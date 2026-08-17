import { Router, Response } from 'express';
import { query } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { checkInstagramIntegration, checkYouTubeIntegration, checkBlogIntegration } from '../services/cron';

const router = Router();

router.use(authMiddleware);

// GET /api/integracoes
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT i.*, g.nome as grupo_nome, g.jid_whatsapp
      FROM integracoes i
      JOIN grupos g ON i.grupo_id = g.id
      ORDER BY i.criado_em DESC
    `);
    return res.json(result.rows);
  } catch (error: any) {
    console.error('Erro ao buscar integrações:', error);
    return res.status(500).json({ error: 'Erro ao buscar integrações.' });
  }
});

// POST /api/integracoes
router.post('/', async (req: AuthRequest, res: Response) => {
  const { grupo_id, tipo, url_referencia, intervalo_minutos, ativo } = req.body;

  if (!grupo_id || !tipo || !url_referencia) {
    return res.status(400).json({ error: 'Grupo, tipo e URL de referência são obrigatórios.' });
  }

  if (!['youtube', 'instagram', 'blog'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo inválido. Deve ser youtube, instagram ou blog.' });
  }

  try {
    const result = await query(
      `INSERT INTO integracoes (grupo_id, tipo, url_referencia, intervalo_minutos, ativo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [grupo_id, tipo, url_referencia.trim(), intervalo_minutos || 15, ativo !== undefined ? ativo : true]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao criar integração:', error);
    return res.status(500).json({ error: 'Erro ao salvar integração.' });
  }
});

// PUT /api/integracoes/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { grupo_id, tipo, url_referencia, intervalo_minutos, ativo } = req.body;

  try {
    const result = await query(
      `UPDATE integracoes 
       SET grupo_id = $1, tipo = $2, url_referencia = $3, intervalo_minutos = $4, ativo = $5 
       WHERE id = $6 RETURNING *`,
      [grupo_id, tipo, url_referencia.trim(), intervalo_minutos || 15, ativo, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Integração não encontrada.' });
    }

    return res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao atualizar integração:', error);
    return res.status(500).json({ error: 'Erro ao atualizar integração.' });
  }
});

// DELETE /api/integracoes/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const result = await query('DELETE FROM integracoes WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Integração não encontrada.' });
    }
    return res.json({ message: 'Integração excluída.' });
  } catch (error: any) {
    console.error('Erro ao excluir integração:', error);
    return res.status(500).json({ error: 'Erro ao excluir integração.' });
  }
});

// POST /api/integracoes/:id/testar (Executa verificação imediata para testes)
router.post('/:id/testar', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const itemRes = await query(`
      SELECT i.*, g.jid_whatsapp, g.nome as grupo_nome
      FROM integracoes i
      JOIN grupos g ON i.grupo_id = g.id
      WHERE i.id = $1
    `, [id]);

    if (itemRes.rowCount === 0) {
      return res.status(404).json({ error: 'Integração não encontrada.' });
    }

    const integ = itemRes.rows[0];

    if (integ.tipo === 'instagram') {
      await checkInstagramIntegration(integ);
    } else if (integ.tipo === 'youtube') {
      await checkYouTubeIntegration(integ);
    } else if (integ.tipo === 'blog') {
      await checkBlogIntegration(integ);
    }

    return res.json({ message: `Checagem da integração de ${integ.tipo} realizada com sucesso.` });
  } catch (error: any) {
    console.error(`Erro ao testar integração #${id}:`, error);
    return res.status(500).json({ error: `Falha no teste de verificação: ${error.message}` });
  }
});

export default router;
