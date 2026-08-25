'use client';

import { useState, useEffect } from 'react';
import api from '../../lib/api';
import {
  CalendarClock,
  Plus,
  FileText,
  Send,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Repeat,
  Edit2,
  XCircle,
} from 'lucide-react';

const DIAS_SEMANA_OPCOES = [
  { val: 0, label: 'Dom' },
  { val: 1, label: 'Seg' },
  { val: 2, label: 'Ter' },
  { val: 3, label: 'Qua' },
  { val: 4, label: 'Qui' },
  { val: 5, label: 'Sex' },
  { val: 6, label: 'Sáb' },
];

export default function AgendamentosPage() {
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [grupoId, setGrupoId] = useState<number | ''>('');
  const [mensagem, setMensagem] = useState('');
  const [dataEnvio, setDataEnvio] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Campos de Recorrência
  const [recorrente, setRecorrente] = useState(false);
  const [tipoRecorrencia, setTipoRecorrencia] = useState<'dias_semana' | 'intervalo_dias'>('dias_semana');
  const [diasSemana, setDiasSemana] = useState<number[]>([1, 3, 5]); // Seg, Qua, Sex por padrão
  const [intervaloDias, setIntervaloDias] = useState<number | ''>(3);
  const [horario, setHorario] = useState('09:00');
  const [dataFim, setDataFim] = useState('');

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

  const handleOpenCreateModal = () => {
    setEditingId(null);
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10);
    const isoString = now.toISOString().slice(0, 16);
    setDataEnvio(isoString);
    setMensagem('');
    setArquivo(null);
    setRecorrente(false);
    setTipoRecorrencia('dias_semana');
    setDiasSemana([1, 3, 5]);
    setIntervaloDias(3);
    setHorario('09:00');
    setDataFim('');
    if (grupos.length > 0) setGrupoId(grupos[0].id);
    setModalOpen(true);
  };

  const handleOpenEditModal = (item: any) => {
    setEditingId(item.id);
    setGrupoId(item.grupo_id);
    setMensagem(item.mensagem || '');
    setArquivo(null);
    setRecorrente(!!item.recorrente);
    setTipoRecorrencia(item.tipo_recorrencia || 'dias_semana');
    setDiasSemana(Array.isArray(item.dias_semana) ? item.dias_semana : [1, 3, 5]);
    setIntervaloDias(item.intervalo_dias || 3);
    setHorario(item.horario ? item.horario.slice(0, 5) : '09:00');
    setDataFim(item.data_fim ? item.data_fim.slice(0, 10) : '');
    if (item.data_envio) {
      const dt = new Date(item.data_envio);
      const isoLocal = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setDataEnvio(isoLocal);
    } else {
      setDataEnvio('');
    }
    setModalOpen(true);
  };

  const handleDiaSemanaToggle = (val: number) => {
    if (diasSemana.includes(val)) {
      setDiasSemana(diasSemana.filter((d) => d !== val));
    } else {
      setDiasSemana([...diasSemana, val].sort());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grupoId) return;

    if (!recorrente && !dataEnvio) {
      alert('Selecione a data e hora de envio.');
      return;
    }

    if (recorrente) {
      if (!horario) {
        alert('Selecione o horário do disparo.');
        return;
      }
      if (tipoRecorrencia === 'dias_semana' && diasSemana.length === 0) {
        alert('Selecione pelo menos um dia da semana.');
        return;
      }
      if (tipoRecorrencia === 'intervalo_dias' && (!intervaloDias || Number(intervaloDias) < 1)) {
        alert('Informe um intervalo de dias válido (mínimo 1).');
        return;
      }
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('grupo_id', String(grupoId));
    formData.append('mensagem', mensagem);
    formData.append('recorrente', String(recorrente));

    if (recorrente) {
      formData.append('tipo_recorrencia', tipoRecorrencia);
      formData.append('horario', horario);
      if (tipoRecorrencia === 'dias_semana') {
        formData.append('dias_semana', JSON.stringify(diasSemana));
      } else {
        formData.append('intervalo_dias', String(intervaloDias));
      }
      if (dataFim) {
        formData.append('data_fim', dataFim);
      }
    } else {
      formData.append('data_envio', dataEnvio);
    }

    if (arquivo) {
      formData.append('arquivo', arquivo);
    }

    try {
      if (editingId) {
        await api.put(`/agendamentos/${editingId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post('/agendamentos', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao salvar agendamento.');
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

  const getRuleSummary = (item: any) => {
    if (!item.recorrente) {
      if (!item.data_envio) return 'Data não definida';
      return new Date(item.data_envio).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' });
    }
    const hrStr = item.horario ? item.horario.slice(0, 5) : '09:00';
    if (item.tipo_recorrencia === 'dias_semana') {
      const days = Array.isArray(item.dias_semana) ? item.dias_semana : [];
      const dayNames = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
      const selected = days.map((d: number) => dayNames[d]).join('/');
      return `Toda ${selected || 'dia'} às ${hrStr}`;
    } else if (item.tipo_recorrencia === 'intervalo_dias') {
      const interval = item.intervalo_dias || 1;
      return `A cada ${interval} ${interval === 1 ? 'dia' : 'dias'} às ${hrStr}`;
    }
    return `Recorrente às ${hrStr}`;
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
            Agende envios de arquivos ou mensagens pontuais ou recorrentes (Fuso America/Fortaleza)
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
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
                <th className="py-4 px-6">Tipo / Programação (Fortaleza)</th>
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
                    <td className="py-4 px-6 text-xs">
                      {item.recorrente ? (
                        <div className="space-y-1">
                          <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-medium inline-flex items-center space-x-1 text-xs">
                            <Repeat className="w-3 h-3" />
                            <span>Recorrente</span>
                          </span>
                          <div className="font-mono text-slate-300 text-xs">{getRuleSummary(item)}</div>
                          {item.data_fim && (
                            <div className="text-[10px] text-slate-500">
                              Até {new Date(item.data_fim).toLocaleDateString('pt-BR')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="font-mono text-slate-300">{getRuleSummary(item)}</span>
                      )}
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
                      {item.status === 'ativo' && (
                        <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-medium flex items-center w-fit space-x-1">
                          <Repeat className="w-3 h-3 animate-spin-slow" />
                          <span>Ativo</span>
                        </span>
                      )}
                      {item.status === 'inativo' && (
                        <span className="px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20 text-xs font-medium flex items-center w-fit space-x-1">
                          <XCircle className="w-3 h-3" />
                          <span>Inativo</span>
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
                        onClick={() => handleOpenEditModal(item)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-indigo-500/20 text-slate-300 hover:text-indigo-400 transition-colors"
                        title="Editar Agendamento"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleReenviar(item.id)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-sky-500/20 text-slate-300 hover:text-sky-400 transition-colors"
                        title="Enviar Agora (Disparo Manual)"
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

      {/* Schedule Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg glass-panel p-6 rounded-2xl border border-white/10 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white">
              {editingId ? 'Editar Agendamento' : 'Criar Envio Agendado'}
            </h2>

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

              {/* Recorrente Toggle Switch */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <span className="block text-xs font-semibold text-white">Envio Recorrente</span>
                  <span className="block text-[11px] text-slate-400">Repetir automaticamente em dias ou intervalos específicos</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recorrente}
                    onChange={(e) => setRecorrente(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                </label>
              </div>

              {!recorrente ? (
                /* Single Schedule DateTime */
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Data e Hora do Envio (Horário de Fortaleza/Brasília - UTC-3)
                  </label>
                  <input
                    type="datetime-local"
                    required={!recorrente}
                    value={dataEnvio}
                    onChange={(e) => setDataEnvio(e.target.value)}
                    className="w-full glass-input px-3.5 py-2 rounded-xl text-sm font-mono"
                  />
                </div>
              ) : (
                /* Recurring Settings */
                <div className="space-y-4 p-3 rounded-xl bg-white/[0.03] border border-white/10">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2">Tipo de Recorrência</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTipoRecorrencia('dias_semana')}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all border ${
                          tipoRecorrencia === 'dias_semana'
                            ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        Dias da Semana
                      </button>
                      <button
                        type="button"
                        onClick={() => setTipoRecorrencia('intervalo_dias')}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all border ${
                          tipoRecorrencia === 'intervalo_dias'
                            ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        Intervalo em Dias
                      </button>
                    </div>
                  </div>

                  {tipoRecorrencia === 'dias_semana' ? (
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-2">Dias de Disparo</label>
                      <div className="flex flex-wrap gap-1.5">
                        {DIAS_SEMANA_OPCOES.map((d) => {
                          const active = diasSemana.includes(d.val);
                          return (
                            <button
                              key={d.val}
                              type="button"
                              onClick={() => handleDiaSemanaToggle(d.val)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                active
                                  ? 'bg-indigo-500/30 border-indigo-400 text-indigo-200'
                                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                              }`}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Intervalo (em dias)</label>
                      <input
                        type="number"
                        min="1"
                        required={recorrente && tipoRecorrencia === 'intervalo_dias'}
                        value={intervaloDias}
                        onChange={(e) => setIntervaloDias(e.target.value ? Number(e.target.value) : '')}
                        placeholder="Ex: 3 (dispara a cada 3 dias)"
                        className="w-full glass-input px-3.5 py-2 rounded-xl text-sm font-mono"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Horário do Disparo</label>
                      <input
                        type="time"
                        required={recorrente}
                        value={horario}
                        onChange={(e) => setHorario(e.target.value)}
                        className="w-full glass-input px-3.5 py-2 rounded-xl text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Data Final (Opcional)</label>
                      <input
                        type="date"
                        value={dataFim}
                        onChange={(e) => setDataFim(e.target.value)}
                        className="w-full glass-input px-3.5 py-2 rounded-xl text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

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
                  {submitting
                    ? 'Salvando...'
                    : editingId
                    ? 'Atualizar Agendamento'
                    : 'Confirmar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

