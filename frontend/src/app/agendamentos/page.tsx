'use client';

import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { CalendarClock, Plus, FileText, Send, Trash2, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AgendamentosPage() {
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [grupoId, setGrupoId] = useState<number | ''>('');
  const [mensagem, setMensagem] = useState('');
  const [dataEnvio, setDataEnvio] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [agRes, grRes] = await Promise.all([
        api.get('/agendamentos'),
        api.get('/grupos'),
      ]);
      setAgendamentos(agRes.data);
      setGrupos(grRes.data);
      if (grRes.data.length > 0 && !grupoId) {
        setGrupoId(grRes.data[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar agendamentos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = () => {
    // Definir horário padrão para daqui 10 minutos no fuso local
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10);
    const isoString = now.toISOString().slice(0, 16);
    setDataEnvio(isoString);
    setMensagem('');
    setArquivo(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grupoId || !dataEnvio) return;

    setSubmitting(true);
    const formData = new FormData();
    formData.append('grupo_id', String(grupoId));
    formData.append('mensagem', mensagem);
    formData.append('data_envio', dataEnvio);
    if (arquivo) {
      formData.append('arquivo', arquivo);
    }

    try {
      await api.post('/agendamentos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao criar agendamento.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReenviar = async (id: number) => {
    if (!confirm('Deseja disparar este envio imediatamente para o grupo?')) return;
    try {
      await api.post(`/agendamentos/${id}/reenviar`);
      alert('Envio disparado com sucesso!');
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao disparar envio.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Deseja cancelar/excluir este agendamento?')) return;
    try {
      await api.delete(`/agendamentos/${id}`);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao excluir agendamento.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <CalendarClock className="w-6 h-6 text-sky-400" />
            <span>Envios Agendados</span>
          </h1>
          <p className="text-sm text-slate-400">
            Agende o envio de PDFs, apostilas ou mensagens para horários específicos (Fuso America/Fortaleza)
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-sky-500/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Agendamento</span>
        </button>
      </div>

      {/* Schedules Table */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-white/5 border-b border-white/10 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-4 px-6">Grupo</th>
                <th className="py-4 px-6">Arquivo / Mídia</th>
                <th className="py-4 px-6">Mensagem</th>
                <th className="py-4 px-6">Data/Hora (Fortaleza)</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                    Carregando agendamentos...
                  </td>
                </tr>
              ) : agendamentos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                    Nenhum envio agendado. Clique em "Novo Agendamento".
                  </td>
                </tr>
              ) : (
                agendamentos.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-6 font-medium text-white">{item.grupo_nome}</td>
                    <td className="py-4 px-6 text-xs font-mono text-sky-400">
                      {item.nome_arquivo ? (
                        <a href={item.arquivo_url} target="_blank" rel="noreferrer" className="hover:underline flex items-center space-x-1">
                          <FileText className="w-3.5 h-3.5" />
                          <span>{item.nome_arquivo}</span>
                        </a>
                      ) : (
                        <span className="text-slate-500">Apenas texto</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-300 max-w-xs truncate">
                      {item.mensagem || '-'}
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-300 font-mono">
                      {new Date(item.data_envio).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}
                    </td>
                    <td className="py-4 px-6">
                      {item.status === 'pendente' && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-medium flex items-center w-fit space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>Pendente</span>
                        </span>
                      )}
                      {item.status === 'enviado' && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium flex items-center w-fit space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Enviado</span>
                        </span>
                      )}
                      {item.status === 'erro' && (
                        <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-medium flex items-center w-fit space-x-1" title={item.erro_mensagem}>
                          <AlertCircle className="w-3 h-3" />
                          <span>Erro</span>
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        onClick={() => handleReenviar(item.id)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-sky-500/20 text-slate-300 hover:text-sky-400 transition-colors"
                        title="Enviar Agora (Disparo Imediato)"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition-colors"
                        title="Excluir Agendamento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-lg font-bold text-white">Criar Envio Agendado</h2>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Grupo de Destino</label>
                <select
                  value={grupoId}
                  onChange={(e) => setGrupoId(Number(e.target.value))}
                  className="w-full glass-input px-3.5 py-2 rounded-xl text-sm"
                >
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id} className="bg-slate-900 text-white">
                      {g.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Data e Hora do Envio (Horário de Fortaleza/Brasília - UTC-3)
                </label>
                <input
                  type="datetime-local"
                  required
                  value={dataEnvio}
                  onChange={(e) => setDataEnvio(e.target.value)}
                  className="w-full glass-input px-3.5 py-2 rounded-xl text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Arquivo para Anexo (PDF, Apostila, Imagem - Opcional)
                </label>
                <input
                  type="file"
                  onChange={(e) => setArquivo(e.target.files ? e.target.files[0] : null)}
                  className="w-full glass-input px-3.5 py-1.5 rounded-xl text-xs file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-500/20 file:text-sky-300 hover:file:bg-sky-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Legenda / Texto da Mensagem (Opcional)
                </label>
                <textarea
                  rows={3}
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Ex: Segue a apostila da aula de hoje! Bons estudos..."
                  className="w-full glass-input p-3 rounded-xl text-sm"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-xs text-white font-semibold shadow-lg shadow-sky-500/25 disabled:opacity-50"
                >
                  {submitting ? 'Agendando...' : 'Confirmar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
