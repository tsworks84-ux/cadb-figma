import { useState } from 'react';
import {
  Plus,
  Users,
  Calendar,
  CheckCircle2,
  User,
  ClipboardList,
  Clock,
  AlertCircle,
  X,
  Paperclip,
} from 'lucide-react';

export default function MyTeamManager() {
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'tasks' | 'leaves'>('tasks');
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    assignedDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    priority: 'Medium',
  });

  const teamMembers = [
    {
      id: 1,
      name: 'Priya Sharma',
      avatar: 'PS',
      code: '256881',
      department: 'Mathematics',
      role: 'Faculty Member',
      status: 'Present',
      taskProgress: { completed: 0, total: 0 },
      tasks: [],
      leaves: [],
    },
  ];

  const stats = {
    totalMembers: teamMembers.length,
    presentToday: teamMembers.filter((m) => m.status === 'Present').length,
    onLeave: teamMembers.filter((m) => m.status === 'On Leave').length,
  };

  const selectedMember = selectedMemberId
    ? teamMembers.find((m) => m.id === selectedMemberId)
    : null;

  const taskStats = selectedMember
    ? {
        all: selectedMember.tasks.length,
        todo: selectedMember.tasks.filter((t: any) => t.status === 'todo').length,
        inProgress: selectedMember.tasks.filter((t: any) => t.status === 'in-progress').length,
        completed: selectedMember.tasks.filter((t: any) => t.status === 'completed').length,
        overdue: selectedMember.tasks.filter((t: any) => t.status === 'overdue').length,
      }
    : null;

  const handleAssignTask = () => {
    console.log('Assigning task:', taskFormData);
    setShowNewTaskModal(false);
    setTaskFormData({
      title: '',
      description: '',
      assignedDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      priority: 'Medium',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center"
              style={{ backgroundColor: '#2C3E7C' }}
            >
              <Users className="text-white" size={18} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">My Team</h1>
              <p className="text-sm text-gray-600">
                {stats.totalMembers} member • {stats.presentToday} present • {stats.onLeave} on leave
              </p>
            </div>
          </div>
        </div>
        {/* Admin only - can add members */}
        <button
          className="hidden px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
          style={{ backgroundColor: '#2C3E7C' }}
        >
          <Plus size={18} />
          Add Member
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6 text-center">
          <p className="text-3xl font-bold" style={{ color: '#2C3E7C' }}>
            {stats.totalMembers}
          </p>
          <p className="text-sm text-gray-600 mt-1">Total Members</p>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-6 text-center">
          <p className="text-3xl font-bold text-green-600">{stats.presentToday}</p>
          <p className="text-sm text-gray-600 mt-1">Present Today</p>
        </div>
        <div className="bg-orange-50 rounded-lg border border-orange-200 p-6 text-center">
          <p className="text-3xl font-bold text-orange-600">{stats.onLeave}</p>
          <p className="text-sm text-gray-600 mt-1">On Leave</p>
        </div>
      </div>

      {/* Team Members List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
            <div className="col-span-4">Member</div>
            <div className="col-span-3">Department / Role</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3">Task Progress</div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {teamMembers.map((member) => (
            <div
              key={member.id}
              className={`px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                selectedMemberId === member.id ? 'bg-blue-50' : ''
              }`}
              onClick={() => setSelectedMemberId(member.id)}
            >
              <div className="grid grid-cols-12 gap-4 items-center">
                <div className="col-span-4 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0"
                    style={{ backgroundColor: '#2C3E7C' }}
                  >
                    {member.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{member.name}</p>
                    <p className="text-xs text-gray-500">{member.code}</p>
                  </div>
                </div>
                <div className="col-span-3">
                  <p className="text-sm text-gray-900">{member.department}</p>
                  <p className="text-xs text-gray-500">{member.role}</p>
                </div>
                <div className="col-span-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                      member.status === 'Present'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    <CheckCircle2 size={12} />
                    {member.status}
                  </span>
                </div>
                <div className="col-span-3">
                  <p className="text-sm text-gray-900">
                    {member.taskProgress.completed}/{member.taskProgress.total} done
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Member Detail View */}
      {selectedMember && (
        <div className="bg-white rounded-lg border-2 border-blue-200 overflow-hidden">
          {/* Member Header */}
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-medium"
                  style={{ backgroundColor: '#2C3E7C' }}
                >
                  {selectedMember.avatar}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedMember.name}</h3>
                  <p className="text-sm text-gray-600">
                    {selectedMember.department} • {selectedMember.role}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMemberId(null)}
                className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex px-6">
              <button
                onClick={() => setActiveTab('tasks')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'tasks'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Tasks
              </button>
              <button
                onClick={() => setActiveTab('leaves')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'leaves'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Leave Records
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'tasks' && (
              <div className="space-y-6">
                {/* Task Stats */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium" style={{ color: '#2C3E7C' }}>
                      {selectedMember.tasks.length} tasks assigned
                    </span>
                  </p>
                  <button
                    onClick={() => setShowNewTaskModal(true)}
                    className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
                    style={{ backgroundColor: '#2C3E7C' }}
                  >
                    <Plus size={16} />
                    New Task
                  </button>
                </div>

                {taskStats && (
                  <div className="grid grid-cols-5 gap-3">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <ClipboardList size={16} className="text-gray-500" />
                        <p className="text-2xl font-semibold text-gray-900">{taskStats.all}</p>
                      </div>
                      <p className="text-xs text-gray-600">All</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Circle size={16} className="text-blue-500" />
                        <p className="text-2xl font-semibold text-blue-600">{taskStats.todo}</p>
                      </div>
                      <p className="text-xs text-gray-600">To do</p>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Clock size={16} className="text-orange-500" />
                        <p className="text-2xl font-semibold text-orange-600">
                          {taskStats.inProgress}
                        </p>
                      </div>
                      <p className="text-xs text-gray-600">In Progress</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <CheckCircle2 size={16} className="text-green-500" />
                        <p className="text-2xl font-semibold text-green-600">
                          {taskStats.completed}
                        </p>
                      </div>
                      <p className="text-xs text-gray-600">Completed</p>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <AlertCircle size={16} className="text-red-500" />
                        <p className="text-2xl font-semibold text-red-600">{taskStats.overdue}</p>
                      </div>
                      <p className="text-xs text-gray-600">Overdue</p>
                    </div>
                  </div>
                )}

                {/* Filters */}
                <div className="flex gap-3">
                  <select className="px-3 py-2 border border-gray-200 rounded-md text-sm">
                    <option>All statuses</option>
                    <option>To do</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                    <option>Overdue</option>
                  </select>
                  <select className="px-3 py-2 border border-gray-200 rounded-md text-sm">
                    <option>All priorities</option>
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>

                {/* Empty State */}
                {selectedMember.tasks.length === 0 && (
                  <div className="text-center py-12">
                    <ClipboardList className="mx-auto text-gray-300 mb-4" size={48} />
                    <p className="text-gray-600 mb-1">No tasks assigned yet</p>
                    <p className="text-sm text-gray-500 mb-4">
                      Click New Task to assign one.
                    </p>
                  </div>
                )}

                {/* Task List would go here */}
                <p className="text-sm text-gray-500 text-center py-4">0 tasks</p>
              </div>
            )}

            {activeTab === 'leaves' && (
              <div className="text-center py-12">
                <Calendar className="mx-auto text-gray-300 mb-4" size={48} />
                <p className="text-gray-600">No leave applications found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Task Modal */}
      {showNewTaskModal && selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">New Task</h3>
                <p className="text-sm text-gray-600">Assign to {selectedMember.name}</p>
              </div>
              <button
                onClick={() => setShowNewTaskModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Topic / Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="What needs to be done?"
                  value={taskFormData.title}
                  onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                  style={{ focusRing: '#2C3E7C' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  placeholder="Provide details, context, or acceptance criteria..."
                  value={taskFormData.description}
                  onChange={(e) =>
                    setTaskFormData({ ...taskFormData, description: e.target.value })
                  }
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 resize-none"
                  style={{ focusRing: '#2C3E7C' }}
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assigned Date
                  </label>
                  <input
                    type="date"
                    value={taskFormData.assignedDate}
                    onChange={(e) =>
                      setTaskFormData({ ...taskFormData, assignedDate: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={taskFormData.dueDate}
                    onChange={(e) =>
                      setTaskFormData({ ...taskFormData, dueDate: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <select
                  value={taskFormData.priority}
                  onChange={(e) =>
                    setTaskFormData({ ...taskFormData, priority: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Urgent</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 hover:text-gray-900">
                  <Paperclip size={16} />
                  Attach file
                  <input type="file" className="hidden" />
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowNewTaskModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignTask}
                className="px-6 py-2 rounded-md text-sm font-medium text-white"
                style={{ backgroundColor: '#2C3E7C' }}
              >
                Assign Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
