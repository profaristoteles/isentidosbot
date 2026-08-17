'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  MessageSquareHeart, 
  CalendarClock, 
  Share2, 
  History,
  Bot
} from 'lucide-react';

const menuItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/grupos', label: 'Grupos do WhatsApp', icon: Users },
  { href: '/boas-vindas', label: 'Boas-Vindas', icon: MessageSquareHeart },
  { href: '/agendamentos', label: 'Envios Agendados', icon: CalendarClock },
  { href: '/integracoes', label: 'Integrações de Conteúdo', icon: Share2 },
  { href: '/logs', label: 'Logs de Eventos', icon: History },
];

export default function Sidebar() {
  const pathname = usePathname();

  if (pathname === '/login') return null;

  return (
    <aside className="w-64 glass-panel border-r border-white/10 flex flex-col min-h-screen">
      {/* Brand / Title */}
      <div className="p-6 border-b border-white/10 flex items-center space-x-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/30">
          <Bot className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-lg text-white leading-tight">Bot de Grupos</h1>
          <p className="text-xs text-sky-400 font-medium">Instituto Sentidos & ISP</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-sky-500/20 to-indigo-500/10 text-sky-400 border border-sky-500/30 shadow-md shadow-sky-900/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Branding Info */}
      <div className="p-4 m-4 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-400 space-y-1">
        <div className="flex items-center justify-between text-slate-300 font-medium">
          <span>Timezone:</span>
          <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px] font-mono">
            UTC-3 (Fortaleza)
          </span>
        </div>
        <div className="flex items-center justify-between text-slate-400 text-[11px]">
          <span>Evolution API:</span>
          <span className="text-slate-300">v2.3.7</span>
        </div>
      </div>
    </aside>
  );
}
