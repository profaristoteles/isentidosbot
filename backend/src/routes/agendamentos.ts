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

// POST /api/agendamentos
router.post('/', upload.single('arquivo'), async (req: AuthRequest, res: Response) => {
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
  } = req.body;
  const file = req.file;

  const isRecorrente = recorrente === 'true' || recorrente === true;

  if (!grupo_id) {
    return res.status(400).json({ error: 'O grupo de destino é obrigatório.' });
  }

  if (!isRecorrente && !data_envio) {
    return res.status(400).json({ error: 'Data e hora de envio são obrigatórias para agendamentos não recorrentes.' });
  }

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

    const status = isRecorrente ? 'ativo' : 'pendente';
    const dataEnvioValue = !isRecorrente && data_envio ? data_envio : null;

    const result = await query(
      `INSERT INTO agendamentos (
        grupo_id, arquivo_url, nome_arquivo, tipo_arquivo, mensagem,
        data_envio, recorrente, tipo_recorrencia, dias_semana, intervalo_dias,
        horario, data_fim, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        grupo_id,
        arquivo_url,
        nome_arquivo,
        tipo_arquivo,
        mensagem || '',
        dataEnvioValue,
        isRecorrente,
        isRecorrente ? tipo_recorrencia : null,
        isRecorrente && tipo_recorrencia === 'dias_semana' ? parsedDiasSemana : null,
        isRecorrente && tipo_recorrencia === 'intervalo_dias' ? Number(intervalo_dias) : null,
        isRecorrente ? horario : null,
        isRecorrente && data_fim ? data_fim : null,
        status,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao criar agendamento:', error);
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

    const updatedStatus = status || (isRecorrente ? 'ativo' : 'pendente');
    const dataEnvioValue = !isRecorrente ? (data_envio || current.data_envio) : null;

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
           status = $13,
           erro_mensagem = NULL
       WHERE id = $14
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

