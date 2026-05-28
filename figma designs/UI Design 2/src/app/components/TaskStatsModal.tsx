import { X, TrendingUp, Target, Clock, Award, Calendar, CheckCircle2, Zap } from 'lucide-react';

interface TaskStatsModalProps {
  onClose: () => void;
}

export default function TaskStatsModal({ onClose }: TaskStatsModalProps) {
  const weeklyData = [
    { day: 'Mon', completed: 5, pending: 2 },
    { day: 'Tue', completed: 7, pending: 1 },
    { day: 'Wed', completed: 4, pending: 3 },
    { day: 'Thu', completed: 6, pending: 2 },
    { day: 'Fri', completed: 8, pending: 1 },
    { day: 'Sat', completed: 3, pending: 0 },
    { day: 'Sun', completed: 2, pending: 1 },
  ];

  const categoryBreakdown = [
    { category: 'Teaching', count: 15, percentage: 45, color: '#2C3E7C' },
    { category: 'Administration', count: 8, percentage: 24, color: '#F2994A' },
    { category: 'Student Support', count: 6, percentage: 18, color: '#A8D08D' },
    { category: 'Research', count: 4, percentage: 13, color: '#E07A5F' },
  ];

  const achievements = [
    { title: 'Task Master', description: 'Completed 50 tasks', icon: Award, earned: true },
    { title: 'On Fire', description: '7-day streak', icon: Zap, earned: true },
    { title: 'Early Bird', description: 'Complete 5 tasks before 9 AM', icon: Clock, earned: false },
    { title: 'Perfect Week', description: 'Complete all tasks for a week', icon: Target, earned: false },
  ];

  const maxCompleted = Math.max(...weeklyData.map(d => d.completed));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Your Statistics</h2>
            <p className="text-sm text-gray-500 mt-1">Insights into your productivity</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="text-blue-600" size={20} />
                <p className="text-sm font-medium text-blue-900">Completed</p>
              </div>
              <p className="text-3xl font-semibold text-blue-900">35</p>
              <p className="text-xs text-blue-700 mt-1">This week</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="text-green-600" size={20} />
                <p className="text-sm font-medium text-green-900">Completion Rate</p>
              </div>
              <p className="text-3xl font-semibold text-green-900">94%</p>
              <p className="text-xs text-green-700 mt-1">+8% from last week</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="text-orange-600" size={20} />
                <p className="text-sm font-medium text-orange-900">Avg. Time</p>
              </div>
              <p className="text-3xl font-semibold text-orange-900">1.2h</p>
              <p className="text-xs text-orange-700 mt-1">Per task</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Target className="text-purple-600" size={20} />
                <p className="text-sm font-medium text-purple-900">Focus Score</p>
              </div>
              <p className="text-3xl font-semibold text-purple-900">87</p>
              <p className="text-xs text-purple-700 mt-1">Out of 100</p>
            </div>
          </div>

          {/* Weekly Activity Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar size={18} />
              Weekly Activity
            </h3>
            <div className="flex items-end justify-between gap-2 h-48">
              {weeklyData.map((data, index) => {
                const totalHeight = ((data.completed / maxCompleted) * 100);
                const completedHeight = totalHeight;

                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex flex-col items-center justify-end flex-1">
                      <div
                        className="w-full rounded-t-lg transition-all"
                        style={{
                          height: `${completedHeight}%`,
                          backgroundColor: '#2C3E7C',
                        }}
                      ></div>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium text-gray-900">{data.completed}</p>
                      <p className="text-xs text-gray-500">{data.day}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#2C3E7C' }}></div>
                <span className="text-xs text-gray-600">Completed</span>
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Tasks by Category</h3>
            <div className="space-y-4">
              {categoryBreakdown.map((item) => (
                <div key={item.category}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">{item.category}</span>
                    <span className="text-sm text-gray-500">
                      {item.count} tasks ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: item.color,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Achievements */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Award size={18} />
              Achievements
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {achievements.map((achievement) => {
                const Icon = achievement.icon;
                return (
                  <div
                    key={achievement.title}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      achievement.earned
                        ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-300'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          achievement.earned ? 'bg-yellow-100' : 'bg-gray-200'
                        }`}
                      >
                        <Icon
                          size={20}
                          className={achievement.earned ? 'text-yellow-600' : 'text-gray-400'}
                        />
                      </div>
                      <div className="flex-1">
                        <p
                          className={`text-sm font-semibold ${
                            achievement.earned ? 'text-gray-900' : 'text-gray-500'
                          }`}
                        >
                          {achievement.title}
                        </p>
                        <p
                          className={`text-xs mt-1 ${
                            achievement.earned ? 'text-gray-600' : 'text-gray-400'
                          }`}
                        >
                          {achievement.description}
                        </p>
                      </div>
                      {achievement.earned && (
                        <CheckCircle2 className="text-green-600 flex-shrink-0" size={20} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tips */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Productivity Tip</h3>
            <p className="text-sm text-gray-700">
              You are most productive on Fridays! Try scheduling your most important tasks on
              this day to maximize your output.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#2C3E7C' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
