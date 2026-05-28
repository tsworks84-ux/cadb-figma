import { TrendingUp, Users, CheckCircle2, Eye } from 'lucide-react';

interface NoticeAnalyticsProps {
  notices: Array<{
    totalRecipients: number;
    acknowledged: number;
    viewed: number;
  }>;
}

export default function NoticeAnalytics({ notices }: NoticeAnalyticsProps) {
  const totalRecipients = notices.reduce((acc, n) => acc + n.totalRecipients, 0);
  const totalAcknowledged = notices.reduce((acc, n) => acc + n.acknowledged, 0);
  const totalViewed = notices.reduce((acc, n) => acc + n.viewed, 0);

  const avgAcknowledgmentRate = totalRecipients > 0
    ? Math.round((totalAcknowledged / totalRecipients) * 100)
    : 0;
  const avgViewRate = totalRecipients > 0
    ? Math.round((totalViewed / totalRecipients) * 100)
    : 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
        Engagement Analytics
      </h3>

      <div className="space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users className="text-blue-600" size={16} />
            </div>
            <p className="text-xs text-gray-600 font-medium">Total Reach</p>
          </div>
          <p className="text-2xl font-semibold text-gray-900">{totalRecipients.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Across all notices</p>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <Eye className="text-purple-600" size={16} />
            </div>
            <p className="text-xs text-gray-600 font-medium">View Rate</p>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <p className="text-2xl font-semibold text-gray-900">{avgViewRate}%</p>
            <span className="text-xs text-gray-500">({totalViewed})</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-purple-600 h-1.5 rounded-full"
              style={{ width: `${avgViewRate}%` }}
            ></div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="text-emerald-600" size={16} />
            </div>
            <p className="text-xs text-gray-600 font-medium">Acknowledgment</p>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <p className="text-2xl font-semibold text-gray-900">{avgAcknowledgmentRate}%</p>
            <span className="text-xs text-gray-500">({totalAcknowledged})</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-emerald-600 h-1.5 rounded-full"
              style={{ width: `${avgAcknowledgmentRate}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
