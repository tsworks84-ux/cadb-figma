import { useState } from 'react';
import { X, Calendar, FileText, AlertCircle, Upload } from 'lucide-react';

interface ApplyLeaveModalProps {
  onClose: () => void;
}

export default function ApplyLeaveModal({ onClose }: ApplyLeaveModalProps) {
  const [leaveData, setLeaveData] = useState({
    type: '',
    from: '',
    to: '',
    halfDay: false,
    halfDayPeriod: 'first',
    reason: '',
    attachment: null as File | null,
  });

  const [calculatedDays, setCalculatedDays] = useState(0);

  // These would be fetched from Administration parameters in a real implementation
  const leaveTypes = [
    { value: 'casual', label: 'Casual Leave', available: 0, requiresCertificate: false },
    { value: 'sick', label: 'Sick Leave', available: 0, requiresCertificate: true },
    { value: 'earned', label: 'Earned Leave', available: 0, requiresCertificate: false },
    { value: 'maternity', label: 'Maternity Leave', available: 0, requiresCertificate: true },
    { value: 'paternity', label: 'Paternity Leave', available: 0, requiresCertificate: true },
    { value: 'bereavement', label: 'Bereavement Leave', available: 0, requiresCertificate: false },
    { value: 'compensatory', label: 'Compensatory Off', available: 0, requiresCertificate: false },
  ];

  const handleDateChange = (field: string, value: string) => {
    const newData = { ...leaveData, [field]: value };
    setLeaveData(newData);

    if (newData.from && newData.to) {
      const from = new Date(newData.from);
      const to = new Date(newData.to);
      const diffTime = Math.abs(to.getTime() - from.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      setCalculatedDays(newData.halfDay ? 0.5 : diffDays);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLeaveData({ ...leaveData, attachment: e.target.files[0] });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Apply for Leave</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Leave Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Leave Type
            </label>
            <select
              value={leaveData.type}
              onChange={(e) => setLeaveData({ ...leaveData, type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            >
              <option value="">Select leave type</option>
              {leaveTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label} ({type.available} days available)
                </option>
              ))}
            </select>
            {leaveData.type && (
              <p className="text-xs text-gray-500 mt-2">
                Available balance:{' '}
                <span className="font-medium text-gray-900">
                  {leaveTypes.find((t) => t.value === leaveData.type)?.available || 0} days
                </span>
              </p>
            )}
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
                value={leaveData.from}
                onChange={(e) => handleDateChange('from', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                style={{ focusRing: '#2C3E7C' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Calendar size={16} />
                To Date
              </label>
              <input
                type="date"
                value={leaveData.to}
                onChange={(e) => handleDateChange('to', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                style={{ focusRing: '#2C3E7C' }}
              />
            </div>
          </div>

          {/* Half Day Option */}
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={leaveData.halfDay}
                onChange={(e) => {
                  setLeaveData({ ...leaveData, halfDay: e.target.checked });
                  if (e.target.checked && leaveData.from) {
                    setCalculatedDays(0.5);
                  }
                }}
                className="w-4 h-4 rounded"
                style={{ accentColor: '#2C3E7C' }}
              />
              <span className="text-sm font-medium text-gray-700">Half Day Leave</span>
            </label>

            {leaveData.halfDay && (
              <div className="mt-3 flex gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="halfDayPeriod"
                    value="first"
                    checked={leaveData.halfDayPeriod === 'first'}
                    onChange={(e) =>
                      setLeaveData({ ...leaveData, halfDayPeriod: e.target.value })
                    }
                    className="w-4 h-4"
                    style={{ accentColor: '#2C3E7C' }}
                  />
                  <span className="text-sm text-gray-700">First Half</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="halfDayPeriod"
                    value="second"
                    checked={leaveData.halfDayPeriod === 'second'}
                    onChange={(e) =>
                      setLeaveData({ ...leaveData, halfDayPeriod: e.target.value })
                    }
                    className="w-4 h-4"
                    style={{ accentColor: '#2C3E7C' }}
                  />
                  <span className="text-sm text-gray-700">Second Half</span>
                </label>
              </div>
            )}
          </div>

          {/* Calculated Days */}
          {calculatedDays > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Duration: </span>
                {calculatedDays} {calculatedDays === 1 ? 'day' : 'days'}
              </p>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <FileText size={16} />
              Reason for Leave
            </label>
            <textarea
              placeholder="Please provide a brief reason for your leave..."
              value={leaveData.reason}
              onChange={(e) => setLeaveData({ ...leaveData, reason: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 resize-none"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>

          {/* Supporting Document Upload */}
          {leaveData.type &&
           leaveTypes.find((t) => t.value === leaveData.type)?.requiresCertificate && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-2 mb-3">
                <AlertCircle className="text-orange-600 flex-shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-orange-900">
                  Supporting document required for{' '}
                  {leaveTypes.find((t) => t.value === leaveData.type)?.label}
                  {leaveData.type === 'sick' && ' (Medical certificate for leaves over 2 days)'}
                  {leaveData.type === 'maternity' && ' (Medical certificate)'}
                  {leaveData.type === 'paternity' && ' (Birth certificate)'}
                </p>
              </div>
              <label className="block">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-orange-300 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors">
                  <Upload size={18} className="text-orange-600" />
                  <span className="text-sm font-medium text-orange-900">
                    {leaveData.attachment
                      ? leaveData.attachment.name
                      : 'Upload Supporting Document'}
                  </span>
                </div>
              </label>
            </div>
          )}

          {/* Impact Preview */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Balance Impact</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Current Balance</span>
                <span className="font-medium text-gray-900">
                  {leaveTypes.find((t) => t.value === leaveData.type)?.available || 0} days
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Requested</span>
                <span className="font-medium text-gray-900">
                  {calculatedDays} {calculatedDays === 1 ? 'day' : 'days'}
                </span>
              </div>
              <div className="pt-2 border-t border-gray-300 flex justify-between text-sm">
                <span className="font-medium text-gray-900">After Approval</span>
                <span className="font-semibold text-gray-900">
                  {Math.max(
                    0,
                    (leaveTypes.find((t) => t.value === leaveData.type)?.available || 0) -
                      calculatedDays
                  )}{' '}
                  days
                </span>
              </div>
            </div>
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
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#2C3E7C' }}
          >
            Submit Request
          </button>
        </div>
      </div>
    </div>
  );
}
