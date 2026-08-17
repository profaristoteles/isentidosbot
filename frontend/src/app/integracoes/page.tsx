'use client';

import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { Share2, Plus, Youtube, Instagram, Rss, Play, Trash2, Edit2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function IntegracoesPage() {
  const [integracoes, setIntegracoes] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingInteg, setEditingInteg] = useState<any | null>(null);
  const [grupoId, setGrupoId] = useState<number | ''>('');
  const [tipo, setTipo] = useState<'youtube' | 'instagram' | 'blog'>('youtube');
  const [urlReferencia, setUrlReferencia] = useState('');
  const [intervaloMinutos, setIntervaloMinutos] = useState(15);
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
      if (grRes.data.length > 0 && !grupoId) {
        setGrupoId(grRes.data[0].id);
      }
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
      setGrupoId(integ.grupo_id);
      setTipo(integ.tipo);
      setUrlReferencia(integ.url_referencia);
      setIntervaloMinutos(integ.intervalo_minutos || 15);
      setAtivo(integ.ativo);
    } else {
      setEditingInteg(null);
      setGrupoId(grupos.length > 0 ? grupos[0].id : '');
      setTipo('youtube');
      setUrlReferencia('');
      setIntervaloMinutos(15);
      setAtivo(true);
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grupoId || !urlReferencia) return;

    try {
      if (editingInteg) {
        await api.put(`/integracoes/${editingInteg.id}`, {
          grupo_id: grupoId,
          tipo,
          url_referencia: urlReferencia,
          intervalo_minutos: intervaloMinutos,
          ativo,
        });
      } else {
        await api.post('/integracoes', {
          grupo_id: grupoId,
          tipo,
          url_referencia: urlReferencia,
          intervalo_minutos: intervaloMinutos,
          ativo,
        });
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao salvar integração.');
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
            Monitoramento de YouTube, Instagram (via RSSHub interno) e Blogs Institucionais (isentidos.com.br / isppreparatorios.com.br)
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
                      <p className="text-xs text-sky-400 font-medium">{item.grupo_nome}</p>
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

                <div className="mt-4 space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Referência / Canal / Feed:</span>
                    <span className="text-slate-200 font-mono break-all">{item.url_referencia}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Último Item Notificado:</span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {item.ultimo_id_verificado || 'Ainda não checado'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <button
                  onClick={() => handleTestar(item.id)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-xs font-medium border border-sky-500/20 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Checar Agora</span>
                </button>

                <div className="flex space-x-2">
                  <button
                    onClick={() => handleOpenModal(item)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
              {editingInteg ? 'Editar Integração' : 'Nova Integração de Conteúdo'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Grupo de WhatsApp Notificado</label>
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

              <div className="flex items-center space-x-2 pt-2">
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
