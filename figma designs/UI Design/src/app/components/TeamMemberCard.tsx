import {
  Mail,
  Phone,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Clock,
  MoreVertical,
  Activity,
  Award,
  AlertCircle,
  User,
} from 'lucide-react';

interface TeamMemberCardProps {
  member: {
    id: number;
    name: string;
    role: string;
    department: string;
    email: string;
    phone: string;
    joinDate: string;
    avatar: string;
    status: string;
    employeeId: string;
    workload: number;
    performance: number;
    activeTasks: number;
    completedTasks: number;
    pendingLeaves: number;
    usedLeaves: number;
    totalLeaves: number;
    attendanceRate: number;
    upcomingReview: string;
    recentActivity: string;
  };
}

export default function TeamMemberCard({ member }: TeamMemberCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return { bg: '#10b98115', text: '#059669', border: '#10b98130' };
      case 'on-leave':
        return { bg: '#F2994A15', text: '#F2994A', border: '#F2994A30' };
      default:
        return { bg: '#gray-50', text: '#gray-700', border: '#gray-200' };
    }
  };

  const statusColors = getStatusColor(member.status);

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0"
            style={{ backgroundColor: '#2C3E7C' }}
          >
            {member.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-1">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{member.name}</h3>
                <p className="text-sm text-gray-600">{member.role}</p>
              </div>
              <button className="p-2 hover:bg-gray-50 rounded-md">
                <MoreVertical size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span
                className="px-2 py-1 rounded-md text-xs font-medium"
                style={{
                  backgroundColor: statusColors.bg,
                  color: statusColors.text,
                  border: `1px solid ${statusColors.border}`,
                }}
              >
                {member.status === 'active' ? 'Active' : 'On Leave'}
              </span>
              <span className="text-xs text-gray-500">{member.employeeId}</span>
              <span className="text-xs text-gray-500">•</span>
              <span className="text-xs text-gray-500">{member.department}</span>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="flex gap-4 mb-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Mail size={14} />
            <span className="text-xs">{member.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone size={14} />
            <span className="text-xs">{member.phone}</span>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 py-4 border-t border-b border-gray-200 mb-4">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Activity size={14} className="text-gray-500" />
              <span className="text-xs text-gray-600">Workload</span>
            </div>
            <div className="flex items-baseline gap-1">
              <p className="text-lg font-semibold text-gray-900">{member.workload}%</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
              <div
                className="h-1 rounded-full"
                style={{
                  width: `${member.workload}%`,
                  backgroundColor:
                    member.workload > 90 ? '#E07A5F' : member.workload > 70 ? '#F2994A' : '#10b981',
                }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1 mb-1">
              <Award size={14} className="text-gray-500" />
              <span className="text-xs text-gray-600">Performance</span>
            </div>
            <div className="flex items-baseline gap-1">
              <p className="text-lg font-semibold text-emerald-600">{member.performance}</p>
              <span className="text-xs text-gray-500">/5.0</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1 mb-1">
              <CheckCircle2 size={14} className="text-gray-500" />
              <span className="text-xs text-gray-600">Tasks</span>
            </div>
            <p className="text-lg font-semibold text-gray-900">{member.activeTasks}</p>
            <p className="text-xs text-gray-500">{member.completedTasks} done</p>
          </div>

          <div>
            <div className="flex items-center gap-1 mb-1">
              <Calendar size={14} className="text-gray-500" />
              <span className="text-xs text-gray-600">Leaves</span>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {member.usedLeaves}/{member.totalLeaves}
            </p>
            {member.pendingLeaves > 0 && (
              <p className="text-xs" style={{ color: '#F2994A' }}>
                {member.pendingLeaves} pending
              </p>
            )}
          </div>
        </div>

        {/* Additional Info */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Attendance Rate</span>
            <span className="font-medium text-gray-900">{member.attendanceRate}%</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Upcoming Review</span>
            <span className="font-medium text-gray-900">
              {new Date(member.upcomingReview).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          <div className="flex items-start justify-between text-sm">
            <span className="text-gray-600">Recent Activity</span>
            <span className="font-medium text-gray-900 text-right max-w-[60%]">
              {member.recentActivity}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            className="flex-1 px-4 py-2 border rounded-md text-sm font-medium hover:bg-gray-50"
            style={{ borderColor: '#2C3E7C', color: '#2C3E7C' }}
          >
            View Profile
          </button>
          <button className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
            Assign Task
          </button>
          <button className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
            1-on-1
          </button>
        </div>
      </div>
    </div>
  );
}
