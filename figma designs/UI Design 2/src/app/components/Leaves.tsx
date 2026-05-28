import { useState } from 'react';
import {
  Plus,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  Download,
  ChevronDown,
  ChevronUp,
  Filter,
  Users,
} from 'lucide-react';
import ApplyLeaveModal from './ApplyLeaveModal';
import LeaveApprovalModal from './LeaveApprovalModal';
import LOPApprovalModal from './LOPApprovalModal';
import HolidayCalendar from './HolidayCalendar';

export default function Leaves() {
  const [activeTab, setActiveTab] = useState('my-leaves');
  const [showApplyLeave, setShowApplyLeave] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showLOPModal, setShowLOPModal] = useState(false);
  const [showHolidayCalendar, setShowHolidayCalendar] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [expandedSections, setExpandedSections] = useState({
    applyLeave: false,
    leaveHistory: true,
    pendingApprovals: true,
    decisionHistory: false,
  });

  const tabs = [
    { id: 'my-leaves', label: 'My Leaves', icon: Calendar },
    { id: 'team-leaves', label: 'Team Leaves', icon: Users },
  ];

  const leaveBalance = {
    casual: { accrued: 0, availed: 0, pending: 0 },
    sick: { accrued: 0, availed: 0, pending: 0 },
    lop: { thisFY: 0, status: 'None' },
  };

  const myLeaves = [
    // Empty for now - will show empty state
  ];

  const pendingApprovals = [
    {
      id: 1,
      employee: 'Priya Sharma',
      employeeCode: '256881',
      type: 'Casual Leave',
      from: '2026-05-20',
      to: '2026-05-22',
      days: 3,
      reason: 'Family function',
      appliedOn: '2026-05-16',
    },
  ];

  const lopRequests = [
    {
      id: 1,
      employee: 'Priya Sharma',
      employeeCode: '256881',
      days: 2,
      dates: '2026-05-10, 2026-05-11',
      reason: 'Exceeded casual leave quota',
      status: 'pending',
    },
  ];

  const decisionHistory = [
    {
      id: 1,
      employee: 'Priya Sharma',
      type: 'Sick Leave',
      from: '2026-05-05',
      to: '2026-05-06',
      days: 2,
      decision: 'approved',
      decidedOn: '2026-05-05',
    },
  ];

  const toggleSection = (section: string) => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section as keyof typeof expandedSections],
    });
  };

  const handleApproveLeave = (leave: any) => {
    setSelectedLeave(leave);
    setShowApprovalModal(true);
  };

  const handleLOPAction = (lop: any) => {
    setSelectedLeave(lop);
    setShowLOPModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Leaves</h1>
          <p className="text-sm text-gray-600 mt-1">
            Check available leaves, submit a request, and track approvals in one place.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHolidayCalendar(true)}
            className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Calendar size={18} />
            View Holiday Calendar
          </button>
          <button
            onClick={() => setShowApplyLeave(true)}
            className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
            style={{ backgroundColor: '#2C3E7C' }}
          >
            <Plus size={18} />
            Apply for Leave
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
                  activeTab === tab.id ? { borderBottomColor: '#2C3E7C' } : {}
                }
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* My Leaves Tab */}
      {activeTab === 'my-leaves' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Leave Balance */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Leave Balance</h2>
                  <p className="text-sm text-gray-500">FY 2026-2027 · Accrued monthly</p>
                </div>
                <span className="text-sm text-gray-500">0 days annual entitlement</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Casual Leave */}
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <h3 className="text-sm font-medium text-blue-600 mb-3">CASUAL</h3>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-4xl font-semibold text-gray-900">
                      {leaveBalance.casual.accrued}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Accrued</span>
                      <span className="font-medium text-gray-900">
                        {leaveBalance.casual.accrued}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Availed</span>
                      <span className="font-medium text-gray-900">
                        {leaveBalance.casual.availed}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Pending</span>
                      <span className="font-medium text-gray-900">
                        {leaveBalance.casual.pending}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sick Leave */}
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <h3 className="text-sm font-medium text-orange-600 mb-3">SICK</h3>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-4xl font-semibold text-gray-900">
                      {leaveBalance.sick.accrued}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Accrued</span>
                      <span className="font-medium text-gray-900">
                        {leaveBalance.sick.accrued}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Availed</span>
                      <span className="font-medium text-gray-900">
                        {leaveBalance.sick.availed}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Pending</span>
                      <span className="font-medium text-gray-900">
                        {leaveBalance.sick.pending}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Loss of Pay */}
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <h3 className="text-sm font-medium text-red-600 mb-3">LOSS OF PAY</h3>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-4xl font-semibold text-gray-900">
                      {leaveBalance.lop.thisFY}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">This FY</span>
                      <span className="font-medium text-gray-900">
                        {leaveBalance.lop.thisFY} days
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status</span>
                      <span className="font-medium text-gray-900">
                        {leaveBalance.lop.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-3">
                Next accrual: 1 June 2026
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Medical certificate required for sick leave over 2 days
              </p>
            </div>

            {/* Apply for Leave Section */}
            <div className="bg-white rounded-lg border border-gray-200">
              <button
                onClick={() => setShowApplyLeave(true)}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Plus size={20} style={{ color: '#2C3E7C' }} />
                  <h3 className="text-base font-semibold text-gray-900">Apply for Leave</h3>
                </div>
                <ChevronDown size={20} className="text-gray-400" />
              </button>
            </div>

            {/* Leave History */}
            <div className="bg-white rounded-lg border border-gray-200">
              <button
                onClick={() => toggleSection('leaveHistory')}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Leave History</h3>
                  <p className="text-sm text-gray-500 text-left mt-1">
                    Recent applications and approval status.
                  </p>
                </div>
                {expandedSections.leaveHistory ? (
                  <ChevronUp size={20} className="text-gray-400" />
                ) : (
                  <ChevronDown size={20} className="text-gray-400" />
                )}
              </button>

              {expandedSections.leaveHistory && (
                <div className="border-t border-gray-200">
                  <div className="p-4 flex items-center gap-2 border-b border-gray-200">
                    <button
                      onClick={() => setHistoryFilter('all')}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        historyFilter === 'all'
                          ? 'text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                      style={historyFilter === 'all' ? { backgroundColor: '#2C3E7C' } : {}}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setHistoryFilter('pending')}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        historyFilter === 'pending'
                          ? 'text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                      style={historyFilter === 'pending' ? { backgroundColor: '#2C3E7C' } : {}}
                    >
                      Pending
                    </button>
                    <button
                      onClick={() => setHistoryFilter('approved')}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        historyFilter === 'approved'
                          ? 'text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                      style={historyFilter === 'approved' ? { backgroundColor: '#2C3E7C' } : {}}
                    >
                      Approved
                    </button>
                  </div>

                  <div className="p-12 text-center">
                    <Calendar className="mx-auto text-gray-300 mb-4" size={48} />
                    <p className="text-base font-medium text-gray-900 mb-1">
                      No leave applications yet
                    </p>
                    <p className="text-sm text-gray-500">
                      Your submitted leave requests will appear here with approval status and
                      balance impact.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Current Request */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Current Request</h3>
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 mb-1">No leave applications yet</p>
                <p className="text-xs text-gray-400">
                  Start submitting leave requests and gauge impact
                </p>
              </div>
            </div>

            {/* Policy Snapshot */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Policy Snapshot</h3>
                <FileText size={16} className="text-gray-400" />
              </div>
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">No leave policy assigned yet.</p>
              </div>
              <button className="w-full mt-3 px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2">
                <Download size={16} />
                Download Full Policy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Leaves Tab */}
      {activeTab === 'team-leaves' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 flex items-start gap-3">
            <Users className="text-purple-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-medium text-gray-900">LEAVE MANAGEMENT</p>
              <p className="text-xs text-gray-600 mt-1">
                Review and approve leave requests from your team members
              </p>
            </div>
          </div>

          {/* Pending Approvals */}
          <div className="bg-white rounded-lg border border-gray-200">
            <button
              onClick={() => toggleSection('pendingApprovals')}
              className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Clock className="text-orange-600" size={20} />
                <h3 className="text-base font-semibold text-gray-900">Pending Approvals</h3>
              </div>
              {expandedSections.pendingApprovals ? (
                <ChevronUp size={20} className="text-gray-400" />
              ) : (
                <ChevronDown size={20} className="text-gray-400" />
              )}
            </button>

            {expandedSections.pendingApprovals && (
              <div className="border-t border-gray-200">
                {pendingApprovals.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {pendingApprovals.map((leave) => (
                      <div key={leave.id} className="p-5 hover:bg-gray-50">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="font-medium text-gray-900">{leave.employee}</p>
                              <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                                {leave.employeeCode}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              <span className="font-medium">{leave.type}</span> · {leave.days}{' '}
                              {leave.days === 1 ? 'day' : 'days'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {new Date(leave.from).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}{' '}
                              -{' '}
                              {new Date(leave.to).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </p>
                            <p className="text-sm text-gray-500 mt-2">
                              <span className="font-medium">Reason:</span> {leave.reason}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Applied on{' '}
                              {new Date(leave.appliedOn).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </p>
                          </div>
                          <button
                            onClick={() => handleApproveLeave(leave)}
                            className="px-4 py-2 rounded-md text-sm font-medium text-white whitespace-nowrap"
                            style={{ backgroundColor: '#2C3E7C' }}
                          >
                            Review
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <Clock className="mx-auto text-gray-300 mb-4" size={48} />
                    <p className="text-sm text-gray-500">No pending approvals at this time.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* LOP Approvals */}
          {lopRequests.length > 0 && (
            <div className="bg-white rounded-lg border border-red-200">
              <div className="p-5 bg-red-50 border-b border-red-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="text-red-600" size={20} />
                  <h3 className="text-base font-semibold text-gray-900">
                    Loss of Pay Approvals
                  </h3>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Review and approve or waive LOP for your team members
                </p>
              </div>
              <div className="divide-y divide-gray-200">
                {lopRequests.map((lop) => (
                  <div key={lop.id} className="p-5 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-medium text-gray-900">{lop.employee}</p>
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                            {lop.employeeCode}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          <span className="font-medium text-red-600">
                            {lop.days} {lop.days === 1 ? 'day' : 'days'} LOP
                          </span>
                        </p>
                        <p className="text-sm text-gray-500">Dates: {lop.dates}</p>
                        <p className="text-sm text-gray-500 mt-2">
                          <span className="font-medium">Reason:</span> {lop.reason}
                        </p>
                      </div>
                      <button
                        onClick={() => handleLOPAction(lop)}
                        className="px-4 py-2 rounded-md text-sm font-medium text-white whitespace-nowrap"
                        style={{ backgroundColor: '#2C3E7C' }}
                      >
                        Take Action
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decision History */}
          <div className="bg-white rounded-lg border border-gray-200">
            <button
              onClick={() => toggleSection('decisionHistory')}
              className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-green-600" size={20} />
                <div className="text-left">
                  <h3 className="text-base font-semibold text-gray-900">Decision History</h3>
                  <p className="text-sm text-gray-500">Leaves you have approved or rejected</p>
                </div>
              </div>
              {expandedSections.decisionHistory ? (
                <ChevronUp size={20} className="text-gray-400" />
              ) : (
                <ChevronDown size={20} className="text-gray-400" />
              )}
            </button>

            {expandedSections.decisionHistory && (
              <div className="border-t border-gray-200">
                {decisionHistory.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {decisionHistory.map((decision) => (
                      <div key={decision.id} className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="font-medium text-gray-900">{decision.employee}</p>
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  decision.decision === 'approved'
                                    ? 'bg-green-50 text-green-700'
                                    : 'bg-red-50 text-red-700'
                                }`}
                              >
                                {decision.decision}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {decision.type} · {decision.days}{' '}
                              {decision.days === 1 ? 'day' : 'days'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {new Date(decision.from).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}{' '}
                              -{' '}
                              {new Date(decision.to).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Decided on{' '}
                              {new Date(decision.decidedOn).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <CheckCircle2 className="mx-auto text-gray-300 mb-4" size={48} />
                    <p className="text-sm text-gray-500">No decisions recorded yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showApplyLeave && <ApplyLeaveModal onClose={() => setShowApplyLeave(false)} />}
      {showApprovalModal && selectedLeave && (
        <LeaveApprovalModal
          leave={selectedLeave}
          onClose={() => {
            setShowApprovalModal(false);
            setSelectedLeave(null);
          }}
        />
      )}
      {showLOPModal && selectedLeave && (
        <LOPApprovalModal
          lop={selectedLeave}
          onClose={() => {
            setShowLOPModal(false);
            setSelectedLeave(null);
          }}
        />
      )}
      {showHolidayCalendar && (
        <HolidayCalendar
          isAdmin={true}
          onClose={() => setShowHolidayCalendar(false)}
        />
      )}
    </div>
  );
}
