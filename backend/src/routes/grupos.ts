import { Router, Response } from 'express';
import { query } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { fetchGroupsFromEvolution } from '../services/evolution';

const router = Router();

// Proteção global de autenticação
router.use(authMiddleware);

// GET /api/grupos
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT g.*, 
             b.mensagem as boas_vindas_mensagem,
             b.ativo as boas_vindas_ativo,
             (SELECT COUNT(*) FROM agendamentos a WHERE a.grupo_id = g.id AND a.status = 'pendente') as agendamentos_pendentes,
             (SELECT COUNT(*) FROM integracoes i WHERE i.grupo_id = g.id AND i.ativo = true) as integracoes_ativas
      FROM grupos g
      LEFT JOIN boas_vindas b ON b.grupo_id = g.id
      ORDER BY g.nome ASC
    `);
    return res.json(result.rows);
  } catch (error: any) {
    console.error('Erro ao listar grupos:', error);
    return res.status(500).json({ error: 'Erro ao buscar grupos.' });
  }
});

// POST /api/grupos
router.post('/', async (req: AuthRequest, res: Response) => {
  const { nome, jid_whatsapp, ativo } = req.body;

  if (!nome || !jid_whatsapp) {
    return res.status(400).json({ error: 'Nome e JID do WhatsApp são obrigatórios.' });
  }

  try {
    const result = await query(
      `INSERT INTO grupos (nome, jid_whatsapp, ativo) VALUES ($1, $2, $3) RETURNING *`,
      [nome.trim(), jid_whatsapp.trim(), ativo !== undefined ? ativo : true]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Já existe um grupo cadastrado com este JID.' });
    }
    console.error('Erro ao cadastrar grupo:', error);
    return res.status(500).json({ error: 'Erro ao criar grupo.' });
  }
});

// PUT /api/grupos/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { nome, jid_whatsapp, ativo } = req.body;

  try {
    const result = await query(
      `UPDATE grupos SET nome = $1, jid_whatsapp = $2, ativo = $3 WHERE id = $4 RETURNING *`,
      [nome.trim(), jid_whatsapp.trim(), ativo, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Grupo não encontrado.' });
    }

    return res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao atualizar grupo:', error);
    return res.status(500).json({ error: 'Erro ao atualizar grupo.' });
  }
});

// DELETE /api/grupos/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const result = await query('DELETE FROM grupos WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Grupo não encontrado.' });
    }
    return res.json({ message: 'Grupo excluído com sucesso.' });
  } catch (error: any) {
    console.error('Erro ao excluir grupo:', error);
    return res.status(500).json({ error: 'Erro ao excluir grupo.' });
  }
});

// POST /api/grupos/sync - Sincronizar grupos via Evolution API
router.post('/sync', async (req: AuthRequest, res: Response) => {
  try {
    const fetched = await fetchGroupsFromEvolution();
    let importados = 0;

    for (const item of fetched) {
      if (!item.jid) continue;
      const resExist = await query('SELECT id FROM grupos WHERE jid_whatsapp = $1', [item.jid]);
      if (resExist.rowCount === 0) {
        await query(
          'INSERT INTO grupos (nome, jid_whatsapp, ativo) VALUES ($1, $2, true)',
          [item.nome, item.jid]
        );
        importados++;
      }
    }

    return res.json({
      message: `${importados} novo(s) grupo(s) importado(s) da Evolution API.`,
      totalEncontrados: fetched.length,
      importados,
    });
  } catch (error: any) {
    console.error('Erro ao sincronizar grupos:', error);
    return res.status(500).json({ error: 'Erro ao sincronizar grupos da Evolution API.' });
  }
});

export default router;
