export type ProjectType = "SIP" | "ASP";
export type ProjectStatus = "ACTIVE" | "ARCHIVED";

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  SIP: "School Integrated Program",
  ASP: "After School Program",
};

export interface Me {
  id: string;
  email: string;
  name: string;
  role: "OWNER" | "MANAGER";
  mustChangePassword: boolean;
}

export interface Grade { id: string; name: string; sortOrder: number; isActive: boolean }
export interface School { id: string; name: string; city: string | null; board: string | null; isActive: boolean }
export interface AcademicYear { id: string; name: string; isActive: boolean; isArchived: boolean }

export interface Board {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  usedBy: number;
}

export interface Partner {
  id: string;
  name: string;
  displayName: string;
  isInternal: boolean;
  logoUrl: string | null;
  brandColor: string | null;
  domain: string | null;
  emailFrom: string | null;
  isArchived: boolean;
  projectCount: number;
  userCount: number;
}

export interface ProjectListItem {
  id: string;
  partner: { id: string; name: string };
  type: ProjectType;
  internalName: string;
  displayName: string;
  startDate: string;
  startAcademicYear: string | null;
  status: ProjectStatus;
  gradeCount: number;
  schoolCount: number;
  batchCount: number;
  userCount: number;
}

export interface Structure {
  gradeIds: string[];
  schools: { schoolId: string; grades: { gradeId: string; boardId: string }[] }[];
}

export interface ProjectDetail {
  id: string;
  partner: { id: string; name: string; displayName: string; isInternal: boolean; isArchived: boolean };
  type: ProjectType;
  internalName: string;
  displayName: string;
  startDate: string;
  startAcademicYear: { id: string; name: string | null };
  status: ProjectStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  batchCount: number;
  userCount: number;
  grades: { id: string; name: string | null; sortOrder: number }[];
  schools: {
    schoolId: string;
    name: string | null;
    city: string | null;
    isActive: boolean;
    grades: { gradeId: string; gradeName: string | null; board: { id: string; code: string; name: string } }[];
  }[];
}

export interface BatchRow {
  id: string;
  name: string;
  academicYear: string;
  grade: string | null;
  schools: { id: string; name: string | null }[];
  studentCount: number;
  isActive: boolean;
  isArchived: boolean;
  project: { id: string; internalName: string; displayName: string; status: ProjectStatus } | null;
  schoolsOutsideProject: number;
}

export interface BatchPage {
  total: number;
  page: number;
  pageSize: number;
  academicYears: string[];
  rows: BatchRow[];
}

export interface QualityCheck {
  key: string;
  title: string;
  help: string;
  severity: "error" | "warning" | "info";
  count: number;
  sample: Record<string, unknown>[];
}

export interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  at: string;
  adminUser: { name: string; email: string };
}

export interface Paged<T> { total: number; page: number; pageSize: number; rows: T[] }
