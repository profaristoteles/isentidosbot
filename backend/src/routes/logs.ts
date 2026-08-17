import { Router, Response } from 'express';
import { query } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// GET /api/logs
router.get('/', async (req: AuthRequest, res: Response) => {
  const { tipo, status, limit = 100 } = req.query;

  try {
    let sql = `
      SELECT l.*, g.nome as grupo_nome
      FROM logs l
      LEFT JOIN grupos g ON l.grupo_id = g.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (tipo) {
      params.push(tipo);
      sql += ` AND l.tipo_evento = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND l.status = $${params.length}`;
    }

    params.push(Math.min(Number(limit) || 100, 500));
    sql += ` ORDER BY l.criado_em DESC LIMIT $${params.length}`;

    const result = await query(sql, params);
    return res.json(result.rows);
  } catch (error: any) {
    console.error('Erro ao listar logs:', error);
    return res.status(500).json({ error: 'Erro ao buscar histórico de logs.' });
  }
});

// DELETE /api/logs/limpar
router.delete('/limpar', async (req: AuthRequest, res: Response) => {
  try {
    await query('DELETE FROM logs');
    return res.json({ message: 'Todos os registros de logs foram limpos.' });
  } catch (error: any) {
    console.error('Erro ao limpar logs:', error);
    return res.status(500).json({ error: 'Erro ao limpar logs.' });
  }
});

export default router;
