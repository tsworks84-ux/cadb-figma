import { Bell, Pin, AlertTriangle } from 'lucide-react';

export default function RecentAnnouncements() {
  const announcements = [
    {
      title: 'Mid-Term Exams Schedule',
      date: '2 hours ago',
      priority: 'high',
      pinned: true,
      excerpt: 'The mid-term examination schedule has been released. Please check your student portal.',
    },
    {
      title: 'Library Hours Extended',
      date: 'Yesterday',
      priority: 'normal',
      pinned: false,
      excerpt: 'The library will now be open until 10 PM on weekdays to support exam preparation.',
    },
    {
      title: 'Sports Day Registration',
      date: '2 days ago',
      priority: 'low',
      pinned: false,
      excerpt: 'Annual sports day is on June 5th. Register for your events by May 20th.',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Announcements</h3>
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          View All
        </button>
      </div>
      <div className="space-y-3">
        {announcements.map((announcement, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg border ${
              announcement.priority === 'high'
                ? 'bg-red-50 border-red-200'
                : 'bg-gray-50 border-gray-200'
            } hover:shadow-sm transition-shadow`}
          >
            <div className="flex items-start gap-2 mb-2">
              {announcement.pinned && (
                <Pin size={14} className="text-orange-500 mt-1" />
              )}
              {announcement.priority === 'high' && (
                <AlertTriangle size={14} className="text-red-500 mt-1" />
              )}
              <div className="flex-1">
                <h4 className="font-semibold text-sm text-gray-900">
                  {announcement.title}
                </h4>
                <p className="text-xs text-gray-600 mt-1">
                  {announcement.excerpt}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{announcement.date}</span>
              <Bell size={12} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
