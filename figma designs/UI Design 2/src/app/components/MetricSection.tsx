import { LucideIcon, ChevronRight } from 'lucide-react';
import { ReactNode } from 'react';

interface MetricSectionProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  iconColor: string;
  children: ReactNode;
}

export default function MetricSection({
  title,
  subtitle,
  icon: Icon,
  iconColor,
  children,
}: MetricSectionProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-md flex items-center justify-center" style={{ backgroundColor: '#2C3E7C' }}>
            <Icon className="text-white" size={22} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-600">{subtitle}</p>
          </div>
        </div>
        <button className="flex items-center gap-1 px-4 py-2 text-sm font-medium hover:bg-gray-50 rounded-md transition-all border border-gray-200" style={{ color: '#2C3E7C' }}>
          View Details
          <ChevronRight size={16} />
        </button>
      </div>

      {children}
    </div>
  );
}
