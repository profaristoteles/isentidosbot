import dotenv from 'dotenv';
dotenv.config();

// Garantir fuso horário oficial America/Fortaleza em toda a aplicação Node
process.env.TZ = 'America/Fortaleza';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';

import { initDb, query } from './db';
import { initCronJobs } from './services/cron';

import authRoutes from './routes/auth';
import gruposRoutes from './routes/grupos';
import boasVindasRoutes from './routes/boasVindas';
import agendamentosRoutes from './routes/agendamentos';
import integracoesRoutes from './routes/integracoes';
import logsRoutes from './routes/logs';
import webhooksRoutes from './routes/webhooks';
import { authMiddleware, AuthRequest } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares Globais
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Servir arquivos de upload estáticos (PDFs, imagens agendadas)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rota de Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    timezone: process.env.TZ,
  });
});

// Rotas de API
app.use('/api/auth', authRoutes);
app.use('/api/grupos', gruposRoutes);
app.use('/api/boas-vindas', boasVindasRoutes);
app.use('/api/agendamentos', agendamentosRoutes);
app.use('/api/integracoes', integracoesRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/webhooks', webhooksRoutes);

// Endpoint de Estatísticas do Dashboard
app.get('/api/dashboard/stats', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const [gruposCount, agendamentosPendente, integracoesCount, logsRecentes] = await Promise.all([
      query('SELECT COUNT(*) FROM grupos WHERE ativo = true'),
      query("SELECT COUNT(*) FROM agendamentos WHERE status = 'pendente'"),
      query('SELECT COUNT(*) FROM integracoes WHERE ativo = true'),
      query('SELECT l.*, g.nome as grupo_nome FROM logs l LEFT JOIN grupos g ON l.grupo_id = g.id ORDER BY l.criado_em DESC LIMIT 10'),
    ]);

    res.json({
      gruposAtivos: parseInt(gruposCount.rows[0].count, 10),
      agendamentosPendentes: parseInt(agendamentosPendente.rows[0].count, 10),
      integracoesAtivas: parseInt(integracoesCount.rows[0].count, 10),
      logsRecentes: logsRecentes.rows,
    });
  } catch (error: any) {
    console.error('Erro ao buscar estatísticas do dashboard:', error);
    res.status(500).json({ error: 'Erro ao carregar estatísticas.' });
  }
});

// Inicialização do Servidor
async function startServer() {
  try {
    await initDb();
    initCronJobs();

    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`🚀 Backend rodando com sucesso na porta ${PORT} (Timezone: ${process.env.TZ})`);
    });
  } catch (error) {
    console.error('❌ Falha crítica ao iniciar o backend:', error);
    process.exit(1);
  }
}

startServer();
