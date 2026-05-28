import {
  Eye,
  CheckCircle2,
  Users,
  Calendar,
  AlertCircle,
  MoreVertical,
  TrendingUp,
} from 'lucide-react';

interface NoticeCardProps {
  notice: {
    id: number;
    title: string;
    content: string;
    category: string;
    audience: string[];
    postedBy: string;
    postedDate: string;
    priority: 'high' | 'medium' | 'low';
    totalRecipients: number;
    acknowledged: number;
    viewed: number;
    status: string;
  };
}

export default function NoticeCard({ notice }: NoticeCardProps) {
  const acknowledgmentRate = Math.round((notice.acknowledged / notice.totalRecipients) * 100);
  const viewRate = Math.round((notice.viewed / notice.totalRecipients) * 100);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return '#E07A5F';
      case 'medium':
        return '#F2994A';
      case 'low':
        return '#A8D08D';
      default:
        return '#gray-400';
    }
  };

  const getAudienceBadgeColor = (audience: string) => {
    switch (audience) {
      case 'students':
        return { bg: '#2C3E7C15', text: '#2C3E7C' };
      case 'staff':
        return { bg: '#F2994A15', text: '#F2994A' };
      case 'parents':
        return { bg: '#A8D08D30', text: '#689F5B' };
      default:
        return { bg: '#gray-100', text: '#gray-700' };
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      {/* Priority Indicator */}
      <div
        className="h-1 rounded-t-lg"
        style={{ backgroundColor: getPriorityColor(notice.priority) }}
      ></div>

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">{notice.title}</h3>
              {notice.priority === 'high' && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-red-700 bg-red-50">
                  <AlertCircle size={12} />
                  High Priority
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 line-clamp-2">{notice.content}</p>
          </div>
          <button className="p-2 hover:bg-gray-50 rounded-md">
            <MoreVertical size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Meta Info */}
        <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <Calendar size={14} />
            {new Date(notice.postedDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          <span>•</span>
          <span>{notice.postedBy}</span>
          <span>•</span>
          <span
            className="px-2 py-0.5 rounded text-xs font-medium"
            style={{ backgroundColor: '#2C3E7C15', color: '#2C3E7C' }}
          >
            {notice.category}
          </span>
        </div>

        {/* Audience Tags */}
        <div className="flex items-center gap-2 mb-4">
          <Users size={16} className="text-gray-400" />
          <div className="flex gap-2">
            {notice.audience.map((aud) => {
              const colors = getAudienceBadgeColor(aud);
              return (
                <span
                  key={aud}
                  className="px-2 py-1 rounded-md text-xs font-medium capitalize"
                  style={{ backgroundColor: colors.bg, color: colors.text }}
                >
                  {aud}
                </span>
              );
            })}
          </div>
        </div>

        {/* Acknowledgment Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users size={16} className="text-gray-500" />
              <span className="text-xs text-gray-600">Total Recipients</span>
            </div>
            <p className="text-lg font-semibold text-gray-900">{notice.totalRecipients}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Eye size={16} className="text-blue-500" />
              <span className="text-xs text-gray-600">Viewed</span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-lg font-semibold text-gray-900">{notice.viewed}</p>
              <span className="text-xs text-blue-600 font-medium">({viewRate}%)</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span className="text-xs text-gray-600">Acknowledged</span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-lg font-semibold text-gray-900">{notice.acknowledged}</p>
              <span
                className={`text-xs font-medium ${
                  acknowledgmentRate >= 80
                    ? 'text-emerald-600'
                    : acknowledgmentRate >= 60
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}
              >
                ({acknowledgmentRate}%)
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>Acknowledgment Progress</span>
            <span>{acknowledgmentRate}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${acknowledgmentRate}%`,
                backgroundColor:
                  acknowledgmentRate >= 80
                    ? '#10b981'
                    : acknowledgmentRate >= 60
                    ? '#F2994A'
                    : '#E07A5F',
              }}
            ></div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <button
            className="flex-1 px-4 py-2 border rounded-md text-sm font-medium hover:bg-gray-50"
            style={{ borderColor: '#2C3E7C', color: '#2C3E7C' }}
          >
            View Details
          </button>
          <button className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
            Send Reminder
          </button>
        </div>
      </div>
    </div>
  );
}
