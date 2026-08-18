'use client';

import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { Share2, Plus, Youtube, Instagram, Rss, Play, Trash2, Edit2, RefreshCw, Layers, Clock, Users } from 'lucide-react';

export default function IntegracoesPage() {
  const [integracoes, setIntegracoes] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [backfillingId, setBackfillingId] = useState<number | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingInteg, setEditingInteg] = useState<any | null>(null);
  const [grupoIds, setGrupoIds] = useState<number[]>([]);
  const [tipo, setTipo] = useState<'youtube' | 'instagram' | 'blog'>('youtube');
  const [urlReferencia, setUrlReferencia] = useState('');
  const [intervaloMinutos, setIntervaloMinutos] = useState(15);
  const [gotejamentoQuantidade, setGotejamentoQuantidade] = useState(1);
  const [gotejamentoPeriodo, setGotejamentoPeriodo] = useState<'dia' | 'semana'>('dia');
  const [ativo, setAtivo] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [intRes, grRes] = await Promise.all([
        api.get('/integracoes'),
        api.get('/grupos'),
      ]);
      setIntegracoes(intRes.data);
      setGrupos(grRes.data);
    } catch (err) {
      console.error('Erro ao carregar integrações:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = (integ?: any) => {
    if (integ) {
      setEditingInteg(integ);
      const initialGrupoIds = integ.grupo_ids && integ.grupo_ids.length > 0
        ? integ.grupo_ids
        : (integ.grupo_id ? [integ.grupo_id] : []);
      setGrupoIds(initialGrupoIds);
      setTipo(integ.tipo);
      setUrlReferencia(integ.url_referencia);
      setIntervaloMinutos(integ.intervalo_minutos || 15);
      setGotejamentoQuantidade(integ.gotejamento_quantidade || 1);
      setGotejamentoPeriodo(integ.gotejamento_periodo || 'dia');
      setAtivo(integ.ativo);
    } else {
      setEditingInteg(null);
      setGrupoIds(grupos.length > 0 ? [grupos[0].id] : []);
      setTipo('youtube');
      setUrlReferencia('');
      setIntervaloMinutos(15);
      setGotejamentoQuantidade(1);
      setGotejamentoPeriodo('dia');
      setAtivo(true);
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (grupoIds.length === 0) {
      alert('Selecione ao menos um grupo de WhatsApp para vincular a esta integração.');
      return;
    }
    if (!urlReferencia) return;

    try {
      if (editingInteg) {
        await api.put(`/integracoes/${editingInteg.id}`, {
          grupo_ids: grupoIds,
          tipo,
          url_referencia: urlReferencia,
          intervalo_minutos: intervaloMinutos,
          gotejamento_quantidade: Number(gotejamentoQuantidade) || 1,
          gotejamento_periodo: gotejamentoPeriodo,
          ativo,
        });
      } else {
        await api.post('/integracoes', {
          grupo_ids: grupoIds,
          tipo,
          url_referencia: urlReferencia,
          intervalo_minutos: intervaloMinutos,
          gotejamento_quantidade: Number(gotejamentoQuantidade) || 1,
          gotejamento_periodo: gotejamentoPeriodo,
          ativo,
        });
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao salvar integração.');
    }
  };

  const handleBackfill = async (id: number) => {
    setBackfillingId(id);
    try {
      const res = await api.post(`/integracoes/${id}/backfill`);
      alert(res.data.message);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao executar backfill.');
    } finally {
      setBackfillingId(null);
    }
  };

  const handleTestar = async (id: number) => {
    try {
      const res = await api.post(`/integracoes/${id}/testar`);
      alert(res.data.message);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao executar teste.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Deseja excluir este monitoramento de conteúdo?')) return;
    try {
      await api.delete(`/integracoes/${id}`);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao excluir integração.');
    }
  };

  const getTipoIcon = (t: string) => {
    switch (t) {
      case 'youtube':
        return <Youtube className="w-5 h-5 text-rose-500" />;
      case 'instagram':
        return <Instagram className="w-5 h-5 text-purple-400" />;
      case 'blog':
        return <Rss className="w-5 h-5 text-amber-400" />;
      default:
        return <Share2 className="w-5 h-5 text-sky-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Share2 className="w-6 h-6 text-sky-400" />
            <span>Integrações de Conteúdo Automático</span>
          </h1>
          <p className="text-sm text-slate-400">
            Monitoramento de YouTube, Instagram e Blogs com Suporte a Múltiplos Grupos e Gotejamento
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-sky-500/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Integração</span>
        </button>
      </div>

      {/* Integrations Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-500">
            Carregando integrações cadastradas...
          </div>
        ) : integracoes.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-500">
            Nenhuma integração cadastrada. Clique em "Nova Integração" para monitorar YouTube, Instagram ou Blog.
          </div>
        ) : (
          integracoes.map((item) => (
            <div key={item.id} className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                      {getTipoIcon(item.tipo)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">{item.tipo}</h3>
                      <p
                        className="text-xs text-sky-400 font-medium truncate max-w-[200px]"
                        title={item.grupos?.map((g: any) => g.nome).join(', ')}
                      >
                        {item.grupos && item.grupos.length > 0
                          ? `${item.grupos.length} grupo(s): ${item.grupos.map((g: any) => g.nome).join(', ')}`
                          : item.grupo_nome || 'Nenhum grupo vinculado'}
                      </p>
                    </div>
                  </div>
                  {item.ativo ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
                      Ativo
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-[10px] font-semibold">
                      Inativo
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-2.5 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Referência / Canal / Feed:</span>
                    <span className="text-slate-200 font-mono break-all">{item.url_referencia}</span>
                  </div>

                  {/* Badges de Fila e Taxa de Gotejamento */}
                  <div className="pt-1 flex flex-wrap gap-2">
                    <div className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 font-medium text-[11px]">
                      <Layers className="w-3.5 h-3.5" />
                      <span>{item.itens_pendentes || 0} na fila de gotejamento</span>
                    </div>

                    <div className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-medium text-[11px]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{item.gotejamento_quantidade || 1} por {item.gotejamento_periodo || 'dia'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col space-y-2 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleBackfill(item.id)}
                    disabled={backfillingId === item.id}
                    className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-medium border border-indigo-500/20 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${backfillingId === item.id ? 'animate-spin' : ''}`} />
                    <span>{backfillingId === item.id ? 'Executando...' : 'Backfill (Retroativo)'}</span>
                  </button>

                  <button
                    onClick={() => handleTestar(item.id)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-xs font-medium border border-sky-500/20 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Checar</span>
                  </button>

                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleOpenModal(item)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
                      title="Editar Integração"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400"
                      title="Excluir Integração"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Integration Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-lg font-bold text-white">
              {editingInteg ? 'Editar Integração & Múltiplos Grupos' : 'Nova Integração de Conteúdo'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              {/* Seleção Múltipla de Grupos */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center space-x-1">
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                  <span>Grupos de WhatsApp Notificados ({grupoIds.length} selecionados)</span>
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1.5 p-3 rounded-xl bg-white/5 border border-white/10">
                  {grupos.length === 0 ? (
                    <span className="text-xs text-slate-500">Nenhum grupo cadastrado.</span>
                  ) : (
                    grupos.map((g) => (
                      <label key={g.id} className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer hover:text-white select-none">
                        <input
                          type="checkbox"
                          checked={grupoIds.includes(g.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setGrupoIds([...grupoIds, g.id]);
                            } else {
                              setGrupoIds(grupoIds.filter((id) => id !== g.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
                        />
                        <span>{g.nome}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Plataforma / Tipo de Conteúdo</label>
                <select
                  value={tipo}
                  onChange={(e: any) => setTipo(e.target.value)}
                  className="w-full glass-input px-3.5 py-2 rounded-xl text-sm"
                >
                  <option value="youtube" className="bg-slate-900 text-white">YouTube (Canal / Vídeos Novos)</option>
                  <option value="instagram" className="bg-slate-900 text-white">Instagram (Username via RSSHub Container)</option>
                  <option value="blog" className="bg-slate-900 text-white">Blog Institucional (Feed RSS / Postagens)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {tipo === 'instagram' ? 'Nome do Usuário (@instagram)' : tipo === 'youtube' ? 'URL do Canal ou Feed XML' : 'URL do Feed do Blog'}
                </label>
                <input
                  type="text"
                  required
                  value={urlReferencia}
                  onChange={(e) => setUrlReferencia(e.target.value)}
                  placeholder={
                    tipo === 'instagram'
                      ? '@isentidos'
                      : tipo === 'youtube'
                      ? 'https://www.youtube.com/channel/UC123...'
                      : 'https://isentidos.com.br/feed'
                  }
                  className="w-full glass-input px-3.5 py-2 rounded-xl text-sm"
                />
              </div>

              {/* Taxa de Gotejamento */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <label className="block text-xs font-bold text-sky-400 uppercase tracking-wider">
                  💧 Taxa de Gotejamento (Drip Release)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Quantidade de Conteúdos</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={gotejamentoQuantidade}
                      onChange={(e) => setGotejamentoQuantidade(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full glass-input px-3.5 py-2 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Período de Liberação</label>
                    <select
                      value={gotejamentoPeriodo}
                      onChange={(e: any) => setGotejamentoPeriodo(e.target.value)}
                      className="w-full glass-input px-3.5 py-2 rounded-xl text-sm"
                    >
                      <option value="dia" className="bg-slate-900 text-white">por dia</option>
                      <option value="semana" className="bg-slate-900 text-white">por semana (Segunda)</option>
                    </select>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Defina a quantidade de conteúdos da busca retroativa liberados automaticamente por período.
                </p>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="integAtivo"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
                />
                <label htmlFor="integAtivo" className="text-xs font-medium text-slate-300">
                  Integração Ativa para Monitoramento Automático
                </label>
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
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-xs text-white font-semibold shadow-lg shadow-sky-500/25"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
