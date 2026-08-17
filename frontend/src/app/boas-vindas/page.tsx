'use client';

import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { MessageSquareHeart, Save, Sparkles, Check, Info } from 'lucide-react';

export default function BoasVindasPage() {
  const [grupos, setGrupos] = useState<any[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState<number | ''>('');
  const [mensagem, setMensagem] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [gruposRes, bvRes] = await Promise.all([
        api.get('/grupos'),
        api.get('/boas-vindas'),
      ]);

      const loadedGrupos = gruposRes.data;
      const loadedBv = bvRes.data;

      setGrupos(loadedGrupos);

      if (loadedGrupos.length > 0) {
        const firstGrupoId = loadedGrupos[0].id;
        setSelectedGrupoId(firstGrupoId);
        
        const existingBv = loadedBv.find((b: any) => b.grupo_id === firstGrupoId);
        if (existingBv) {
          setMensagem(existingBv.mensagem);
          setAtivo(existingBv.ativo);
        } else {
          setMensagem('Seja muito bem-vindo(a) ao grupo {grupo}, {nome}! 👋\n\nÉ um prazer ter você conosco! Fique atento às nossas atualizações e avisos importantes.');
          setAtivo(true);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados de boas-vindas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectGrupo = async (grupoId: number) => {
    setSelectedGrupoId(grupoId);
    try {
      const res = await api.get('/boas-vindas');
      const existing = res.data.find((b: any) => b.grupo_id === grupoId);
      if (existing) {
        setMensagem(existing.mensagem);
        setAtivo(existing.ativo);
      } else {
        const grupo = grupos.find((g) => g.id === grupoId);
        setMensagem(`Seja muito bem-vindo(a) ao grupo ${grupo?.nome || '{grupo}'}, {nome}! 👋\n\nÉ um prazer ter você conosco! Fique atento às nossas atualizações e avisos importantes.`);
        setAtivo(true);
      }
    } catch (err) {
      console.error('Erro ao alternar grupo:', err);
    }
  };

  const insertVariable = (variable: string) => {
    setMensagem((prev) => prev + variable);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGrupoId) return;

    setSaving(true);
    setSavedSuccess(false);

    try {
      await api.post('/boas-vindas', {
        grupo_id: selectedGrupoId,
        mensagem,
        ativo,
      });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao salvar mensagem de boas-vindas.');
    } finally {
      setSaving(false);
    }
  };

  const selectedGrupo = grupos.find((g) => g.id === Number(selectedGrupoId));

  // Preview dinâmico com substituição das variáveis
  const previewText = mensagem
    .replace(/\{nome\}/g, 'João Silva')
    .replace(/\{pushName\}/g, 'João Silva')
    .replace(/\{numero\}/g, '85999998888')
    .replace(/\{grupo\}/g, selectedGrupo?.nome || 'Alunos ISP');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
          <MessageSquareHeart className="w-6 h-6 text-sky-400" />
          <span>Mensagens de Boas-Vindas</span>
        </h1>
        <p className="text-sm text-slate-400">Configure recepção automática enviada aos novos membros via Webhook</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Editor Form Panel */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          {/* Grupo Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              Selecione o Grupo
            </label>
            <select
              value={selectedGrupoId}
              onChange={(e) => handleSelectGrupo(Number(e.target.value))}
              className="w-full glass-input px-4 py-2.5 rounded-xl text-sm"
            >
              {grupos.map((g) => (
                <option key={g.id} value={g.id} className="bg-slate-900 text-white">
                  {g.nome} ({g.jid_whatsapp})
                </option>
              ))}
            </select>
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

          {/* Text Area */}
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

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="bvAtivo"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
                />
                <label htmlFor="bvAtivo" className="text-xs font-medium text-slate-300">
                  Ativar envio automático neste grupo ao entrar participante
                </label>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-sky-500/25 transition-all disabled:opacity-50"
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

          <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-300 flex items-start space-x-2">
            <Info className="w-4 h-4 text-sky-400 mt-0.5 flex-shrink-0" />
            <span>
              Toda vez que um novo participante entrar no grupo via link de convite ou adição direta, a Evolution API disparará um webhook e a mensagem acima será enviada instantaneamente.
            </span>
          </div>
        </div>

        {/* WhatsApp Preview Card */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Pré-visualização no WhatsApp
          </h2>

          {/* WhatsApp Chat Bubble Simulation */}
          <div className="p-4 rounded-2xl bg-[#0b141a] border border-white/10 min-h-[220px] flex flex-col justify-end space-y-2">
            <div className="self-start max-w-[88%] p-3 rounded-2xl rounded-tl-none bg-[#202c33] text-slate-100 text-xs shadow-md space-y-1">
              <span className="text-[10px] font-bold text-[#25D366] block">
                {selectedGrupo?.nome || 'Grupo de WhatsApp'}
              </span>
              <p className="whitespace-pre-wrap leading-relaxed">{previewText}</p>
              <span className="text-[9px] text-slate-400 float-right mt-1">15:30</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
