import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color?: 'green' | 'yellow' | 'red' | 'blue';
  description?: string;
}

const colorMap = {
  green: { bg: 'bg-neon-green/10', border: 'border-neon-green/20', icon: 'text-neon-green', value: 'text-neon-green' },
  yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: 'text-yellow-400', value: 'text-yellow-400' },
  red: { bg: 'bg-red-500/10', border: 'border-red-500/20', icon: 'text-red-400', value: 'text-red-400' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: 'text-blue-400', value: 'text-blue-400' },
};

export default function StatsCard({ label, value, icon: Icon, color = 'blue', description }: StatsCardProps) {
  const colors = colorMap[color];
  return (
    <div className="bg-navy-700 border border-navy-400 rounded-2xl p-5 hover:border-navy-300 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm font-medium">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${colors.value}`}>{value}</p>
          {description && <p className="text-slate-500 text-xs mt-1">{description}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center`}>
          <Icon size={20} className={colors.icon} />
        </div>
      </div>
    </div>
  );
}
