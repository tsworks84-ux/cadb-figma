import { useState } from 'react';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Edit,
  Lock,
  Download,
  User,
  FileText,
  Briefcase,
  DollarSign,
  CreditCard,
  Plane,
  Receipt,
  BookOpen,
  Shield,
  Users,
  AlertCircle,
  CheckCircle2,
  Ban,
  Upload,
  Plus,
  GraduationCap,
  Award,
  File,
  Trash2,
} from 'lucide-react';
import AddQualificationModal from './AddQualificationModal';
import AddCertificationModal from './AddCertificationModal';
import AddBonusPlanModal from './AddBonusPlanModal';
import SalarySlipModal from './SalarySlipModal';
import Leaves from './Leaves';
import Claims from './Claims';
import Policies from './Policies';
import MyTeamManager from './MyTeamManager';
import SelectTeamMembersModal from './SelectTeamMembersModal';
import EditBankDetailsModal from './EditBankDetailsModal';

interface EmployeeProfileProps {
  isOwnProfile?: boolean; // true if employee viewing their own profile
  onBack?: () => void;
}

export default function EmployeeProfile({ isOwnProfile = false, onBack }: EmployeeProfileProps) {
  const [activeTab, setActiveTab] = useState('personal');
  const [showAddQualification, setShowAddQualification] = useState(false);
  const [showAddCertification, setShowAddCertification] = useState(false);
  const [showAddBonusPlan, setShowAddBonusPlan] = useState(false);
  const [showSalarySlip, setShowSalarySlip] = useState(false);
  const [showSelectTeamMembers, setShowSelectTeamMembers] = useState(false);
  const [showEditBankDetails, setShowEditBankDetails] = useState(false);
  const [selectedPayoutMonth, setSelectedPayoutMonth] = useState<any>(null);
  const [qualifications, setQualifications] = useState<any[]>([]);
  const [certifications, setCertifications] = useState<any[]>([]);
  const [bonusPlans, setBonusPlans] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([
    {
      id: 1,
      name: 'Priya Sharma',
      code: '256881',
      designation: 'Faculty Member',
      department: 'Mathematics',
      avatar: 'PS',
      status: 'Present',
      tasksCompleted: 0,
      totalTasks: 0,
    },
  ]);
  const [bankDetails, setBankDetails] = useState({
    bankName: 'HDFC Bank',
    accountNumber: 'XXXX XXXX XXXX 1234',
    ifscCode: 'HDFC0001234',
    branch: 'Bangalore - MG Road',
    accountHolderName: 'Priya Sharma',
    accountType: 'Savings Account',
  });

  // Monthly Payout Data (Sample)
  const monthlyPayouts = [
    {
      month: 'April',
      year: '2026',
      paymentDate: '01 May 2026',
      basicSalary: 70000,
      hra: 70000,
      conveyance: 1600,
      medical: 1263,
      bonus: 15000,
      claims: 3500,
      totalEarnings: 161363,
      pfEmployee: 8400,
      professionalTax: 200,
      tds: 11080,
      lop: 0,
      otherDeductions: 0,
      totalDeductions: 19680,
      netPay: 141683,
      netPayInWords: 'One Lakh Forty-One Thousand Six Hundred Eighty-Three Rupees Only',
      workingDays: 22,
      totalDays: 22,
    },
    {
      month: 'March',
      year: '2026',
      paymentDate: '01 Apr 2026',
      basicSalary: 70000,
      hra: 70000,
      conveyance: 1600,
      medical: 1263,
      bonus: 0,
      claims: 1200,
      totalEarnings: 144063,
      pfEmployee: 8400,
      professionalTax: 200,
      tds: 11080,
      lop: 2500,
      otherDeductions: 0,
      totalDeductions: 22180,
      netPay: 121883,
      netPayInWords: 'One Lakh Twenty-One Thousand Eight Hundred Eighty-Three Rupees Only',
      workingDays: 20,
      totalDays: 22,
    },
    {
      month: 'February',
      year: '2026',
      paymentDate: '01 Mar 2026',
      basicSalary: 70000,
      hra: 70000,
      conveyance: 1600,
      medical: 1263,
      bonus: 0,
      claims: 0,
      totalEarnings: 142863,
      pfEmployee: 8400,
      professionalTax: 200,
      tds: 11080,
      lop: 0,
      otherDeductions: 0,
      totalDeductions: 19680,
      netPay: 123183,
      netPayInWords: 'One Lakh Twenty-Three Thousand One Hundred Eighty-Three Rupees Only',
      workingDays: 22,
      totalDays: 22,
    },
  ];

  // Sample employee data
  const employee = {
    name: 'Priya Sharma',
    code: '256881',
    email: 'priya@centrum.edu',
    phone: '+91 9897654367',
    avatar: 'PS',
    designation: 'Faculty Member',
    department: 'Mathematics',
    status: 'ACTIVE',
    joinDate: '01 May 2025',
    location: 'Bangalore',
    reportingTo: 'System Administrator',
    employmentType: 'PART TIME',

    // Personal Info
    firstName: 'Priya',
    middleName: '',
    lastName: 'Sharma',
    gender: 'Female',
    dateOfBirth: '01 Jan 1989',
    bloodGroup: 'Not on file — please update',
    maritalStatus: 'Single',
    nationality: 'Indian',
    religion: '',

    // Contact
    personalEmail: 'priya@centrum.edu',
    officialPhone: '',

    // Address
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    country: '',

    // Emergency Contact
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: '',

    // Employment
    confirmationDate: '',
    workLocation: 'Bangalore',

    // Documents
    profileCompletion: 14,
  };

  const tabs = [
    { id: 'personal', label: 'Personal', icon: User, badge: null },
    { id: 'documents', label: 'Documents', icon: FileText, badge: null },
    { id: 'job', label: 'Position', icon: Briefcase, badge: null },
    { id: 'salary', label: 'Salary', icon: DollarSign, badge: null, adminOnly: true },
    { id: 'leaves', label: 'Leaves', icon: Plane, badge: null },
    { id: 'claims', label: 'Claims', icon: Receipt, badge: null },
    { id: 'training', label: 'Training', icon: BookOpen, badge: null },
    { id: 'policies', label: 'Policies', icon: Shield, badge: null },
    { id: 'team', label: 'Team', icon: Users, badge: null },
  ];

  const visibleTabs = tabs.filter(tab => !tab.adminOnly || !isOwnProfile);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 text-gray-600"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Back to Employees</span>
          </button>
        )}
      </div>

      {/* Employee Card Header */}
      <div className="rounded-lg overflow-hidden" style={{ backgroundColor: '#2C3E7C' }}>
        {/* Profile Info on Blue Background */}
        <div className="px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className="w-24 h-24 rounded-lg flex items-center justify-center font-bold text-2xl border-4 border-white shadow-lg"
                style={{ backgroundColor: '#2C3E7C', color: 'white' }}
              >
                {employee.avatar}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-semibold text-white">{employee.name}</h1>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      employee.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {employee.status}
                  </span>
                </div>
                <p className="text-white/90 mb-2">
                  {employee.designation} • {employee.department}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-sm text-white/80">
                  <div className="flex items-center gap-1">
                    <Mail size={14} />
                    {employee.email}
                  </div>
                  <div className="flex items-center gap-1">
                    <Phone size={14} />
                    {employee.phone}
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin size={14} />
                    {employee.location}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {!isOwnProfile && (
                <button
                  className="px-4 py-2 border border-white/30 rounded-md text-sm font-medium text-white hover:bg-white/10 flex items-center gap-2"
                >
                  <Lock size={16} />
                  Reset Password
                </button>
              )}
              <button
                className="px-4 py-2 border border-white/30 rounded-md text-sm font-medium text-white hover:bg-white/10 flex items-center gap-2"
              >
                <Download size={16} />
                Export
              </button>
              <button
                className="px-4 py-2 rounded-md text-sm font-medium bg-white flex items-center gap-2"
                style={{ color: '#2C3E7C' }}
              >
                <Edit size={16} />
                Edit Profile
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Completion Alert */}
      {employee.profileCompletion < 100 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-orange-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              Your profile is {employee.profileCompletion}% complete
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Fill your DOB, blood group, address, or emergency contact info
            </p>
          </div>
          <button className="text-sm font-medium hover:underline" style={{ color: '#2C3E7C' }}>
            Update now →
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200 overflow-x-auto">
          <div className="flex px-4">
            {visibleTabs.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'font-medium text-gray-900'
                      : 'text-gray-600 hover:text-gray-900 border-transparent'
                  }`}
                  style={isActive ? { borderColor: '#2C3E7C', color: '#2C3E7C' } : {}}
                >
                  <TabIcon size={18} />
                  <span className="text-sm">{tab.label}</span>
                  {tab.badge && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-semibold rounded-full">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'personal' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">View your personal profile information.</p>
                <button
                  className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
                  style={{ backgroundColor: '#2C3E7C' }}
                >
                  <Edit size={16} />
                  Edit Profile
                </button>
              </div>

              {/* Personal Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      FIRST NAME
                    </label>
                    <p className="text-sm text-gray-900">{employee.firstName}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      MIDDLE NAME
                    </label>
                    <p className="text-sm text-gray-900">{employee.middleName || '—'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      LAST NAME
                    </label>
                    <p className="text-sm text-gray-900">{employee.lastName}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">GENDER</label>
                    <p className="text-sm text-gray-900">{employee.gender}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      DATE OF BIRTH
                    </label>
                    <p className="text-sm text-gray-900">{employee.dateOfBirth}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      MARITAL STATUS
                    </label>
                    <p className="text-sm text-gray-900">{employee.maritalStatus}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      NATIONALITY
                    </label>
                    <p className="text-sm text-gray-900">{employee.nationality}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      BLOOD GROUP
                    </label>
                    <p className="text-sm text-red-600">{employee.bloodGroup}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      RELIGION
                    </label>
                    <p className="text-sm text-gray-900">{employee.religion || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
                  Contact
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      LEARNING
                    </label>
                    <p className="text-sm text-gray-900">{employee.phone}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      OFFICIAL PHONE
                    </label>
                    <p className="text-sm text-gray-900">{employee.officialPhone || '—'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      OFFICIAL EMAIL
                    </label>
                    <p className="text-sm text-gray-900">{employee.email}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      PERSONAL EMAIL
                    </label>
                    <p className="text-sm text-gray-900">{employee.personalEmail}</p>
                  </div>
                </div>
              </div>

              {/* Current Address */}
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
                  Current Address
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">LINE 1</label>
                    <p className="text-sm text-gray-900">{employee.addressLine1 || '—'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">LINE 2</label>
                    <p className="text-sm text-gray-900">{employee.addressLine2 || '—'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">CITY</label>
                    <p className="text-sm text-gray-900">{employee.city || '—'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">STATE</label>
                    <p className="text-sm text-gray-900">{employee.state || '—'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">PINCODE</label>
                    <p className="text-sm text-gray-900">{employee.pincode || '—'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">COUNTRY</label>
                    <p className="text-sm text-gray-900">{employee.country || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
                  Emergency Contact
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">NAME</label>
                    <p className="text-sm text-gray-900">{employee.emergencyName || '—'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">PHONE</label>
                    <p className="text-sm text-gray-900">{employee.emergencyPhone || '—'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">RELATION</label>
                    <p className="text-sm text-gray-900">{employee.emergencyRelation || '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'job' && (
            <div className="space-y-6">
              {/* Employment */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                    Employment
                  </h3>
                  {!isOwnProfile && (
                    <button className="text-sm font-medium hover:underline" style={{ color: '#2C3E7C' }}>
                      <Edit size={14} className="inline mr-1" />
                      Edit
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      EMPLOYEE CODE
                    </label>
                    <p className="text-sm text-gray-900">{employee.code}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      ACCESS ROLE
                    </label>
                    <p className="text-sm text-gray-900">Employee</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">STATUS</label>
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                      <CheckCircle2 size={12} />
                      {employee.status}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      EMPLOYMENT TYPE
                    </label>
                    <p className="text-sm text-gray-900">{employee.employmentType}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      JOINING DATE
                    </label>
                    <p className="text-sm text-gray-900">{employee.joinDate}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      CONFIRMATION DATE
                    </label>
                    <p className="text-sm text-gray-900">{employee.confirmationDate || '—'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      DESIGNATION
                    </label>
                    <p className="text-sm text-gray-900">{employee.designation}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      DEPARTMENT
                    </label>
                    <p className="text-sm text-gray-900">{employee.department}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      REPORTING TO
                    </label>
                    <p className="text-sm text-gray-900">{employee.reportingTo}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      WORK LOCATION
                    </label>
                    <p className="text-sm text-gray-900">{employee.workLocation}</p>
                  </div>
                </div>
              </div>

              {/* Department Memberships */}
              <div className="pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                    Department Memberships
                  </h3>
                  {!isOwnProfile && (
                    <button
                      className="text-sm font-medium hover:underline"
                      style={{ color: '#2C3E7C' }}
                    >
                      + Add Department
                    </button>
                  )}
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: '#2C3E7C20' }}
                      >
                        <Briefcase style={{ color: '#2C3E7C' }} size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Mathematics</p>
                        <p className="text-xs text-gray-600">HOD</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium" style={{ color: '#2C3E7C' }}>
                        Primary
                      </span>
                      {!isOwnProfile && (
                        <button className="text-xs text-gray-600 hover:text-gray-900">Change</button>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3">No additional department memberships.</p>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-6">
              {/* Identity & KYC Documents */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Identity & KYC Documents
                </h3>
                <p className="text-xs text-gray-600 mb-4">
                  Upload official documents for identity verification and records. Accepted: JPG, PNG, PDF (max 5 MB each).
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Passport Photo */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Passport Photo</h4>
                    <label className="block cursor-pointer">
                      <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" />
                      <div className="flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        <Upload size={24} className="text-gray-400" />
                        <p className="text-xs font-medium text-gray-700">Click to upload</p>
                        <p className="text-xs text-gray-500">JPG/PNG · max 5 MB</p>
                      </div>
                    </label>
                  </div>

                  {/* PAN Card */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">PAN Card</h4>
                    <label className="block cursor-pointer">
                      <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" />
                      <div className="flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        <Upload size={24} className="text-gray-400" />
                        <p className="text-xs font-medium text-gray-700">Click to upload</p>
                        <p className="text-xs text-gray-500">JPG/PNG/PDF · max 5 MB</p>
                      </div>
                    </label>
                  </div>

                  {/* Aadhaar Card */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Aadhaar Card</h4>
                    <label className="block cursor-pointer">
                      <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" />
                      <div className="flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        <Upload size={24} className="text-gray-400" />
                        <p className="text-xs font-medium text-gray-700">Click to upload</p>
                        <p className="text-xs text-gray-500">JPG/PNG/PDF · max 5 MB</p>
                      </div>
                    </label>
                  </div>

                  {/* Address Proof */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Address Proof</h4>
                    <label className="block cursor-pointer">
                      <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" />
                      <div className="flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        <Upload size={24} className="text-gray-400" />
                        <p className="text-xs font-medium text-gray-700">Click to upload</p>
                        <p className="text-xs text-gray-500">JPG/PNG/PDF · max 5 MB</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Academic Qualifications */}
              <div className="pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <GraduationCap size={18} style={{ color: '#2C3E7C' }} />
                      Academic Qualifications
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowAddQualification(true)}
                    className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
                    style={{ backgroundColor: '#2C3E7C' }}
                  >
                    <Plus size={16} />
                    Add Qualification
                  </button>
                </div>

                {qualifications.length > 0 ? (
                  <div className="space-y-3">
                    {qualifications.map((qual, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="px-2 py-0.5 rounded text-xs font-semibold text-white"
                                style={{ backgroundColor: '#2C3E7C' }}
                              >
                                {qual.level}
                              </span>
                              <h4 className="text-sm font-semibold text-gray-900">
                                {qual.degree}
                                {qual.specialization && ` - ${qual.specialization}`}
                              </h4>
                            </div>
                            <p className="text-xs text-gray-600 mb-1">{qual.institution}</p>
                            {qual.university && (
                              <p className="text-xs text-gray-500">{qual.university}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                              <span>Year: {qual.yearOfPassing}</span>
                              {qual.percentage && <span>Score: {qual.percentage}</span>}
                            </div>
                            {qual.certificate && (
                              <div className="flex items-center gap-2 mt-2">
                                <File size={14} className="text-green-600" />
                                <span className="text-xs text-green-600 font-medium">
                                  Certificate uploaded
                                </span>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              setQualifications(qualifications.filter((_, i) => i !== idx))
                            }
                            className="p-1.5 hover:bg-gray-200 rounded text-gray-400 hover:text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <p className="text-sm text-gray-500">
                      No qualifications added yet. Click 'Add Qualification' to get started.
                    </p>
                  </div>
                )}
              </div>

              {/* Professional Certifications */}
              <div className="pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Award size={18} style={{ color: '#2C3E7C' }} />
                      Professional Certifications
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowAddCertification(true)}
                    className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
                    style={{ backgroundColor: '#2C3E7C' }}
                  >
                    <Plus size={16} />
                    Add Certification
                  </button>
                </div>

                {certifications.length > 0 ? (
                  <div className="space-y-3">
                    {certifications.map((cert, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-gray-900 mb-1">
                              {cert.name}
                            </h4>
                            <p className="text-xs text-gray-600 mb-1">{cert.issuingOrganization}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                              {cert.issueDate && (
                                <span>
                                  Issued: {new Date(cert.issueDate).toLocaleDateString('en-US', {
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </span>
                              )}
                              {cert.expiryDate && (
                                <span>
                                  Expires: {new Date(cert.expiryDate).toLocaleDateString('en-US', {
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </span>
                              )}
                            </div>
                            {cert.credentialId && (
                              <p className="text-xs text-gray-500 mt-1">
                                Credential ID: {cert.credentialId}
                              </p>
                            )}
                            {cert.certificate && (
                              <div className="flex items-center gap-2 mt-2">
                                <File size={14} className="text-green-600" />
                                <span className="text-xs text-green-600 font-medium">
                                  Certificate uploaded
                                </span>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              setCertifications(certifications.filter((_, i) => i !== idx))
                            }
                            className="p-1.5 hover:bg-gray-200 rounded text-gray-400 hover:text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <p className="text-sm text-gray-500">No certifications added yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'salary' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content - Left Side (2/3 width) */}
              <div className="lg:col-span-2 space-y-6">
                {/* Salary Structure */}
                <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Salary Structure</h3>
                    <p className="text-xs text-gray-500 mt-1">Effective from 01 May 2026</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">Annual CTC</p>
                    <p className="text-2xl font-bold" style={{ color: '#2C3E7C' }}>
                      ₹12,00,000
                    </p>
                    <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded mt-1">
                      FULL TIME
                    </span>
                  </div>
                </div>

                {/* Monthly Earnings */}
                <div className="bg-gray-50 rounded-lg p-5 mb-4">
                  <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
                    Monthly Earnings
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">Basic Salary (70%)</span>
                      <span className="font-medium text-gray-900">₹70,000</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">HRA (100% of Basic)</span>
                      <span className="font-medium text-gray-900">₹70,000</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">Conveyance Allowance</span>
                      <span className="font-medium text-gray-900">₹1,600</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">Medical Allowance</span>
                      <span className="font-medium text-gray-900">₹1,263</span>
                    </div>
                    <div className="pt-3 mt-3 border-t border-gray-300 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">
                        Gross Monthly Pay
                      </span>
                      <span className="text-base font-bold text-gray-900">₹1,00,000</span>
                    </div>
                  </div>
                </div>

                {/* Monthly Deductions */}
                <div className="bg-red-50 rounded-lg p-5 mb-4">
                  <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
                    Monthly Deductions
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">PF — Employee (12%)</span>
                      <span className="font-medium text-red-600">₹8,400</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">Professional Tax</span>
                      <span className="font-medium text-red-600">₹200</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">Income Tax / TDS</span>
                      <span className="font-medium text-red-600">₹11,080</span>
                    </div>
                    <div className="pt-3 mt-3 border-t border-red-300 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">
                        Total Deductions
                      </span>
                      <span className="text-base font-bold text-red-600">₹19,680</span>
                    </div>
                  </div>
                </div>

                {/* Net Take-Home */}
                <div className="bg-green-50 rounded-lg p-5 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">
                      Monthly Net Take-Home
                    </span>
                    <span className="text-2xl font-bold text-green-600">₹80,320</span>
                  </div>
                </div>

                {/* Employer Contributions */}
                <div className="bg-blue-50 rounded-lg p-5">
                  <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
                    Employer Contributions
                  </h4>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">PF — Employer (13%)</span>
                    <span className="font-medium text-gray-900">₹9,100</span>
                  </div>
                </div>
              </div>

              {/* Bonus Plans */}
              <div className="pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">Bonus Plans</h3>
                  {!isOwnProfile && (
                    <button
                      onClick={() => setShowAddBonusPlan(true)}
                      className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
                      style={{ backgroundColor: '#2C3E7C' }}
                    >
                      <Plus size={16} />
                      New Plan
                    </button>
                  )}
                </div>

                {bonusPlans.length > 0 ? (
                  <div className="space-y-3">
                    {bonusPlans.map((plan, idx) => (
                      <div
                        key={idx}
                        className="border border-gray-200 rounded-lg p-4 bg-gradient-to-r from-green-50 to-transparent"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-gray-900 mb-1">
                              {plan.name}
                            </h4>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                                {plan.type}
                              </span>
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                {plan.frequency}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 mb-1">
                              Amount: <span className="font-semibold text-gray-900">₹{parseInt(plan.amount).toLocaleString('en-IN')}</span>
                            </p>
                            <p className="text-xs text-gray-600">
                              Effective: {new Date(plan.effectiveDate).toLocaleDateString('en-US', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                            {plan.description && (
                              <p className="text-xs text-gray-500 mt-2">{plan.description}</p>
                            )}
                          </div>
                          {!isOwnProfile && (
                            <button
                              onClick={() => setBonusPlans(bonusPlans.filter((_, i) => i !== idx))}
                              className="p-1.5 hover:bg-gray-200 rounded text-gray-400 hover:text-red-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <p className="text-sm text-gray-500">
                      No bonus plans yet. Use "New Plan" to create one.
                    </p>
                  </div>
                )}
              </div>

              {/* Monthly Payout */}
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Monthly Payout</h3>

                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-200 rounded-lg">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Month
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Monthly Salary
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Bonus
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Claims
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Deductions
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Net Pay
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {monthlyPayouts.map((payout, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <div className="font-medium">
                              {payout.month} {payout.year}
                            </div>
                            <div className="text-xs text-gray-500">Paid: {payout.paymentDate}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            ₹{(payout.basicSalary + payout.hra + payout.conveyance + payout.medical).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {payout.bonus > 0 ? (
                              <span className="text-green-600 font-medium">
                                +₹{payout.bonus.toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {payout.claims > 0 ? (
                              <span className="text-blue-600 font-medium">
                                +₹{payout.claims.toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="text-red-600 font-medium">
                              -₹{payout.totalDeductions.toLocaleString('en-IN')}
                            </div>
                            {payout.lop > 0 && (
                              <div className="text-xs text-red-500">
                                (Incl. LOP: ₹{payout.lop.toLocaleString('en-IN')})
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="font-semibold text-gray-900">
                              ₹{payout.netPay.toLocaleString('en-IN')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <button
                              onClick={() => {
                                setSelectedPayoutMonth(payout);
                                setShowSalarySlip(true);
                              }}
                              className="px-3 py-1.5 rounded-md text-xs font-medium text-white flex items-center gap-1"
                              style={{ backgroundColor: '#2C3E7C' }}
                            >
                              <Download size={14} />
                              Slip
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-xs text-gray-600 mb-1">Total Paid (Last 3 Months)</p>
                    <p className="text-lg font-bold text-blue-700">
                      ₹{monthlyPayouts.reduce((sum, p) => sum + p.netPay, 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <p className="text-xs text-gray-600 mb-1">Total Bonus</p>
                    <p className="text-lg font-bold text-green-700">
                      ₹{monthlyPayouts.reduce((sum, p) => sum + p.bonus, 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <p className="text-xs text-gray-600 mb-1">Total Claims</p>
                    <p className="text-lg font-bold text-purple-700">
                      ₹{monthlyPayouts.reduce((sum, p) => sum + p.claims, 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <p className="text-xs text-gray-600 mb-1">Total Deductions</p>
                    <p className="text-lg font-bold text-red-700">
                      ₹{monthlyPayouts.reduce((sum, p) => sum + p.totalDeductions, 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>
              </div>

              {/* Right Sidebar - Bank Account Details (1/3 width) */}
              <div className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 p-5 sticky top-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide flex items-center gap-2">
                    <CreditCard size={18} style={{ color: '#2C3E7C' }} />
                    Bank Account Details
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        BANK NAME
                      </label>
                      <p className="text-sm text-gray-900">{bankDetails.bankName}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        ACCOUNT NUMBER
                      </label>
                      <p className="text-sm text-gray-900">{bankDetails.accountNumber}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        IFSC CODE
                      </label>
                      <p className="text-sm text-gray-900">{bankDetails.ifscCode}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        BRANCH
                      </label>
                      <p className="text-sm text-gray-900">{bankDetails.branch}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        ACCOUNT HOLDER NAME
                      </label>
                      <p className="text-sm text-gray-900">{bankDetails.accountHolderName}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        ACCOUNT TYPE
                      </label>
                      <p className="text-sm text-gray-900">{bankDetails.accountType}</p>
                    </div>
                  </div>

                  {!isOwnProfile && (
                    <button
                      onClick={() => setShowEditBankDetails(true)}
                      className="w-full mt-4 px-4 py-2 rounded-md text-sm font-medium text-white flex items-center justify-center gap-2"
                      style={{ backgroundColor: '#2C3E7C' }}
                    >
                      <Edit size={16} />
                      Edit Bank Details
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'leaves' && <Leaves />}

          {activeTab === 'claims' && <Claims />}

          {activeTab === 'policies' && <Policies isAdmin={false} />}

          {activeTab === 'team' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: '#2C3E7C' }}
                  >
                    <Users className="text-white" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">My Team</h2>
                    <p className="text-sm text-gray-600">
                      {teamMembers.length} {teamMembers.length === 1 ? 'member' : 'members'} •{' '}
                      {teamMembers.filter((m) => m.status === 'Present').length} present • {teamMembers.filter((m) => m.status === 'On Leave').length} on leave
                    </p>
                  </div>
                </div>
                {!isOwnProfile && (
                  <button
                    onClick={() => setShowSelectTeamMembers(true)}
                    className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
                    style={{ backgroundColor: '#2C3E7C' }}
                  >
                    <Plus size={16} />
                    Add Team Member
                  </button>
                )}
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                  <p className="text-4xl font-bold text-blue-700 mb-1">{teamMembers.length}</p>
                  <p className="text-sm text-gray-600">Total Members</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-5">
                  <p className="text-4xl font-bold text-green-700 mb-1">
                    {teamMembers.filter((m) => m.status === 'Present').length}
                  </p>
                  <p className="text-sm text-gray-600">Present Today</p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-5">
                  <p className="text-4xl font-bold text-orange-700 mb-1">
                    {teamMembers.filter((m) => m.status === 'On Leave').length}
                  </p>
                  <p className="text-sm text-gray-600">On Leave</p>
                </div>
              </div>

              {/* Team Members Table */}
              {teamMembers.length > 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Member
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Department / Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Task Progress
                        </th>
                        {!isOwnProfile && (
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {teamMembers.map((member) => (
                        <tr key={member.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                                style={{ backgroundColor: '#2C3E7C' }}
                              >
                                {member.avatar}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{member.name}</p>
                                <p className="text-xs text-gray-500">{member.code}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm text-gray-900">{member.department}</p>
                              <p className="text-xs text-gray-500">{member.designation}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                member.status === 'Present'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-orange-100 text-orange-700'
                              }`}
                            >
                              <div
                                className={`w-1.5 h-1.5 rounded-full ${
                                  member.status === 'Present' ? 'bg-green-600' : 'bg-orange-600'
                                }`}
                              ></div>
                              {member.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-900">
                              {member.tasksCompleted}/{member.totalTasks} done
                            </p>
                          </td>
                          {!isOwnProfile && (
                            <td className="px-6 py-4">
                              <button
                                onClick={() => setTeamMembers(teamMembers.filter((m) => m.id !== member.id))}
                                className="text-sm text-red-600 hover:text-red-700 font-medium"
                              >
                                Remove
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
                  <Users className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="text-base font-medium text-gray-900 mb-1">No team members yet</p>
                  <p className="text-sm text-gray-500 mb-4">
                    {!isOwnProfile
                      ? 'Add team members to start managing and assigning tasks.'
                      : 'Your team members will appear here.'}
                  </p>
                  {!isOwnProfile && (
                    <button
                      onClick={() => setShowSelectTeamMembers(true)}
                      className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2 mx-auto"
                      style={{ backgroundColor: '#2C3E7C' }}
                    >
                      <Plus size={16} />
                      Add Team Member
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'training' && (
            <div className="space-y-6">
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <BookOpen className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-base font-medium text-gray-900 mb-1">
                  Training & Development
                </p>
                <p className="text-sm text-gray-500">
                  Your assigned training programs and certifications will appear here.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Modals */}
      {showAddQualification && (
        <AddQualificationModal
          onClose={() => setShowAddQualification(false)}
          onAdd={(qual) => setQualifications([...qualifications, qual])}
        />
      )}

      {showAddCertification && (
        <AddCertificationModal
          onClose={() => setShowAddCertification(false)}
          onAdd={(cert) => setCertifications([...certifications, cert])}
        />
      )}

      {showAddBonusPlan && (
        <AddBonusPlanModal
          onClose={() => setShowAddBonusPlan(false)}
          onAdd={(plan) => setBonusPlans([...bonusPlans, plan])}
        />
      )}

      {showSalarySlip && selectedPayoutMonth && (
        <SalarySlipModal
          onClose={() => {
            setShowSalarySlip(false);
            setSelectedPayoutMonth(null);
          }}
          month={selectedPayoutMonth.month}
          year={selectedPayoutMonth.year}
          employeeName={employee.name}
          employeeCode={employee.code}
          designation={employee.designation}
          department={employee.department}
          employmentType={employee.employmentType}
          payoutData={selectedPayoutMonth}
        />
      )}

      {showSelectTeamMembers && (
        <SelectTeamMembersModal
          onClose={() => setShowSelectTeamMembers(false)}
          onAdd={(members) => {
            const newMembers = members.map((m) => ({
              ...m,
              status: 'Present',
              tasksCompleted: 0,
              totalTasks: 0,
            }));
            setTeamMembers([...teamMembers, ...newMembers]);
          }}
        />
      )}

      {showEditBankDetails && (
        <EditBankDetailsModal
          onClose={() => setShowEditBankDetails(false)}
          onSave={(details) => setBankDetails(details)}
          currentDetails={bankDetails}
        />
      )}
    </div>
  );
}
