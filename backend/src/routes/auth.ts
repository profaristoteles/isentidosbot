import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const userRes = await query('SELECT * FROM usuarios WHERE email = $1', [email.trim().toLowerCase()]);
    if (userRes.rowCount === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(senha, user.senha_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const secret = process.env.JWT_SECRET || 'super-secret-key-isentidos-2026';
    const token = jwt.sign(
      { id: user.id, email: user.email },
      secret,
      { expiresIn: '30d' }
    );

    return res.json({
      token,
      usuario: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error: any) {
    console.error('Erro no login:', error);
    return res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  return res.json({ usuario: req.user });
});

export default router;
