import { Router, Response } from 'express';
import { query } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { checkInstagramIntegration, checkYouTubeIntegration, checkBlogIntegration, runBackfillForIntegration } from '../services/cron';

const router = Router();

router.use(authMiddleware);

// GET /api/integracoes
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT i.*,
             COALESCE(
               (SELECT json_agg(json_build_object('id', g.id, 'nome', g.nome, 'jid_whatsapp', g.jid_whatsapp))
                FROM integracao_grupos ig
                JOIN grupos g ON ig.grupo_id = g.id
                WHERE ig.integracao_id = i.id), '[]'::json
             ) as grupos,
             COALESCE(
               (SELECT array_agg(ig.grupo_id)
                FROM integracao_grupos ig
                WHERE ig.integracao_id = i.id), ARRAY[]::integer[]
             ) as grupo_ids,
             COALESCE((SELECT COUNT(*) FROM fila_conteudo f WHERE f.integracao_id = i.id AND f.status = 'pendente'), 0)::int as itens_pendentes
      FROM integracoes i
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
  const { grupo_ids, grupo_id, tipo, url_referencia, intervalo_minutos, ativo, gotejamento_quantidade, gotejamento_periodo } = req.body;

  let targetGrupoIds: number[] = [];
  if (Array.isArray(grupo_ids)) {
    targetGrupoIds = grupo_ids.map((id: any) => Number(id)).filter((id: number) => !isNaN(id));
  } else if (grupo_id) {
    targetGrupoIds = [Number(grupo_id)];
  }

  if (targetGrupoIds.length === 0 || !tipo || !url_referencia) {
    return res.status(400).json({ error: 'Ao menos um grupo, tipo e URL de referência são obrigatórios.' });
  }

  if (!['youtube', 'instagram', 'blog'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo inválido. Deve ser youtube, instagram ou blog.' });
  }

  try {
    const primaryGrupoId = targetGrupoIds[0];
    const result = await query(
      `INSERT INTO integracoes (grupo_id, tipo, url_referencia, intervalo_minutos, ativo, gotejamento_quantidade, gotejamento_periodo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        primaryGrupoId,
        tipo,
        url_referencia.trim(),
        intervalo_minutos || 15,
        ativo !== undefined ? ativo : true,
        gotejamento_quantidade || 1,
        gotejamento_periodo || 'dia',
      ]
    );

    const createdInteg = result.rows[0];

    // Inserir vínculos na tabela integracao_grupos
    for (const gid of targetGrupoIds) {
      await query(
        `INSERT INTO integracao_grupos (integracao_id, grupo_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [createdInteg.id, gid]
      );
    }

    return res.status(201).json({ ...createdInteg, grupo_ids: targetGrupoIds });
  } catch (error: any) {
    console.error('Erro ao criar integração:', error);
    return res.status(500).json({ error: 'Erro ao salvar integração.' });
  }
});

// PUT /api/integracoes/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { grupo_ids, grupo_id, tipo, url_referencia, intervalo_minutos, ativo, gotejamento_quantidade, gotejamento_periodo } = req.body;

  let targetGrupoIds: number[] = [];
  if (Array.isArray(grupo_ids)) {
    targetGrupoIds = grupo_ids.map((gid: any) => Number(gid)).filter((gid: number) => !isNaN(gid));
  } else if (grupo_id) {
    targetGrupoIds = [Number(grupo_id)];
  }

  if (targetGrupoIds.length === 0 || !tipo || !url_referencia) {
    return res.status(400).json({ error: 'Ao menos um grupo, tipo e URL de referência são obrigatórios.' });
  }

  try {
    const primaryGrupoId = targetGrupoIds[0];
    const result = await query(
      `UPDATE integracoes 
       SET grupo_id = $1, tipo = $2, url_referencia = $3, intervalo_minutos = $4, ativo = $5,
           gotejamento_quantidade = $6, gotejamento_periodo = $7
       WHERE id = $8 RETURNING *`,
      [
        primaryGrupoId,
        tipo,
        url_referencia.trim(),
        intervalo_minutos || 15,
        ativo,
        gotejamento_quantidade || 1,
        gotejamento_periodo || 'dia',
        id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Integração não encontrada.' });
    }

    // Sincronizar tabela de junção integracao_grupos
    await query(`DELETE FROM integracao_grupos WHERE integracao_id = $1`, [id]);
    for (const gid of targetGrupoIds) {
      await query(
        `INSERT INTO integracao_grupos (integracao_id, grupo_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [id, gid]
      );
    }

    return res.json({ ...result.rows[0], grupo_ids: targetGrupoIds });
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

// POST /api/integracoes/:id/backfill (Executa busca retroativa de novos itens para a fila de gotejamento)
router.post('/:id/backfill', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const itemRes = await query(`SELECT * FROM integracoes WHERE id = $1`, [id]);

    if (itemRes.rowCount === 0) {
      return res.status(404).json({ error: 'Integração não encontrada.' });
    }

    const integ = itemRes.rows[0];
    const { itensAdicionados } = await runBackfillForIntegration(integ);

    return res.json({
      message: `Backfill concluído! ${itensAdicionados} novo(s) item(ns) adicionado(s) à fila de gotejamento.`,
      itens_adicionados: itensAdicionados,
    });
  } catch (error: any) {
    console.error(`Erro ao realizar backfill da integração #${id}:`, error);
    return res.status(500).json({ error: `Falha ao executar backfill: ${error.message}` });
  }
});

// POST /api/integracoes/:id/testar (Executa verificação imediata para testes)
router.post('/:id/testar', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const itemRes = await query(`SELECT * FROM integracoes WHERE id = $1`, [id]);

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

    return res.json({ message: `Checagem da integração de ${integ.tipo} realizada com sucesso para todos os grupos vinculados.` });
  } catch (error: any) {
    console.error(`Erro ao testar integração #${id}:`, error);
    return res.status(500).json({ error: `Falha no teste de verificação: ${error.message}` });
  }
});

export default router;
