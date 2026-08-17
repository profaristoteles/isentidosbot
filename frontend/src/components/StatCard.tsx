'use client';

import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  description?: string;
  icon: LucideIcon;
  color: 'sky' | 'emerald' | 'amber' | 'indigo' | 'purple';
}

const colorMap = {
  sky: 'from-sky-500/20 to-sky-600/5 text-sky-400 border-sky-500/30',
  emerald: 'from-emerald-500/20 to-emerald-600/5 text-emerald-400 border-emerald-500/30',
  amber: 'from-amber-500/20 to-amber-600/5 text-amber-400 border-amber-500/30',
  indigo: 'from-indigo-500/20 to-indigo-600/5 text-indigo-400 border-indigo-500/30',
  purple: 'from-purple-500/20 to-purple-600/5 text-purple-400 border-purple-500/30',
};

export default function StatCard({ title, value, description, icon: Icon, color }: StatCardProps) {
  return (
    <div className={`p-6 rounded-2xl glass-panel bg-gradient-to-br ${colorMap[color]} border transition-all duration-200 hover:scale-[1.02]`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-extrabold text-white mt-2">{value}</p>
          {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
        </div>
        <div className="p-3 rounded-xl bg-white/10 text-white backdrop-blur-md">
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
