import { BookOpen, ClipboardCheck, TrendingUp, Calendar } from 'lucide-react';

export default function DashboardStats() {
  const stats = [
    {
      label: 'Active Classes',
      value: '6',
      change: '+2 from last term',
      icon: BookOpen,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
    },
    {
      label: 'Pending Assignments',
      value: '4',
      change: '2 due this week',
      icon: ClipboardCheck,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-700',
    },
    {
      label: 'Average Grade',
      value: '87%',
      change: '+5% from last month',
      icon: TrendingUp,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
    },
    {
      label: 'Attendance Rate',
      value: '94%',
      change: '28 of 30 days',
      icon: Calendar,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`${stat.bgColor} p-3 rounded-lg`}>
                <Icon className={stat.textColor} size={24} />
              </div>
            </div>
            <div>
              <p className="text-gray-600 text-sm mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.change}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
