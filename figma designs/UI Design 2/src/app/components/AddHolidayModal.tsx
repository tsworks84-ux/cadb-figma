import { useState, useEffect } from 'react';
import { X, Calendar, FileText, AlertCircle } from 'lucide-react';

interface AddHolidayModalProps {
  onClose: () => void;
  onAdd: (holiday: any) => void;
}

export default function AddHolidayModal({ onClose, onAdd }: AddHolidayModalProps) {
  const [holidayData, setHolidayData] = useState({
    name: '',
    fromDate: '',
    toDate: '',
    description: '',
  });

  const [calculatedDays, setCalculatedDays] = useState(0);

  useEffect(() => {
    if (holidayData.fromDate && holidayData.toDate) {
      const from = new Date(holidayData.fromDate);
      const to = new Date(holidayData.toDate);
      const diffTime = Math.abs(to.getTime() - from.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      setCalculatedDays(diffDays);
    } else if (holidayData.fromDate) {
      setCalculatedDays(1);
    } else {
      setCalculatedDays(0);
    }
  }, [holidayData.fromDate, holidayData.toDate]);

  const handleSubmit = () => {
    onAdd({
      name: holidayData.name,
      fromDate: holidayData.fromDate,
      toDate: holidayData.toDate || holidayData.fromDate,
      days: calculatedDays,
      description: holidayData.description,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add Holiday</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Holiday Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Holiday Name
            </label>
            <input
              type="text"
              placeholder="e.g., Republic Day, Diwali, Christmas"
              value={holidayData.name}
              onChange={(e) => setHolidayData({ ...holidayData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Calendar size={16} />
                From Date
              </label>
              <input
                type="date"
                value={holidayData.fromDate}
                onChange={(e) => setHolidayData({ ...holidayData, fromDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                style={{ focusRing: '#2C3E7C' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Calendar size={16} />
                To Date
                <span className="text-xs text-gray-500 font-normal">(Optional for single day)</span>
              </label>
              <input
                type="date"
                value={holidayData.toDate}
                onChange={(e) => setHolidayData({ ...holidayData, toDate: e.target.value })}
                min={holidayData.fromDate}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                style={{ focusRing: '#2C3E7C' }}
              />
            </div>
          </div>

          {/* Duration Display */}
          {calculatedDays > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Duration: </span>
                {calculatedDays} {calculatedDays === 1 ? 'day' : 'days'}
              </p>
              {holidayData.fromDate && (
                <p className="text-xs text-gray-600 mt-1">
                  {new Date(holidayData.fromDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  {holidayData.toDate && holidayData.toDate !== holidayData.fromDate && (
                    <>
                      {' to '}
                      {new Date(holidayData.toDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <FileText size={16} />
              Description
              <span className="text-xs text-gray-500 font-normal">(Optional)</span>
            </label>
            <textarea
              placeholder="Add any additional details about this holiday..."
              value={holidayData.description}
              onChange={(e) => setHolidayData({ ...holidayData, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 resize-none"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>

          {/* Info Note */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-2">
            <AlertCircle className="text-orange-600 flex-shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-orange-900">
              This holiday will be visible to all employees once added. Make sure the dates and name
              are correct before submitting.
            </p>
          </div>
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
            disabled={!holidayData.name.trim() || !holidayData.fromDate}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${
              !holidayData.name.trim() || !holidayData.fromDate
                ? 'bg-gray-300 cursor-not-allowed'
                : 'hover:opacity-90'
            }`}
            style={
              holidayData.name.trim() && holidayData.fromDate
                ? { backgroundColor: '#2C3E7C' }
                : {}
            }
          >
            Add Holiday
          </button>
        </div>
      </div>
    </div>
  );
}
