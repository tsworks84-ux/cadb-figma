import {
  FileText,
  MessageSquare,
  Calendar,
  BookOpen,
  Users,
  Video,
} from 'lucide-react';

export default function QuickActions() {
  const actions = [
    { label: 'Submit Assignment', icon: FileText, color: 'bg-blue-500' },
    { label: 'Join Class', icon: Video, color: 'bg-green-500' },
    { label: 'Message Teacher', icon: MessageSquare, color: 'bg-purple-500' },
    { label: 'View Schedule', icon: Calendar, color: 'bg-orange-500' },
    { label: 'Study Materials', icon: BookOpen, color: 'bg-pink-500' },
    { label: 'Study Groups', icon: Users, color: 'bg-indigo-500' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <button
              key={index}
              className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-100 hover:border-gray-200"
            >
              <div className={`${action.color} w-10 h-10 rounded-lg flex items-center justify-center`}>
                <Icon className="text-white" size={20} />
              </div>
              <span className="text-xs font-medium text-gray-700 text-center">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
