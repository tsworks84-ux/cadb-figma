import { useState } from 'react';
import { X, Search, UserPlus, AlertCircle } from 'lucide-react';

interface SelectTeamMembersModalProps {
  onClose: () => void;
  onAdd: (members: any[]) => void;
}

export default function SelectTeamMembersModal({ onClose, onAdd }: SelectTeamMembersModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);

  // Sample available employees
  const availableEmployees = [
    {
      id: 1,
      name: 'Rajesh Kumar',
      code: 'EMP001',
      designation: 'Senior Teacher',
      department: 'Physics',
      avatar: 'RK',
    },
    {
      id: 2,
      name: 'Anita Desai',
      code: 'EMP002',
      designation: 'Teacher',
      department: 'Chemistry',
      avatar: 'AD',
    },
    {
      id: 3,
      name: 'Vikram Singh',
      code: 'EMP003',
      designation: 'Teacher',
      department: 'Biology',
      avatar: 'VS',
    },
    {
      id: 4,
      name: 'Meera Reddy',
      code: 'EMP004',
      designation: 'Junior Teacher',
      department: 'English',
      avatar: 'MR',
    },
    {
      id: 5,
      name: 'Suresh Patel',
      code: 'EMP005',
      designation: 'Lab Assistant',
      department: 'Science Lab',
      avatar: 'SP',
    },
  ];

  const filteredEmployees = availableEmployees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const toggleSelection = (employee: any) => {
    if (selectedMembers.find((m) => m.id === employee.id)) {
      setSelectedMembers(selectedMembers.filter((m) => m.id !== employee.id));
    } else {
      setSelectedMembers([...selectedMembers, employee]);
    }
  };

  const handleSubmit = () => {
    onAdd(selectedMembers);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Add Team Members</h2>
            <p className="text-sm text-gray-600 mt-1">
              Select employees to add to this employee's team
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name, employee code, designation, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>

          {/* Selected Count */}
          {selectedMembers.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus size={16} className="text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  {selectedMembers.length} {selectedMembers.length === 1 ? 'member' : 'members'}{' '}
                  selected
                </span>
              </div>
              <button
                onClick={() => setSelectedMembers([])}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear All
              </button>
            </div>
          )}

          {/* Employee List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((employee) => {
                const isSelected = selectedMembers.find((m) => m.id === employee.id);
                return (
                  <div
                    key={employee.id}
                    onClick={() => toggleSelection(employee)}
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={!!isSelected}
                      onChange={() => {}}
                      className="w-4 h-4 rounded border-gray-300 focus:ring-2"
                      style={{ accentColor: '#2C3E7C' }}
                    />
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-semibold flex-shrink-0"
                      style={{ backgroundColor: '#2C3E7C' }}
                    >
                      {employee.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">
                        {employee.name}
                      </h4>
                      <p className="text-xs text-gray-600">
                        {employee.code} • {employee.designation}
                      </p>
                      <p className="text-xs text-gray-500">{employee.department}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-gray-500">No employees found matching your search.</p>
              </div>
            )}
          </div>

          {/* Info Note */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-2 mt-4">
            <AlertCircle className="text-orange-600 flex-shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-orange-900">
              These employees will be added to this employee's team and will report to them for task
              assignments and leave approvals.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedMembers.length === 0}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 ${
              selectedMembers.length === 0 ? 'bg-gray-300 cursor-not-allowed' : 'hover:opacity-90'
            }`}
            style={selectedMembers.length > 0 ? { backgroundColor: '#2C3E7C' } : {}}
          >
            <UserPlus size={16} />
            Add {selectedMembers.length > 0 ? selectedMembers.length : ''} Member
            {selectedMembers.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
