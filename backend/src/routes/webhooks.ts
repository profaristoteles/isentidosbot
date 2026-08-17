import { Router, Request, Response } from 'express';
import { query } from '../db';
import { webhookSecretMiddleware } from '../middleware/webhookSecret';
import { sendTextMessage } from '../services/evolution';

const router = Router();

// Aplicar Middleware de Segurança (Validação de EVOLUTION_WEBHOOK_SECRET -> HTTP 401 se inválido)
router.use(webhookSecretMiddleware);

// POST /api/webhooks/evolution
router.post('/evolution', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const event = body?.event || body?.type;

    // Verificar se é um evento de atualização de participantes do grupo
    const isParticipantUpdate = 
      event === 'group-participants.update' || 
      event === 'GROUP_PARTICIPANTS_UPDATE' ||
      body?.data?.action === 'add';

    if (!isParticipantUpdate) {
      // Outros eventos recebidos são ignorados pacificamente com status 200
      return res.status(200).json({ status: 'ignored', reason: 'Evento não aplicável para boas-vindas' });
    }

    const data = body?.data || body;
    const action = data?.action;

    // Apenas ação de entrada/adição ('add')
    if (action && action !== 'add') {
      return res.status(200).json({ status: 'ignored', reason: 'Ação não é de entrada no grupo' });
    }

    const groupJid = data?.id || data?.groupJid || data?.jid;
    const participants: string[] = data?.participants || [];

    if (!groupJid || participants.length === 0) {
      return res.status(400).json({ error: 'Payload de webhook inválido: JID ou participantes ausentes' });
    }

    console.log(`📥 [Webhook] Novo participante detectado no grupo ${groupJid}:`, participants);

    // Buscar grupo no banco de dados
    const grupoRes = await query('SELECT * FROM grupos WHERE jid_whatsapp = $1 AND ativo = true', [groupJid]);
    if (grupoRes.rowCount === 0) {
      console.log(`ℹ️ [Webhook] Grupo ${groupJid} não está cadastrado ou ativo no sistema.`);
      return res.status(200).json({ status: 'ignored', reason: 'Grupo não cadastrado ou inativo' });
    }

    const grupo = grupoRes.rows[0];

    // Buscar mensagem de boas-vindas para este grupo
    const bvRes = await query('SELECT * FROM boas_vindas WHERE grupo_id = $1 AND ativo = true', [grupo.id]);
    if (bvRes.rowCount === 0) {
      console.log(`ℹ️ [Webhook] Nenhuma mensagem de boas-vindas ativa para o grupo "${grupo.nome}".`);
      return res.status(200).json({ status: 'ignored', reason: 'Mensagem de boas-vindas não cadastrada ou inativa' });
    }

    const boasVindas = bvRes.rows[0];

    for (const participantJid of participants) {
      // Extrair número limpo
      const rawNumber = participantJid.split('@')[0];
      const pushName = data?.pushName || data?.notify || rawNumber;
      
      // Substituir variáveis dinâmicas no template
      let message = boasVindas.mensagem;
      message = message.replace(/\{nome\}/g, pushName);
      message = message.replace(/\{pushName\}/g, pushName);
      message = message.replace(/\{numero\}/g, rawNumber);
      message = message.replace(/\{grupo\}/g, grupo.nome);

      // Disparar mensagem de boas-vindas via Evolution API
      await sendTextMessage(groupJid, message);

      // Registrar histórico no log
      await query(
        `INSERT INTO logs (tipo_evento, grupo_id, detalhe, status) VALUES ($1, $2, $3, $4)`,
        [
          'boas_vindas',
          grupo.id,
          `Boas-vindas enviada para ${pushName} (${rawNumber}) no grupo "${grupo.nome}"`,
          'sucesso',
        ]
      );

      console.log(`✅ [Webhook] Mensagem de boas-vindas enviada para ${pushName} no grupo "${grupo.nome}"`);
    }

    return res.status(200).json({ status: 'success', message: 'Boas-vindas enviada(s) com sucesso' });
  } catch (error: any) {
    console.error('❌ [Webhook Error]:', error);
    
    // Tentar gravar erro no log
    try {
      await query(
        `INSERT INTO logs (tipo_evento, detalhe, status) VALUES ($1, $2, $3)`,
        ['boas_vindas', `Falha ao processar webhook de boas-vindas: ${error.message}`, 'erro']
      );
    } catch (_) {}

    return res.status(500).json({ error: 'Erro interno ao processar webhook' });
  }
});

export default router;
