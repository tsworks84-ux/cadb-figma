import { useState } from 'react';
import { X, Calendar, Clock, Flag, Tag } from 'lucide-react';

interface AddTaskModalProps {
  onClose: () => void;
}

export default function AddTaskModal({ onClose }: AddTaskModalProps) {
  const [taskData, setTaskData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
    category: 'Teaching',
    timeEstimate: '',
  });

  const categories = ['Teaching', 'Administration', 'Student Support', 'Research', 'Other'];
  const priorities = ['low', 'medium', 'high'];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">New Task</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Task Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Task Title
            </label>
            <input
              type="text"
              placeholder="What needs to be done?"
              value={taskData.title}
              onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              placeholder="Add details about this task..."
              value={taskData.description}
              onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 resize-none"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Calendar size={16} />
                Due Date
              </label>
              <input
                type="date"
                value={taskData.dueDate}
                onChange={(e) => setTaskData({ ...taskData, dueDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              />
            </div>

            {/* Time Estimate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Clock size={16} />
                Time Estimate
              </label>
              <input
                type="text"
                placeholder="e.g., 2h, 30m"
                value={taskData.timeEstimate}
                onChange={(e) => setTaskData({ ...taskData, timeEstimate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Tag size={16} />
                Category
              </label>
              <select
                value={taskData.category}
                onChange={(e) => setTaskData({ ...taskData, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Flag size={16} />
                Priority
              </label>
              <div className="flex gap-2">
                {priorities.map((priority) => {
                  const isActive = taskData.priority === priority;
                  const colors = {
                    low: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
                    medium: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
                    high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
                  };
                  const color = colors[priority as keyof typeof colors];

                  return (
                    <button
                      key={priority}
                      onClick={() => setTaskData({ ...taskData, priority })}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                        isActive
                          ? `${color.bg} ${color.text} ${color.border}`
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </button>
                  );
                })}
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
            Create Task
          </button>
        </div>
      </div>
    </div>
  );
}
