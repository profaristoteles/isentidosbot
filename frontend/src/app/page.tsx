'use client';

import { useEffect, useState } from 'react';
import api from '../lib/api';
import StatCard from '../components/StatCard';
import { Users, CalendarClock, Share2, Activity, ArrowRight, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    gruposAtivos: 0,
    agendamentosPendentes: 0,
    integracoesAtivas: 0,
    logsRecentes: [] as any[],
  });
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Painel de Controle Geral</h1>
          <p className="text-sm text-slate-400">Automação de WhatsApp e Monitoramento de Canais Institucionais</p>
        </div>
        <button
          onClick={loadStats}
          disabled={loading}
          className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar Dados</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Grupos Monitorados"
          value={stats.gruposAtivos}
          description="Grupos de WhatsApp ativos"
          icon={Users}
          color="sky"
        />
        <StatCard
          title="Envios Agendados"
          value={stats.agendamentosPendentes}
          description="Aguardando data/hora"
          icon={CalendarClock}
          color="amber"
        />
        <StatCard
          title="Integrações de Conteúdo"
          value={stats.integracoesAtivas}
          description="YouTube, Instagram & Blogs"
          icon={Share2}
          color="purple"
        />
        <StatCard
          title="Status do Webhook"
          value="Ativo (401 Sec)"
          description="Evolution API Token OK"
          icon={Activity}
          color="emerald"
        />
      </div>

      {/* Quick Actions & Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions Panel */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <h2 className="text-base font-semibold text-white">Ações Rápidas</h2>
          
          <div className="space-y-3">
            <Link
              href="/agendamentos"
              className="flex items-center justify-between p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 hover:bg-sky-500/20 transition-all text-sm font-medium"
            >
              <span>Agendar Envio de PDF / Imagem</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/boas-vindas"
              className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 transition-all text-sm font-medium"
            >
              <span>Configurar Boas-Vindas</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/integracoes"
              className="flex items-center justify-between p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 hover:bg-purple-500/20 transition-all text-sm font-medium"
            >
              <span>Cadastrar Novo Canal ou Blog</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Recent Audit Logs Feed */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Últimos Eventos Executados</h2>
            <Link href="/logs" className="text-xs text-sky-400 hover:underline">
              Ver todos os logs
            </Link>
          </div>

          {stats.logsRecentes.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Nenhum evento registrado até o momento.
            </div>
          ) : (
            <div className="space-y-3">
              {stats.logsRecentes.map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 text-xs"
                >
                  <div className="flex items-start space-x-3">
                    {log.status === 'sucesso' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-slate-200 font-medium">{log.detalhe}</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Evento: <span className="uppercase text-sky-400">{log.tipo_evento}</span> • Grupo: {log.grupo_nome || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap ml-4">
                    {new Date(log.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
