'use client';

import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { History, RefreshCw, Trash2, Filter, CheckCircle2, AlertCircle, Eye } from 'lucide-react';

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipoFilter, setTipoFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/logs', {
        params: {
          tipo: tipoFilter || undefined,
          status: statusFilter || undefined,
          limit: 150,
        },
      });
      setLogs(res.data);
    } catch (err) {
      console.error('Erro ao carregar logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [tipoFilter, statusFilter]);

  const handleLimparLogs = async () => {
    if (!confirm('Deseja realmente limpar todos os registros de histórico?')) return;
    try {
      await api.delete('/logs/limpar');
      loadLogs();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao limpar logs.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <History className="w-6 h-6 text-sky-400" />
            <span>Logs de Eventos e Auditoria</span>
          </h1>
          <p className="text-sm text-slate-400">Histórico em tempo real de mensagens disparadas, boas-vindas e checagens</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadLogs}
            disabled={loading}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar Logs</span>
          </button>

          <button
            onClick={handleLimparLogs}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar Histórico</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center space-x-2 text-slate-400 font-semibold">
          <Filter className="w-4 h-4 text-sky-400" />
          <span>Filtrar por:</span>
        </div>

        <div>
          <select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
            className="glass-input px-3 py-1.5 rounded-xl text-xs"
          >
            <option value="" className="bg-slate-900 text-white">Todos os Eventos</option>
            <option value="boas_vindas" className="bg-slate-900 text-white">Boas-Vindas</option>
            <option value="agendamento" className="bg-slate-900 text-white">Envios Agendados</option>
            <option value="youtube" className="bg-slate-900 text-white">YouTube</option>
            <option value="instagram" className="bg-slate-900 text-white">Instagram</option>
            <option value="blog" className="bg-slate-900 text-white">Blog RSS</option>
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="glass-input px-3 py-1.5 rounded-xl text-xs"
          >
            <option value="" className="bg-slate-900 text-white">Todos os Status</option>
            <option value="sucesso" className="bg-slate-900 text-white">Sucesso</option>
            <option value="erro" className="bg-slate-900 text-white">Erro</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-white/5 border-b border-white/10 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-4 px-6">Data/Hora (Fortaleza)</th>
                <th className="py-4 px-6">Tipo de Evento</th>
                <th className="py-4 px-6">Grupo</th>
                <th className="py-4 px-6">Detalhe da Ação</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                    Carregando histórico de logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                    Nenhum registro de log encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-6 text-xs text-slate-400 font-mono">
                      {new Date(log.criado_em).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/20 text-xs font-mono uppercase">
                        {log.tipo_evento}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-xs font-medium text-white">
                      {log.grupo_nome || 'N/A'}
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-300 max-w-md truncate">
                      {log.detalhe}
                    </td>
                    <td className="py-4 px-6">
                      {log.status === 'sucesso' ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium flex items-center space-x-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Sucesso</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-medium flex items-center space-x-1 w-fit">
                          <AlertCircle className="w-3 h-3" />
                          <span>Erro</span>
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
                        title="Ver Detalhes do Log"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Detail Viewer Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-base font-bold text-white">Detalhes do Log #{selectedLog.id}</h2>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Fechar
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block font-semibold">Tipo de Evento:</span>
                <span className="text-sky-300 font-mono uppercase">{selectedLog.tipo_evento}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Grupo Alvo:</span>
                <span className="text-white font-medium">{selectedLog.grupo_nome || 'Geral'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Data / Hora:</span>
                <span className="text-slate-300 font-mono">
                  {new Date(selectedLog.criado_em).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Detalhe Técnico:</span>
                <p className="p-3 rounded-xl bg-black/50 border border-white/10 font-mono text-slate-200 whitespace-pre-wrap mt-1">
                  {selectedLog.detalhe}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
