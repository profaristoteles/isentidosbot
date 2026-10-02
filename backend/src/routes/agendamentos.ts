import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendMediaMessage, sendTextMessage } from '../services/evolution';

const router = Router();

// Configuração do Multer para upload de mídias (PDF, Imagens, Documentos)
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // Limite 50MB
});

router.use(authMiddleware);

// GET /api/agendamentos
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT a.*, g.nome as grupo_nome, g.jid_whatsapp
      FROM agendamentos a
      JOIN grupos g ON a.grupo_id = g.id
      ORDER BY COALESCE(a.data_envio, a.criado_em) DESC
    `);
    return res.json(result.rows);
  } catch (error: any) {
    console.error('Erro ao buscar agendamentos:', error);
    return res.status(500).json({ error: 'Erro ao buscar agendamentos.' });
  }
});

// Função auxiliar para processar lote de envio imediato em segundo plano com delay anti-bloqueio
async function dispatchImmediateBatch(items: any[], delaySeconds: number) {
  console.log(`🚀 [Disparo Imediato] Iniciando lote de ${items.length} grupo(s) com delay anti-bloqueio de ${delaySeconds}s...`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      // Obter informações do grupo
      const groupRes = await query(`SELECT nome, jid_whatsapp FROM grupos WHERE id = $1`, [item.grupo_id]);
      if (groupRes.rowCount === 0) {
        throw new Error('Grupo não cadastrado ou removido.');
      }
      const group = groupRes.rows[0];

      // Disparar via Evolution API
      let response;
      if (item.arquivo_url && item.arquivo_url.trim() !== '') {
        response = await sendMediaMessage(
          group.jid_whatsapp,
          item.arquivo_url,
          item.nome_arquivo || 'arquivo.pdf',
          item.mensagem || ''
        );
      } else if (item.mensagem) {
        response = await sendTextMessage(group.jid_whatsapp, item.mensagem);
      }

      // Marcar como enviado
      await query(`UPDATE agendamentos SET status = 'enviado', erro_mensagem = NULL WHERE id = $1`, [item.id]);

      // Registrar log de sucesso
      await query(
        `INSERT INTO logs (tipo_evento, grupo_id, detalhe, status) VALUES ($1, $2, $3, $4)`,
        [
          'agendamento',
          item.grupo_id,
          `Envio imediato #${item.id} ("${item.nome_arquivo || 'Texto'}") entregue com sucesso para o grupo "${group.nome}"`,
          'sucesso',
        ]
      );
      console.log(`✅ [Disparo Imediato] Grupo ${i + 1}/${items.length} ("${group.nome}") enviado com sucesso.`);
    } catch (err: any) {
      const errorMsg = err?.message || 'Erro no envio da mensagem';
      console.error(`❌ [Disparo Imediato] Falha ao enviar para grupo_id ${item.grupo_id}:`, errorMsg);
      await query(`UPDATE agendamentos SET status = 'erro', erro_mensagem = $1 WHERE id = $2`, [errorMsg, item.id]);
      await query(
        `INSERT INTO logs (tipo_evento, grupo_id, detalhe, status) VALUES ($1, $2, $3, $4)`,
        [
          'agendamento',
          item.grupo_id,
          `Falha no envio imediato #${item.id}: ${errorMsg}`,
          'erro',
        ]
      );
    }

    // Se houver mais grupos no lote, aguardar a pausa anti-bloqueio com variação natural (jitter)
    if (i < items.length - 1) {
      const jitter = (Math.random() * 3) - 1; // Variação humana entre -1s e +2s
      const waitSec = Math.max(3, delaySeconds + jitter);
      console.log(`⏳ [Anti-Bloqueio] Aguardando ${waitSec.toFixed(1)}s antes de disparar para o próximo grupo (${i + 2}/${items.length})...`);
      await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
    }
  }
  console.log(`🏁 [Disparo Imediato] Lote finalizado para todos os ${items.length} grupos.`);
}

