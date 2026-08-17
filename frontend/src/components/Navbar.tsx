'use client';

import { useAuth } from '../context/AuthContext';
import { LogOut, UserCheck, ShieldCheck } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (pathname === '/login') return null;

  return (
    <header className="h-16 glass-panel border-b border-white/10 px-6 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <span className="flex h-3 w-3 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
        </span>
        <span className="text-sm font-medium text-slate-300">Sistema Conectado & Operacional</span>
      </div>

      {user && (
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            <span className="text-slate-200 font-medium">{user.email}</span>
          </div>

          <button
            onClick={logout}
            className="flex items-center space-x-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg transition-colors border border-rose-500/20"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      )}
    </header>
  );
}
