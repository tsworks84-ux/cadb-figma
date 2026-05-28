import { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  Users,
  AlertCircle,
  Calendar,
  FileText,
  MoreVertical,
  Edit,
  Trash2,
  Send,
  TrendingUp,
} from 'lucide-react';
import NoticeCard from './NoticeCard';
import CreateNoticeModal from './CreateNoticeModal';
import NoticeAnalytics from './NoticeAnalytics';

export default function NoticeBoard() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterAudience, setFilterAudience] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const notices = [
    {
      id: 1,
      title: 'Mid-Term Examination Schedule - Academic Year 2025-26',
      content:
        'The mid-term examinations will be conducted from June 1st to June 15th, 2026. Students are required to report 15 minutes before the scheduled time. Hall tickets will be distributed by class teachers.',
      category: 'Examination',
      audience: ['students', 'parents'],
      postedBy: 'Dr. Sarah Mitchell',
      postedDate: '2026-05-10T09:00:00',
      priority: 'high',
      totalRecipients: 850,
      acknowledged: 672,
      viewed: 798,
      status: 'active',
    },
    {
      id: 2,
      title: 'Parent-Teacher Meeting (PTM) - May 2026',
      content:
        'PTM is scheduled for May 25th, 2026 from 10:00 AM to 4:00 PM. Parents are requested to meet respective class teachers to discuss student progress and performance.',
      category: 'Event',
      audience: ['parents', 'staff'],
      postedBy: 'Principal Office',
      postedDate: '2026-05-08T14:30:00',
      priority: 'medium',
      totalRecipients: 920,
      acknowledged: 856,
      viewed: 901,
      status: 'active',
    },
    {
      id: 3,
      title: 'Physics Lab Practical Submission Deadline',
      content:
        'All Grade 11 and 12 students must submit their physics lab practical notebooks by May 20th, 2026. Late submissions will incur a 10% deduction in marks.',
      category: 'Academic',
      audience: ['students'],
      postedBy: 'Prof. James Wilson',
      postedDate: '2026-05-05T11:00:00',
      priority: 'medium',
      totalRecipients: 240,
      acknowledged: 198,
      viewed: 226,
      status: 'active',
    },
    {
      id: 4,
      title: 'Staff Professional Development Workshop',
      content:
        'Mandatory workshop on "Modern Teaching Methodologies" scheduled for May 22nd, 2026. All teaching staff are required to attend. Lunch will be provided.',
      category: 'Training',
      audience: ['staff'],
      postedBy: 'HR Department',
      postedDate: '2026-05-03T08:00:00',
      priority: 'high',
      totalRecipients: 85,
      acknowledged: 81,
      viewed: 85,
      status: 'active',
    },
    {
      id: 5,
      title: 'Summer Vacation Notice',
      content:
        'School will remain closed for summer vacation from June 20th to July 10th, 2026. Classes will resume on July 11th, 2026.',
      category: 'Holiday',
      audience: ['students', 'parents', 'staff'],
      postedBy: 'Administration',
      postedDate: '2026-05-01T10:00:00',
      priority: 'low',
      totalRecipients: 1255,
      acknowledged: 1100,
      viewed: 1189,
      status: 'active',
    },
  ];

  const stats = {
    total: notices.length,
    active: notices.filter((n) => n.status === 'active').length,
    drafts: 2,
    avgAcknowledgmentRate:
      Math.round(
        (notices.reduce((acc, n) => acc + (n.acknowledged / n.totalRecipients) * 100, 0) /
          notices.length) *
          10
      ) / 10,
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
              <FileText className="text-white" size={18} />
            </div>
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wide">Team Communication</p>
              <h1 className="text-2xl font-semibold text-gray-900">Notice Board</h1>
            </div>
          </div>
          <p className="text-sm md:text-base text-gray-600 mt-1">
            Publish updates that every team member can quickly view and acknowledge
          </p>
        </div>
        <div className="flex gap-2 md:gap-3 flex-wrap md:flex-nowrap">
          <button className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
            Save Draft
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
            style={{ backgroundColor: '#2C3E7C' }}
          >
            <Plus size={18} />
            New Notice
          </button>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left Side (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search and Filter */}
          <div className="bg-white rounded-lg border border-gray-200 p-3 md:p-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search notices by title, category, or author..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-0"
                  style={{ focusRing: '#2C3E7C' }}
                />
              </div>
              <div className="flex gap-2 flex-1 md:flex-initial">
                <select
                  value={filterAudience}
                  onChange={(e) => setFilterAudience(e.target.value)}
                  className="flex-1 md:flex-initial px-3 md:px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 focus:outline-none focus:ring-2"
                  style={{ focusRing: '#2C3E7C' }}
                >
                  <option value="all">All Audiences</option>
                  <option value="students">Students</option>
                  <option value="staff">Staff</option>
                  <option value="parents">Parents</option>
                </select>
                <button className="px-3 md:px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center">
                  <Filter size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Notices List */}
          <div className="space-y-4">
            {notices.map((notice) => (
              <NoticeCard key={notice.id} notice={notice} />
            ))}
          </div>
        </div>

        {/* Right Sidebar - Analytics (1/3 width) */}
        <div className="space-y-4">
          {/* Stats Overview */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
              Overview
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total</p>
                <p className="text-3xl font-semibold text-gray-900">{stats.total}</p>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Active</p>
                <p className="text-3xl font-semibold" style={{ color: '#2C3E7C' }}>
                  {stats.active}
                </p>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Drafts</p>
                <p className="text-3xl font-semibold text-gray-900">{stats.drafts}</p>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Avg. Acknowledgment</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-3xl font-semibold text-emerald-600">
                    {stats.avgAcknowledgmentRate}%
                  </p>
                  <TrendingUp size={20} className="text-emerald-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Analytics Summary */}
          <NoticeAnalytics notices={notices} />
        </div>
      </div>

      {/* Create Notice Modal */}
      {showCreateModal && <CreateNoticeModal onClose={() => setShowCreateModal(false)} />}
    </div>
  );
}
