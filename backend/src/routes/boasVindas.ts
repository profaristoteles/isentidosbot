import { Router, Response } from 'express';
import { query } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// GET /api/boas-vindas
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT b.*, g.nome as grupo_nome, g.jid_whatsapp
      FROM boas_vindas b
      JOIN grupos g ON b.grupo_id = g.id
      ORDER BY g.nome ASC
    `);
    return res.json(result.rows);
  } catch (error: any) {
    console.error('Erro ao buscar boas-vindas:', error);
    return res.status(500).json({ error: 'Erro ao buscar mensagens de boas-vindas.' });
  }
});

// POST /api/boas-vindas (Salvar ou Atualizar por grupo)
router.post('/', async (req: AuthRequest, res: Response) => {
  const { grupo_id, mensagem, ativo } = req.body;

  if (!grupo_id || !mensagem) {
    return res.status(400).json({ error: 'Grupo e mensagem são obrigatórios.' });
  }

  try {
    // Upsert (Insere ou atualiza caso já exista mensagem para o grupo)
    const result = await query(
      `INSERT INTO boas_vindas (grupo_id, mensagem, ativo) 
       VALUES ($1, $2, $3)
       ON CONFLICT (grupo_id) 
       DO UPDATE SET mensagem = EXCLUDED.mensagem, ativo = EXCLUDED.ativo
       RETURNING *`,
      [grupo_id, mensagem, ativo !== undefined ? ativo : true]
    );

    return res.status(200).json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao salvar boas-vindas:', error);
    return res.status(500).json({ error: 'Erro ao salvar mensagem de boas-vindas.' });
  }
});

// DELETE /api/boas-vindas/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const result = await query('DELETE FROM boas_vindas WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Mensagem de boas-vindas não encontrada.' });
    }
    return res.json({ message: 'Mensagem de boas-vindas excluída.' });
  } catch (error: any) {
    console.error('Erro ao excluir boas-vindas:', error);
    return res.status(500).json({ error: 'Erro ao excluir mensagem.' });
  }
});

export default router;
