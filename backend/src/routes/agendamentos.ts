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
      ORDER BY a.data_envio DESC
    `);
    return res.json(result.rows);
  } catch (error: any) {
    console.error('Erro ao buscar agendamentos:', error);
    return res.status(500).json({ error: 'Erro ao buscar agendamentos.' });
  }
});

// POST /api/agendamentos
router.post('/', upload.single('arquivo'), async (req: AuthRequest, res: Response) => {
  const { grupo_id, mensagem, data_envio } = req.body;
  const file = req.file;

  if (!grupo_id || !data_envio) {
    return res.status(400).json({ error: 'Grupo e data/hora de envio são obrigatórios.' });
  }

  try {
    let arquivo_url = '';
    let nome_arquivo = '';
    let tipo_arquivo = '';

    if (file) {
      // Gerar URL pública/estática acessível para a Evolution API enviar
      const host = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      arquivo_url = `${host}/uploads/${file.filename}`;
      nome_arquivo = file.originalname;
      tipo_arquivo = file.mimetype;
    }

    // Persistir no banco com TIMESTAMPTZ garantindo fuso America/Fortaleza
    const result = await query(
      `INSERT INTO agendamentos (grupo_id, arquivo_url, nome_arquivo, tipo_arquivo, mensagem, data_envio, status)
       VALUES ($1, $2, $3, $4, $5, $6::timestamptz, 'pendente')
       RETURNING *`,
      [grupo_id, arquivo_url, nome_arquivo, tipo_arquivo, mensagem || '', data_envio]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao criar agendamento:', error);
    return res.status(500).json({ error: 'Erro ao salvar agendamento.' });
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

    await query(`UPDATE agendamentos SET status = 'enviado', erro_mensagem = NULL WHERE id = $1`, [id]);
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
