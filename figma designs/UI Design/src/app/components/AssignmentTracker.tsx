import { Calendar, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

export default function AssignmentTracker() {
  const assignments = [
    {
      title: 'Calculus Problem Set #5',
      subject: 'Mathematics',
      dueDate: 'May 17, 2026',
      daysLeft: 2,
      status: 'pending',
      progress: 60,
      points: 100,
    },
    {
      title: 'Essay: Industrial Revolution',
      subject: 'History',
      dueDate: 'May 16, 2026',
      daysLeft: 1,
      status: 'inProgress',
      progress: 85,
      points: 150,
    },
    {
      title: 'Lab Report: Chemical Reactions',
      subject: 'Chemistry',
      dueDate: 'May 20, 2026',
      daysLeft: 5,
      status: 'notStarted',
      progress: 0,
      points: 80,
    },
    {
      title: 'Shakespeare Analysis',
      subject: 'English',
      dueDate: 'May 14, 2026',
      daysLeft: -1,
      status: 'completed',
      progress: 100,
      points: 120,
      grade: '95/120',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'inProgress':
        return 'text-blue-600 bg-blue-50';
      case 'pending':
        return 'text-orange-600 bg-orange-50';
      case 'notStarted':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={16} />;
      case 'inProgress':
        return <Clock size={16} />;
      case 'pending':
      case 'notStarted':
        return <AlertCircle size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'inProgress':
        return 'In Progress';
      case 'pending':
        return 'Pending';
      case 'notStarted':
        return 'Not Started';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold text-gray-900">Assignments</h3>
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          View All
        </button>
      </div>
      <div className="space-y-4">
        {assignments.map((assignment, index) => (
          <div
            key={index}
            className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-1">
                  {assignment.title}
                </h4>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <span className="font-medium">{assignment.subject}</span>
                  <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    Due: {assignment.dueDate}
                  </span>
                </div>
              </div>
              <div
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                  assignment.status
                )}`}
              >
                {getStatusIcon(assignment.status)}
                {getStatusLabel(assignment.status)}
              </div>
            </div>

            {assignment.status !== 'completed' && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Progress</span>
                  <span>{assignment.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${assignment.progress}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {assignment.status === 'completed' ? (
                  <span className="font-medium text-green-600">
                    Grade: {assignment.grade}
                  </span>
                ) : assignment.daysLeft < 0 ? (
                  <span className="font-medium text-red-600">Overdue</span>
                ) : assignment.daysLeft <= 2 ? (
                  <span className="font-medium text-orange-600">
                    Due in {assignment.daysLeft} day{assignment.daysLeft !== 1 ? 's' : ''}
                  </span>
                ) : (
                  <span>
                    Due in {assignment.daysLeft} days
                  </span>
                )}
              </div>
              <span className="text-sm text-gray-500">{assignment.points} pts</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
