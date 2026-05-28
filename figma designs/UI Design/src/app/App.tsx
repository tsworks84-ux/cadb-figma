import { useState } from 'react';
import {
  BookOpen,
  Calendar,
  Users,
  ClipboardList,
  BarChart3,
  Bell,
  Settings,
  LogOut,
  Search,
  Menu,
  X,
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  FileText,
  Video,
  MessageSquare,
} from 'lucide-react';
import AdminDashboard from './components/AdminDashboard';
import NoticeBoard from './components/NoticeBoard';
import MyTeam from './components/MyTeam';
import Employees from './components/Employees';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('home');

  const myDashboardItems = [
    { id: 'home', label: 'Home', icon: BarChart3 },
    { id: 'notice-board', label: 'Notice Board', icon: FileText },
    { id: 'my-team', label: 'My Team', icon: Users },
    { id: 'my-todo', label: 'My To-Do', icon: ClipboardList },
    { id: 'leaves', label: 'Leaves', icon: Calendar },
    { id: 'holidays', label: 'Holidays', icon: Calendar },
    { id: 'claims', label: 'Claims', icon: FileText },
    { id: 'policies', label: 'Policies', icon: FileText },
    { id: 'training', label: 'Training', icon: Video },
    { id: 'directory', label: 'Directory', icon: BookOpen },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const managementItems = [
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'administration', label: 'Administration', icon: Settings },
    { id: 'academics', label: 'Academics', icon: GraduationCap },
    { id: 'mis-reports', label: 'MIS Reports', icon: BarChart3 },
  ];

  return (
    <div className="size-full flex bg-gray-100">
      {/* Sidebar */}
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed lg:relative lg:translate-x-0 w-64 bg-slate-50 border-r border-gray-200 transition-transform duration-300 flex flex-col z-50 h-full`}
      >
        {/* Logo & Brand */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <img
              src="/src/imports/Logo1new.png"
              alt="Centrum Academy"
              className="w-12 h-12 object-contain"
            />
            <div>
              <h1 className="font-semibold text-base text-gray-900 tracking-tight">Centrum Academy</h1>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Administration</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          {/* MY DASHBOARD Section */}
          <div className="mb-6">
            <div className="px-4 mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                My Dashboard
              </h3>
            </div>
            <div className="space-y-1">
              {myDashboardItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md transition-all text-sm ${
                      isActive
                        ? 'text-white font-medium'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    style={isActive ? { backgroundColor: '#2C3E7C' } : {}}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* MANAGEMENT Section */}
          <div>
            <div className="px-4 mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Management
              </h3>
            </div>
            <div className="space-y-1">
              {managementItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md transition-all text-sm ${
                      isActive
                        ? 'text-white font-medium'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    style={isActive ? { backgroundColor: '#2C3E7C' } : {}}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm" style={{ backgroundColor: '#2C3E7C' }}>
              SA
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm text-gray-900">System Admin</p>
              <p className="text-xs text-gray-500">Administrator</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
              <Settings size={16} />
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-4 flex-1 md:flex-initial">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Menu size={20} />
              </button>
              <div className="relative flex-1 md:flex-initial">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 pr-4 py-2 w-full md:w-96 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm md:text-base"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell size={20} className="text-gray-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <div className="hidden md:flex items-center gap-2 text-sm">
                <Clock size={16} className="text-gray-500" />
                <span className="text-gray-600">15 May 2026, 10:30</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            {/* Welcome Section */}
            <div className="bg-white border-b border-gray-200 -mx-6 -mt-6 px-4 md:px-6 py-4 md:py-6 mb-6 md:mb-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-1">
                    Good evening, System Administrator
                  </h2>
                  <p className="text-sm md:text-base text-gray-600">
                    Super Administrator • Administration • Director
                  </p>
                </div>
                <div className="hidden lg:flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">System Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <span className="text-sm font-medium text-gray-900">Operational</span>
                    </div>
                  </div>
                  <div className="h-12 w-px bg-gray-200"></div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Current Session</p>
                    <p className="text-sm font-medium text-gray-900 mt-1">Academic Year 2025-26</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Based on Active Section */}
            {activeSection === 'home' && <AdminDashboard />}
            {activeSection === 'notice-board' && <NoticeBoard />}
            {activeSection === 'my-team' && <MyTeam />}
            {activeSection === 'employees' && <Employees />}
            {activeSection !== 'home' && activeSection !== 'notice-board' && activeSection !== 'my-team' && activeSection !== 'employees' && <AdminDashboard />}
          </div>
        </div>
      </main>
    </div>
  );
}
