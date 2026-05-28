import { useState } from 'react';
import {
  Plus,
  Upload,
  FileText,
  Calendar,
  Eye,
  Trash2,
  Pencil,
  File,
  Search,
} from 'lucide-react';
import UploadPolicyModal from './UploadPolicyModal';

interface PoliciesProps {
  isAdmin?: boolean;
}

export default function Policies({ isAdmin = false }: PoliciesProps) {
  const [showUploadPolicy, setShowUploadPolicy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const policies = [
    {
      id: 1,
      title: 'Leave Policy',
      category: 'HR Policies',
      uploadedBy: 'System Admin',
      uploadedOn: '2026-04-15',
      lastUpdated: '2026-04-15',
      fileSize: '2.3 MB',
      fileName: 'leave-policy-2026.pdf',
      views: 145,
    },
    {
      id: 2,
      title: 'Reimbursement Policy',
      category: 'Finance Policies',
      uploadedBy: 'System Admin',
      uploadedOn: '2026-04-10',
      lastUpdated: '2026-04-10',
      fileSize: '1.8 MB',
      fileName: 'reimbursement-policy.pdf',
      views: 98,
    },
    {
      id: 3,
      title: 'Travel Policy',
      category: 'Finance Policies',
      uploadedBy: 'System Admin',
      uploadedOn: '2026-03-25',
      lastUpdated: '2026-03-25',
      fileSize: '1.5 MB',
      fileName: 'travel-policy.pdf',
      views: 67,
    },
    {
      id: 4,
      title: 'Class Discipline Policy',
      category: 'Academic Policies',
      uploadedBy: 'System Admin',
      uploadedOn: '2026-03-20',
      lastUpdated: '2026-03-20',
      fileSize: '3.1 MB',
      fileName: 'class-discipline-policy.pdf',
      views: 234,
    },
  ];

  const categories = [
    'All Policies',
    'HR Policies',
    'Finance Policies',
    'Academic Policies',
    'IT Policies',
    'Safety Policies',
  ];

  const filteredPolicies = policies.filter((policy) => {
    const matchesSearch = policy.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         policy.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' ||
                           policy.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Policy Documents</h1>
          <p className="text-sm text-gray-600 mt-1">Company policies and guidelines</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowUploadPolicy(true)}
            className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
            style={{ backgroundColor: '#2C3E7C' }}
          >
            <Plus size={18} />
            Upload Policy
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search policies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 focus:outline-none focus:ring-2"
          >
            <option value="all">All Categories</option>
            {categories.slice(1).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Policies List */}
      {filteredPolicies.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredPolicies.map((policy) => (
            <div
              key={policy.id}
              className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-all p-5"
            >
              {/* Header */}
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#2C3E7C' }}
                >
                  <FileText className="text-white" size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 mb-1">
                    {policy.title}
                  </h3>
                  <p className="text-xs text-gray-500">{policy.category}</p>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600">
                      <Pencil size={16} />
                    </button>
                    <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <File size={14} className="text-gray-400" />
                  <span>{policy.fileName}</span>
                  <span className="text-gray-400">•</span>
                  <span>{policy.fileSize}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Calendar size={14} className="text-gray-400" />
                  <span>Uploaded on {new Date(policy.uploadedOn).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Eye size={14} className="text-gray-400" />
                  <span>{policy.views} views</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  className="w-full px-4 py-2 rounded-md text-sm font-medium text-white flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#2C3E7C' }}
                >
                  <Eye size={16} />
                  View Policy
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <FileText className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-base font-medium text-gray-900 mb-1">
            No policy documents published yet.
          </p>
          <p className="text-sm text-gray-500 mb-4">
            {isAdmin
              ? 'Start by uploading your first policy document.'
              : 'Check back later for policy updates.'}
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowUploadPolicy(true)}
              className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2 mx-auto"
              style={{ backgroundColor: '#2C3E7C' }}
            >
              <Upload size={18} />
              Upload your first policy
            </button>
          )}
        </div>
      )}

      {/* Stats for Admin */}
      {isAdmin && policies.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {policies.length} {policies.length === 1 ? 'policy' : 'policies'} published
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Total views: {policies.reduce((sum, p) => sum + p.views, 0)}
              </p>
            </div>
            <FileText className="text-blue-600" size={24} />
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadPolicy && (
        <UploadPolicyModal onClose={() => setShowUploadPolicy(false)} />
      )}
    </div>
  );
}
