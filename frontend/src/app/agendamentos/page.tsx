'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
  ShieldCheck,
  Zap,
  Users,
  Search,
  Check,
  RefreshCw,
  Loader2,
  Filter,
  X,
  Info,
  Calendar,
  Sparkles,
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

const DELAY_PRESETS = [
  { val: 10, label: '10s', badge: 'Rápido', desc: 'Poucos grupos' },
  { val: 15, label: '15s', badge: 'Recomendado', desc: 'Equilíbrio ideal' },
  { val: 30, label: '30s', badge: 'Seguro', desc: 'Alta proteção' },
  { val: 60, label: '60s', badge: 'Ultra Seguro', desc: 'Grandes listas' },
];

export default function AgendamentosPage() {
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Table filters & selection
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Group selection in modal
  const [grupoIds, setGrupoIds] = useState<number[]>([]);
  const [singleGrupoId, setSingleGrupoId] = useState<number | ''>('');
  const [grupoSearch, setGrupoSearch] = useState('');

  // Mode: imediato | agendado | recorrente
  const [modoEnvio, setModoEnvio] = useState<'imediato' | 'agendado' | 'recorrente'>('agendado');

  // Anti-bloqueio / Delay Control
  const [intervaloEnvio, setIntervaloEnvio] = useState<number>(15);
  const [isCustomDelay, setIsCustomDelay] = useState(false);
  const [customDelayInput, setCustomDelayInput] = useState('15');

  // Form Fields
  const [mensagem, setMensagem] = useState('');
  const [dataEnvio, setDataEnvio] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Recurrent fields
  const [tipoRecorrencia, setTipoRecorrencia] = useState<'dias_semana' | 'intervalo_dias'>('dias_semana');
  const [diasSemana, setDiasSemana] = useState<number[]>([1, 3, 5]); // Seg, Qua, Sex
  const [intervaloDias, setIntervaloDias] = useState<number | ''>(3);
  const [horario, setHorario] = useState('09:00');
  const [dataFim, setDataFim] = useState('');

  const loadData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);

    try {
      const [agRes, grRes] = await Promise.all([
        api.get('/agendamentos'),
        api.get('/grupos'),
      ]);
      setAgendamentos(agRes.data);
      setGrupos(grRes.data);
    } catch (err) {
      console.error('Erro ao carregar agendamentos:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Polling automático suave enquanto houver envios com status 'processando'
  useEffect(() => {
    const hasProcessing = agendamentos.some((a) => a.status === 'processando');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      loadData(false);
    }, 4000);

    return () => clearInterval(interval);
  }, [agendamentos]);

  const handleOpenCreateModal = () => {
    setEditingId(null);
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10);
    const isoString = now.toISOString().slice(0, 16);
    setDataEnvio(isoString);
    setMensagem('');
    setArquivo(null);
    setModoEnvio('agendado');

    // Grupos
    if (grupos.length > 0) {
      setGrupoIds([grupos[0].id]);
      setSingleGrupoId(grupos[0].id);
    } else {
      setGrupoIds([]);
      setSingleGrupoId('');
    }
    setGrupoSearch('');

    // Anti-bloqueio padrão: 15s recomendado
    setIntervaloEnvio(15);
    setIsCustomDelay(false);
    setCustomDelayInput('15');

    // Recorrência
    setTipoRecorrencia('dias_semana');
    setDiasSemana([1, 3, 5]);
    setIntervaloDias(3);
    setHorario('09:00');
    setDataFim('');

    setModalOpen(true);
  };

  const handleOpenEditModal = (item: any) => {
    setEditingId(item.id);
    setSingleGrupoId(item.grupo_id);
    setGrupoIds([item.grupo_id]);
    setMensagem(item.mensagem || '');
    setArquivo(null);
    setGrupoSearch('');

    // Intervalo salvo
    const delay = item.intervalo_envio_segundos || 15;
    setIntervaloEnvio(delay);
    if ([10, 15, 30, 60].includes(delay)) {
      setIsCustomDelay(false);
    } else {
      setIsCustomDelay(true);
      setCustomDelayInput(String(delay));
    }

    if (item.recorrente) {
      setModoEnvio('recorrente');
      setTipoRecorrencia(item.tipo_recorrencia || 'dias_semana');
      setDiasSemana(Array.isArray(item.dias_semana) ? item.dias_semana : [1, 3, 5]);
      setIntervaloDias(item.intervalo_dias || 3);
      setHorario(item.horario ? item.horario.slice(0, 5) : '09:00');
      setDataFim(item.data_fim ? item.data_fim.slice(0, 10) : '');
      setDataEnvio('');
    } else {
      setModoEnvio('agendado');
      if (item.data_envio) {
        const dt = new Date(item.data_envio);
        const isoLocal = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setDataEnvio(isoLocal);
      } else {
        setDataEnvio('');
      }
    }

    setModalOpen(true);
  };

  const handleSelectAllGroups = () => {
    setGrupoIds(grupos.map((g) => g.id));
  };

  const handleClearAllGroups = () => {
    setGrupoIds([]);
  };

  const handleToggleGroup = (gid: number) => {
    if (grupoIds.includes(gid)) {
      setGrupoIds(grupoIds.filter((id) => id !== gid));
    } else {
      setGrupoIds([...grupoIds, gid]);
    }
  };

  const handleDiaSemanaToggle = (val: number) => {
    if (diasSemana.includes(val)) {
      setDiasSemana(diasSemana.filter((d) => d !== val));
    } else {
      setDiasSemana([...diasSemana, val].sort());
    }
  };

  const handleDelayPresetSelect = (val: number) => {
    setIntervaloEnvio(val);
    setIsCustomDelay(false);
    setCustomDelayInput(String(val));
  };

  const handleCustomDelayChange = (valStr: string) => {
    setCustomDelayInput(valStr);
    const num = Number(valStr);
    if (!isNaN(num) && num >= 3) {
      setIntervaloEnvio(num);
    }
  };

  // Cálculo de tempo estimado total para envio em todos os grupos
  const targetGroupCount = editingId ? 1 : grupoIds.length;
  const totalDelaySeconds = Math.max(0, (targetGroupCount - 1) * intervaloEnvio);
  const formattedEstimatedTime = useMemo(() => {
    if (targetGroupCount <= 1) return 'Imediato (1 grupo)';
    const minutes = Math.floor(totalDelaySeconds / 60);
    const seconds = totalDelaySeconds % 60;
    if (minutes === 0) return `~${seconds} segundos`;
    if (seconds === 0) return `~${minutes} minuto${minutes > 1 ? 's' : ''}`;
    return `~${minutes} min e ${seconds} seg`;
  }, [targetGroupCount, totalDelaySeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      if (!singleGrupoId) {
        alert('Selecione um grupo de destino.');
        return;
      }
    } else {
      if (grupoIds.length === 0) {
        alert('Selecione ao menos um grupo de destino para agendar ou enviar.');
        return;
      }
    }

    if (!mensagem.trim() && !arquivo) {
      alert('Informe uma mensagem de texto ou selecione um arquivo/mídia para enviar.');
      return;
    }

    if (modoEnvio === 'agendado' && !dataEnvio) {
      alert('Selecione a data e hora de envio.');
      return;
    }

    if (modoEnvio === 'recorrente') {
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

    formData.append('mensagem', mensagem.trim());
    formData.append('intervalo_envio_segundos', String(intervaloEnvio));

    if (arquivo) {
      formData.append('arquivo', arquivo);
    }

    try {
      if (editingId) {
        formData.append('grupo_id', String(singleGrupoId));
        if (modoEnvio === 'recorrente') {
          formData.append('recorrente', 'true');
          formData.append('tipo_recorrencia', tipoRecorrencia);
          formData.append('horario', horario);
          if (tipoRecorrencia === 'dias_semana') {
            formData.append('dias_semana', JSON.stringify(diasSemana));
          } else {
            formData.append('intervalo_dias', String(intervaloDias));
          }
          if (dataFim) formData.append('data_fim', dataFim);
        } else {
          formData.append('recorrente', 'false');
          formData.append('data_envio', dataEnvio);
        }

        await api.put(`/agendamentos/${editingId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        formData.append('grupo_ids', JSON.stringify(grupoIds));

        if (modoEnvio === 'imediato') {
          formData.append('envio_imediato', 'true');
          formData.append('recorrente', 'false');
        } else if (modoEnvio === 'recorrente') {
          formData.append('recorrente', 'true');
          formData.append('tipo_recorrencia', tipoRecorrencia);
          formData.append('horario', horario);
          if (tipoRecorrencia === 'dias_semana') {
            formData.append('dias_semana', JSON.stringify(diasSemana));
          } else {
            formData.append('intervalo_dias', String(intervaloDias));
          }
          if (dataFim) formData.append('data_fim', dataFim);
        } else {
          formData.append('recorrente', 'false');
          formData.append('data_envio', dataEnvio);
        }

        const res = await api.post('/agendamentos', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (modoEnvio === 'imediato') {
          alert(`⚡ Disparo iniciado para ${grupoIds.length} grupo(s)!\n\nIntervalo anti-bloqueio configurado para ${intervaloEnvio} segundos entre cada grupo.`);
        }
      }

      setModalOpen(false);
      loadData(false);
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
      loadData(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao disparar envio.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Deseja cancelar/excluir este agendamento?')) return;
    try {
      await api.delete(`/agendamentos/${id}`);
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      loadData(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao excluir agendamento.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Deseja cancelar/excluir todos os ${selectedIds.length} agendamentos selecionados?`)) return;

    setBulkActionLoading(true);
    try {
      await api.post('/agendamentos/bulk-delete', { ids: selectedIds });
      setSelectedIds([]);
      loadData(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao excluir agendamentos em massa.');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleToggleSelectAllTable = () => {
    if (selectedIds.length === filteredAgendamentos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAgendamentos.map((a) => a.id));
    }
  };

  const handleToggleSelectRow = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const getRuleSummary = (item: any) => {
    if (!item.recorrente) {
      if (!item.data_envio) return 'Imediato';
      return new Date(item.data_envio).toLocaleString('pt-BR', {
        timeZone: 'America/Fortaleza',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    const hrStr = item.horario ? item.horario.slice(0, 5) : '09:00';
    if (item.tipo_recorrencia === 'dias_semana') {
      const days = Array.isArray(item.dias_semana) ? item.dias_semana : [];
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const selected = days.map((d: number) => dayNames[d]).join(', ');
      return `${selected || 'Dias'} às ${hrStr}`;
    } else if (item.tipo_recorrencia === 'intervalo_dias') {
      const interval = item.intervalo_dias || 1;
      return `A cada ${interval} ${interval === 1 ? 'dia' : 'dias'} às ${hrStr}`;
    }
    return `Recorrente às ${hrStr}`;
  };

  // Grupos filtrados na busca do modal
  const modalFilteredGrupos = useMemo(() => {
    if (!grupoSearch.trim()) return grupos;
    const term = grupoSearch.toLowerCase();
    return grupos.filter((g) => g.nome.toLowerCase().includes(term));
  }, [grupos, grupoSearch]);

  // Agendamentos filtrados na tabela principal
  const filteredAgendamentos = useMemo(() => {
    return agendamentos.filter((item) => {
      const matchesSearch =
        searchFilter === '' ||
        (item.grupo_nome && item.grupo_nome.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (item.mensagem && item.mensagem.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (item.nome_arquivo && item.nome_arquivo.toLowerCase().includes(searchFilter.toLowerCase()));

      const matchesStatus =
        statusFilter === 'todos' || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [agendamentos, searchFilter, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <CalendarClock className="w-6 h-6 text-sky-400" />
            <span>Envios Agendados & Disparos</span>
          </h1>
          <p className="text-sm text-slate-400">
            Dispare ou agende mensagens e mídias para múltiplos grupos com proteção anti-bloqueio
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadData(false)}
            disabled={loading || refreshing}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/10"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-sky-500/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Envio / Agendamento</span>
          </button>
        </div>
      </div>

      {/* Filters & Bulk Action Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-1 items-center space-x-3 w-full">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por grupo, texto ou arquivo..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full glass-input pl-10 pr-3.5 py-2 rounded-xl text-xs"
            />
          </div>

          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0 text-xs">
            {['todos', 'processando', 'pendente', 'enviado', 'ativo', 'erro'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all capitalize whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'bg-white/5 text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                {st === 'todos' ? 'Todos' : st}
              </button>
            ))}
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center space-x-2 w-full md:w-auto justify-end bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl text-xs">
            <span className="text-rose-300 font-medium">
              {selectedIds.length} selecionado(s)
            </span>
            <button
              onClick={handleBulkDelete}
              disabled={bulkActionLoading}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-semibold transition-all disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{bulkActionLoading ? 'Excluindo...' : 'Excluir Selecionados'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Schedules Table */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-white/5 border-b border-white/10 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-4 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredAgendamentos.length > 0 &&
                      selectedIds.length === filteredAgendamentos.length
                    }
                    onChange={handleToggleSelectAllTable}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
                  />
                </th>
                <th className="py-4 px-5">Grupo</th>
                <th className="py-4 px-5">Arquivo / Mídia</th>
                <th className="py-4 px-5">Mensagem</th>
                <th className="py-4 px-5">Programação</th>
                <th className="py-4 px-5">Intervalo Anti-Ban</th>
                <th className="py-4 px-5">Status</th>
                <th className="py-4 px-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-400" />
                    Carregando envios e agendamentos...
                  </td>
                </tr>
              ) : filteredAgendamentos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-500">
                    Nenhum agendamento encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredAgendamentos.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => handleToggleSelectRow(item.id)}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
                      />
                    </td>
                    <td className="py-4 px-5 font-medium text-white">
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-sky-400 shrink-0" />
                        <span className="truncate max-w-[180px]">{item.grupo_nome}</span>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-xs font-mono text-sky-400">
                      {item.nome_arquivo ? (
                        <a
                          href={item.arquivo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline flex items-center space-x-1 max-w-[160px] truncate"
                        >
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{item.nome_arquivo}</span>
                        </a>
                      ) : (
                        <span className="text-slate-500">Apenas texto</span>
                      )}
                    </td>
                    <td className="py-4 px-5 text-xs text-slate-300 max-w-xs truncate">
                      {item.mensagem || '-'}
                    </td>
                    <td className="py-4 px-5 text-xs">
                      {item.recorrente ? (
                        <div className="space-y-1">
                          <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-medium inline-flex items-center space-x-1 text-[11px]">
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
                    <td className="py-4 px-5 text-xs">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center space-x-1 text-[11px] font-mono">
                        <ShieldCheck className="w-3 h-3" />
                        <span>{item.intervalo_envio_segundos || 15}s delay</span>
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      {item.status === 'processando' && (
                        <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-medium flex items-center w-fit space-x-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Enviando...</span>
                        </span>
                      )}
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
                        <span
                          className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-medium flex items-center w-fit space-x-1 cursor-help"
                          title={item.erro_mensagem || 'Erro ao enviar'}
                        >
                          <AlertCircle className="w-3 h-3" />
                          <span>Erro</span>
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-5 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenEditModal(item)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-indigo-500/20 text-slate-300 hover:text-indigo-400 transition-colors"
                        title="Editar Agendamento"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleReenviar(item.id)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-sky-500/20 text-slate-300 hover:text-sky-400 transition-colors"
                        title="Enviar Agora (Disparo Imediato)"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition-colors"
                        title="Excluir Agendamento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule / Multi-Group Dispatch Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl glass-panel p-6 rounded-2xl border border-white/10 space-y-5 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white leading-tight">
                    {editingId ? 'Editar Agendamento' : 'Criar Envio ou Agendamento'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {editingId
                      ? 'Altere as configurações do envio selecionado'
                      : 'Envie para múltiplos grupos de WhatsApp com proteção contra bloqueios'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 text-sm">
              {/* 1. SELEÇÃO DE GRUPOS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5 uppercase tracking-wider">
                    <Users className="w-3.5 h-3.5 text-sky-400" />
                    <span>
                      Grupos de Destino (
                      <span className="text-sky-400">
                        {editingId ? '1 selecionado' : `${grupoIds.length} de ${grupos.length} selecionados`}
                      </span>
                      )
                    </span>
                  </label>

                  {!editingId && grupos.length > 0 && (
                    <div className="flex items-center space-x-2 text-xs">
                      <button
                        type="button"
                        onClick={handleSelectAllGroups}
                        className="text-sky-400 hover:text-sky-300 font-medium underline underline-offset-2"
                      >
                        Selecionar Todos
                      </button>
                      <span className="text-slate-600">•</span>
                      <button
                        type="button"
                        onClick={handleClearAllGroups}
                        className="text-slate-400 hover:text-slate-300 font-medium"
                      >
                        Limpar
                      </button>
                    </div>
                  )}
                </div>

                {editingId ? (
                  /* Modo Edição: Select único */
                  <select
                    value={singleGrupoId}
                    onChange={(e) => setSingleGrupoId(Number(e.target.value))}
                    className="w-full glass-input px-3.5 py-2.5 rounded-xl text-sm"
                  >
                    {grupos.map((g) => (
                      <option key={g.id} value={g.id} className="bg-slate-900 text-white">
                        {g.nome}
                      </option>
                    ))}
                  </select>
                ) : (
                  /* Modo Criação: Multi-Select com Busca e Checkboxes */
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Filtrar grupos pelo nome..."
                        value={grupoSearch}
                        onChange={(e) => setGrupoSearch(e.target.value)}
                        className="w-full glass-input pl-9 pr-3 py-1.5 rounded-xl text-xs"
                      />
                    </div>

                    <div className="max-h-44 overflow-y-auto space-y-1 p-2 rounded-xl bg-white/[0.03] border border-white/10">
                      {modalFilteredGrupos.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-500">
                          Nenhum grupo encontrado.
                        </div>
                      ) : (
                        modalFilteredGrupos.map((g) => {
                          const isSelected = grupoIds.includes(g.id);
                          return (
                            <label
                              key={g.id}
                              onClick={() => handleToggleGroup(g.id)}
                              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all select-none ${
                                isSelected
                                  ? 'bg-sky-500/15 border border-sky-500/30 text-white'
                                  : 'hover:bg-white/5 border border-transparent text-slate-300'
                              }`}
                            >
                              <div className="flex items-center space-x-2.5">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}} // tratado no onClick do label
                                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
                                />
                                <span className="text-xs font-medium">{g.nome}</span>
                              </div>
                              {isSelected && (
                                <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-md font-semibold">
                                  Incluído
                                </span>
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. MODO DE DISPARO / AGENDAMENTO */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5 uppercase tracking-wider">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Modo de Envio</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setModoEnvio('agendado')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all border flex items-center justify-center space-x-1.5 ${
                      modoEnvio === 'agendado'
                        ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-sm'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Data & Hora</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModoEnvio('imediato')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all border flex items-center justify-center space-x-1.5 ${
                      modoEnvio === 'imediato'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Disparo Agora</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModoEnvio('recorrente')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all border flex items-center justify-center space-x-1.5 ${
                      modoEnvio === 'recorrente'
                        ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-sm'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <Repeat className="w-3.5 h-3.5" />
                    <span>Recorrente</span>
                  </button>
                </div>
              </div>

              {/* 3. CONTROLE DE TEMPO DE ENVIO ANTI-BLOQUEIO (ANTI-BAN) */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 via-slate-900/60 to-sky-500/10 border border-emerald-500/20 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="block text-xs font-bold text-emerald-300 uppercase tracking-wider">
                        Controle de Tempo Anti-Bloqueio (WhatsApp)
                      </span>
                      <span className="block text-[11px] text-slate-300">
                        Intervalo de espera inteligente entre cada grupo para proteger seu número de banimentos.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  {DELAY_PRESETS.map((p) => {
                    const isSelected = !isCustomDelay && intervaloEnvio === p.val;
                    return (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => handleDelayPresetSelect(p.val)}
                        className={`py-2 px-2.5 rounded-xl border text-center transition-all ${
                          isSelected
                            ? 'bg-emerald-500/25 border-emerald-400 text-white shadow-md shadow-emerald-500/20'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span className="block font-bold text-xs">{p.label}</span>
                        <span className="block text-[10px] text-emerald-300/80">{p.badge}</span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setIsCustomDelay(true)}
                    className={`py-2 px-2.5 rounded-xl border text-center transition-all ${
                      isCustomDelay
                        ? 'bg-emerald-500/25 border-emerald-400 text-white shadow-md shadow-emerald-500/20'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="block font-bold text-xs">Personalizado</span>
                    <span className="block text-[10px] text-slate-400">Custom</span>
                  </button>
                </div>

                {isCustomDelay && (
                  <div className="flex items-center space-x-2 pt-1">
                    <label className="text-xs text-slate-300 whitespace-nowrap">
                      Intervalo personalizado (segundos):
                    </label>
                    <input
                      type="number"
                      min="3"
                      max="3600"
                      value={customDelayInput}
                      onChange={(e) => handleCustomDelayChange(e.target.value)}
                      className="w-24 glass-input px-3 py-1.5 rounded-lg text-xs font-mono"
                    />
                    <span className="text-[11px] text-slate-400">(mínimo recomendado: 10s)</span>
                  </div>
                )}

                {/* Resumo da estimativa de tempo */}
                <div className="flex items-center justify-between pt-2 border-t border-emerald-500/20 text-xs">
                  <div className="flex items-center space-x-1.5 text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    <span>Tempo total estimado ({targetGroupCount} grupos):</span>
                  </div>
                  <span className="font-mono font-semibold text-emerald-400">
                    {formattedEstimatedTime}
                  </span>
                </div>
              </div>

              {/* 4. CAMPOS ESPECÍFICOS DO MODO DE ENVIO */}
              {modoEnvio === 'agendado' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Data e Hora do Primeiro Envio (Horário de Fortaleza/Brasília - UTC-3)
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={dataEnvio}
                    onChange={(e) => setDataEnvio(e.target.value)}
                    className="w-full glass-input px-3.5 py-2 rounded-xl text-sm font-mono"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Os grupos subsequentes serão disparados escalonadamente a cada {intervaloEnvio} segundos após este horário.
                  </p>
                </div>
              )}

              {modoEnvio === 'recorrente' && (
                <div className="space-y-4 p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2">Frequência da Recorrência</label>
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
                        required
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
                        required
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

              {/* 5. ANEXO E MENSAGEM */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Arquivo para Anexo (PDF, Apostila, Imagem, Vídeo - Opcional)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    onChange={(e) => setArquivo(e.target.files ? e.target.files[0] : null)}
                    className="w-full glass-input px-3.5 py-1.5 rounded-xl text-xs file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-500/20 file:text-sky-300 hover:file:bg-sky-500/30"
                  />
                  {arquivo && (
                    <button
                      type="button"
                      onClick={() => setArquivo(null)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                      title="Remover anexo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Texto da Mensagem {arquivo ? '(Opcional se houver anexo)' : '(Obrigatório)'}
                </label>
                <textarea
                  rows={4}
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Ex: Segue a apostila da aula de hoje! Bons estudos..."
                  className="w-full glass-input p-3.5 rounded-xl text-sm"
                />
              </div>

              {/* FOOTER ACTIONS */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <span className="text-xs text-slate-400">
                  {modoEnvio === 'imediato' && '⚡ O envio começará assim que você confirmar.'}
                  {modoEnvio === 'agendado' && '📅 Os envios serão disparados na data configurada.'}
                  {modoEnvio === 'recorrente' && '🔁 As mensagens serão repetidas conforme a regra.'}
                </span>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`px-5 py-2.5 rounded-xl text-xs font-semibold shadow-lg text-white transition-all disabled:opacity-50 flex items-center space-x-1.5 ${
                      modoEnvio === 'imediato'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-amber-500/25'
                        : 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-sky-500/25'
                    }`}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Processando...</span>
                      </>
                    ) : editingId ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Atualizar Agendamento</span>
                      </>
                    ) : modoEnvio === 'imediato' ? (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        <span>Disparar Agora ({grupoIds.length} grupos)</span>
                      </>
                    ) : (
                      <>
                        <CalendarClock className="w-3.5 h-3.5" />
                        <span>Confirmar Agendamento ({grupoIds.length} grupos)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
