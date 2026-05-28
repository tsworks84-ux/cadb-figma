import { useState } from 'react';
import { X, Users, Calendar, AlertCircle, FileText, Send } from 'lucide-react';

interface CreateNoticeModalProps {
  onClose: () => void;
}

export default function CreateNoticeModal({ onClose }: CreateNoticeModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    category: 'general',
    content: '',
    priority: 'medium',
    audience: {
      students: false,
      staff: false,
      parents: false,
    },
    requireAcknowledgment: true,
    scheduledDate: '',
  });

  const handleAudienceToggle = (audience: 'students' | 'staff' | 'parents') => {
    setFormData({
      ...formData,
      audience: {
        ...formData.audience,
        [audience]: !formData.audience[audience],
      },
    });
  };

  const selectedAudienceCount = Object.values(formData.audience).filter(Boolean).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white rounded-none md:rounded-xl max-w-3xl w-full h-full md:h-auto md:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-md flex items-center justify-center"
              style={{ backgroundColor: '#2C3E7C' }}
            >
              <FileText className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Create New Notice</h2>
              <p className="text-sm text-gray-600">Publish important updates and announcements</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notice Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Mid-Term Examination Schedule"
              className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>

          {/* Category and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
              >
                <option value="general">General</option>
                <option value="examination">Examination</option>
                <option value="event">Event</option>
                <option value="academic">Academic</option>
                <option value="training">Training</option>
                <option value="holiday">Holiday</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notice Content <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Enter the detailed notice content here..."
              rows={6}
              className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 resize-none"
              style={{ focusRing: '#2C3E7C' }}
            ></textarea>
            <p className="text-xs text-gray-500 mt-1">
              {formData.content.length} characters
            </p>
          </div>

          {/* Target Audience */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Target Audience <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleAudienceToggle('students')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  formData.audience.students
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      formData.audience.students ? 'bg-blue-100' : 'bg-gray-100'
                    }`}
                  >
                    <Users
                      size={24}
                      className={formData.audience.students ? 'text-blue-600' : 'text-gray-500'}
                    />
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      formData.audience.students ? 'text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    Students
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAudienceToggle('staff')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  formData.audience.staff
                    ? 'bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                style={
                  formData.audience.staff
                    ? { borderColor: '#F2994A' }
                    : {}
                }
              >
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center`}
                    style={{
                      backgroundColor: formData.audience.staff ? '#F2994A20' : '#f3f4f6',
                    }}
                  >
                    <Users
                      size={24}
                      style={{
                        color: formData.audience.staff ? '#F2994A' : '#6b7280',
                      }}
                    />
                  </div>
                  <span
                    className={`text-sm font-medium`}
                    style={{
                      color: formData.audience.staff ? '#F2994A' : '#374151',
                    }}
                  >
                    Staff
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAudienceToggle('parents')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  formData.audience.parents
                    ? 'bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                style={
                  formData.audience.parents
                    ? { borderColor: '#A8D08D' }
                    : {}
                }
              >
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center`}
                    style={{
                      backgroundColor: formData.audience.parents ? '#A8D08D30' : '#f3f4f6',
                    }}
                  >
                    <Users
                      size={24}
                      style={{
                        color: formData.audience.parents ? '#689F5B' : '#6b7280',
                      }}
                    />
                  </div>
                  <span
                    className={`text-sm font-medium`}
                    style={{
                      color: formData.audience.parents ? '#689F5B' : '#374151',
                    }}
                  >
                    Parents
                  </span>
                </div>
              </button>
            </div>
            {selectedAudienceCount === 0 && (
              <p className="text-xs text-red-600 mt-2">Please select at least one audience</p>
            )}
          </div>

          {/* Additional Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.requireAcknowledgment}
                onChange={(e) =>
                  setFormData({ ...formData, requireAcknowledgment: e.target.checked })
                }
                className="w-4 h-4 rounded"
                style={{ accentColor: '#2C3E7C' }}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Require Acknowledgment</p>
                <p className="text-xs text-gray-600">
                  Recipients must acknowledge they have read this notice
                </p>
              </div>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Schedule for Later (Optional)
              </label>
              <input
                type="datetime-local"
                value={formData.scheduledDate}
                onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to publish immediately
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-4 md:px-6 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <p className="text-xs md:text-sm text-gray-600 text-center sm:text-left">
            {selectedAudienceCount > 0 && (
              <span>
                Will be sent to <strong>{selectedAudienceCount}</strong> audience group
                {selectedAudienceCount > 1 ? 's' : ''}
              </span>
            )}
          </p>
          <div className="flex gap-2 md:gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-3 md:px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-white"
            >
              Cancel
            </button>
            <button className="hidden sm:block px-3 md:px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-white">
              Save as Draft
            </button>
            <button
              className="flex-1 sm:flex-initial px-4 md:px-6 py-2 rounded-md text-sm font-medium text-white flex items-center justify-center gap-2"
              style={{ backgroundColor: '#2C3E7C' }}
            >
              <Send size={18} />
              Publish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
