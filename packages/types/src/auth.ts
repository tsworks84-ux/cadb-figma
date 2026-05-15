export type SystemRole = "SUPER_ADMIN" | "HR_ADMIN" | "DEPT_HEAD" | "EMPLOYEE";
export type Role = SystemRole | string;

export interface JwtPayload {
  sub: string;
  employeeCode: string;
  role: Role;
  departmentId: string;
  /** All department IDs this employee belongs to (primary + EmployeeDepartment memberships). */
  memberDeptIds: string[];
  /** Subset of memberDeptIds where the employee is HoD (isHead = true). */
  managedDeptIds: string[];
  iat?: number;
  exp?: number;
}

export interface LoginRequest {
  employeeCode: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string;
    role: Role;
    photoUrl: string | null;
  };
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
}

// ─── Student Auth ─────────────────────────────────────────────────────────────

export interface StudentJwtPayload {
  sub: string;
  studentCode: string;
  userType: "STUDENT";
  iat?: number;
  exp?: number;
}

export interface StudentLoginResponse {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
  student: {
    id: string;
    studentCode: string;
    firstName: string;
    lastName: string;
    email: string;
    photoUrl: string | null;
    batchId: string | null;
  };
}
