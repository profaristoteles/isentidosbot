'use client';

import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { Users, Plus, RefreshCw, Trash2, Edit2, CheckCircle, XCircle } from 'lucide-react';

export default function GruposPage() {
  const [grupos, setGrupos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [nome, setNome] = useState('');
  const [jidWhatsapp, setJidWhatsapp] = useState('');
  const [ativo, setAtivo] = useState(true);

  const loadGrupos = async () => {
    setLoading(true);
    try {
      const res = await api.get('/grupos');
      setGrupos(res.data);
    } catch (err) {
      console.error('Erro ao carregar grupos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGrupos();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/grupos/sync');
      alert(res.data.message);
      loadGrupos();
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err?.message || 'Erro ao sincronizar com Evolution API.';
      alert(`Erro de Sincronização: ${errorMsg}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenModal = (grupo?: any) => {
    if (grupo) {
      setEditingGroup(grupo);
      setNome(grupo.nome);
      setJidWhatsapp(grupo.jid_whatsapp);
      setAtivo(grupo.ativo);
    } else {
      setEditingGroup(null);
      setNome('');
      setJidWhatsapp('');
      setAtivo(true);
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingGroup) {
        await api.put(`/grupos/${editingGroup.id}`, { nome, jid_whatsapp: jidWhatsapp, ativo });
      } else {
        await api.post('/grupos', { nome, jid_whatsapp: jidWhatsapp, ativo });
      }
      setModalOpen(false);
      loadGrupos();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao salvar grupo.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Deseja realmente remover este grupo da gestão?')) return;
    try {
      await api.delete(`/grupos/${id}`);
      loadGrupos();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao excluir grupo.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Users className="w-6 h-6 text-sky-400" />
            <span>Grupos de WhatsApp</span>
          </h1>
          <p className="text-sm text-slate-400">Cadastre e sincronize os grupos gerenciados via Evolution API</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-sky-400 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Sincronizando...' : 'Sincronizar Evolution API'}</span>
          </button>

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-sky-500/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Grupo</span>
          </button>
        </div>
      </div>

      {/* Groups Table */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-white/5 border-b border-white/10 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-4 px-6">Nome do Grupo</th>
                <th className="py-4 px-6">JID do WhatsApp</th>
                <th className="py-4 px-6">Boas-Vindas</th>
                <th className="py-4 px-6">Agendamentos</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                    Carregando grupos cadastrados...
                  </td>
                </tr>
              ) : grupos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                    Nenhum grupo cadastrado. Clique em "Sincronizar Evolution API" ou "Cadastrar Grupo".
                  </td>
                </tr>
              ) : (
                grupos.map((grupo) => (
                  <tr key={grupo.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-6 font-medium text-white">{grupo.nome}</td>
                    <td className="py-4 px-6 font-mono text-xs text-slate-400">{grupo.jid_whatsapp}</td>
                    <td className="py-4 px-6 text-xs">
                      {grupo.boas_vindas_mensagem ? (
                        <span className="text-emerald-400 flex items-center space-x-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Configurada</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 flex items-center space-x-1">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Não ativada</span>
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-400">
                      {grupo.agendamentos_pendentes > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold">
                          {grupo.agendamentos_pendentes} pendente(s)
                        </span>
                      ) : (
                        <span>Nenhum pendente</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      {grupo.ativo ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
                          Ativo
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-medium">
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        onClick={() => handleOpenModal(grupo)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-sky-500/20 text-slate-300 hover:text-sky-400 transition-colors"
                        title="Editar Grupo"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(grupo.id)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition-colors"
                        title="Excluir Grupo"
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

      {/* Group Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-lg font-bold text-white">
              {editingGroup ? 'Editar Grupo' : 'Cadastrar Novo Grupo'}
            </h2>

            <form onSubmit={handleSave} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nome do Grupo</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Alunos ISP - Turma 2026"
                  className="w-full glass-input px-3.5 py-2 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">JID do WhatsApp</label>
                <input
                  type="text"
                  required
                  value={jidWhatsapp}
                  onChange={(e) => setJidWhatsapp(e.target.value)}
                  placeholder="120363048912345678@g.us"
                  className="w-full glass-input px-3.5 py-2 rounded-xl text-sm font-mono"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
                />
                <label htmlFor="ativo" className="text-xs font-medium text-slate-300">
                  Grupo Ativo para Automações
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
