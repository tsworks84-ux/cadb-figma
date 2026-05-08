export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface CreateEmployeeDto {
  firstName: string;
  lastName: string;
  middleName?: string;
  email: string;
  personalPhone: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  dateOfBirth: string;
  maritalStatus?: "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED";
  bloodGroup?: string;
  nationality?: string;
  currentAddress: Address;
  permanentAddress?: Address;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyRelation: string;
  departmentId: string;
  designationId: string;
  reportingToId?: string;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "VISITING" | "INTERN";
  joiningDate: string;
}

export interface UpdateEmployeeDto extends Partial<CreateEmployeeDto> {}

export interface EmployeeListItem {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  personalPhone: string | null;
  personalEmail: string | null;
  gender: string | null;
  status: string;
  employmentType: string;
  joiningDate: string;
  photoUrl: string | null;
  department: { id: string; name: string; code: string };
  designation: { id: string; title: string };
  profileComplete: boolean;
  profileScore: number;
  profileTotal: number;
  profileMissing: string[];
}

export interface CreateLeaveDto {
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason: string;
}

export interface CreateClaimDto {
  claimType: string;
  title: string;
  description?: string;
  claimedAmount: number;
}

export interface CreateQualificationDto {
  level: string;
  degreeName: string;
  specialization?: string;
  institution: string;
  boardUniversity: string;
  yearOfPassing: number;
  percentage?: number;
  cgpa?: number;
}

export interface CreateCertificationDto {
  name: string;
  issuingBody: string;
  credentialId?: string;
  issueDate: string;
  expiryDate?: string;
}
