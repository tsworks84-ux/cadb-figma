import {
  Users,
  Briefcase,
  UserCheck,
  TrendingUp,
  ClipboardCheck,
  FileCheck,
  Activity,
  Star,
  Headphones,
  Clock,
  AlertCircle,
  ChevronRight,
  BarChart3,
} from 'lucide-react';
import MetricCard from './MetricCard';
import MetricSection from './MetricSection';

export default function AdminDashboard() {
  const studentMetrics = [
    {
      label: 'Average Daily Attendance',
      value: '92.5%',
      change: '+2.3%',
      trend: 'up',
      icon: UserCheck,
      color: 'slate',
      description: 'Last 30 days',
    },
    {
      label: 'Average Test Performance',
      value: '78.4%',
      change: '+5.1%',
      trend: 'up',
      icon: TrendingUp,
      color: 'slate',
      description: 'Across all subjects',
    },
    {
      label: 'Average Assignment Submission Rate',
      value: '85.7%',
      change: '-1.2%',
      trend: 'down',
      icon: FileCheck,
      color: 'slate',
      description: 'On-time submissions',
    },
  ];

  const staffMetrics = [
    {
      label: 'Average Employee Workload',
      value: '78%',
      change: '+3.5%',
      trend: 'up',
      icon: Activity,
      color: 'slate',
      description: 'Capacity utilization',
    },
    {
      label: 'Average Employee Quality Score',
      value: '4.6/5',
      change: '+0.2',
      trend: 'up',
      icon: Star,
      color: 'slate',
      description: 'Based on peer reviews',
    },
    {
      label: 'Total Number of Employees',
      value: '247',
      change: '+8',
      trend: 'up',
      icon: Briefcase,
      color: 'slate',
      description: 'Active staff members',
    },
  ];

  const parentMetrics = [
    {
      label: 'Total Number of Service Requests',
      value: '124',
      change: '+12',
      trend: 'up',
      icon: Headphones,
      color: 'slate',
      description: 'This month',
    },
    {
      label: 'Average Turn Around Time',
      value: '2.3 days',
      change: '-0.5 days',
      trend: 'down',
      icon: Clock,
      color: 'slate',
      description: 'Resolution time',
    },
    {
      label: 'Number of Open SRs',
      value: '18',
      change: '-6',
      trend: 'down',
      icon: AlertCircle,
      color: 'slate',
      description: 'Pending resolution',
    },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Students Front */}
      <MetricSection
        title="Student Performance Metrics"
        subtitle="Academic performance and attendance analytics"
        icon={Users}
        iconColor=""
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {studentMetrics.map((metric, index) => (
            <MetricCard key={index} {...metric} />
          ))}
        </div>
      </MetricSection>

      {/* Staff Front */}
      <MetricSection
        title="Faculty & Staff Analytics"
        subtitle="Employee performance and workforce metrics"
        icon={Briefcase}
        iconColor=""
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staffMetrics.map((metric, index) => (
            <MetricCard key={index} {...metric} />
          ))}
        </div>
      </MetricSection>

      {/* Parents Front */}
      <MetricSection
        title="Parent Relations & Support"
        subtitle="Service requests and stakeholder engagement"
        icon={Headphones}
        iconColor=""
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {parentMetrics.map((metric, index) => (
            <MetricCard key={index} {...metric} />
          ))}
        </div>
      </MetricSection>

      {/* Quick Insights Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ backgroundColor: '#2C3E7C20' }}>
              <BarChart3 style={{ color: '#2C3E7C' }} size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Administrative Alerts</h3>
              <p className="text-sm text-gray-600">Key highlights and notifications</p>
            </div>
          </div>
          <button className="flex items-center gap-1 text-sm font-medium border border-gray-200 px-3 py-1.5 rounded-md hover:bg-gray-50" style={{ color: '#2C3E7C' }}>
            View All
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-md">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-emerald-600 rounded-md flex items-center justify-center flex-shrink-0">
                <TrendingUp className="text-white" size={16} />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 text-sm mb-1">
                  Test Performance Improved
                </h4>
                <p className="text-xs text-gray-600">
                  Grade 10 mathematics scores increased by 12% this quarter
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-md" style={{ backgroundColor: '#F2994A15', borderColor: '#F2994A50', borderWidth: '1px' }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F2994A' }}>
                <AlertCircle className="text-white" size={16} />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 text-sm mb-1">
                  Priority Service Requests
                </h4>
                <p className="text-xs text-gray-600">
                  5 service requests require immediate administrative review
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
