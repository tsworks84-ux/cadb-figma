import { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertCircle,
  MoreVertical,
  UserPlus,
  ClipboardList,
  Award,
  Activity,
} from 'lucide-react';
import TeamMemberCard from './TeamMemberCard';
import AddTeamMemberModal from './AddTeamMemberModal';
import AssignTaskModal from './AssignTaskModal';
import TeamAnalytics from './TeamAnalytics';

export default function MyTeam() {
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showAssignTaskModal, setShowAssignTaskModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const teamMembers = [
    {
      id: 1,
      name: 'Dr. Sarah Mitchell',
      role: 'Senior Mathematics Teacher',
      department: 'Mathematics',
      email: 'sarah.mitchell@centrum.edu',
      phone: '+1 234-567-8901',
      joinDate: '2020-08-15',
      avatar: 'SM',
      status: 'active',
      employeeId: 'EMP-001',
      workload: 85,
      performance: 4.8,
      activeTasks: 5,
      completedTasks: 42,
      pendingLeaves: 1,
      usedLeaves: 8,
      totalLeaves: 20,
      attendanceRate: 96,
      upcomingReview: '2026-06-01',
      recentActivity: 'Submitted Grade 10 exam papers',
    },
    {
      id: 2,
      name: 'Prof. James Wilson',
      role: 'Physics Department Head',
      department: 'Science',
      email: 'james.wilson@centrum.edu',
      phone: '+1 234-567-8902',
      joinDate: '2018-09-01',
      avatar: 'JW',
      status: 'active',
      employeeId: 'EMP-002',
      workload: 92,
      performance: 4.9,
      activeTasks: 8,
      completedTasks: 156,
      pendingLeaves: 0,
      usedLeaves: 5,
      totalLeaves: 20,
      attendanceRate: 98,
      upcomingReview: '2026-07-15',
      recentActivity: 'Lab equipment order approved',
    },
    {
      id: 3,
      name: 'Ms. Emily Parker',
      role: 'English Literature Teacher',
      department: 'Humanities',
      email: 'emily.parker@centrum.edu',
      phone: '+1 234-567-8903',
      joinDate: '2021-07-10',
      avatar: 'EP',
      status: 'on-leave',
      employeeId: 'EMP-003',
      workload: 45,
      performance: 4.6,
      activeTasks: 2,
      completedTasks: 28,
      pendingLeaves: 0,
      usedLeaves: 12,
      totalLeaves: 20,
      attendanceRate: 94,
      upcomingReview: '2026-08-10',
      recentActivity: 'On medical leave until May 20',
    },
    {
      id: 4,
      name: 'Mr. David Chen',
      role: 'Computer Science Teacher',
      department: 'Technology',
      email: 'david.chen@centrum.edu',
      phone: '+1 234-567-8904',
      joinDate: '2022-01-05',
      avatar: 'DC',
      status: 'active',
      employeeId: 'EMP-004',
      workload: 78,
      performance: 4.7,
      activeTasks: 6,
      completedTasks: 35,
      pendingLeaves: 2,
      usedLeaves: 4,
      totalLeaves: 20,
      attendanceRate: 97,
      upcomingReview: '2026-05-20',
      recentActivity: 'Submitted coding bootcamp proposal',
    },
    {
      id: 5,
      name: 'Dr. Priya Sharma',
      role: 'Chemistry Teacher',
      department: 'Science',
      email: 'priya.sharma@centrum.edu',
      phone: '+1 234-567-8905',
      joinDate: '2019-03-20',
      avatar: 'PS',
      status: 'active',
      employeeId: 'EMP-005',
      workload: 88,
      performance: 4.8,
      activeTasks: 7,
      completedTasks: 98,
      pendingLeaves: 1,
      usedLeaves: 6,
      totalLeaves: 20,
      attendanceRate: 95,
      upcomingReview: '2026-06-10',
      recentActivity: 'Lab safety audit completed',
    },
  ];

  const pendingApprovals = [
    {
      id: 1,
      type: 'leave',
      employeeName: 'David Chen',
      employeeId: 4,
      details: 'Casual Leave - May 22-23, 2026',
      requestDate: '2026-05-10',
    },
    {
      id: 2,
      type: 'leave',
      employeeName: 'Sarah Mitchell',
      employeeId: 1,
      details: 'Sick Leave - May 25, 2026',
      requestDate: '2026-05-12',
    },
    {
      id: 3,
      type: 'leave',
      employeeName: 'Priya Sharma',
      employeeId: 5,
      details: 'Personal Leave - June 1-3, 2026',
      requestDate: '2026-05-14',
    },
  ];

  const teamStats = {
    totalMembers: teamMembers.length,
    activeMembers: teamMembers.filter((m) => m.status === 'active').length,
    avgWorkload: Math.round(
      teamMembers.reduce((acc, m) => acc + m.workload, 0) / teamMembers.length
    ),
    avgPerformance:
      Math.round(
        (teamMembers.reduce((acc, m) => acc + m.performance, 0) / teamMembers.length) * 10
      ) / 10,
    pendingApprovals: pendingApprovals.length,
    totalActiveTasks: teamMembers.reduce((acc, m) => acc + m.activeTasks, 0),
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
              <p className="text-sm text-gray-500 uppercase tracking-wide">Team Management</p>
              <h1 className="text-2xl font-semibold text-gray-900">My Team</h1>
            </div>
          </div>
          <p className="text-sm md:text-base text-gray-600 mt-1">
            Manage your team members, assign tasks, and track performance
          </p>
        </div>
        <div className="flex gap-2 md:gap-3 flex-wrap md:flex-nowrap w-full md:w-auto">
          <button
            onClick={() => setShowAssignTaskModal(true)}
            className="flex-1 md:flex-initial px-3 md:px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
          >
            <ClipboardList size={18} />
            <span className="hidden sm:inline">Assign Task</span>
            <span className="sm:hidden">Task</span>
          </button>
          <button
            onClick={() => setShowAddMemberModal(true)}
            className="flex-1 md:flex-initial px-3 md:px-4 py-2 rounded-md text-sm font-medium text-white flex items-center justify-center gap-2"
            style={{ backgroundColor: '#2C3E7C' }}
          >
            <UserPlus size={18} />
            <span className="hidden sm:inline">Add Team Member</span>
            <span className="sm:hidden">Add Member</span>
          </button>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left Side (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search and Filter */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search team members by name, role, or department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-0"
                  style={{ focusRing: '#2C3E7C' }}
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 focus:outline-none focus:ring-2"
                  style={{ focusRing: '#2C3E7C' }}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="on-leave">On Leave</option>
                </select>
                <button className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <Filter size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Team Members Grid */}
          <div className="grid grid-cols-1 gap-4">
            {teamMembers.map((member) => (
              <TeamMemberCard key={member.id} member={member} />
            ))}
          </div>
        </div>

        {/* Right Sidebar - Stats & Actions (1/3 width) */}
        <div className="space-y-4">
          {/* Team Overview Stats */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
              Team Overview
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Members</p>
                <p className="text-3xl font-semibold text-gray-900">{teamStats.totalMembers}</p>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Active Members</p>
                <p className="text-3xl font-semibold" style={{ color: '#2C3E7C' }}>
                  {teamStats.activeMembers}
                </p>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Active Tasks</p>
                <p className="text-3xl font-semibold text-gray-900">{teamStats.totalActiveTasks}</p>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Avg. Performance</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-3xl font-semibold text-emerald-600">
                    {teamStats.avgPerformance}
                  </p>
                  <span className="text-lg text-gray-500">/5.0</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Approvals */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Pending Approvals
              </h3>
              <span
                className="px-2 py-1 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: '#F2994A' }}
              >
                {teamStats.pendingApprovals}
              </span>
            </div>
            <div className="space-y-3">
              {pendingApprovals.map((approval) => (
                <div
                  key={approval.id}
                  className="p-3 bg-orange-50 border border-orange-200 rounded-md"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-orange-600" />
                      <span className="text-xs font-semibold text-gray-900 uppercase">
                        {approval.type}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{approval.employeeName}</p>
                  <p className="text-xs text-gray-600 mb-3">{approval.details}</p>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 px-3 py-1.5 rounded text-xs font-medium text-white"
                      style={{ backgroundColor: '#2C3E7C' }}
                    >
                      Approve
                    </button>
                    <button className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded text-xs font-medium text-gray-700 hover:bg-gray-50">
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Team Analytics */}
          <TeamAnalytics members={teamMembers} />
        </div>
      </div>

      {/* Modals */}
      {showAddMemberModal && (
        <AddTeamMemberModal onClose={() => setShowAddMemberModal(false)} />
      )}
      {showAssignTaskModal && (
        <AssignTaskModal onClose={() => setShowAssignTaskModal(false)} teamMembers={teamMembers} />
      )}
    </div>
  );
}
