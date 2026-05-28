import { useState } from 'react';
import { X, CheckCircle2, Circle, User, Briefcase, DollarSign, AlertCircle } from 'lucide-react';

interface AddEmployeeModalProps {
  onClose: () => void;
}

export default function AddEmployeeModal({ onClose }: AddEmployeeModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1: Identity & Contact
    firstName: '',
    middleName: '',
    lastName: '',
    gender: '',
    dateOfBirth: '',
    employeeCode: '',
    contactNumber: '',
    personalEmail: '',
    officialEmail: '',
    sendLoginInfo: true,
    activateAccount: true,

    // Step 2: Employment Details
    department: '',
    designation: '',
    employmentType: 'FULL TIME',
    reportingManager: '',
    joiningDate: '',
    accessLevel: 'employee',
    initialPassword: '',
    workLocation: '',

    // Step 3: Salary Setup
    annualCTC: '',
    basic: '',
    hra: '',
    otherAllowance: '',
    performanceBonus: false,
  });

  const steps = [
    { id: 1, name: 'Identity & Contact', icon: User },
    { id: 2, name: 'Employment Details', icon: Briefcase },
    { id: 3, name: 'Salary Setup', icon: DollarSign },
  ];

  const onboardingChecklist = [
    { id: 1, label: 'Add basic info and contact info', completed: currentStep > 1 },
    { id: 2, label: 'Login email is available', completed: false },
    { id: 3, label: 'Upload a profile photo', completed: false },
    { id: 4, label: 'Set a primary phone', completed: false },
    { id: 5, label: 'Select gender before sending email', completed: false },
    { id: 6, label: 'Add a date of birth', completed: false },
    { id: 7, label: 'Set a primary work address', completed: false },
  ];

  const handleNext = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = () => {
    // Submit logic here
    console.log('Employee data:', formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 md:p-4 overflow-y-auto">
      <div className="bg-white rounded-none md:rounded-xl w-full h-full md:h-auto md:max-h-[95vh] max-w-6xl flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 md:px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Add Employee</h2>
            <p className="text-sm text-gray-600 mt-1">
              Add a new employee to your team, send login details, and conduct a successful step-by-step
              onboarding.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="hidden md:block px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
              Save Draft
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 min-h-full">
            {/* Left: Form Steps (2/3 width) */}
            <div className="lg:col-span-2 p-4 md:p-6 border-r border-gray-200">
              {/* Step Indicators */}
              <div className="flex items-center justify-between mb-8">
                {steps.map((step, index) => {
                  const StepIcon = step.icon;
                  const isActive = currentStep === step.id;
                  const isCompleted = currentStep > step.id;

                  return (
                    <div key={step.id} className="flex items-center flex-1">
                      <div className="flex flex-col items-center flex-1">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                            isCompleted
                              ? 'bg-green-100'
                              : isActive
                              ? ''
                              : 'bg-gray-100'
                          }`}
                          style={isActive ? { backgroundColor: '#2C3E7C' } : {}}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="text-green-600" size={20} />
                          ) : (
                            <StepIcon
                              className={isActive ? 'text-white' : 'text-gray-500'}
                              size={20}
                            />
                          )}
                        </div>
                        <p
                          className={`text-xs md:text-sm font-medium text-center ${
                            isActive ? 'text-gray-900' : 'text-gray-500'
                          }`}
                        >
                          {step.name}
                        </p>
                      </div>
                      {index < steps.length - 1 && (
                        <div
                          className={`flex-1 h-0.5 mx-2 ${
                            isCompleted ? 'bg-green-500' : 'bg-gray-200'
                          }`}
                        ></div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Step Content */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div
                    className="flex items-center gap-3 p-4 rounded-lg"
                    style={{ backgroundColor: '#2C3E7C' }}
                  >
                    <CheckCircle2 className="text-white flex-shrink-0" size={24} />
                    <div className="text-white">
                      <h3 className="font-semibold">Identity & Contact</h3>
                      <p className="text-sm text-blue-100">
                        Basics of the new employee
                      </p>
                    </div>
                  </div>

                  {/* Legal Name */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Legal Name</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          First name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Priya"
                          value={formData.firstName}
                          onChange={(e) =>
                            setFormData({ ...formData, firstName: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Middle name
                        </label>
                        <input
                          type="text"
                          placeholder="Optional"
                          value={formData.middleName}
                          onChange={(e) =>
                            setFormData({ ...formData, middleName: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Last name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Sharma"
                          value={formData.lastName}
                          onChange={(e) =>
                            setFormData({ ...formData, lastName: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Personal Details */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Personal Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Gender <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.gender}
                          onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                        >
                          <option value="">Select gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date of birth
                        </label>
                        <input
                          type="date"
                          value={formData.dateOfBirth}
                          onChange={(e) =>
                            setFormData({ ...formData, dateOfBirth: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Employee code
                        </label>
                        <input
                          type="text"
                          placeholder="Auto-generated on create"
                          value={formData.employeeCode}
                          onChange={(e) =>
                            setFormData({ ...formData, employeeCode: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 bg-gray-50"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Used for employee profile
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Contact */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Contact</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Contact number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          placeholder="+91234567890"
                          value={formData.contactNumber}
                          onChange={(e) =>
                            setFormData({ ...formData, contactNumber: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Personal email
                        </label>
                        <input
                          type="email"
                          placeholder="pr***@*****.com"
                          value={formData.personalEmail}
                          onChange={(e) =>
                            setFormData({ ...formData, personalEmail: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Official email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          placeholder="pr***@centrum.edu"
                          value={formData.officialEmail}
                          onChange={(e) =>
                            setFormData({ ...formData, officialEmail: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          This email will get login credentials
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Account Setup */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Account Setup</h4>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.sendLoginInfo}
                          onChange={(e) =>
                            setFormData({ ...formData, sendLoginInfo: e.target.checked })
                          }
                          className="w-4 h-4 rounded"
                          style={{ accentColor: '#2C3E7C' }}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">Send login info by email</p>
                          <p className="text-xs text-gray-600">
                            Email notification once the profile is created
                          </p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.activateAccount}
                          onChange={(e) =>
                            setFormData({ ...formData, activateAccount: e.target.checked })
                          }
                          className="w-4 h-4 rounded"
                          style={{ accentColor: '#2C3E7C' }}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Activate employee account
                          </p>
                          <p className="text-xs text-gray-600">
                            This account can login only after activation
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <div
                    className="flex items-center gap-3 p-4 rounded-lg"
                    style={{ backgroundColor: '#2C3E7C' }}
                  >
                    <CheckCircle2 className="text-white flex-shrink-0" size={24} />
                    <div className="text-white">
                      <h3 className="font-semibold">Employment Details</h3>
                      <p className="text-sm text-blue-100">
                        Required for job assignment, reporting line, and access; No range-bound column headings in empty space.
                      </p>
                    </div>
                  </div>

                  {/* Job Assignment */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Job Assignment</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Department <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.department}
                          onChange={(e) =>
                            setFormData({ ...formData, department: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                        >
                          <option value="">Select department</option>
                          <option value="Mathematics">Mathematics</option>
                          <option value="Science">Science</option>
                          <option value="Humanities">Humanities</option>
                          <option value="Technology">Technology</option>
                          <option value="Administration">Administration</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Designation <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.designation}
                          onChange={(e) =>
                            setFormData({ ...formData, designation: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                        >
                          <option value="">Select designation</option>
                          <option value="Teacher">Teacher</option>
                          <option value="Senior Teacher">Senior Teacher</option>
                          <option value="Department Head">Department Head</option>
                          <option value="Administrator">Administrator</option>
                          <option value="Staff">Staff</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Employment type <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.employmentType}
                          onChange={(e) =>
                            setFormData({ ...formData, employmentType: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                        >
                          <option value="FULL TIME">Full Time</option>
                          <option value="PART TIME">Part Time</option>
                          <option value="CONTRACT">Contract</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Reporting & Joining */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">
                      Reporting & Joining
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Reporting manager
                        </label>
                        <input
                          type="text"
                          placeholder="Search by name or code..."
                          value={formData.reportingManager}
                          onChange={(e) =>
                            setFormData({ ...formData, reportingManager: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Search for name, employee code, or department
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Joining date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={formData.joiningDate}
                          onChange={(e) =>
                            setFormData({ ...formData, joiningDate: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Access Level */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Access Level</h4>
                    <select
                      value={formData.accessLevel}
                      onChange={(e) => setFormData({ ...formData, accessLevel: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                    >
                      <option value="employee">
                        Employee — Self-service dashboard, tasks, leaves, policies and training
                      </option>
                      <option value="manager">
                        Manager — Employee access + team management
                      </option>
                      <option value="admin">
                        Admin — Full system access
                      </option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Dashboard permissions</p>
                  </div>

                  {/* Login Setup */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Login Setup</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Initial password
                        </label>
                        <input
                          type="password"
                          placeholder="c***i3a7c0Dj7d71"
                          value={formData.initialPassword}
                          onChange={(e) =>
                            setFormData({ ...formData, initialPassword: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Leave blank to auto-generate. Employee will be asked to change this on first login.
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Work location
                        </label>
                        <select
                          value={formData.workLocation}
                          onChange={(e) =>
                            setFormData({ ...formData, workLocation: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                        >
                          <option value="">Select location</option>
                          <option value="Main Campus">Main Campus</option>
                          <option value="Science Block">Science Block</option>
                          <option value="Arts Building">Arts Building</option>
                          <option value="Sports Complex">Sports Complex</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6">
                  <div
                    className="flex items-center gap-3 p-4 rounded-lg"
                    style={{ backgroundColor: '#2C3E7C' }}
                  >
                    <CheckCircle2 className="text-white flex-shrink-0" size={24} />
                    <div className="text-white">
                      <h3 className="font-semibold">Salary Setup</h3>
                      <p className="text-sm text-blue-100">
                        Configure compensation structure
                      </p>
                    </div>
                  </div>

                  {/* Annual CTC */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Annual CTC (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      placeholder="500000"
                      value={formData.annualCTC}
                      onChange={(e) => setFormData({ ...formData, annualCTC: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                    />
                  </div>

                  {/* Salary Components */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Salary Components</h4>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Basic (%)
                          </label>
                          <input
                            type="number"
                            placeholder="40"
                            value={formData.basic}
                            onChange={(e) => setFormData({ ...formData, basic: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            HRA (%)
                          </label>
                          <input
                            type="number"
                            placeholder="30"
                            value={formData.hra}
                            onChange={(e) => setFormData({ ...formData, hra: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Other Allowance (%)
                        </label>
                        <input
                          type="number"
                          placeholder="30"
                          value={formData.otherAllowance}
                          onChange={(e) =>
                            setFormData({ ...formData, otherAllowance: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Performance Bonus */}
                  <div>
                    <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.performanceBonus}
                        onChange={(e) =>
                          setFormData({ ...formData, performanceBonus: e.target.checked })
                        }
                        className="w-4 h-4 rounded"
                        style={{ accentColor: '#2C3E7C' }}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          Include Performance Bonus
                        </p>
                        <p className="text-xs text-gray-600">
                          Variable pay based on annual performance review
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Info Box */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex gap-3">
                      <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                      <div>
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          Salary Information Privacy
                        </p>
                        <p className="text-sm text-gray-600">
                          Salary details are encrypted and only visible to HR administrators and the
                          employee. This information will not be shared with team managers or other staff
                          members.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Sidebar (1/3 width) */}
            <div className="bg-gray-50 p-4 md:p-6 space-y-6">
              {/* New Employee Card */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                    style={{ backgroundColor: '#2C3E7C' }}
                  >
                    {formData.firstName.charAt(0) || 'N'}
                    {formData.lastName.charAt(0) || 'E'}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {formData.firstName || 'New'} {formData.lastName || 'Employee'}
                    </h4>
                    <p className="text-sm text-gray-600">{formData.designation || 'Position'}</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {formData.department && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Department</span>
                      <span className="text-gray-900 font-medium">{formData.department}</span>
                    </div>
                  )}
                  {formData.joiningDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Joining Date</span>
                      <span className="text-gray-900 font-medium">{formData.joiningDate}</span>
                    </div>
                  )}
                  {formData.employmentType && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type</span>
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: '#2C3E7C15',
                          color: '#2C3E7C',
                        }}
                      >
                        {formData.employmentType}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Step Checklist */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h4 className="font-semibold text-gray-900 mb-4">Onboarding Checklist</h4>
                <div className="space-y-3">
                  {onboardingChecklist.map((item) => (
                    <div key={item.id} className="flex items-start gap-3">
                      {item.completed ? (
                        <CheckCircle2 className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
                      ) : (
                        <Circle className="text-gray-300 flex-shrink-0 mt-0.5" size={18} />
                      )}
                      <span
                        className={`text-sm ${
                          item.completed ? 'text-gray-900 line-through' : 'text-gray-600'
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Why This Works Better */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2 text-sm">Why This Works Better</h4>
                <p className="text-xs text-gray-600 leading-relaxed">
                  This structured onboarding process ensures all critical employee information is collected
                  systematically, reduces data entry errors, and helps the admin track the completion status.
                  New employees receive a professional welcome email with their login details.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Step {currentStep} of {steps.length} • {currentStep === 3 ? '4 required fields' : ''}
            </p>
            <div className="flex gap-3">
              {currentStep > 1 && (
                <button
                  onClick={handleBack}
                  className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-white"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleBack}
                className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-white"
              >
                {currentStep === 3 ? 'Create without Salary' : 'Cancel'}
              </button>
              {currentStep < 3 ? (
                <button
                  onClick={handleNext}
                  className="px-6 py-2 rounded-md text-sm font-medium text-white"
                  style={{ backgroundColor: '#2C3E7C' }}
                >
                  Next Step →
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2 rounded-md text-sm font-medium text-white"
                  style={{ backgroundColor: '#2C3E7C' }}
                >
                  Next: Salary Setup →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
