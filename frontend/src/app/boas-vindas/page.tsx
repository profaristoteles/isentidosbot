'use client';

import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { MessageSquareHeart, Plus, Users, Edit2, Trash2, Save, Sparkles, Check, Info, X } from 'lucide-react';

export default function BoasVindasPage() {
  const [boasVindas, setBoasVindas] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBv, setEditingBv] = useState<any | null>(null);
  const [grupoIds, setGrupoIds] = useState<number[]>([]);
  const [mensagem, setMensagem] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bvRes, gruposRes] = await Promise.all([
        api.get('/boas-vindas'),
        api.get('/grupos'),
      ]);
      setBoasVindas(bvRes.data);
      setGrupos(gruposRes.data);
    } catch (err) {
      console.error('Erro ao carregar dados de boas-vindas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = (bv?: any) => {
    if (bv) {
      setEditingBv(bv);
      const initialGrupoIds = bv.grupo_ids && bv.grupo_ids.length > 0
        ? bv.grupo_ids
        : (bv.grupo_id ? [bv.grupo_id] : []);
      setGrupoIds(initialGrupoIds);
      setMensagem(bv.mensagem || '');
      setAtivo(bv.ativo !== undefined ? bv.ativo : true);
    } else {
      setEditingBv(null);
      setGrupoIds(grupos.length > 0 ? [grupos[0].id] : []);
      setMensagem('Seja muito bem-vindo(a) ao grupo {grupo}, {nome}! 👋\n\nÉ um prazer ter você conosco! Fique atento às nossas atualizações e avisos importantes.');
      setAtivo(true);
    }
    setSavedSuccess(false);
    setModalOpen(true);
  };

  const insertVariable = (variable: string) => {
    setMensagem((prev) => prev + variable);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (grupoIds.length === 0) {
      alert('Selecione ao menos um grupo de WhatsApp para vincular a esta mensagem de boas-vindas.');
      return;
    }
    if (!mensagem.trim()) {
      alert('O texto da mensagem é obrigatório.');
      return;
    }

    setSaving(true);
    setSavedSuccess(false);

    try {
      if (editingBv) {
        await api.put(`/boas-vindas/${editingBv.id}`, {
          grupo_ids: grupoIds,
          mensagem: mensagem.trim(),
          ativo,
        });
      } else {
        await api.post('/boas-vindas', {
          grupo_ids: grupoIds,
          mensagem: mensagem.trim(),
          ativo,
        });
      }

      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        setModalOpen(false);
        loadData();
      }, 1000);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao salvar mensagem de boas-vindas.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Deseja realmente excluir esta mensagem de boas-vindas?')) return;
    try {
      await api.delete(`/boas-vindas/${id}`);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao excluir mensagem.');
    }
  };

  // Preview dinâmico com substituição das variáveis
  const firstSelectedGrupo = grupos.find((g) => grupoIds.includes(g.id));
  const previewText = mensagem
    .replace(/\{nome\}/g, 'João Silva')
    .replace(/\{pushName\}/g, 'João Silva')
    .replace(/\{numero\}/g, '85999998888')
    .replace(/\{grupo\}/g, firstSelectedGrupo?.nome || 'Alunos ISP');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <MessageSquareHeart className="w-6 h-6 text-sky-400" />
            <span>Mensagens de Boas-Vindas</span>
          </h1>
          <p className="text-sm text-slate-400">
            Configure recepção automática enviada aos novos membros via Webhook com suporte a múltiplos grupos
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-sky-500/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Mensagem</span>
        </button>
      </div>

      {/* Listing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-500">
            Carregando mensagens de boas-vindas...
          </div>
        ) : boasVindas.length === 0 ? (
          <div className="col-span-full glass-panel p-8 rounded-2xl border border-white/10 text-center space-y-3">
            <MessageSquareHeart className="w-10 h-10 text-slate-500 mx-auto" />
            <p className="text-sm text-slate-400">
              Nenhuma mensagem de boas-vindas cadastrada.
            </p>
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Primeira Mensagem</span>
            </button>
          </div>
        ) : (
          boasVindas.map((bv) => (
            <div
              key={bv.id}
              className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col justify-between space-y-4 hover:border-white/20 transition-all"
            >
              <div className="space-y-3">
                {/* Header: Grupos & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-1.5 text-xs text-sky-400 font-semibold">
                      <Users className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        {bv.grupos && bv.grupos.length > 0
                          ? `${bv.grupos.length} grupo(s) vinculado(s)`
                          : 'Nenhum grupo vinculado'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium line-clamp-2" title={bv.grupos?.map((g: any) => g.nome).join(', ')}>
                      {bv.grupos && bv.grupos.length > 0
                        ? bv.grupos.map((g: any) => g.nome).join(', ')
                        : 'Sem grupos'}
                    </p>
                  </div>

                  {bv.ativo ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold flex-shrink-0">
                      Ativo
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-semibold flex-shrink-0">
                      Inativo
                    </span>
                  )}
                </div>

                {/* Mensagem Body */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-300">
                  <p className="line-clamp-4 whitespace-pre-wrap font-sans leading-relaxed">
                    {bv.mensagem}
                  </p>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-white/5">
                <button
                  onClick={() => handleOpenModal(bv)}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-sky-500/20 text-slate-300 hover:text-sky-400 text-xs font-medium transition-colors"
                  title="Editar Mensagem"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
                <button
                  onClick={() => handleDelete(bv.id)}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 text-xs font-medium transition-colors"
                  title="Excluir Mensagem"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Editor & Preview Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-4xl glass-panel p-6 rounded-2xl border border-white/10 space-y-6 max-h-[90vh] overflow-y-auto my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <MessageSquareHeart className="w-5 h-5 text-sky-400" />
                <span>{editingBv ? 'Editar Mensagem de Boas-Vindas' : 'Nova Mensagem de Boas-Vindas'}</span>
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg bg-white/5 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Form Side */}
              <div className="lg:col-span-3 space-y-5">
                {/* Seleção Múltipla de Grupos */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center space-x-1 uppercase tracking-wider">
                    <Users className="w-3.5 h-3.5 text-sky-400" />
                    <span>Grupos de WhatsApp Notificados ({grupoIds.length} selecionados)</span>
                  </label>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 p-3 rounded-xl bg-white/5 border border-white/10">
                    {grupos.length === 0 ? (
                      <span className="text-xs text-slate-500">Nenhum grupo cadastrado.</span>
                    ) : (
                      grupos.map((g) => (
                        <label key={g.id} className="flex items-center space-x-2.5 text-xs text-slate-200 cursor-pointer hover:text-white select-none py-0.5">
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

                {/* Variables Shortcuts */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-400 flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Inserir Variáveis Dinâmicas:</span>
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => insertVariable('{nome}')}
                      className="px-3 py-1 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-300 hover:bg-sky-500/20 text-xs font-mono"
                    >
                      + &#123;nome&#125;
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable('{grupo}')}
                      className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 text-xs font-mono"
                    >
                      + &#123;grupo&#125;
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable('{numero}')}
                      className="px-3 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 text-xs font-mono"
                    >
                      + &#123;numero&#125;
                    </button>
                  </div>
                </div>

                {/* Textarea */}
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                      Texto da Mensagem de Boas-Vindas
                    </label>
                    <textarea
                      rows={6}
                      required
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                      placeholder="Escreva a mensagem..."
                      className="w-full glass-input p-4 rounded-xl text-sm font-sans"
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="checkbox"
                      id="bvAtivo"
                      checked={ativo}
                      onChange={(e) => setAtivo(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
                    />
                    <label htmlFor="bvAtivo" className="text-xs font-medium text-slate-300">
                      Ativar envio automático nestes grupos ao entrar participante
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
                      disabled={saving}
                      className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-sky-500/25 transition-all disabled:opacity-50"
                    >
                      {savedSuccess ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-300" />
                          <span>Salvo com Sucesso!</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>{saving ? 'Salvando...' : 'Salvar Boas-Vindas'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Preview Side */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Pré-visualização no WhatsApp
                </h3>
                <div className="p-4 rounded-2xl bg-[#0b141a] border border-white/10 min-h-[250px] flex flex-col justify-end space-y-2">
                  <div className="self-start max-w-[95%] p-3 rounded-2xl rounded-tl-none bg-[#202c33] text-slate-100 text-xs shadow-md space-y-1">
                    <span className="text-[10px] font-bold text-[#25D366] block">
                      {firstSelectedGrupo?.nome || 'Grupo de WhatsApp'}
                    </span>
                    <p className="whitespace-pre-wrap leading-relaxed">{previewText}</p>
                    <span className="text-[9px] text-slate-400 float-right mt-1">15:30</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[11px] text-sky-300 flex items-start space-x-2">
                  <Info className="w-4 h-4 text-sky-400 mt-0.5 flex-shrink-0" />
                  <span>
                    O envio ocorre via Evolution API automaticamente para cada novo participante adicionado aos grupos vinculados.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
