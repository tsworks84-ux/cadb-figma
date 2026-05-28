import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  icon: LucideIcon;
  color: 'slate';
  description: string;
}

const colorConfig = {
  slate: {
    bg: 'bg-blue-50',
    iconBg: '#2C3E7C',
    text: 'text-blue-900',
    trendUp: 'text-emerald-600',
    trendDown: 'text-red-600',
  },
};

export default function MetricCard({
  label,
  value,
  change,
  trend,
  icon: Icon,
  color,
  description,
}: MetricCardProps) {
  const colors = colorConfig[color];
  const isPositive = trend === 'up';

  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200 hover:shadow-md transition-all hover:border-gray-300">
      <div className="flex items-start justify-between mb-4">
        <div className={`${colors.bg} p-2.5 rounded-md`} style={{ backgroundColor: typeof colors.iconBg === 'string' && colors.iconBg.startsWith('#') ? colors.iconBg + '15' : undefined }}>
          <Icon className="text-white" style={{ color: typeof colors.iconBg === 'string' && colors.iconBg.startsWith('#') ? colors.iconBg : undefined }} size={20} />
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium ${
          isPositive ? colors.trendUp : colors.trendDown
        }`}>
          {isPositive ? (
            <TrendingUp size={14} />
          ) : (
            <TrendingDown size={14} />
          )}
          <span>{change}</span>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-600 mb-2">{label}</h3>
        <p className="text-3xl font-semibold text-gray-900 mb-1">{value}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </div>
  );
}
