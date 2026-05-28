import { TrendingUp, Activity, Users, Award } from 'lucide-react';

interface TeamAnalyticsProps {
  members: Array<{
    workload: number;
    performance: number;
    attendanceRate: number;
  }>;
}

export default function TeamAnalytics({ members }: TeamAnalyticsProps) {
  const avgWorkload = Math.round(
    members.reduce((acc, m) => acc + m.workload, 0) / members.length
  );
  const avgPerformance =
    Math.round((members.reduce((acc, m) => acc + m.performance, 0) / members.length) * 10) / 10;
  const avgAttendance = Math.round(
    members.reduce((acc, m) => acc + m.attendanceRate, 0) / members.length
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
        Team Analytics
      </h3>

      <div className="space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#2C3E7C20' }}
            >
              <Activity style={{ color: '#2C3E7C' }} size={16} />
            </div>
            <p className="text-xs text-gray-600 font-medium">Avg. Workload</p>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <p className="text-2xl font-semibold text-gray-900">{avgWorkload}%</p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full"
              style={{
                width: `${avgWorkload}%`,
                backgroundColor:
                  avgWorkload > 90 ? '#E07A5F' : avgWorkload > 70 ? '#F2994A' : '#10b981',
              }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {avgWorkload > 90
              ? 'Team is overloaded'
              : avgWorkload > 70
              ? 'Healthy workload'
              : 'Capacity available'}
          </p>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Award className="text-emerald-600" size={16} />
            </div>
            <p className="text-xs text-gray-600 font-medium">Avg. Performance</p>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <p className="text-2xl font-semibold text-emerald-600">{avgPerformance}</p>
            <span className="text-sm text-gray-500">/5.0</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-emerald-600 h-1.5 rounded-full"
              style={{ width: `${(avgPerformance / 5) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users className="text-blue-600" size={16} />
            </div>
            <p className="text-xs text-gray-600 font-medium">Avg. Attendance</p>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <p className="text-2xl font-semibold text-gray-900">{avgAttendance}%</p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full"
              style={{ width: `${avgAttendance}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
