import { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Users,
  UserPlus,
  UserMinus,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  MoreVertical,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react';
import AddEmployeeModal from './AddEmployeeModal';
import EmployeeProfile from './EmployeeProfile';

export default function Employees() {
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);

  const employees = [
    {
      id: 1,
      name: 'Priya Sharma',
      code: '256881',
      email: 'priya@centrum.edu',
      phone: '+1 234-567-8901',
      department: 'Mathematics',
      designation: 'Faculty Member',
      gender: 'Female',
      type: 'PART TIME',
      joined: '01 May 2025',
      status: 'ACTIVE',
      profileCompletion: 1/7,
      avatar: 'PS',
      location: 'Main Campus',
      reportingTo: 'Dr. Sarah Mitchell',
    },
    {
      id: 2,
      name: 'System Administrator',
      code: 'SA0001',
      email: 'admin@centrum.edu',
      phone: '+1 234-567-8900',
      department: 'Administration',
      designation: 'Super Administrator',
      gender: 'Male',
      type: 'FULL TIME',
      joined: '15 May 2026',
      status: 'ACTIVE',
      profileCompletion: 6/7,
      avatar: 'SA',
      location: 'Main Campus',
      reportingTo: 'Principal',
    },
    {
      id: 3,
      name: 'Dr. Sarah Mitchell',
      code: 'EMP-001',
      email: 'sarah.mitchell@centrum.edu',
      phone: '+1 234-567-8902',
      department: 'Mathematics',
      designation: 'Department Head',
      gender: 'Female',
      type: 'FULL TIME',
      joined: '15 Aug 2020',
      status: 'ACTIVE',
      profileCompletion: 7/7,
      avatar: 'SM',
      location: 'Main Campus',
      reportingTo: 'Principal',
    },
    {
      id: 4,
      name: 'Prof. James Wilson',
      code: 'EMP-002',
      email: 'james.wilson@centrum.edu',
      phone: '+1 234-567-8903',
      department: 'Science',
      designation: 'Physics Department Head',
      gender: 'Male',
      type: 'FULL TIME',
      joined: '01 Sep 2018',
      status: 'ACTIVE',
      profileCompletion: 7/7,
      avatar: 'JW',
      location: 'Science Block',
      reportingTo: 'Principal',
    },
    {
      id: 5,
      name: 'Ms. Emily Parker',
      code: 'EMP-003',
      email: 'emily.parker@centrum.edu',
      phone: '+1 234-567-8904',
      department: 'Humanities',
      designation: 'English Teacher',
      gender: 'Female',
      type: 'FULL TIME',
      joined: '10 Jul 2021',
      status: 'ON LEAVE',
      profileCompletion: 7/7,
      avatar: 'EP',
      location: 'Arts Building',
      reportingTo: 'Dr. Sarah Mitchell',
    },
  ];

  const stats = {
    totalEmployees: employees.length,
    onLeaveToday: employees.filter(e => e.status === 'ON LEAVE').length,
    onboardedThisMonth: employees.filter(e => e.joined.includes('May 2026')).length,
    leftThisMonth: 1,
  };

  const incompleteProfiles = employees.filter(e => e.profileCompletion < 1).length;

  const toggleSelectEmployee = (id: number) => {
    setSelectedEmployees(prev =>
      prev.includes(id) ? prev.filter(eid => eid !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    setSelectedEmployees(
      selectedEmployees.length === employees.length ? [] : employees.map(e => e.id)
    );
  };

  // If viewing employee profile, show profile component
  if (selectedEmployeeId) {
    return <EmployeeProfile isOwnProfile={false} onBack={() => setSelectedEmployeeId(null)} />;
  }

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
              <h1 className="text-2xl font-semibold text-gray-900">Employees</h1>
              <p className="text-sm text-gray-600">{stats.totalEmployees} total employees</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 md:gap-3 flex-wrap">
          <button className="px-3 md:px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <Upload size={18} />
            <span className="hidden sm:inline">Import</span>
          </button>
          <button className="px-3 md:px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <Download size={18} />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={() => setShowAddEmployeeModal(true)}
            className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
            style={{ backgroundColor: '#2C3E7C' }}
          >
            <Plus size={18} />
            Add Employee
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Employees</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalEmployees}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
              <Calendar className="text-orange-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-600">On Leave Today</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.onLeaveToday}</p>
              <p className="text-xs text-gray-500">16 May</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <UserPlus className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Onboarded in May</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.onboardedThisMonth}</p>
              <p className="text-xs text-gray-500">joined this month</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <UserMinus className="text-red-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Out in May</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.leftThisMonth}</p>
              <p className="text-xs text-gray-500">left this month</p>
            </div>
          </div>
        </div>
      </div>

      {/* Incomplete Profiles Alert */}
      {incompleteProfiles > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="text-orange-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              {incompleteProfiles} employee{incompleteProfiles > 1 ? 's' : ''} have incomplete profiles
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Missing DOB, blood group, address, or emergency contact info
            </p>
          </div>
          <button className="text-sm font-medium hover:underline" style={{ color: '#2C3E7C' }}>
            View →
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name, code, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 focus:outline-none focus:ring-2"
            >
              <option value="all">All Departments</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Science">Science</option>
              <option value="Humanities">Humanities</option>
              <option value="Administration">Administration</option>
            </select>
            <button className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
              <Filter size={18} />
              <span className="hidden md:inline">Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedEmployees.length === employees.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: '#2C3E7C' }}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Designation
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Profile
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {employees.map((employee) => {
                const completion = Math.round(employee.profileCompletion * 100);
                return (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedEmployees.includes(employee.id)}
                        onChange={() => toggleSelectEmployee(employee.id)}
                        className="w-4 h-4 rounded"
                        style={{ accentColor: '#2C3E7C' }}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div
                        className="flex items-center gap-3 cursor-pointer hover:opacity-80"
                        onClick={() => setSelectedEmployeeId(employee.id)}
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0"
                          style={{ backgroundColor: '#2C3E7C' }}
                        >
                          {employee.avatar}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 hover:underline">
                            {employee.name}
                          </p>
                          <p className="text-xs text-gray-500">{employee.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">{employee.code}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{employee.department}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{employee.designation}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          employee.type === 'FULL TIME'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-gray-50 text-gray-700'
                        }`}
                      >
                        {employee.type}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">{employee.joined}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          employee.status === 'ACTIVE'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-orange-50 text-orange-700'
                        }`}
                      >
                        {employee.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5 w-16">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${completion}%`,
                              backgroundColor: completion >= 100 ? '#10b981' : '#F2994A',
                            }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600">{completion}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <button className="p-1 hover:bg-gray-100 rounded">
                        <MoreVertical size={16} className="text-gray-400" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showAddEmployeeModal && (
        <AddEmployeeModal onClose={() => setShowAddEmployeeModal(false)} />
      )}
    </div>
  );
}
