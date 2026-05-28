import { CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function AttendanceOverview() {
  const attendanceData = [
    { day: 'Mon', status: 'present' },
    { day: 'Tue', status: 'present' },
    { day: 'Wed', status: 'present' },
    { day: 'Thu', status: 'absent' },
    { day: 'Fri', status: 'present' },
  ];

  const summary = {
    present: 28,
    absent: 1,
    late: 1,
    total: 30,
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">This Week's Attendance</h3>

      {/* Weekly Grid */}
      <div className="flex justify-between gap-2 mb-6">
        {attendanceData.map((day, index) => (
          <div key={index} className="flex flex-col items-center gap-2">
            <span className="text-xs font-medium text-gray-600">{day.day}</span>
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                day.status === 'present'
                  ? 'bg-green-100'
                  : day.status === 'absent'
                  ? 'bg-red-100'
                  : 'bg-yellow-100'
              }`}
            >
              {day.status === 'present' ? (
                <CheckCircle2 size={20} className="text-green-600" />
              ) : day.status === 'absent' ? (
                <XCircle size={20} className="text-red-600" />
              ) : (
                <Clock size={20} className="text-yellow-600" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="space-y-3 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600">Present</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {summary.present}/{summary.total}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-sm text-gray-600">Absent</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {summary.absent}/{summary.total}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="text-sm text-gray-600">Late</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {summary.late}/{summary.total}
          </span>
        </div>
      </div>

      {/* Attendance Percentage */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">Overall Rate</span>
          <span className="text-lg font-bold text-green-600">94%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full"
            style={{ width: '94%' }}
          ></div>
        </div>
      </div>
    </div>
  );
}
