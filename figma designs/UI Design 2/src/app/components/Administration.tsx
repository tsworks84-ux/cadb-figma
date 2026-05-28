import { useState } from 'react';
import {
  Building2,
  MapPin,
  FileText,
  Users,
  Award,
  Shield,
  Calendar,
  Pencil,
  Trash2,
  Plus,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';

export default function Administration() {
  const [activeTab, setActiveTab] = useState('departments');

  const tabs = [
    { id: 'departments', label: 'Departments' },
    { id: 'designations', label: 'Designations' },
    { id: 'leave-types', label: 'Leave Types' },
    { id: 'leave-policies', label: 'Leave Policies' },
    { id: 'work-locations', label: 'Work Locations' },
    { id: 'claim-types', label: 'Claim Types' },
    { id: 'custom-roles', label: 'Custom Roles' },
    { id: 'roles-permissions', label: 'Roles & Permissions' },
  ];

  const departments = [
    { name: 'Administration', code: 'ADMIN', employees: 1 },
    { name: 'Mathematics', code: 'MAT', employees: 1 },
  ];

  const designations = [
    { title: 'Faculty Member', grade: 'L5', employees: 1 },
    { title: 'Super Administrator', grade: 'L1', employees: 1 },
  ];

  const workLocations = ['Bangalore', 'Mumbai', 'Pune', 'Remote'];

  const leaveTypes = [
    { name: 'Casual Leave', code: 'CL', requiresCertificate: false, status: 'Active' },
    { name: 'Sick Leave', code: 'SL', requiresCertificate: true, status: 'Active' },
    { name: 'Earned Leave', code: 'EL', requiresCertificate: false, status: 'Active' },
    { name: 'Maternity Leave', code: 'ML', requiresCertificate: true, status: 'Active' },
    { name: 'Paternity Leave', code: 'PL', requiresCertificate: true, status: 'Active' },
    { name: 'Bereavement Leave', code: 'BL', requiresCertificate: false, status: 'Active' },
    { name: 'Compensatory Off', code: 'CO', requiresCertificate: false, status: 'Active' },
  ];

  const claimTypes = [
    { label: 'Accommodation', internalKey: 'ACCOMMODATION', status: 'Active' },
    { label: 'Food & Meals', internalKey: 'FOOD', status: 'Active' },
    { label: 'Medical', internalKey: 'MEDICAL', status: 'Active' },
    { label: 'Other', internalKey: 'OTHER', status: 'Active' },
    { label: 'Training', internalKey: 'TRAINING', status: 'Active' },
    { label: 'Travel', internalKey: 'TRAVEL', status: 'Active' },
  ];

  const roles = [
    {
      name: 'Super Admin',
      color: 'red',
      description: 'Full system access. Cannot be restricted.',
      locked: true,
    },
    {
      name: 'HR Admin',
      color: 'purple',
      description: 'Manages employees, leaves, claims, and policies.',
      locked: false,
    },
    {
      name: 'Department Head',
      color: 'blue',
      description: 'Approves leaves and claims for their department.',
      locked: false,
    },
    {
      name: 'Employee',
      color: 'green',
      description: 'Manages own leaves, claims and profile.',
      locked: false,
    },
  ];

  const modules = [
    {
      name: 'EMPLOYEES',
      items: [
        'Profile',
        'Documents',
        'Salary',
        'Bank Details',
        'Leaves',
        'Monthly Payout',
      ],
    },
    { name: 'Leaves', items: [] },
    { name: 'Claims', items: [] },
    { name: 'Policies', items: [] },
    { name: 'Training', items: [] },
  ];

  const permissions = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE'];

  const [expandedRole, setExpandedRole] = useState<string | null>('Super Admin');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Administration</h1>
        <p className="text-sm text-gray-600 mt-1">
          Manage departments, designations, leave policies, and role permissions.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
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
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200">
        {/* Departments Tab */}
        {activeTab === 'departments' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-gray-600">{departments.length} departments</p>
              <button
                className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
                style={{ backgroundColor: '#2C3E7C' }}
              >
                <Plus size={18} />
                Add Department
              </button>
            </div>
            <table className="w-full">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Employees
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {departments.map((dept, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm text-gray-900">{dept.name}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{dept.code}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{dept.employees}</td>
                    <td className="px-4 py-4 text-right">
                      <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400">
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Designations Tab */}
        {activeTab === 'designations' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-gray-600">{designations.length} designations</p>
              <button
                className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
                style={{ backgroundColor: '#2C3E7C' }}
              >
                <Plus size={18} />
                Add Designation
              </button>
            </div>
            <table className="w-full">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Grade
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Employees
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {designations.map((designation, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {designation.title}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {designation.grade}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {designation.employees}
                    </td>
                    <td className="px-4 py-4 text-right flex items-center justify-end gap-2">
                      <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400">
                        <Pencil size={16} />
                      </button>
                      <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Leave Types Tab */}
        {activeTab === 'leave-types' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-gray-600">{leaveTypes.length} leave types configured</p>
              <button
                className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
                style={{ backgroundColor: '#2C3E7C' }}
              >
                <Plus size={18} />
                Add Leave Type
              </button>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Note:</span> Leave types configured here will appear in
                the leave application dropdown for all employees. Leave entitlements are set separately
                in Leave Policies.
              </p>
            </div>
            <table className="w-full">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Leave Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Requires Certificate
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leaveTypes.map((leave, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">
                      {leave.name}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">{leave.code}</td>
                    <td className="px-4 py-4">
                      {leave.requiresCertificate ? (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-orange-50 text-orange-700">
                          Yes
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-50 text-gray-700">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700">
                        {leave.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right flex items-center justify-end gap-2">
                      <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400">
                        <Pencil size={16} />
                      </button>
                      <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Leave Policies Tab */}
        {activeTab === 'leave-policies' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-gray-600">
                0 policies — define leave entitlements per grade and apply to employees.
              </p>
              <button
                className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
                style={{ backgroundColor: '#2C3E7C' }}
              >
                <Plus size={18} />
                New Policy
              </button>
            </div>
            <div className="py-20 text-center">
              <Calendar className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-base font-medium text-gray-900 mb-1">
                No leave policies yet
              </p>
              <p className="text-sm text-gray-500">
                Create a policy to define leave entitlements for each grade.
              </p>
            </div>
          </div>
        )}

        {/* Work Locations Tab */}
        {activeTab === 'work-locations' && (
          <div className="p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-medium text-gray-900">Work Locations</h3>
                <button
                  className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
                  style={{ backgroundColor: '#2C3E7C' }}
                >
                  <Plus size={18} />
                  Add Location
                </button>
              </div>
              <p className="text-sm text-gray-500">
                Locations available in the employee creation form.
              </p>
            </div>
            <div className="space-y-3">
              {workLocations.map((location, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <span className="text-sm text-gray-900">{location}</span>
                  <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Claim Types Tab */}
        {activeTab === 'claim-types' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-gray-600">{claimTypes.length} claim types</p>
              <button
                className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
                style={{ backgroundColor: '#2C3E7C' }}
              >
                <Plus size={18} />
                Add Claim Type
              </button>
            </div>

            {/* Receipt Requirement Setting */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    Receipt Requirement Threshold
                  </p>
                  <p className="text-xs text-gray-600">
                    Supporting documents will be mandatory for claims above this amount
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">₹</span>
                  <input
                    type="number"
                    defaultValue="250"
                    className="w-24 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2"
                    style={{ focusRing: '#2C3E7C' }}
                  />
                </div>
              </div>
            </div>
            <table className="w-full">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Label
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Internal Key
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {claimTypes.map((claim, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm text-gray-900">{claim.label}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {claim.internalKey}
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700">
                        {claim.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right flex items-center justify-end gap-2">
                      <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400">
                        <Pencil size={16} />
                      </button>
                      <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Custom Roles Tab */}
        {activeTab === 'custom-roles' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-gray-600">0 custom roles</p>
              <button
                className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
                style={{ backgroundColor: '#2C3E7C' }}
              >
                <Plus size={18} />
                New Role
              </button>
            </div>
            <div className="py-20 text-center">
              <Users className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-base font-medium text-gray-900 mb-1">
                No custom roles yet
              </p>
              <p className="text-sm text-gray-500">
                Create a role to define cross-department access for specific positions.
              </p>
            </div>
            <div className="mt-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-orange-900">
                After creating a role, go to{' '}
                <button
                  className="font-medium underline"
                  onClick={() => setActiveTab('roles-permissions')}
                >
                  Roles & Permissions
                </button>{' '}
                to configure what this role can view, edit, approve, etc. Department access here only controls which employees they can see — module permissions are set separately.
              </p>
            </div>
          </div>
        )}

        {/* Roles & Permissions Tab */}
        {activeTab === 'roles-permissions' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-gray-600">
                Configure what each role can do across modules.
              </p>
              <button className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <RotateCcw size={18} />
                Reset to Defaults
              </button>
            </div>

            <div className="space-y-4">
              {roles.map((role) => {
                const isExpanded = expandedRole === role.name;
                const colorClasses = {
                  red: 'bg-red-100 text-red-800',
                  purple: 'bg-purple-100 text-purple-800',
                  blue: 'bg-blue-100 text-blue-800',
                  green: 'bg-green-100 text-green-800',
                };

                return (
                  <div
                    key={role.name}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setExpandedRole(isExpanded ? null : role.name)
                      }
                      className="w-full flex items-center justify-between px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2.5 py-1 rounded text-xs font-medium ${
                            colorClasses[role.color as keyof typeof colorClasses]
                          }`}
                        >
                          {role.name}
                        </span>
                        <span className="text-sm text-gray-600">
                          {role.description}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {role.locked && (
                          <span className="text-xs text-gray-500">Locked</span>
                        )}
                        <ChevronDown
                          size={20}
                          className={`text-gray-400 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-6 bg-white overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                Module
                              </th>
                              {permissions.map((perm) => (
                                <th
                                  key={perm}
                                  className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider"
                                >
                                  {perm}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {modules.map((module) => (
                              <>
                                <tr key={module.name} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                    {module.name}
                                  </td>
                                  {permissions.map((perm) => (
                                    <td key={perm} className="px-4 py-3 text-center">
                                      <input
                                        type="checkbox"
                                        defaultChecked={role.name === 'Super Admin'}
                                        disabled={role.locked}
                                        className="w-4 h-4 rounded"
                                        style={{ accentColor: '#2C3E7C' }}
                                      />
                                    </td>
                                  ))}
                                </tr>
                                {module.items.map((item) => (
                                  <tr
                                    key={`${module.name}-${item}`}
                                    className="hover:bg-gray-50"
                                  >
                                    <td className="px-4 py-2 text-sm text-gray-600 pl-8">
                                      {item}
                                    </td>
                                    {permissions.map((perm) => (
                                      <td key={perm} className="px-4 py-2 text-center">
                                        <input
                                          type="checkbox"
                                          defaultChecked={role.name === 'Super Admin'}
                                          disabled={role.locked}
                                          className="w-4 h-4 rounded"
                                          style={{ accentColor: '#2C3E7C' }}
                                        />
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
