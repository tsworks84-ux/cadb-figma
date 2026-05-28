import { useState } from 'react';
import {
  Plus,
  Receipt,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  Settings,
  Users,
  FileText,
  AlertCircle,
} from 'lucide-react';
import NewClaimModal from './NewClaimModal';
import ClaimApprovalModal from './ClaimApprovalModal';

export default function Claims() {
  const [activeTab, setActiveTab] = useState('my-claims');
  const [showNewClaim, setShowNewClaim] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [viewMode, setViewMode] = useState('pending');

  const tabs = [
    { id: 'my-claims', label: 'My Claims', icon: Receipt },
    { id: 'team-claims', label: 'Team Claims', icon: Users },
  ];

  const stats = {
    thisMonth: { amount: 0, count: 0 },
    thisFY: { amount: 0, count: 0 },
    pendingApproval: 0,
    totalApproved: { amount: 0, count: 0 },
  };

  const myClaims = [
    // Empty for now
  ];

  const pendingApprovals = [
    {
      id: 1,
      employee: 'Priya Sharma',
      employeeCode: '256881',
      claimType: 'Travel',
      amount: 2500,
      date: '2026-05-15',
      description: 'Travel to Pune for training workshop',
      attachments: ['receipt.pdf'],
      submittedOn: '2026-05-15',
    },
  ];

  const receiptRequiredLimit = 250; // This would come from Administration settings

  const handleApproveClaim = (claim: any) => {
    setSelectedClaim(claim);
    setShowApprovalModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reimbursement Claims</h1>
          <p className="text-sm text-gray-600 mt-1">
            Submit expense claims and track reimbursement status
          </p>
        </div>
        <div className="flex gap-2">
          <div className="px-4 py-2 border border-gray-200 rounded-md text-sm text-gray-600 flex items-center gap-2">
            <Settings size={16} />
            Receipt required above ₹{receiptRequiredLimit}
          </div>
          <button
            onClick={() => setShowNewClaim(true)}
            className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
            style={{ backgroundColor: '#2C3E7C' }}
          >
            <Plus size={18} />
            New Claim
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

      {/* My Claims Tab */}
      {activeTab === 'my-claims' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Calendar className="text-blue-600" size={20} />
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-1">This Month</p>
              <p className="text-2xl font-semibold text-gray-900">₹{stats.thisMonth.amount}</p>
              <p className="text-xs text-gray-500">{stats.thisMonth.count} claims</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Receipt className="text-purple-600" size={20} />
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-1">This FY (Apr-Mar)</p>
              <p className="text-2xl font-semibold text-gray-900">₹{stats.thisFY.amount}</p>
              <p className="text-xs text-gray-500">{stats.thisFY.count} claims</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                  <Clock className="text-orange-600" size={20} />
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-1">Pending Approval</p>
              <p className="text-2xl font-semibold text-orange-600">{stats.pendingApproval}</p>
              <p className="text-xs text-gray-500">—</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <CheckCircle2 className="text-green-600" size={20} />
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-1">Total Approved</p>
              <p className="text-2xl font-semibold text-green-600">
                ₹{stats.totalApproved.amount}
              </p>
              <p className="text-xs text-gray-500">{stats.totalApproved.count} claims</p>
            </div>
          </div>

          {/* My Claims Section */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-5 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">My Claims</h2>
            </div>
            <div className="p-12 text-center">
              <Receipt className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-base font-medium text-gray-900 mb-1">No claims yet</p>
              <p className="text-sm text-gray-500">
                Click <span className="font-medium">+ New Claim</span> to get started.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Team Claims Tab */}
      {activeTab === 'team-claims' && (
        <div className="space-y-6">
          {/* Tabs for Pending/All */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center gap-2">
              <button
                onClick={() => setViewMode('pending')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'pending'
                    ? 'text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                style={viewMode === 'pending' ? { backgroundColor: '#2C3E7C' } : {}}
              >
                Pending Approvals
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'all'
                    ? 'text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                style={viewMode === 'all' ? { backgroundColor: '#2C3E7C' } : {}}
              >
                All Claims
              </button>
            </div>

            {/* Pending Approvals */}
            {viewMode === 'pending' && (
              <div>
                {pendingApprovals.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {pendingApprovals.map((claim) => (
                      <div key={claim.id} className="p-5 hover:bg-gray-50">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="font-medium text-gray-900">{claim.employee}</p>
                              <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                                {claim.employeeCode}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 mb-2">
                              <span className="px-2.5 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700">
                                {claim.claimType}
                              </span>
                              <p className="text-lg font-semibold text-gray-900">
                                ₹{claim.amount}
                              </p>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{claim.description}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>
                                Date: {new Date(claim.date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                              <span>
                                Submitted:{' '}
                                {new Date(claim.submittedOn).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                              {claim.attachments.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <FileText size={14} />
                                  {claim.attachments.length} attachment(s)
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleApproveClaim(claim)}
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
                    <p className="text-sm text-gray-500">No claims pending approval.</p>
                  </div>
                )}
              </div>
            )}

            {/* All Claims */}
            {viewMode === 'all' && (
              <div className="p-12 text-center">
                <Receipt className="mx-auto text-gray-300 mb-4" size={48} />
                <p className="text-sm text-gray-500">No team claims yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showNewClaim && (
        <NewClaimModal
          receiptRequiredLimit={receiptRequiredLimit}
          onClose={() => setShowNewClaim(false)}
        />
      )}
      {showApprovalModal && selectedClaim && (
        <ClaimApprovalModal
          claim={selectedClaim}
          onClose={() => {
            setShowApprovalModal(false);
            setSelectedClaim(null);
          }}
        />
      )}
    </div>
  );
}
