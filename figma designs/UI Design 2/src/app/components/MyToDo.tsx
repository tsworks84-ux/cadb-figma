import { useState } from 'react';
import {
  Plus,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  TrendingUp,
  List,
  BarChart3,
  Target,
  Zap,
  Award,
  Play,
  Pause,
  Square,
  ChevronRight,
  Filter,
  Search,
  MoreVertical,
  Flame,
} from 'lucide-react';
import AddTaskModal from './AddTaskModal';
import TaskStatsModal from './TaskStatsModal';
import LogTimeModal from './LogTimeModal';

export default function MyToDo() {
  const [activeTab, setActiveTab] = useState('tasks');
  const [showAddTask, setShowAddTask] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showLogTime, setShowLogTime] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [activeTimer, setActiveTimer] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const tabs = [
    { id: 'tasks', label: 'My Tasks', icon: CheckCircle2 },
    { id: 'timesheet', label: 'Timesheet', icon: Clock },
  ];

  const tasks = [
    {
      id: 1,
      title: 'Review student assignments for Math 101',
      priority: 'high',
      dueDate: '2026-05-16',
      category: 'Teaching',
      completed: false,
      timeEstimate: '2h',
    },
    {
      id: 2,
      title: 'Prepare quiz for next week',
      priority: 'medium',
      dueDate: '2026-05-18',
      category: 'Teaching',
      completed: false,
      timeEstimate: '1h',
    },
    {
      id: 3,
      title: 'Submit attendance report',
      priority: 'high',
      dueDate: '2026-05-16',
      category: 'Administration',
      completed: true,
      timeEstimate: '30m',
    },
  ];

  const timesheetEntries = [
    {
      id: 1,
      date: '2026-05-16',
      task: 'Lecture - Mathematics 101',
      hours: 2.5,
      category: 'Lectures',
      status: 'approved',
    },
    {
      id: 2,
      date: '2026-05-16',
      task: 'Student consultation',
      hours: 1.0,
      category: 'Doubt Solving',
      status: 'pending',
    },
    {
      id: 3,
      date: '2026-05-15',
      task: 'Department meeting',
      hours: 1.5,
      category: 'PTM',
      status: 'approved',
    },
  ];

  const stats = {
    dueToday: tasks.filter(t => t.dueDate === '2026-05-16' && !t.completed).length,
    pending: tasks.filter(t => !t.completed).length,
    completed: tasks.filter(t => t.completed).length,
    overdue: tasks.filter(t => new Date(t.dueDate) < new Date('2026-05-16') && !t.completed).length,
  };

  const todayFocus = tasks.filter(t => t.dueDate === '2026-05-16');
  const focusProgress = todayFocus.length > 0
    ? (todayFocus.filter(t => t.completed).length / todayFocus.length) * 100
    : 0;

  const weeklyHours = timesheetEntries
    .filter(e => new Date(e.date) >= new Date('2026-05-12'))
    .reduce((sum, e) => sum + e.hours, 0);

  const streak = 5;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">My To-Do</h1>
          <p className="text-sm text-gray-600 mt-1">
            Organize your work and track your time
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowStats(true)}
            className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <BarChart3 size={18} />
            Stats
          </button>
          <button
            onClick={() => setShowAddTask(true)}
            className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
            style={{ backgroundColor: '#2C3E7C' }}
          >
            <Plus size={18} />
            New Task
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium flex items-center gap-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 text-gray-900'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                style={
                  activeTab === tab.id
                    ? { borderBottomColor: '#2C3E7C' }
                    : {}
                }
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Calendar className="text-blue-600" size={20} />
                </div>
              </div>
              <p className="text-3xl font-semibold text-gray-900 mb-1">{stats.dueToday}</p>
              <p className="text-sm text-gray-600">Due Today</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                  <Clock className="text-orange-600" size={20} />
                </div>
              </div>
              <p className="text-3xl font-semibold text-gray-900 mb-1">{stats.pending}</p>
              <p className="text-sm text-gray-600">Pending</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <CheckCircle2 className="text-green-600" size={20} />
                </div>
              </div>
              <p className="text-3xl font-semibold text-gray-900 mb-1">{stats.completed}</p>
              <p className="text-sm text-gray-600">Completed</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                  <AlertCircle className="text-red-600" size={20} />
                </div>
              </div>
              <p className="text-3xl font-semibold text-gray-900 mb-1">{stats.overdue}</p>
              <p className="text-sm text-gray-600">Overdue</p>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Task List */}
            <div className="lg:col-span-2 space-y-4">
              {/* Search and View Toggle */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="Search tasks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                      style={{ focusRing: '#2C3E7C' }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewMode('list')}
                      className={`px-3 py-2 rounded-md text-sm font-medium ${
                        viewMode === 'list'
                          ? 'text-white'
                          : 'text-gray-700 border border-gray-200 hover:bg-gray-50'
                      }`}
                      style={viewMode === 'list' ? { backgroundColor: '#2C3E7C' } : {}}
                    >
                      <List size={18} />
                    </button>
                    <button
                      onClick={() => setViewMode('calendar')}
                      className={`px-3 py-2 rounded-md text-sm font-medium ${
                        viewMode === 'calendar'
                          ? 'text-white'
                          : 'text-gray-700 border border-gray-200 hover:bg-gray-50'
                      }`}
                      style={viewMode === 'calendar' ? { backgroundColor: '#2C3E7C' } : {}}
                    >
                      <Calendar size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Task List */}
              <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
                {tasks.map((task) => {
                  const priorityColors = {
                    high: 'text-red-600 bg-red-50',
                    medium: 'text-orange-600 bg-orange-50',
                    low: 'text-blue-600 bg-blue-50',
                  };

                  return (
                    <div key={task.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <button className="mt-0.5">
                          {task.completed ? (
                            <CheckCircle2 className="text-green-600" size={20} />
                          ) : (
                            <Circle className="text-gray-300" size={20} />
                          )}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${
                                task.completed ? 'text-gray-400 line-through' : 'text-gray-900'
                              }`}>
                                {task.title}
                              </p>
                              <div className="flex items-center gap-3 mt-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  priorityColors[task.priority as keyof typeof priorityColors]
                                }`}>
                                  {task.priority}
                                </span>
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Calendar size={14} />
                                  {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Clock size={14} />
                                  {task.timeEstimate}
                                </span>
                                <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                                  {task.category}
                                </span>
                              </div>
                            </div>
                            <button className="p-1 hover:bg-gray-100 rounded">
                              <MoreVertical size={16} className="text-gray-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Today's Focus */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Target size={18} style={{ color: '#2C3E7C' }} />
                    Today's Focus
                  </h3>
                </div>
                <div className="mb-3">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-3xl font-semibold text-gray-900">
                      {todayFocus.filter(t => t.completed).length}
                    </span>
                    <span className="text-sm text-gray-500">
                      of {todayFocus.length} tasks done
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${focusProgress}%`,
                        backgroundColor: '#2C3E7C',
                      }}
                    ></div>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  {focusProgress === 100
                    ? 'Great job! All tasks completed!'
                    : 'Keep going! You are doing great.'}
                </p>
              </div>

              {/* Streak */}
              <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg border border-orange-200 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                    <Flame className="text-orange-600" size={22} />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-gray-900">{streak} days</p>
                    <p className="text-xs text-gray-600">Current streak</p>
                  </div>
                </div>
                <p className="text-xs text-gray-600">
                  You have completed tasks {streak} days in a row!
                </p>
              </div>

              {/* Productivity Score */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Zap size={18} className="text-yellow-500" />
                    Productivity
                  </h3>
                  <TrendingUp size={16} className="text-green-600" />
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-semibold text-gray-900">87</span>
                  <span className="text-sm text-gray-500">/ 100</span>
                </div>
                <p className="text-xs text-gray-500">
                  +12% from last week
                </p>
              </div>

              {/* Upcoming */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Upcoming</h3>
                <div className="space-y-3">
                  {tasks.filter(t => !t.completed && t.dueDate > '2026-05-16').slice(0, 3).map((task) => (
                    <div key={task.id} className="flex items-start gap-2">
                      <ChevronRight size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">{task.title}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {tasks.filter(t => !t.completed && t.dueDate > '2026-05-16').length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No upcoming tasks
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timesheet Tab */}
      {activeTab === 'timesheet' && (
        <div className="space-y-6">
          {/* Weekly Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Clock className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">{weeklyHours}h</p>
                  <p className="text-sm text-gray-600">This Week</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <CheckCircle2 className="text-green-600" size={20} />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">
                    {timesheetEntries.filter(e => e.status === 'approved').length}
                  </p>
                  <p className="text-sm text-gray-600">Approved</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                  <AlertCircle className="text-orange-600" size={20} />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">
                    {timesheetEntries.filter(e => e.status === 'pending').length}
                  </p>
                  <p className="text-sm text-gray-600">Pending</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Timer */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Quick Timer</h3>
              <span className="text-2xl font-mono font-semibold" style={{ color: '#2C3E7C' }}>
                00:00:00
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="What are you working on?"
                className="flex-1 px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
              />
              <button
                className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
                style={{ backgroundColor: '#2C3E7C' }}
              >
                <Play size={18} />
                Start
              </button>
            </div>
          </div>

          {/* Timesheet Entries */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Recent Entries</h3>
              <button
                onClick={() => setShowLogTime(true)}
                className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
                style={{ backgroundColor: '#2C3E7C' }}
              >
                <Plus size={18} />
                Log Time
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Task
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Hours
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {timesheetEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">{entry.task}</td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">
                          {entry.category}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                        {entry.hours}h
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            entry.status === 'approved'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-orange-50 text-orange-700'
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button className="p-1 hover:bg-gray-100 rounded">
                          <MoreVertical size={16} className="text-gray-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddTask && <AddTaskModal onClose={() => setShowAddTask(false)} />}
      {showStats && <TaskStatsModal onClose={() => setShowStats(false)} />}
      {showLogTime && <LogTimeModal onClose={() => setShowLogTime(false)} />}
    </div>
  );
}
