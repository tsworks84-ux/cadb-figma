import { useState } from 'react';
import { Mail, Phone, MessageSquare, Info, Search, ChevronDown, ChevronUp } from 'lucide-react';

export default function Directory() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const keyPeople = [
    {
      id: 1,
      name: 'Dr. Sarah Mitchell',
      designation: 'Principal',
      areaOfWork: 'Academic Affairs & Overall Administration',
      email: 'sarah.mitchell@centrumacademy.edu',
      phone: '+91 98765 43210',
      purpose: ['General Info', 'Academic Queries'],
      avatar: 'SM',
    },
    {
      id: 2,
      name: 'Mr. Rajesh Kumar',
      designation: 'HR Head',
      areaOfWork: 'Employee Relations & Human Resources',
      email: 'rajesh.kumar@centrumacademy.edu',
      phone: '+91 98765 43211',
      purpose: ['HR Queries', 'Staff Grievances'],
      avatar: 'RK',
    },
    {
      id: 3,
      name: 'Ms. Priya Sharma',
      designation: 'Academic Coordinator',
      areaOfWork: 'Curriculum & Teaching Standards',
      email: 'priya.sharma@centrumacademy.edu',
      phone: '+91 98765 43212',
      purpose: ['Academic Feedback', 'Curriculum Queries'],
      avatar: 'PS',
    },
    {
      id: 4,
      name: 'Mr. Anil Verma',
      designation: 'Admin Manager',
      areaOfWork: 'Operations & Facilities Management',
      email: 'anil.verma@centrumacademy.edu',
      phone: '+91 98765 43213',
      purpose: ['Facilities Issues', 'General Complaints'],
      avatar: 'AV',
    },
    {
      id: 5,
      name: 'Dr. Meera Reddy',
      designation: 'Student Welfare Officer',
      areaOfWork: 'Student Support & Counseling',
      email: 'meera.reddy@centrumacademy.edu',
      phone: '+91 98765 43214',
      purpose: ['Student Welfare', 'Counseling'],
      avatar: 'MR',
    },
  ];

  const filteredPeople = keyPeople.filter((person) => {
    const matchesSearch =
      person.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      person.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      person.areaOfWork.toLowerCase().includes(searchQuery.toLowerCase()) ||
      person.purpose.some((p) => p.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      {/* Header - Collapsible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between mb-4"
      >
        <div className="flex items-center gap-2">
          <Info size={16} style={{ color: '#2C3E7C' }} />
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Directory
          </h3>
          <span className="text-xs text-gray-500">({keyPeople.length})</span>
        </div>
        {isExpanded ? (
          <ChevronUp size={18} className="text-gray-400" />
        ) : (
          <ChevronDown size={18} className="text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <>
          <p className="text-xs text-gray-600 mb-4">
            Key contacts for information, feedback, and support
          </p>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by name, designation, or area..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>
        </>
      )}

      {isExpanded && (
        <>
          {filteredPeople.length > 0 ? (
            <div className="space-y-4">
              {filteredPeople.map((person) => (
          <div
            key={person.id}
            className="pb-4 border-b border-gray-100 last:border-b-0 last:pb-0"
          >
            {/* Header */}
            <div className="flex items-start gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-medium text-sm flex-shrink-0"
                style={{ backgroundColor: '#2C3E7C' }}
              >
                {person.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 truncate">
                  {person.name}
                </h4>
                <p className="text-xs text-gray-600">{person.designation}</p>
              </div>
            </div>

            {/* Area of Work */}
            <div className="mb-2 pl-13">
              <p className="text-xs text-gray-700">{person.areaOfWork}</p>
            </div>

            {/* Purpose Tags */}
            <div className="flex flex-wrap gap-1 mb-3 pl-13">
              {person.purpose.map((p, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded"
                >
                  {p}
                </span>
              ))}
            </div>

            {/* Contact Details */}
            <div className="space-y-1.5 pl-13">
              <a
                href={`mailto:${person.email}`}
                className="flex items-center gap-2 text-xs text-gray-600 hover:text-blue-600 transition-colors group"
              >
                <Mail size={13} className="text-gray-400 group-hover:text-blue-600" />
                <span className="truncate">{person.email}</span>
              </a>
              <a
                href={`tel:${person.phone}`}
                className="flex items-center gap-2 text-xs text-gray-600 hover:text-blue-600 transition-colors group"
              >
                <Phone size={13} className="text-gray-400 group-hover:text-blue-600" />
                <span>{person.phone}</span>
              </a>
            </div>
          </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">No contacts found matching your search.</p>
            </div>
          )}

          {/* Footer Note */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex items-start gap-2">
              <MessageSquare className="text-blue-600 flex-shrink-0 mt-0.5" size={14} />
              <p className="text-xs text-blue-900">
                Reach out to the appropriate contact for your queries, feedback, or concerns.
                Response time: 24-48 hours.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