// POST /api/agendamentos (Suporta grupo único ou múltiplos grupos, agendamento ou disparo imediato com delay anti-bloqueio)
router.post('/', upload.single('arquivo'), async (req: AuthRequest, res: Response) => {
  const {
    grupo_id,
    grupo_ids,
    mensagem,
    data_envio,
    recorrente,
    tipo_recorrencia,
    dias_semana,
    intervalo_dias,
    horario,
    data_fim,
    intervalo_envio_segundos,
    envio_imediato,
  } = req.body;
  const file = req.file;

  const isRecorrente = recorrente === 'true' || recorrente === true;
  const isEnvioImediato = envio_imediato === 'true' || envio_imediato === true;

  // Extrair lista de IDs de grupos
  let targetGrupoIds: number[] = [];
  if (grupo_ids) {
    if (Array.isArray(grupo_ids)) {
      targetGrupoIds = grupo_ids.map(Number).filter((n: number) => !isNaN(n));
    } else if (typeof grupo_ids === 'string') {
      try {
        const parsed = JSON.parse(grupo_ids);
        if (Array.isArray(parsed)) {
          targetGrupoIds = parsed.map(Number).filter((n: number) => !isNaN(n));
        } else {
          targetGrupoIds = [Number(parsed)].filter((n: number) => !isNaN(n));
        }
      } catch (_) {
        targetGrupoIds = grupo_ids.split(',').map((s: string) => Number(s.trim())).filter((n: number) => !isNaN(n));
      }
    }
  } else if (grupo_id) {
    targetGrupoIds = [Number(grupo_id)].filter((n: number) => !isNaN(n));
  }

  if (targetGrupoIds.length === 0) {
    return res.status(400).json({ error: 'Ao menos um grupo de destino é obrigatório.' });
  }

  if (!isRecorrente && !isEnvioImediato && !data_envio) {
    return res.status(400).json({ error: 'Data e hora de envio são obrigatórias para agendamentos não imediatos.' });
  }

  const rawIntervalo = Number(intervalo_envio_segundos);
  const intervaloEnvioSegundos = (!isNaN(rawIntervalo) && rawIntervalo >= 3) ? Math.min(rawIntervalo, 3600) : 15;

  let parsedDiasSemana: number[] | null = null;
  if (isRecorrente) {
    if (!tipo_recorrencia || !horario) {
      return res.status(400).json({ error: 'Tipo de recorrência e horário são obrigatórios para agendamentos recorrentes.' });
    }
    if (tipo_recorrencia === 'dias_semana') {
      if (typeof dias_semana === 'string') {
        try {
          parsedDiasSemana = JSON.parse(dias_semana);
        } catch (_) {
          parsedDiasSemana = null;
        }
      } else if (Array.isArray(dias_semana)) {
        parsedDiasSemana = dias_semana.map(Number);
      }
      if (!parsedDiasSemana || !Array.isArray(parsedDiasSemana) || parsedDiasSemana.length === 0) {
        return res.status(400).json({ error: 'Selecione pelo menos um dia da semana.' });
      }
    } else if (tipo_recorrencia === 'intervalo_dias') {
      const intervalNum = Number(intervalo_dias);
      if (isNaN(intervalNum) || intervalNum < 1) {
        return res.status(400).json({ error: 'Informe um intervalo de dias válido (mínimo 1).' });
      }
    } else {
      return res.status(400).json({ error: 'Tipo de recorrência inválido.' });
    }
  }

  try {
    let arquivo_url = '';
    let nome_arquivo = '';
    let tipo_arquivo = '';

    if (file) {
      const host = process.env.BACKEND_PUBLIC_URL || 'http://localhost:5000';
      arquivo_url = `${host}/uploads/${file.filename}`;
      nome_arquivo = file.originalname;
      tipo_arquivo = file.mimetype;
    }

    const loteId = `lote_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const createdRows: any[] = [];

    if (isEnvioImediato) {
      // 1. DISPARO IMEDIATO MULTI-GRUPOS COM CONTROLE DE TEMPO
      for (const gid of targetGrupoIds) {
        const insertRes = await query(
          `INSERT INTO agendamentos (
            grupo_id, arquivo_url, nome_arquivo, tipo_arquivo, mensagem,
            data_envio, recorrente, intervalo_envio_segundos, lote_id, status
           )
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, false, $6, $7, 'processando')
           RETURNING *`,
          [
            gid,
            arquivo_url,
            nome_arquivo,
            tipo_arquivo,
            mensagem || '',
            intervaloEnvioSegundos,
            loteId,
          ]
        );
        createdRows.push(insertRes.rows[0]);
      }

      // Iniciar disparador em segundo plano com delay seguro entre grupos
      setImmediate(() => {
        dispatchImmediateBatch(createdRows, intervaloEnvioSegundos);
      });

      return res.status(201).json({
        message: `Disparo imediato iniciado para ${createdRows.length} grupo(s) com intervalo de ${intervaloEnvioSegundos}s.`,
        lote_id: loteId,
        count: createdRows.length,
        items: createdRows,
      });

    } else if (isRecorrente) {
      // 2. AGENDAMENTO RECORRENTE MULTI-GRUPOS
      for (const gid of targetGrupoIds) {
        const insertRes = await query(
          `INSERT INTO agendamentos (
            grupo_id, arquivo_url, nome_arquivo, tipo_arquivo, mensagem,
            data_envio, recorrente, tipo_recorrencia, dias_semana, intervalo_dias,
            horario, data_fim, intervalo_envio_segundos, lote_id, status
           )
           VALUES ($1, $2, $3, $4, $5, NULL, true, $6, $7, $8, $9, $10, $11, $12, 'ativo')
           RETURNING *`,
          [
            gid,
            arquivo_url,
            nome_arquivo,
            tipo_arquivo,
            mensagem || '',
            tipo_recorrencia,
            tipo_recorrencia === 'dias_semana' ? parsedDiasSemana : null,
            tipo_recorrencia === 'intervalo_dias' ? Number(intervalo_dias) : null,
            horario,
            data_fim || null,
            intervaloEnvioSegundos,
            loteId,
          ]
        );
        createdRows.push(insertRes.rows[0]);
      }

      return res.status(201).json(createdRows.length === 1 ? createdRows[0] : createdRows);

    } else {
      // 3. AGENDAMENTO PONTUAL MULTI-GRUPOS COM HORÁRIOS ESCALONADOS (STAGGERED DELAY)
      let baseDate: Date;
      if (typeof data_envio === 'string' && !data_envio.includes('Z') && !data_envio.includes('+') && !data_envio.includes('-03')) {
        // Se vier como formato datetime-local "YYYY-MM-DDTHH:mm", garantir fuso oficial de Fortaleza (UTC-3)
        baseDate = new Date(`${data_envio}:00-03:00`);
      } else {
        baseDate = new Date(data_envio);
      }

      for (let i = 0; i < targetGrupoIds.length; i++) {
        const gid = targetGrupoIds[i];
        // Escalonar o data_envio com o intervalo anti-bloqueio para cada grupo seguinte
        const staggeredDate = new Date(baseDate.getTime() + (i * intervaloEnvioSegundos * 1000));
        const staggeredIso = staggeredDate.toISOString();

        const insertRes = await query(
          `INSERT INTO agendamentos (
            grupo_id, arquivo_url, nome_arquivo, tipo_arquivo, mensagem,
            data_envio, recorrente, intervalo_envio_segundos, lote_id, status
           )
           VALUES ($1, $2, $3, $4, $5, $6, false, $7, $8, 'pendente')
           RETURNING *`,
          [
            gid,
            arquivo_url,
            nome_arquivo,
            tipo_arquivo,
            mensagem || '',
            staggeredIso,
            intervaloEnvioSegundos,
            loteId,
          ]
        );
        createdRows.push(insertRes.rows[0]);
      }

      return res.status(201).json(createdRows.length === 1 ? createdRows[0] : createdRows);
    }
  } catch (error: any) {
    console.error('Erro ao criar agendamento(s):', error);
    return res.status(500).json({ error: 'Erro ao salvar agendamento.' });
  }
});

// PUT /api/agendamentos/:id
router.put('/:id', upload.single('arquivo'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    grupo_id,
    mensagem,
    data_envio,
    recorrente,
    tipo_recorrencia,
    dias_semana,
    intervalo_dias,
    horario,
    data_fim,
    status,
  } = req.body;
  const file = req.file;

  try {
    const checkRes = await query('SELECT * FROM agendamentos WHERE id = $1', [id]);
    if (checkRes.rowCount === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }
    const current = checkRes.rows[0];

    const isRecorrente = recorrente !== undefined 
      ? (recorrente === 'true' || recorrente === true)
      : current.recorrente;

    let parsedDiasSemana: number[] | null = current.dias_semana;
    if (isRecorrente && (tipo_recorrencia === 'dias_semana' || current.tipo_recorrencia === 'dias_semana')) {
      if (typeof dias_semana === 'string') {
        try {
          parsedDiasSemana = JSON.parse(dias_semana);
        } catch (_) {
          parsedDiasSemana = current.dias_semana;
        }
      } else if (Array.isArray(dias_semana)) {
        parsedDiasSemana = dias_semana.map(Number);
      }
    }

    let arquivo_url = current.arquivo_url;
    let nome_arquivo = current.nome_arquivo;
    let tipo_arquivo = current.tipo_arquivo;

    if (file) {
      const host = process.env.BACKEND_PUBLIC_URL || 'http://localhost:5000';
      arquivo_url = `${host}/uploads/${file.filename}`;
      nome_arquivo = file.originalname;
      tipo_arquivo = file.mimetype;
    }

    const rawIntervalo = Number(req.body.intervalo_envio_segundos);
    const updatedIntervalo = !isNaN(rawIntervalo) && rawIntervalo >= 3 
      ? Math.min(rawIntervalo, 3600) 
      : (current.intervalo_envio_segundos || 15);

    const updatedStatus = status || (isRecorrente ? 'ativo' : 'pendente');
    let dataEnvioValue: string | null = null;
    if (!isRecorrente) {
      const rawDt = data_envio || current.data_envio;
      if (rawDt) {
        if (typeof rawDt === 'string' && !rawDt.includes('Z') && !rawDt.includes('+') && !rawDt.includes('-03')) {
          dataEnvioValue = new Date(`${rawDt}:00-03:00`).toISOString();
        } else {
          dataEnvioValue = new Date(rawDt).toISOString();
        }
      }
    }

    const result = await query(
      `UPDATE agendamentos
       SET grupo_id = $1,
           arquivo_url = $2,
           nome_arquivo = $3,
           tipo_arquivo = $4,
           mensagem = $5,
           data_envio = $6,
           recorrente = $7,
           tipo_recorrencia = $8,
           dias_semana = $9,
           intervalo_dias = $10,
           horario = $11,
           data_fim = $12,
           intervalo_envio_segundos = $13,
           status = $14,
           erro_mensagem = NULL
       WHERE id = $15
       RETURNING *`,
      [
        grupo_id || current.grupo_id,
        arquivo_url,
        nome_arquivo,
        tipo_arquivo,
        mensagem !== undefined ? mensagem : current.mensagem,
        dataEnvioValue,
        isRecorrente,
        isRecorrente ? (tipo_recorrencia || current.tipo_recorrencia) : null,
        isRecorrente && (tipo_recorrencia || current.tipo_recorrencia) === 'dias_semana' ? parsedDiasSemana : null,
        isRecorrente && (tipo_recorrencia || current.tipo_recorrencia) === 'intervalo_dias' ? Number(intervalo_dias || current.intervalo_dias) : null,
        isRecorrente ? (horario || current.horario) : null,
        isRecorrente ? (data_fim !== undefined ? data_fim : current.data_fim) : null,
        updatedIntervalo,
        updatedStatus,
        id,
      ]
    );

    return res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao atualizar agendamento:', error);
    return res.status(500).json({ error: 'Erro ao atualizar agendamento.' });
  }
});

// POST /api/agendamentos/:id/reenviar (Disparo imediato / reenvio manual)
router.post('/:id/reenviar', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const itemRes = await query(`
      SELECT a.*, g.jid_whatsapp, g.nome as grupo_nome
      FROM agendamentos a
      JOIN grupos g ON a.grupo_id = g.id
      WHERE a.id = $1
    `, [id]);

    if (itemRes.rowCount === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }

    const item = itemRes.rows[0];

    let response;
    if (item.arquivo_url && item.arquivo_url.trim() !== '') {
      response = await sendMediaMessage(
        item.jid_whatsapp,
        item.arquivo_url,
        item.nome_arquivo || 'arquivo.pdf',
        item.mensagem || ''
      );
    } else if (item.mensagem) {
      response = await sendTextMessage(item.jid_whatsapp, item.mensagem);
    } else {
      return res.status(400).json({ error: 'Agendamento sem mídia ou texto para enviar.' });
    }

    const updatedStatus = item.recorrente ? 'ativo' : 'enviado';
    await query(`UPDATE agendamentos SET status = $1, erro_mensagem = NULL WHERE id = $2`, [updatedStatus, id]);
    await query(
      `INSERT INTO logs (tipo_evento, grupo_id, detalhe, status) VALUES ($1, $2, $3, $4)`,
      ['agendamento', item.grupo_id, `Reenvio manual do agendamento #${id} executado com sucesso.`, 'sucesso']
    );

    return res.json({ message: 'Agendamento reenviado com sucesso!', response });
  } catch (error: any) {
    const errorMsg = error?.message || 'Falha no disparo manual';
    await query(`UPDATE agendamentos SET status = 'erro', erro_mensagem = $1 WHERE id = $2`, [errorMsg, id]);
    await query(
      `INSERT INTO logs (tipo_evento, grupo_id, detalhe, status) VALUES ($1, $2, $3, $4)`,
      ['agendamento', null, `Falha no reenvio manual do agendamento #${id}: ${errorMsg}`, 'erro']
    );
    return res.status(500).json({ error: `Falha ao enviar: ${errorMsg}` });
  }
});

// POST /api/agendamentos/bulk-delete (Exclusão em massa)
router.post('/bulk-delete', async (req: AuthRequest, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'IDs são obrigatórios.' });
  }

  try {
    const result = await query(`DELETE FROM agendamentos WHERE id = ANY($1::int[]) RETURNING id`, [ids]);
    return res.json({ message: `${result.rowCount} agendamento(s) cancelado(s) com sucesso.`, deletedCount: result.rowCount });
  } catch (error: any) {
    console.error('Erro ao excluir agendamentos em massa:', error);
    return res.status(500).json({ error: 'Erro ao excluir agendamentos.' });
  }
});

// DELETE /api/agendamentos/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const result = await query('DELETE FROM agendamentos WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }
    return res.json({ message: 'Agendamento excluído.' });
  } catch (error: any) {
    console.error('Erro ao excluir agendamento:', error);
    return res.status(500).json({ error: 'Erro ao excluir agendamento.' });
  }
});

export default router;

