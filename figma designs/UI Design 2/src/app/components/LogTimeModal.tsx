import { useState, useEffect } from 'react';
import { X, Calendar, Clock, Tag, FileText, Users } from 'lucide-react';

interface LogTimeModalProps {
  onClose: () => void;
}

export default function LogTimeModal({ onClose }: LogTimeModalProps) {
  const [timeData, setTimeData] = useState({
    date: new Date().toISOString().split('T')[0],
    task: '',
    category: 'Lectures',
    startTime: '',
    endTime: '',
    hours: '',
    minutes: '',
    batch: '',
    description: '',
  });

  const categories = [
    'Lectures',
    'Doubt Solving',
    'Exam Paper Work',
    'Content Creation',
    'Evaluation Work',
    'PTM',
    'Training',
    'Others',
  ];

  const batches = [
    'Grade 1A',
    'Grade 1B',
    'Grade 2A',
    'Grade 2B',
    'Grade 3A',
    'Grade 3B',
    'Grade 4A',
    'Grade 4B',
    'Grade 5A',
    'Grade 5B',
  ];

  // Auto-calculate duration when start and end times are set
  useEffect(() => {
    if (timeData.startTime && timeData.endTime) {
      const start = new Date(`2000-01-01T${timeData.startTime}`);
      const end = new Date(`2000-01-01T${timeData.endTime}`);
      const diffMs = end.getTime() - start.getTime();

      if (diffMs > 0) {
        const totalMinutes = Math.floor(diffMs / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        setTimeData(prev => ({
          ...prev,
          hours: hours.toString(),
          minutes: minutes.toString(),
        }));
      }
    }
  }, [timeData.startTime, timeData.endTime]);

  // Show batch field for certain categories
  const showBatchField = ['Lectures', 'PTM', 'Doubt Solving'].includes(timeData.category);

  const handleSubmit = () => {
    // Handle form submission
    console.log('Time log data:', timeData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Log Time</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Calendar size={16} />
              Date
            </label>
            <input
              type="date"
              value={timeData.date}
              onChange={(e) => setTimeData({ ...timeData, date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>

          {/* Task Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Task Title
            </label>
            <input
              type="text"
              placeholder="e.g., Lecture - Mathematics 101"
              value={timeData.task}
              onChange={(e) => setTimeData({ ...timeData, task: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Tag size={16} />
              Category
            </label>
            <select
              value={timeData.category}
              onChange={(e) => setTimeData({ ...timeData, category: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Batch (Conditional) */}
          {showBatchField && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Users size={16} />
                Batch / Class
                <span className="text-xs text-gray-500 font-normal">(Optional)</span>
              </label>
              <select
                value={timeData.batch}
                onChange={(e) => setTimeData({ ...timeData, batch: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              >
                <option value="">Select batch</option>
                {batches.map((batch) => (
                  <option key={batch} value={batch}>
                    {batch}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Time Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Clock size={16} />
                Start Time
              </label>
              <input
                type="time"
                value={timeData.startTime}
                onChange={(e) => setTimeData({ ...timeData, startTime: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Clock size={16} />
                End Time
              </label>
              <input
                type="time"
                value={timeData.endTime}
                onChange={(e) => setTimeData({ ...timeData, endTime: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              />
            </div>
          </div>

          {/* Duration (Auto-calculated or Manual) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Clock size={16} />
              Duration
              {timeData.startTime && timeData.endTime && (
                <span className="text-xs text-gray-500 font-normal">(Auto-calculated)</span>
              )}
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  min="0"
                  max="23"
                  placeholder="Hours"
                  value={timeData.hours}
                  onChange={(e) => setTimeData({ ...timeData, hours: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                />
                <p className="text-xs text-gray-500 mt-1">Hours</p>
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  min="0"
                  max="59"
                  step="15"
                  placeholder="Minutes"
                  value={timeData.minutes}
                  onChange={(e) => setTimeData({ ...timeData, minutes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                />
                <p className="text-xs text-gray-500 mt-1">Minutes</p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <FileText size={16} />
              Description
              <span className="text-xs text-gray-500 font-normal">(Optional)</span>
            </label>
            <textarea
              placeholder="Add any additional notes about this work..."
              value={timeData.description}
              onChange={(e) => setTimeData({ ...timeData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 resize-none"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>

          {/* Quick Duration Buttons */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quick Select
            </label>
            <div className="flex gap-2 flex-wrap">
              {['15m', '30m', '45m', '1h', '1.5h', '2h', '3h'].map((duration) => {
                let hours = '0';
                let minutes = '0';

                if (duration.includes('h')) {
                  const parts = duration.replace('h', '').split('.');
                  hours = parts[0];
                  minutes = parts[1] === '5' ? '30' : '0';
                } else {
                  minutes = duration.replace('m', '');
                }

                return (
                  <button
                    key={duration}
                    type="button"
                    onClick={() => setTimeData({ ...timeData, hours, minutes })}
                    className="px-3 py-1.5 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {duration}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview */}
          {(timeData.hours || timeData.minutes || timeData.startTime || timeData.endTime) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="space-y-2">
                {timeData.startTime && timeData.endTime && (
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Time: </span>
                    {timeData.startTime} - {timeData.endTime}
                  </p>
                )}
                {(timeData.hours || timeData.minutes) && (
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Total Duration: </span>
                    {timeData.hours && parseInt(timeData.hours) > 0 && `${timeData.hours}h `}
                    {timeData.minutes && parseInt(timeData.minutes) > 0 && `${timeData.minutes}m`}
                    {(!timeData.hours || parseInt(timeData.hours) === 0) &&
                     (!timeData.minutes || parseInt(timeData.minutes) === 0) && '0h'}
                  </p>
                )}
                {timeData.batch && (
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Batch: </span>
                    {timeData.batch}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#2C3E7C' }}
          >
            Log Time
          </button>
        </div>
      </div>
    </div>
  );
}
