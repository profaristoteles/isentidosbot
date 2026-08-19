import { Router, Response } from 'express';
import { query } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// GET /api/boas-vindas
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT b.*,
             COALESCE(
               (SELECT json_agg(json_build_object('id', g.id, 'nome', g.nome, 'jid_whatsapp', g.jid_whatsapp))
                FROM boas_vindas_grupos bvg
                JOIN grupos g ON bvg.grupo_id = g.id
                WHERE bvg.boas_vindas_id = b.id), '[]'::json
             ) as grupos,
             COALESCE(
               (SELECT array_agg(bvg.grupo_id)
                FROM boas_vindas_grupos bvg
                WHERE bvg.boas_vindas_id = b.id), ARRAY[]::integer[]
             ) as grupo_ids
      FROM boas_vindas b
      ORDER BY b.criado_em DESC
    `);
    return res.json(result.rows);
  } catch (error: any) {
    console.error('Erro ao buscar boas-vindas:', error);
    return res.status(500).json({ error: 'Erro ao buscar mensagens de boas-vindas.' });
  }
});

// POST /api/boas-vindas (Salvar nova mensagem de boas-vindas)
router.post('/', async (req: AuthRequest, res: Response) => {
  const { grupo_ids, grupo_id, mensagem, ativo } = req.body;

  let targetGrupoIds: number[] = [];
  if (Array.isArray(grupo_ids)) {
    targetGrupoIds = grupo_ids.map((gid: any) => Number(gid)).filter((gid: number) => !isNaN(gid));
  } else if (grupo_id) {
    targetGrupoIds = [Number(grupo_id)];
  }

  if (targetGrupoIds.length === 0 || !mensagem) {
    return res.status(400).json({ error: 'Ao menos um grupo e a mensagem são obrigatórios.' });
  }

  try {
    const primaryGrupoId = targetGrupoIds[0];
    const result = await query(
      `INSERT INTO boas_vindas (grupo_id, mensagem, ativo)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [primaryGrupoId, mensagem.trim(), ativo !== undefined ? ativo : true]
    );

    const createdBv = result.rows[0];

    // Inserir vínculos na tabela boas_vindas_grupos
    for (const gid of targetGrupoIds) {
      await query(
        `INSERT INTO boas_vindas_grupos (boas_vindas_id, grupo_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [createdBv.id, gid]
      );
    }

    // Retornar a mensagem criada com seus vínculos completos
    const fullRes = await query(
      `SELECT b.*,
              COALESCE(
                (SELECT json_agg(json_build_object('id', g.id, 'nome', g.nome, 'jid_whatsapp', g.jid_whatsapp))
                 FROM boas_vindas_grupos bvg
                 JOIN grupos g ON bvg.grupo_id = g.id
                 WHERE bvg.boas_vindas_id = b.id), '[]'::json
              ) as grupos,
              COALESCE(
                (SELECT array_agg(bvg.grupo_id)
                 FROM boas_vindas_grupos bvg
                 WHERE bvg.boas_vindas_id = b.id), ARRAY[]::integer[]
              ) as grupo_ids
       FROM boas_vindas b
       WHERE b.id = $1`,
      [createdBv.id]
    );

    return res.status(201).json(fullRes.rows[0]);
  } catch (error: any) {
    console.error('Erro ao salvar boas-vindas:', error);
    return res.status(500).json({ error: 'Erro ao salvar mensagem de boas-vindas.' });
  }
});

// PUT /api/boas-vindas/:id (Atualizar mensagem existente por ID)
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { grupo_ids, grupo_id, mensagem, ativo } = req.body;

  let targetGrupoIds: number[] = [];
  if (Array.isArray(grupo_ids)) {
    targetGrupoIds = grupo_ids.map((gid: any) => Number(gid)).filter((gid: number) => !isNaN(gid));
  } else if (grupo_id) {
    targetGrupoIds = [Number(grupo_id)];
  }

  if (targetGrupoIds.length === 0 || !mensagem) {
    return res.status(400).json({ error: 'Ao menos um grupo e a mensagem são obrigatórios.' });
  }

  try {
    const primaryGrupoId = targetGrupoIds[0];
    const result = await query(
      `UPDATE boas_vindas
       SET grupo_id = $1, mensagem = $2, ativo = $3
       WHERE id = $4 RETURNING *`,
      [primaryGrupoId, mensagem.trim(), ativo !== undefined ? ativo : true, id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Mensagem de boas-vindas não encontrada.' });
    }

    // Sincronizar tabela de junção boas_vindas_grupos
    await query(`DELETE FROM boas_vindas_grupos WHERE boas_vindas_id = $1`, [id]);
    for (const gid of targetGrupoIds) {
      await query(
        `INSERT INTO boas_vindas_grupos (boas_vindas_id, grupo_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [id, gid]
      );
    }

    const fullRes = await query(
      `SELECT b.*,
              COALESCE(
                (SELECT json_agg(json_build_object('id', g.id, 'nome', g.nome, 'jid_whatsapp', g.jid_whatsapp))
                 FROM boas_vindas_grupos bvg
                 JOIN grupos g ON bvg.grupo_id = g.id
                 WHERE bvg.boas_vindas_id = b.id), '[]'::json
              ) as grupos,
              COALESCE(
                (SELECT array_agg(bvg.grupo_id)
                 FROM boas_vindas_grupos bvg
                 WHERE bvg.boas_vindas_id = b.id), ARRAY[]::integer[]
              ) as grupo_ids
       FROM boas_vindas b
       WHERE b.id = $1`,
      [id]
    );

    return res.json(fullRes.rows[0]);
  } catch (error: any) {
    console.error('Erro ao atualizar boas-vindas:', error);
    return res.status(500).json({ error: 'Erro ao atualizar mensagem de boas-vindas.' });
  }
});

// DELETE /api/boas-vindas/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const result = await query('DELETE FROM boas_vindas WHERE id = $1 RETURNING *', [id]);
    if (!result.rowCount) {
      return res.status(404).json({ error: 'Mensagem de boas-vindas não encontrada.' });
    }
    return res.json({ message: 'Mensagem de boas-vindas excluída.' });
  } catch (error: any) {
    console.error('Erro ao excluir boas-vindas:', error);
    return res.status(500).json({ error: 'Erro ao excluir mensagem.' });
  }
});

export default router;
