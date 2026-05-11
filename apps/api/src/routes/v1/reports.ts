import type { FastifyInstance } from "fastify";
import { prisma } from "@cadb/db";
import { authenticate, requireRole } from "../../middleware/authenticate.js";
import ExcelJS from "exceljs";

const ADMIN_ROLES = ["SUPER_ADMIN", "HR_ADMIN"] as const;

// All selectable fields for the employee directory report
export const EMPLOYEE_FIELD_KEYS = [
  "employeeCode", "firstName", "lastName", "fullName", "email", "personalEmail",
  "gender", "dateOfBirth", "maritalStatus", "bloodGroup", "nationality", "religion",
  "personalPhone", "officialPhone",
  "department", "designation", "grade",
  "employmentType", "status", "joiningDate", "confirmationDate",
  "reportingTo",
  "currentAddress", "permanentAddress",
  "emergencyContactName", "emergencyContactPhone", "emergencyRelation",
] as const;

export type EmployeeFieldKey = typeof EMPLOYEE_FIELD_KEYS[number];

const FIELD_LABELS: Record<EmployeeFieldKey, string> = {
  employeeCode:        "Employee Code",
  firstName:           "First Name",
  lastName:            "Last Name",
  fullName:            "Full Name",
  email:               "Official Email",
  personalEmail:       "Personal Email",
  gender:              "Gender",
  dateOfBirth:         "Date of Birth",
  maritalStatus:       "Marital Status",
  bloodGroup:          "Blood Group",
  nationality:         "Nationality",
  religion:            "Religion",
  personalPhone:       "Personal Phone",
  officialPhone:       "Official Phone",
  department:          "Department",
  designation:         "Designation",
  grade:               "Grade",
  employmentType:      "Employment Type",
  status:              "Status",
  joiningDate:         "Joining Date",
  confirmationDate:    "Confirmation Date",
  reportingTo:         "Reporting To",
  currentAddress:      "Current Address",
  permanentAddress:    "Permanent Address",
  emergencyContactName:  "Emergency Contact Name",
  emergencyContactPhone: "Emergency Contact Phone",
  emergencyRelation:     "Emergency Relation",
};

const BLOOD_GROUP_LABELS: Record<string, string> = {
  A_POS: "A+", A_NEG: "A-", B_POS: "B+", B_NEG: "B-",
  AB_POS: "AB+", AB_NEG: "AB-", O_POS: "O+", O_NEG: "O-",
};

function fmtDate(d: Date | null | undefined) {
  if (!d) return "";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtAddress(addr: unknown): string {
  if (!addr || typeof addr !== "object") return "";
  const a = addr as Record<string, string>;
  return [a.line1, a.line2, a.city, a.state, a.pincode, a.country].filter(Boolean).join(", ");
}

function fmtEnum(val: string | null | undefined) {
  if (!val) return "";
  return val.replace(/_/g, " ");
}

function getCellValue(emp: ReturnType<typeof mapEmployee>, key: EmployeeFieldKey): string | number | Date {
  switch (key) {
    case "employeeCode":        return emp.employeeCode ?? "";
    case "firstName":           return emp.firstName ?? "";
    case "lastName":            return emp.lastName ?? "";
    case "fullName":            return `${emp.firstName ?? ""} ${emp.middleName ?? ""} ${emp.lastName ?? ""}`.trim();
    case "email":               return emp.email ?? "";
    case "personalEmail":       return emp.personalEmail ?? "";
    case "gender":              return fmtEnum(emp.gender);
    case "dateOfBirth":         return emp.dateOfBirth ? fmtDate(emp.dateOfBirth) : "";
    case "maritalStatus":       return fmtEnum(emp.maritalStatus);
    case "bloodGroup":          return emp.bloodGroup ? (BLOOD_GROUP_LABELS[emp.bloodGroup] ?? emp.bloodGroup) : "";
    case "nationality":         return emp.nationality ?? "";
    case "religion":            return emp.religion ?? "";
    case "personalPhone":       return emp.personalPhone ?? "";
    case "officialPhone":       return emp.officialPhone ?? "";
    case "department":          return emp.department?.name ?? "";
    case "designation":         return emp.designation?.title ?? "";
    case "grade":               return emp.designation?.grade ?? "";
    case "employmentType":      return fmtEnum(emp.employmentType);
    case "status":              return fmtEnum(emp.status);
    case "joiningDate":         return emp.joiningDate ? fmtDate(emp.joiningDate) : "";
    case "confirmationDate":    return emp.confirmationDate ? fmtDate(emp.confirmationDate) : "";
    case "reportingTo":         return emp.reportingTo ? `${emp.reportingTo.firstName} ${emp.reportingTo.lastName}` : "";
    case "currentAddress":      return fmtAddress(emp.currentAddress);
    case "permanentAddress":    return fmtAddress(emp.permanentAddress);
    case "emergencyContactName":  return emp.emergencyContactName ?? "";
    case "emergencyContactPhone": return emp.emergencyContactPhone ?? "";
    case "emergencyRelation":     return emp.emergencyRelation ?? "";
    default:                    return "";
  }
}

type MappedEmployee = Awaited<ReturnType<typeof fetchEmployees>>[number];
function mapEmployee(emp: MappedEmployee) { return emp; }

async function fetchEmployees() {
  return prisma.employee.findMany({
    where: { deletedAt: null },
    orderBy: [{ department: { name: "asc" } }, { firstName: "asc" }],
    select: {
      employeeCode: true,
      firstName: true,
      lastName: true,
      middleName: true,
      email: true,
      personalEmail: true,
      gender: true,
      dateOfBirth: true,
      maritalStatus: true,
      bloodGroup: true,
      nationality: true,
      religion: true,
      personalPhone: true,
      officialPhone: true,
      employmentType: true,
      status: true,
      joiningDate: true,
      confirmationDate: true,
      currentAddress: true,
      permanentAddress: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      emergencyRelation: true,
      department:   { select: { name: true } },
      designation:  { select: { title: true, grade: true } },
      reportingTo:  { select: { firstName: true, lastName: true } },
    },
  });
}

export async function reportRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── GET /reports/employee-directory/fields ──────────────────────────────────
  // Returns the full list of available field keys + labels for the UI picker
  fastify.get("/employee-directory/fields", { preHandler: requireRole(...ADMIN_ROLES) }, async (_req, reply) => {
    const groups = [
      {
        group: "Identity",
        fields: [
          "employeeCode", "firstName", "lastName", "fullName",
          "email", "personalEmail", "personalPhone", "officialPhone",
        ],
      },
      {
        group: "Personal",
        fields: [
          "gender", "dateOfBirth", "maritalStatus", "bloodGroup",
          "nationality", "religion",
        ],
      },
      {
        group: "Employment",
        fields: [
          "department", "designation", "grade", "employmentType",
          "status", "joiningDate", "confirmationDate", "reportingTo",
        ],
      },
      {
        group: "Address",
        fields: ["currentAddress", "permanentAddress"],
      },
      {
        group: "Emergency Contact",
        fields: ["emergencyContactName", "emergencyContactPhone", "emergencyRelation"],
      },
    ] as const;

    return reply.send({
      success: true,
      data: groups.map((g) => ({
        group: g.group,
        fields: g.fields.map((key) => ({ key, label: FIELD_LABELS[key as EmployeeFieldKey] })),
      })),
    });
  });

  // ── GET /reports/employee-directory/export ──────────────────────────────────
  // Query params: fields=employeeCode,firstName,... (comma-separated)
  fastify.get("/employee-directory/export", { preHandler: requireRole(...ADMIN_ROLES) }, async (request, reply) => {
    const query = request.query as { fields?: string };
    const requestedFields = query.fields
      ? (query.fields.split(",").filter((f) => EMPLOYEE_FIELD_KEYS.includes(f as EmployeeFieldKey)) as EmployeeFieldKey[])
      : ([...EMPLOYEE_FIELD_KEYS] as EmployeeFieldKey[]);

    if (requestedFields.length === 0) {
      return reply.status(400).send({ success: false, error: "At least one field is required", statusCode: 400 });
    }

    const employees = await fetchEmployees();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CADB";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Employee Directory", {
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
    });

    // Header row
    sheet.columns = requestedFields.map((key) => ({
      header: FIELD_LABELS[key],
      key,
      width: ["currentAddress", "permanentAddress", "fullName"].includes(key) ? 40 : 22,
    }));

    // Style header
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFCCD6E0" } },
        right:  { style: "thin", color: { argb: "FFCCD6E0" } },
      };
    });
    headerRow.height = 30;

    // Data rows
    employees.forEach((emp, idx) => {
      const row = sheet.addRow(
        requestedFields.reduce<Record<string, string | number | Date>>((acc, key) => {
          acc[key] = getCellValue(emp, key);
          return acc;
        }, {})
      );

      row.eachCell((cell) => {
        cell.alignment = { vertical: "middle", wrapText: false };
        if (idx % 2 === 0) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F8FB" } };
        }
        cell.border = {
          bottom: { style: "hair", color: { argb: "FFE2EAF0" } },
          right:  { style: "hair", color: { argb: "FFE2EAF0" } },
        };
      });
    });

    // Freeze header row
    sheet.views = [{ state: "frozen", ySplit: 1, activeCell: "A2" }];

    // Auto-filter
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to:   { row: 1, column: requestedFields.length },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `employee_directory_${new Date().toISOString().slice(0, 10)}.xlsx`;

    reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename="${fileName}"`)
      .send(Buffer.from(buffer));
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SALARY STRUCTURES REPORT
  // ════════════════════════════════════════════════════════════════════════════

  const EARNINGS: string[] = [
    "BASIC", "HRA", "CONVEYANCE", "MEDICAL", "SPECIAL_ALLOWANCE",
    "PF_EMPLOYER", "ESI_EMPLOYER", "GRATUITY", "BONUS", "INCENTIVE",
  ];
  const DEDUCTIONS: string[] = [
    "TDS", "PF_EMPLOYEE", "ESI_EMPLOYEE", "PROFESSIONAL_TAX", "ADVANCE_DEDUCTION",
  ];
  const COMPONENT_LABELS: Record<string, string> = {
    BASIC:               "Basic",
    HRA:                 "HRA",
    CONVEYANCE:          "Conveyance",
    MEDICAL:             "Medical",
    SPECIAL_ALLOWANCE:   "Special Allowance",
    PF_EMPLOYER:         "PF (Employer)",
    ESI_EMPLOYER:        "ESI (Employer)",
    GRATUITY:            "Gratuity",
    BONUS:               "Bonus",
    INCENTIVE:           "Incentive",
    TDS:                 "TDS",
    PF_EMPLOYEE:         "PF (Employee)",
    ESI_EMPLOYEE:        "ESI (Employee)",
    PROFESSIONAL_TAX:    "Prof. Tax",
    ADVANCE_DEDUCTION:   "Advance Deduction",
  };

  async function fetchSalaryData() {
    const employees = await prisma.employee.findMany({
      where: { deletedAt: null },
      orderBy: [{ department: { name: "asc" } }, { firstName: "asc" }],
      select: {
        employeeCode: true,
        firstName: true,
        lastName: true,
        employmentType: true,
        status: true,
        department:  { select: { name: true } },
        designation: { select: { title: true } },
        salaryStructure: {
          select: {
            ctc: true,
            effectiveFrom: true,
            effectiveTo: true,
            items: { select: { component: true, amount: true, isPercentage: true } },
          },
        },
      },
    });
    return employees;
  }

  // ── GET /reports/salary-structures/data  (JSON for client-side PDF) ─────────
  fastify.get(
    "/salary-structures/data",
    { preHandler: requireRole(...ADMIN_ROLES) },
    async (_req, reply) => {
      const employees = await fetchSalaryData();
      const rows = employees.map((emp) => {
        const items = emp.salaryStructure?.items ?? [];
        const byComp: Record<string, number> = {};
        for (const item of items) byComp[item.component] = item.amount;

        const grossEarnings = EARNINGS.reduce((s, c) => s + (byComp[c] ?? 0), 0);
        const totalDeductions = DEDUCTIONS.reduce((s, c) => s + (byComp[c] ?? 0), 0);

        return {
          employeeCode:   emp.employeeCode,
          name:           `${emp.firstName} ${emp.lastName}`,
          department:     emp.department.name,
          designation:    emp.designation.title,
          employmentType: emp.employmentType.replace(/_/g, " "),
          status:         emp.status.replace(/_/g, " "),
          ctcAnnual:      emp.salaryStructure?.ctc ?? null,
          ctcMonthly:     emp.salaryStructure ? emp.salaryStructure.ctc / 12 : null,
          effectiveFrom:  emp.salaryStructure?.effectiveFrom?.toISOString().slice(0, 10) ?? null,
          effectiveTo:    emp.salaryStructure?.effectiveTo?.toISOString().slice(0, 10) ?? null,
          components:     byComp,
          grossEarnings,
          totalDeductions,
          netSalary:      grossEarnings - totalDeductions,
          hasStructure:   !!emp.salaryStructure,
        };
      });

      return reply.send({
        success: true,
        data: { rows, earnings: EARNINGS, deductions: DEDUCTIONS, labels: COMPONENT_LABELS },
      });
    }
  );

  // ── GET /reports/salary-structures/export  (Excel download) ─────────────────
  fastify.get(
    "/salary-structures/export",
    { preHandler: requireRole(...ADMIN_ROLES) },
    async (_req, reply) => {
      const employees = await fetchSalaryData();

      const wb = new ExcelJS.Workbook();
      wb.creator = "CADB";
      wb.created = new Date();

      const ws = wb.addWorksheet("Salary Structures", {
        pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
      });

      // ── Build column list ──────────────────────────────────────────────────
      const INFO_COLS = [
        { key: "employeeCode", header: "Emp Code",       width: 14 },
        { key: "name",         header: "Employee Name",  width: 26 },
        { key: "department",   header: "Department",     width: 20 },
        { key: "designation",  header: "Designation",    width: 22 },
        { key: "empType",      header: "Type",           width: 14 },
        { key: "ctcMonthly",   header: "CTC / Month",    width: 14 },
        { key: "ctcAnnual",    header: "CTC / Year",     width: 14 },
      ];
      const EARN_COLS = EARNINGS.map((c) => ({ key: c, header: COMPONENT_LABELS[c], width: 16 }));
      const GROSS_COL = { key: "grossEarnings",    header: "Gross Earnings",     width: 16 };
      const DED_COLS  = DEDUCTIONS.map((c) => ({ key: c, header: COMPONENT_LABELS[c], width: 16 }));
      const TOT_DED   = { key: "totalDeductions",  header: "Total Deductions",   width: 16 };
      const NET_COL   = { key: "netSalary",        header: "Net Salary",         width: 16 };
      const EFF_COL   = { key: "effectiveFrom",    header: "Effective From",     width: 14 };

      const allCols = [
        ...INFO_COLS, ...EARN_COLS, GROSS_COL, ...DED_COLS, TOT_DED, NET_COL, EFF_COL,
      ];
      ws.columns = allCols.map((c) => ({ key: c.key, width: c.width }));

      // ── Row 1: group labels (merged cells) ────────────────────────────────
      const C = {
        infoStart:  1,
        infoEnd:    INFO_COLS.length,
        earnStart:  INFO_COLS.length + 1,
        earnEnd:    INFO_COLS.length + EARN_COLS.length + 1, // +1 for gross
        dedStart:   INFO_COLS.length + EARN_COLS.length + 2,
        dedEnd:     INFO_COLS.length + EARN_COLS.length + 1 + DEDUCTIONS.length + 1, // +1 for total
        summaryStart: INFO_COLS.length + EARN_COLS.length + DEDUCTIONS.length + 4,
        summaryEnd:   allCols.length,
      };

      const groupRow = ws.getRow(1);
      groupRow.height = 22;

      function mergeGroup(startCol: number, endCol: number, label: string, argb: string) {
        ws.mergeCells(1, startCol, 1, endCol);
        const cell = ws.getCell(1, startCol);
        cell.value = label;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }

      mergeGroup(C.infoStart,    C.infoEnd,    "Employee Info",  "FF1E3A5F");
      mergeGroup(C.earnStart,    C.earnEnd,    "Earnings",       "FF166534");
      mergeGroup(C.dedStart,     C.dedEnd,     "Deductions",     "FF7F1D1D");
      mergeGroup(C.summaryStart, C.summaryEnd, "Summary",        "FF374151");

      // ── Row 2: column headers ─────────────────────────────────────────────
      const headerRow = ws.getRow(2);
      headerRow.height = 28;
      allCols.forEach((col, i) => {
        const cell = ws.getCell(2, i + 1);
        cell.value = col.header;
        cell.font  = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

        const isEarning   = EARNINGS.includes(col.key) || col.key === "grossEarnings";
        const isDeduction = DEDUCTIONS.includes(col.key) || col.key === "totalDeductions";
        const isNet       = col.key === "netSalary" || col.key === "effectiveFrom";
        const argb = isEarning ? "FF14532D"
          : isDeduction ? "FF6B0101"
          : isNet ? "FF111827"
          : "FF162032";

        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
        cell.border = {
          bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
          right:  { style: "thin", color: { argb: "FF4B5563" } },
        };
      });

      // ── Data rows ─────────────────────────────────────────────────────────
      employees.forEach((emp, idx) => {
        const items = emp.salaryStructure?.items ?? [];
        const byComp: Record<string, number> = {};
        for (const item of items) byComp[item.component] = item.amount;

        const grossEarnings   = EARNINGS.reduce((s, c) => s + (byComp[c] ?? 0), 0);
        const totalDeductions = DEDUCTIONS.reduce((s, c) => s + (byComp[c] ?? 0), 0);
        const netSalary       = grossEarnings - totalDeductions;

        const rowData: Record<string, string | number> = {
          employeeCode: emp.employeeCode,
          name:         `${emp.firstName} ${emp.lastName}`,
          department:   emp.department.name,
          designation:  emp.designation.title,
          empType:      emp.employmentType.replace(/_/g, " "),
          ctcMonthly:   emp.salaryStructure ? Math.round(emp.salaryStructure.ctc / 12) : 0,
          ctcAnnual:    emp.salaryStructure?.ctc ?? 0,
          grossEarnings,
          totalDeductions,
          netSalary,
          effectiveFrom: emp.salaryStructure?.effectiveFrom
            ? emp.salaryStructure.effectiveFrom.toLocaleDateString("en-IN")
            : "—",
        };
        for (const c of [...EARNINGS, ...DEDUCTIONS]) rowData[c] = byComp[c] ?? 0;

        const row = ws.getRow(idx + 3);
        allCols.forEach((col, ci) => {
          const cell = ws.getCell(idx + 3, ci + 1);
          cell.value = rowData[col.key] ?? "";
          cell.alignment = { vertical: "middle" };

          const isNum = typeof rowData[col.key] === "number";
          if (isNum) {
            cell.numFmt = "₹#,##0";
            cell.alignment = { ...cell.alignment, horizontal: "right" };
          }

          // Zebra
          const base = idx % 2 === 0;
          const isEarning   = EARNINGS.includes(col.key) || col.key === "grossEarnings";
          const isDeduction = DEDUCTIONS.includes(col.key) || col.key === "totalDeductions";
          const argb = isEarning
            ? (base ? "FFF0FDF4" : "FFD1FAE5")
            : isDeduction
            ? (base ? "FFFFF1F2" : "FFFECDD3")
            : (base ? "FFF9FAFB" : "FFF3F4F6");

          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
          cell.border = {
            bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
            right:  { style: "hair", color: { argb: "FFD1D5DB" } },
          };
        });

        // Bold net salary cell
        const netCol = allCols.findIndex((c) => c.key === "netSalary") + 1;
        const netCell = ws.getCell(idx + 3, netCol);
        netCell.font = { bold: true };
      });

      // ── Freeze first two rows + first col ─────────────────────────────────
      ws.views = [{ state: "frozen", ySplit: 2, xSplit: 2, activeCell: "C3" }];

      // ── Auto-filter on row 2 ──────────────────────────────────────────────
      ws.autoFilter = {
        from: { row: 2, column: 1 },
        to:   { row: 2, column: allCols.length },
      };

      const buffer = await wb.xlsx.writeBuffer();
      const fileName = `salary_structures_${new Date().toISOString().slice(0, 10)}.xlsx`;

      reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", `attachment; filename="${fileName}"`)
        .send(Buffer.from(buffer));
    }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // MONTHLY SALARY DISBURSEMENT REPORT
  // ════════════════════════════════════════════════════════════════════════════

  function workingDaysInMonth(year: number, month: number): number {
    const days = new Date(year, month, 0).getDate();
    let count = 0;
    for (let d = 1; d <= days; d++) {
      const w = new Date(year, month - 1, d).getDay();
      if (w !== 0 && w !== 6) count++;
    }
    return count;
  }

  function workingDaysBetweenDates(from: Date, to: Date): number {
    let count = 0;
    const cur = new Date(from);
    while (cur <= to) {
      const w = cur.getDay();
      if (w !== 0 && w !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  async function fetchDisbursementData(year: number, month: number) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd   = new Date(year, month, 0, 23, 59, 59, 999);

    const [employees, unpaidLeaves, claims, bonusPayouts] = await Promise.all([
      // All active employees with salary structure + primary bank
      prisma.employee.findMany({
        where: { deletedAt: null },
        orderBy: [{ department: { name: "asc" } }, { firstName: "asc" }],
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          department:  { select: { name: true } },
          designation: { select: { title: true } },
          salaryStructure: {
            select: {
              ctc: true,
              items: { select: { component: true, amount: true } },
            },
          },
          bankDetails: {
            where: { isPrimary: true },
            take: 1,
            select: { accountNumber: true, bankName: true },
          },
        },
      }),

      // UNPAID leaves approved that overlap with this month
      prisma.leaveApplication.findMany({
        where: {
          leaveType: "UNPAID",
          status: "APPROVED",
          fromDate: { lte: monthEnd },
          toDate:   { gte: monthStart },
        },
        select: { employeeId: true, fromDate: true, toDate: true, totalDays: true },
      }),

      // Approved / paid claims in this month
      prisma.reimbursementClaim.findMany({
        where: {
          status: { in: ["APPROVED", "PAID"] as any },
          approvedAt: { gte: monthStart, lte: monthEnd },
        },
        select: { employeeId: true, approvedAmount: true, claimedAmount: true },
      }),

      // Bonus payouts scheduled/paid this month
      prisma.bonusPayout.findMany({
        where: {
          status: { in: ["PAID", "SCHEDULED"] as any },
          scheduledDate: { gte: monthStart, lte: monthEnd },
        },
        select: { employeeId: true, amount: true },
      }),
    ]);

    const workingDays = workingDaysInMonth(year, month);

    // Build lookup maps
    const lopByEmp: Record<string, number> = {};
    for (const lv of unpaidLeaves) {
      const overlapStart = lv.fromDate > monthStart ? lv.fromDate : monthStart;
      const overlapEnd   = lv.toDate   < monthEnd   ? lv.toDate   : monthEnd;
      if (overlapStart <= overlapEnd) {
        const days = lv.totalDays === 0.5
          ? 0.5
          : workingDaysBetweenDates(overlapStart, overlapEnd);
        lopByEmp[lv.employeeId] = (lopByEmp[lv.employeeId] ?? 0) + days;
      }
    }

    const claimsByEmp: Record<string, number> = {};
    for (const c of claims) {
      claimsByEmp[c.employeeId] = (claimsByEmp[c.employeeId] ?? 0) + (c.approvedAmount ?? c.claimedAmount);
    }

    const bonusByEmp: Record<string, number> = {};
    for (const b of bonusPayouts) {
      bonusByEmp[b.employeeId] = (bonusByEmp[b.employeeId] ?? 0) + b.amount;
    }

    return employees.map((emp) => {
      const items = emp.salaryStructure?.items ?? [];
      const comp: Record<string, number> = {};
      for (const item of items) comp[item.component] = item.amount;

      const basic             = comp["BASIC"] ?? 0;
      const hra               = comp["HRA"] ?? 0;
      const conveyance        = comp["CONVEYANCE"] ?? 0;
      const medical           = comp["MEDICAL"] ?? 0;
      const specialAllowance  = comp["SPECIAL_ALLOWANCE"] ?? 0;
      const pfEmployer        = comp["PF_EMPLOYER"] ?? 0;
      const esiEmployer       = comp["ESI_EMPLOYER"] ?? 0;
      const gratuity          = comp["GRATUITY"] ?? 0;
      const bonusComp         = comp["BONUS"] ?? 0;
      const incentive         = comp["INCENTIVE"] ?? 0;
      const grossEarnings     = EARNINGS.reduce((s, c) => s + (comp[c] ?? 0), 0);

      const tds               = comp["TDS"] ?? 0;
      const pfEmployee        = comp["PF_EMPLOYEE"] ?? 0;
      const esiEmployee       = comp["ESI_EMPLOYEE"] ?? 0;
      const professionalTax   = comp["PROFESSIONAL_TAX"] ?? 0;
      const advanceDeduction  = comp["ADVANCE_DEDUCTION"] ?? 0;

      const lopDays           = lopByEmp[emp.id] ?? 0;
      const lopAmount         = workingDays > 0 ? Math.round((basic / workingDays) * lopDays) : 0;
      const claimsAmount      = claimsByEmp[emp.id] ?? 0;
      const bonusAmount       = bonusByEmp[emp.id] ?? 0;

      const totalDeductions   = tds + pfEmployee + esiEmployee + professionalTax + advanceDeduction + lopAmount;
      const netPayable        = grossEarnings - totalDeductions + claimsAmount + bonusAmount;

      return {
        employeeCode:    emp.employeeCode,
        name:            `${emp.firstName} ${emp.lastName}`,
        department:      emp.department.name,
        designation:     emp.designation.title,
        accountNumber:   emp.bankDetails[0]?.accountNumber ?? null,
        bankName:        emp.bankDetails[0]?.bankName ?? null,
        basic, hra, conveyance, medical, specialAllowance,
        pfEmployer, esiEmployer, gratuity, bonusComp, incentive,
        grossEarnings,
        lopDays, lopAmount,
        claimsAmount, bonusAmount,
        tds, pfEmployee, esiEmployee, professionalTax, advanceDeduction,
        totalDeductions,
        netPayable,
        ctcMonthly:    emp.salaryStructure ? Math.round(emp.salaryStructure.ctc / 12) : null,
        hasStructure:  !!emp.salaryStructure,
      };
    });
  }

  // ── GET /reports/salary-disbursement/data ────────────────────────────────────
  fastify.get(
    "/salary-disbursement/data",
    { preHandler: requireRole(...ADMIN_ROLES) },
    async (request, reply) => {
      const q = request.query as { month?: string };
      if (!q.month || !/^\d{4}-\d{2}$/.test(q.month)) {
        return reply.status(400).send({ success: false, error: "month param required (YYYY-MM)", statusCode: 400 });
      }
      const [year, month] = q.month.split("-").map(Number);
      const rows = await fetchDisbursementData(year, month);
      return reply.send({ success: true, data: rows });
    }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // LEAVE RECORDS REPORT
  // ════════════════════════════════════════════════════════════════════════════

  const LEAVE_TYPE_LABELS: Record<string, string> = {
    CASUAL:       "Casual",
    SICK:         "Sick",
    EARNED:       "Earned",
    MATERNITY:    "Maternity",
    PATERNITY:    "Paternity",
    COMPENSATORY: "Compensatory",
    UNPAID:       "Unpaid",
    SPECIAL:      "Special",
  };

  const LEAVE_TYPES = ["CASUAL", "SICK", "EARNED", "MATERNITY", "PATERNITY", "COMPENSATORY", "UNPAID", "SPECIAL"] as const;
  type LeaveTypeKey = typeof LEAVE_TYPES[number];

  async function fetchLeaveData(year: number) {
    const yearStart = new Date(year, 0, 1);
    const yearEnd   = new Date(year, 11, 31, 23, 59, 59, 999);

    const [employees, balances, applications] = await Promise.all([
      prisma.employee.findMany({
        where: { deletedAt: null },
        orderBy: [{ department: { name: "asc" } }, { firstName: "asc" }],
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          department:  { select: { name: true } },
          designation: { select: { title: true } },
        },
      }),

      prisma.leaveBalance.findMany({
        where: { year },
        select: {
          employeeId: true,
          leaveType: true,
          allocated: true,
          used: true,
          pending: true,
          carried: true,
        },
      }),

      prisma.leaveApplication.findMany({
        where: {
          fromDate: { lte: yearEnd },
          toDate:   { gte: yearStart },
        },
        orderBy: { createdAt: "asc" },
        select: {
          employeeId: true,
          leaveType: true,
          fromDate: true,
          toDate: true,
          totalDays: true,
          status: true,
          approvedAt: true,
          rejectedAt: true,
          reason: true,
          createdAt: true,
          approver: { select: { firstName: true, lastName: true } },
          employee: { select: { employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } } },
        },
      }),
    ]);

    // Index balances by employeeId
    const balancesByEmp: Record<string, Record<string, { allocated: number; used: number; pending: number; carried: number }>> = {};
    for (const b of balances) {
      if (!balancesByEmp[b.employeeId]) balancesByEmp[b.employeeId] = {};
      balancesByEmp[b.employeeId][b.leaveType] = {
        allocated: b.allocated,
        used:      b.used,
        pending:   b.pending,
        carried:   b.carried,
      };
    }

    const rows = employees.map((emp) => {
      const empBalances = balancesByEmp[emp.id] ?? {};
      const byType = LEAVE_TYPES.map((lt) => {
        const b = empBalances[lt] ?? { allocated: 0, used: 0, pending: 0, carried: 0 };
        return {
          leaveType: lt,
          leaveTypeLabel: LEAVE_TYPE_LABELS[lt],
          allocated: b.allocated,
          used:      b.used,
          pending:   b.pending,
          carried:   b.carried,
          available: Math.max(0, b.allocated + b.carried - b.used - b.pending),
        };
      });

      const totalAllocated = byType.reduce((s, b) => s + b.allocated, 0);
      const totalUsed      = byType.reduce((s, b) => s + b.used, 0);
      const totalPending   = byType.reduce((s, b) => s + b.pending, 0);
      const totalCarried   = byType.reduce((s, b) => s + b.carried, 0);

      return {
        employeeCode: emp.employeeCode,
        name:         `${emp.firstName} ${emp.lastName}`,
        department:   emp.department.name,
        designation:  emp.designation.title,
        balances:     byType,
        totalAllocated,
        totalUsed,
        totalPending,
        totalCarried,
        totalAvailable: Math.max(0, totalAllocated + totalCarried - totalUsed - totalPending),
      };
    });

    const apps = applications.map((a) => ({
      employeeCode: a.employee.employeeCode,
      name:         `${a.employee.firstName} ${a.employee.lastName}`,
      department:   a.employee.department.name,
      leaveType:    LEAVE_TYPE_LABELS[a.leaveType] ?? a.leaveType,
      fromDate:     a.fromDate.toISOString().slice(0, 10),
      toDate:       a.toDate.toISOString().slice(0, 10),
      totalDays:    a.totalDays,
      status:       a.status,
      appliedOn:    a.createdAt.toISOString().slice(0, 10),
      approver:     a.approver ? `${a.approver.firstName} ${a.approver.lastName}` : null,
      resolvedAt:   (a.approvedAt ?? a.rejectedAt)?.toISOString().slice(0, 10) ?? null,
      reason:       a.reason,
    }));

    return { rows, applications: apps };
  }

  // ── GET /reports/leave-records/data ─────────────────────────────────────────
  fastify.get(
    "/leave-records/data",
    { preHandler: requireRole(...ADMIN_ROLES) },
    async (request, reply) => {
      const q = request.query as { year?: string };
      const year = q.year ? parseInt(q.year, 10) : new Date().getFullYear();
      if (isNaN(year) || year < 2000 || year > 2100) {
        return reply.status(400).send({ success: false, error: "Invalid year", statusCode: 400 });
      }
      const data = await fetchLeaveData(year);
      return reply.send({ success: true, data });
    }
  );

  // ── GET /reports/leave-records/export ───────────────────────────────────────
  fastify.get(
    "/leave-records/export",
    { preHandler: requireRole(...ADMIN_ROLES) },
    async (request, reply) => {
      const q = request.query as { year?: string };
      const year = q.year ? parseInt(q.year, 10) : new Date().getFullYear();
      if (isNaN(year) || year < 2000 || year > 2100) {
        return reply.status(400).send({ success: false, error: "Invalid year", statusCode: 400 });
      }

      const { rows, applications } = await fetchLeaveData(year);

      const wb = new ExcelJS.Workbook();
      wb.creator = "CADB";
      wb.created = new Date();

      // ── Sheet 1: Leave Balances ──────────────────────────────────────────────
      const ws1 = wb.addWorksheet("Leave Balances", {
        pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
      });

      const INFO_W = [
        { key: "sno",         header: "S.No",        width: 6  },
        { key: "empCode",     header: "Emp Code",     width: 13 },
        { key: "name",        header: "Employee Name",width: 24 },
        { key: "department",  header: "Department",   width: 20 },
        { key: "designation", header: "Designation",  width: 20 },
      ];
      const LEAVE_COLS_PER_TYPE = ["Allocated", "Carried", "Used", "Pending", "Available"];
      const TYPE_COLS = LEAVE_TYPES.flatMap((lt) =>
        LEAVE_COLS_PER_TYPE.map((sub) => ({ key: `${lt}_${sub.toLowerCase()}`, header: `${LEAVE_TYPE_LABELS[lt]}\n${sub}`, width: 11, lt, sub }))
      );
      const TOTAL_COLS = [
        { key: "totalAllocated", header: "Total\nAllocated",  width: 13 },
        { key: "totalCarried",   header: "Total\nCarried",    width: 11 },
        { key: "totalUsed",      header: "Total\nUsed",       width: 11 },
        { key: "totalPending",   header: "Total\nPending",    width: 11 },
        { key: "totalAvailable", header: "Total\nAvailable",  width: 13 },
      ];

      const allW = [...INFO_W, ...TYPE_COLS, ...TOTAL_COLS];
      ws1.columns = allW.map((c) => ({ key: c.key, width: c.width }));

      // Row 1: Title
      ws1.mergeCells(1, 1, 1, allW.length);
      const t1 = ws1.getCell(1, 1);
      t1.value = `Leave Balances Report — ${year}`;
      t1.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
      t1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF92400E" } };
      t1.alignment = { horizontal: "center", vertical: "middle" };
      ws1.getRow(1).height = 28;

      // Row 2: Leave type group headers
      ws1.getRow(2).height = 20;
      ws1.mergeCells(2, 1, 2, INFO_W.length);
      const g1 = ws1.getCell(2, 1);
      g1.value = "Employee Info";
      g1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
      g1.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      g1.alignment = { horizontal: "center", vertical: "middle" };

      const TYPE_COLORS: Record<LeaveTypeKey, string> = {
        CASUAL:       "FF065F46",
        SICK:         "FF1E40AF",
        EARNED:       "FF7C3AED",
        MATERNITY:    "FF9D174D",
        PATERNITY:    "FF0E7490",
        COMPENSATORY: "FF92400E",
        UNPAID:       "FF4B5563",
        SPECIAL:      "FF5B21B6",
      };
      let typeColStart = INFO_W.length + 1;
      for (const lt of LEAVE_TYPES) {
        const span = LEAVE_COLS_PER_TYPE.length;
        ws1.mergeCells(2, typeColStart, 2, typeColStart + span - 1);
        const gc = ws1.getCell(2, typeColStart);
        gc.value = LEAVE_TYPE_LABELS[lt];
        gc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TYPE_COLORS[lt] } };
        gc.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
        gc.alignment = { horizontal: "center", vertical: "middle" };
        typeColStart += span;
      }
      ws1.mergeCells(2, typeColStart, 2, allW.length);
      const gtot = ws1.getCell(2, typeColStart);
      gtot.value = "Totals";
      gtot.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF374151" } };
      gtot.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      gtot.alignment = { horizontal: "center", vertical: "middle" };

      // Row 3: Column headers
      ws1.getRow(3).height = 36;
      allW.forEach((col, i) => {
        const cell = ws1.getCell(3, i + 1);
        cell.value = col.header;
        cell.font  = { bold: true, size: 8.5, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        const isType  = "lt" in col;
        const isTotal = TOTAL_COLS.some((tc) => tc.key === col.key);
        const argb = isType
          ? TYPE_COLORS[(col as typeof TYPE_COLS[number]).lt]
          : isTotal ? "FF111827" : "FF162032";
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
        cell.border = { right: { style: "thin", color: { argb: "FF4B5563" } }, bottom: { style: "thin", color: { argb: "FFFFFFFF" } } };
      });

      // Data rows
      rows.forEach((row, idx) => {
        const isEven = idx % 2 === 0;
        const dataRow: Record<string, string | number> = {
          sno:          idx + 1,
          empCode:      row.employeeCode,
          name:         row.name,
          department:   row.department,
          designation:  row.designation,
          totalAllocated: row.totalAllocated,
          totalCarried:   row.totalCarried,
          totalUsed:      row.totalUsed,
          totalPending:   row.totalPending,
          totalAvailable: row.totalAvailable,
        };
        for (const b of row.balances) {
          dataRow[`${b.leaveType}_allocated`] = b.allocated;
          dataRow[`${b.leaveType}_carried`]   = b.carried;
          dataRow[`${b.leaveType}_used`]       = b.used;
          dataRow[`${b.leaveType}_pending`]    = b.pending;
          dataRow[`${b.leaveType}_available`]  = b.available;
        }

        allW.forEach((col, ci) => {
          const cell = ws1.getCell(idx + 4, ci + 1);
          cell.value = dataRow[col.key] ?? "";
          const isNum = ci >= INFO_W.length && typeof dataRow[col.key] === "number";
          if (isNum) {
            cell.numFmt = "0.0";
            cell.alignment = { vertical: "middle", horizontal: "right" };
          } else {
            cell.alignment = { vertical: "middle" };
          }
          const isType  = "lt" in col;
          const isTotal = TOTAL_COLS.some((tc) => tc.key === col.key);
          let baseArgb: string;
          if (isType) {
            baseArgb = isEven ? "FFFAFAFA" : "FFF3F4F6";
          } else if (isTotal) {
            baseArgb = isEven ? "FFF0F9FF" : "FFE0F2FE";
          } else {
            baseArgb = isEven ? "FFF9FAFB" : "FFF3F4F6";
          }
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: baseArgb } };
          cell.border = {
            bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
            right:  { style: "hair", color: { argb: "FFD1D5DB" } },
          };
        });
        ws1.getRow(idx + 4).height = 17;
      });

      ws1.views = [{ state: "frozen", ySplit: 3, xSplit: 2, activeCell: "C4" }];
      ws1.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: allW.length } };

      // ── Sheet 2: Leave Applications ──────────────────────────────────────────
      const ws2 = wb.addWorksheet("Leave Applications", {
        pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
      });

      const APP_COLS = [
        { key: "sno",         header: "S.No",         width: 6  },
        { key: "empCode",     header: "Emp Code",      width: 13 },
        { key: "name",        header: "Employee Name", width: 24 },
        { key: "department",  header: "Department",    width: 20 },
        { key: "leaveType",   header: "Leave Type",    width: 16 },
        { key: "fromDate",    header: "From Date",     width: 14 },
        { key: "toDate",      header: "To Date",       width: 14 },
        { key: "totalDays",   header: "Days",          width: 9  },
        { key: "status",      header: "Status",        width: 12 },
        { key: "appliedOn",   header: "Applied On",    width: 14 },
        { key: "approver",    header: "Approver",      width: 22 },
        { key: "resolvedAt",  header: "Resolved On",   width: 14 },
        { key: "reason",      header: "Reason",        width: 40 },
      ];

      ws2.columns = APP_COLS.map((c) => ({ key: c.key, width: c.width }));

      // Title row
      ws2.mergeCells(1, 1, 1, APP_COLS.length);
      const t2 = ws2.getCell(1, 1);
      t2.value = `Leave Applications — ${year}`;
      t2.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
      t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF92400E" } };
      t2.alignment = { horizontal: "center", vertical: "middle" };
      ws2.getRow(1).height = 28;

      // Header row
      ws2.getRow(2).height = 26;
      APP_COLS.forEach((col, i) => {
        const cell = ws2.getCell(2, i + 1);
        cell.value = col.header;
        cell.font  = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
        cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = { right: { style: "thin", color: { argb: "FF4B5563" } }, bottom: { style: "thin", color: { argb: "FFFFFFFF" } } };
      });

      const STATUS_COLORS: Record<string, string> = {
        APPROVED:  "FF14532D",
        PENDING:   "FF92400E",
        REJECTED:  "FF7F1D1D",
        CANCELLED: "FF374151",
      };

      applications.forEach((app, idx) => {
        const isEven = idx % 2 === 0;
        APP_COLS.forEach((col, ci) => {
          const cell = ws2.getCell(idx + 3, ci + 1);
          const key = col.key as keyof typeof app | "sno";
          cell.value = key === "sno" ? idx + 1 : ((app as any)[key] ?? "");
          cell.alignment = { vertical: "middle", wrapText: col.key === "reason" };
          const argb = isEven ? "FFF9FAFB" : "FFF3F4F6";
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
          cell.border = {
            bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
            right:  { style: "hair", color: { argb: "FFD1D5DB" } },
          };
        });

        // Color-code status cell
        const statusCi = APP_COLS.findIndex((c) => c.key === "status") + 1;
        const statusCell = ws2.getCell(idx + 3, statusCi);
        const statusColor = STATUS_COLORS[app.status] ?? "FF374151";
        statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusColor + "22" } };
        statusCell.font = { color: { argb: statusColor }, bold: true, size: 9 };
        statusCell.alignment = { horizontal: "center", vertical: "middle" };

        ws2.getRow(idx + 3).height = 17;
      });

      ws2.views = [{ state: "frozen", ySplit: 2, xSplit: 2, activeCell: "C3" }];
      ws2.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: APP_COLS.length } };

      const buffer = await wb.xlsx.writeBuffer();
      const fileName = `leave_records_${year}.xlsx`;

      reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", `attachment; filename="${fileName}"`)
        .send(Buffer.from(buffer));
    }
  );

  // ── GET /reports/salary-disbursement/export ──────────────────────────────────
  fastify.get(
    "/salary-disbursement/export",
    { preHandler: requireRole(...ADMIN_ROLES) },
    async (request, reply) => {
      const q = request.query as { month?: string };
      if (!q.month || !/^\d{4}-\d{2}$/.test(q.month)) {
        return reply.status(400).send({ success: false, error: "month param required (YYYY-MM)", statusCode: 400 });
      }
      const [year, month] = q.month.split("-").map(Number);
      const rows = await fetchDisbursementData(year, month);

      const monthName = new Date(year, month - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });

      const wb = new ExcelJS.Workbook();
      wb.creator = "CADB";
      wb.created = new Date();

      const ws = wb.addWorksheet(`Disbursement ${monthName}`, {
        pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
      });

      // ── Column definitions ────────────────────────────────────────────────
      const INFO_COLS = [
        { key: "sno",           header: "S.No",           width: 6  },
        { key: "employeeCode",  header: "Emp Code",        width: 13 },
        { key: "name",          header: "Employee Name",   width: 24 },
        { key: "department",    header: "Department",      width: 20 },
        { key: "designation",   header: "Designation",     width: 20 },
        { key: "accountNumber", header: "Account No",      width: 16 },
        { key: "bankName",      header: "Bank",            width: 16 },
      ];
      const EARN_COLS = [
        { key: "basic",             header: "Basic",          width: 13 },
        { key: "hra",               header: "HRA",            width: 12 },
        { key: "conveyance",        header: "Conveyance",     width: 13 },
        { key: "medical",           header: "Medical",        width: 12 },
        { key: "specialAllowance",  header: "Spl. Allow.",    width: 13 },
        { key: "pfEmployer",        header: "PF (Emp.)",      width: 12 },
        { key: "esiEmployer",       header: "ESI (Emp.)",     width: 12 },
        { key: "gratuity",          header: "Gratuity",       width: 12 },
        { key: "bonusComp",         header: "Bonus",          width: 12 },
        { key: "incentive",         header: "Incentive",      width: 12 },
        { key: "grossEarnings",     header: "Gross Pay",      width: 14 },
      ];
      const ADJ_COLS = [
        { key: "lopDays",       header: "LoP Days",       width: 11 },
        { key: "lopAmount",     header: "LoP Amount",     width: 13 },
        { key: "claimsAmount",  header: "Claims",         width: 12 },
        { key: "bonusAmount",   header: "Bonus Payout",   width: 14 },
      ];
      const DED_COLS = [
        { key: "tds",               header: "TDS",             width: 12 },
        { key: "pfEmployee",        header: "PF (Empl.)",      width: 12 },
        { key: "esiEmployee",       header: "ESI (Empl.)",     width: 12 },
        { key: "professionalTax",   header: "Prof. Tax",       width: 12 },
        { key: "advanceDeduction",  header: "Advance Ded.",    width: 13 },
        { key: "totalDeductions",   header: "Total Deductions",width: 16 },
      ];
      const NET_COLS = [
        { key: "netPayable", header: "Net Payable", width: 15 },
        { key: "ctcMonthly", header: "CTC/Month",   width: 14 },
      ];

      const allCols = [...INFO_COLS, ...EARN_COLS, ...ADJ_COLS, ...DED_COLS, ...NET_COLS];
      ws.columns = allCols.map((c) => ({ key: c.key, width: c.width }));

      // ── Row 1: Title ─────────────────────────────────────────────────────
      ws.mergeCells(1, 1, 1, allCols.length);
      const titleCell = ws.getCell(1, 1);
      titleCell.value = `Monthly Salary Disbursement — ${monthName}`;
      titleCell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(1).height = 28;

      // ── Row 2: Group labels ───────────────────────────────────────────────
      ws.getRow(2).height = 20;
      function mergeGrp(sc: number, ec: number, label: string, argb: string) {
        ws.mergeCells(2, sc, 2, ec);
        const cell = ws.getCell(2, sc);
        cell.value = label;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }
      const g = {
        infoEnd:  INFO_COLS.length,
        earnEnd:  INFO_COLS.length + EARN_COLS.length,
        adjEnd:   INFO_COLS.length + EARN_COLS.length + ADJ_COLS.length,
        dedEnd:   INFO_COLS.length + EARN_COLS.length + ADJ_COLS.length + DED_COLS.length,
        netEnd:   allCols.length,
      };
      mergeGrp(1,           g.infoEnd,  "Employee Info",  "FF1E3A5F");
      mergeGrp(g.infoEnd+1, g.earnEnd,  "Earnings",       "FF166534");
      mergeGrp(g.earnEnd+1, g.adjEnd,   "Adjustments",    "FF7C3AED");
      mergeGrp(g.adjEnd+1,  g.dedEnd,   "Deductions",     "FF7F1D1D");
      mergeGrp(g.dedEnd+1,  g.netEnd,   "Net",            "FF374151");

      // ── Row 3: Column headers ─────────────────────────────────────────────
      ws.getRow(3).height = 28;
      allCols.forEach((col, i) => {
        const cell = ws.getCell(3, i + 1);
        cell.value = col.header;
        const isEarn = i >= g.infoEnd && i < g.earnEnd;
        const isAdj  = i >= g.earnEnd && i < g.adjEnd;
        const isDed  = i >= g.adjEnd  && i < g.dedEnd;
        const argb = isEarn ? "FF14532D" : isAdj ? "FF5B21B6" : isDed ? "FF6B0101" : "FF111827";
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
        cell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = { right: { style: "thin", color: { argb: "FF4B5563" } }, bottom: { style: "thin", color: { argb: "FFFFFFFF" } } };
      });

      // ── Data rows ─────────────────────────────────────────────────────────
      rows.forEach((row, idx) => {
        const wsRow = ws.getRow(idx + 4);
        const isEven = idx % 2 === 0;

        allCols.forEach((col, ci) => {
          const cell = ws.getCell(idx + 4, ci + 1);
          const key = col.key as keyof typeof row | "sno";
          cell.value = key === "sno" ? idx + 1 : (row as any)[key] ?? "";

          const isNum   = typeof (row as any)[key] === "number" && key !== "sno" && key !== "lopDays";
          const isEarn  = ci >= g.infoEnd && ci < g.earnEnd;
          const isAdj   = ci >= g.earnEnd && ci < g.adjEnd;
          const isDed   = ci >= g.adjEnd  && ci < g.dedEnd;

          if (isNum) {
            cell.numFmt = "₹#,##0";
            cell.alignment = { vertical: "middle", horizontal: "right" };
          } else {
            cell.alignment = { vertical: "middle" };
          }

          const argb = isEarn
            ? (isEven ? "FFF0FDF4" : "FFD1FAE5")
            : isAdj
            ? (isEven ? "FFF5F3FF" : "FFEDE9FE")
            : isDed
            ? (isEven ? "FFFFF1F2" : "FFFECDD3")
            : (isEven ? "FFF9FAFB" : "FFF3F4F6");

          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
          cell.border = {
            bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
            right:  { style: "hair", color: { argb: "FFD1D5DB" } },
          };
        });

        // Bold net payable
        const netCol = allCols.findIndex((c) => c.key === "netPayable") + 1;
        ws.getCell(idx + 4, netCol).font = { bold: true };

        wsRow.height = 18;
      });

      // ── Totals row ────────────────────────────────────────────────────────
      const totalsRow = ws.getRow(rows.length + 4);
      totalsRow.height = 20;
      const numericKeys = new Set(["basic","hra","conveyance","medical","specialAllowance","pfEmployer","esiEmployer","gratuity","bonusComp","incentive","grossEarnings","lopAmount","claimsAmount","bonusAmount","tds","pfEmployee","esiEmployee","professionalTax","advanceDeduction","totalDeductions","netPayable","ctcMonthly"]);
      allCols.forEach((col, ci) => {
        const cell = ws.getCell(rows.length + 4, ci + 1);
        if (col.key === "name") {
          cell.value = `TOTAL (${rows.filter((r) => r.hasStructure).length} employees)`;
          cell.font = { bold: true, size: 10 };
        } else if (numericKeys.has(col.key)) {
          cell.value = rows.reduce((s, r) => s + ((r as any)[col.key] ?? 0), 0);
          cell.numFmt = "₹#,##0";
          cell.font = { bold: true };
          cell.alignment = { horizontal: "right", vertical: "middle" };
        }
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F0FE" } };
        cell.border = { top: { style: "medium", color: { argb: "FF1E3A5F" } } };
      });

      // ── Freeze rows 1-3 + first 2 cols ───────────────────────────────────
      ws.views = [{ state: "frozen", ySplit: 3, xSplit: 2, activeCell: "C4" }];

      // ── Auto-filter on row 3 ──────────────────────────────────────────────
      ws.autoFilter = {
        from: { row: 3, column: 1 },
        to:   { row: 3, column: allCols.length },
      };

      const buffer = await wb.xlsx.writeBuffer();
      const safeName = monthName.replace(/ /g, "_");
      const fileName = `salary_disbursement_${safeName}.xlsx`;

      reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", `attachment; filename="${fileName}"`)
        .send(Buffer.from(buffer));
    }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // CLAIMS REPORT
  // ════════════════════════════════════════════════════════════════════════════

  async function fetchClaimsData(from: Date, to: Date) {
    const claims = await prisma.reimbursementClaim.findMany({
      where: { createdAt: { gte: from, lte: to }, status: { not: "DRAFT" as any } },
      orderBy: { createdAt: "asc" },
      include: {
        employee: {
          select: {
            employeeCode: true, firstName: true, lastName: true,
            department:  { select: { name: true } },
            designation: { select: { title: true } },
          },
        },
        approver: { select: { firstName: true, lastName: true } },
      },
    });

    return claims.map((c) => ({
      claimNumber:    c.claimNumber,
      employeeCode:   c.employee.employeeCode,
      name:           `${c.employee.firstName} ${c.employee.lastName}`,
      department:     c.employee.department.name,
      designation:    c.employee.designation.title,
      claimType:      c.claimType,
      title:          c.title,
      description:    c.description ?? "",
      claimedAmount:  c.claimedAmount,
      approvedAmount: c.approvedAmount ?? null,
      status:         c.status,
      submittedAt:    c.createdAt.toISOString().slice(0, 10),
      resolvedAt:     (c.approvedAt ?? c.rejectedAt)?.toISOString().slice(0, 10) ?? null,
      paidAt:         (c as any).paidAt?.toISOString().slice(0, 10) ?? null,
      approver:       c.approver ? `${c.approver.firstName} ${c.approver.lastName}` : null,
      rejectionNote:  (c as any).rejectionNote ?? null,
    }));
  }

  // ── GET /reports/claims/data ────────────────────────────────────────────────
  fastify.get(
    "/claims/data",
    { preHandler: requireRole(...ADMIN_ROLES) },
    async (request, reply) => {
      const q = request.query as { from?: string; to?: string };
      if (!q.from || !q.to) {
        return reply.status(400).send({ success: false, error: "from and to date params required (YYYY-MM-DD)", statusCode: 400 });
      }
      const from = new Date(q.from + "T00:00:00.000Z");
      const to   = new Date(q.to   + "T23:59:59.999Z");
      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return reply.status(400).send({ success: false, error: "Invalid date format", statusCode: 400 });
      }

      const rows = await fetchClaimsData(from, to);
      const stats = {
        total:         rows.length,
        submitted:     rows.filter((r) => r.status === "SUBMITTED").length,
        approved:      rows.filter((r) => r.status === "APPROVED" || r.status === "PAID").length,
        rejected:      rows.filter((r) => r.status === "REJECTED").length,
        paid:          rows.filter((r) => r.status === "PAID").length,
        totalClaimed:  rows.reduce((s, r) => s + r.claimedAmount, 0),
        totalApproved: rows.filter((r) => r.approvedAmount != null).reduce((s, r) => s + (r.approvedAmount ?? 0), 0),
        totalPaid:     rows.filter((r) => r.status === "PAID").reduce((s, r) => s + (r.approvedAmount ?? 0), 0),
      };

      return reply.send({ success: true, data: { rows, stats } });
    }
  );

  // ── GET /reports/claims/export ──────────────────────────────────────────────
  fastify.get(
    "/claims/export",
    { preHandler: requireRole(...ADMIN_ROLES) },
    async (request, reply) => {
      const q = request.query as { from?: string; to?: string };
      if (!q.from || !q.to) {
        return reply.status(400).send({ success: false, error: "from and to date params required", statusCode: 400 });
      }
      const from = new Date(q.from + "T00:00:00.000Z");
      const to   = new Date(q.to   + "T23:59:59.999Z");
      const rows = await fetchClaimsData(from, to);

      const wb = new ExcelJS.Workbook();
      wb.creator = "CADB";
      wb.created = new Date();

      const ws = wb.addWorksheet("Claims Report", {
        pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
      });

      const COLS = [
        { key: "sno",            header: "S.No",           width: 6  },
        { key: "claimNumber",    header: "Claim No.",       width: 16 },
        { key: "submittedAt",    header: "Date",            width: 13 },
        { key: "employeeCode",   header: "Emp Code",        width: 13 },
        { key: "name",           header: "Employee Name",   width: 24 },
        { key: "department",     header: "Department",      width: 20 },
        { key: "designation",    header: "Designation",     width: 20 },
        { key: "claimType",      header: "Claim Type",      width: 18 },
        { key: "title",          header: "Title",           width: 28 },
        { key: "claimedAmount",  header: "Claimed (₹)",     width: 14 },
        { key: "approvedAmount", header: "Approved (₹)",    width: 14 },
        { key: "status",         header: "Status",          width: 13 },
        { key: "resolvedAt",     header: "Resolved On",     width: 13 },
        { key: "paidAt",         header: "Paid On",         width: 13 },
        { key: "approver",       header: "Processed By",    width: 22 },
        { key: "rejectionNote",  header: "Rejection Note",  width: 35 },
      ];
      ws.columns = COLS.map((c) => ({ key: c.key, width: c.width }));

      // Title row
      ws.mergeCells(1, 1, 1, COLS.length);
      const tc = ws.getCell(1, 1);
      tc.value = `Claims Report  —  ${q.from} to ${q.to}`;
      tc.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
      tc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
      tc.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(1).height = 28;

      // Header row
      ws.getRow(2).height = 26;
      COLS.forEach((col, i) => {
        const cell = ws.getCell(2, i + 1);
        cell.value = col.header;
        cell.font  = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
        cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5B21B6" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = { right: { style: "thin", color: { argb: "FF7C3AED" } }, bottom: { style: "thin", color: { argb: "FFFFFFFF" } } };
      });

      const STATUS_ARGB: Record<string, string> = {
        APPROVED:  "FF14532D", PAID: "FF064E3B",
        SUBMITTED: "FF92400E", REJECTED: "FF7F1D1D", DRAFT: "FF374151",
      };

      rows.forEach((row, idx) => {
        const isEven = idx % 2 === 0;
        COLS.forEach((col, ci) => {
          const cell = ws.getCell(idx + 3, ci + 1);
          const key = col.key as keyof typeof row | "sno";
          cell.value = key === "sno" ? idx + 1 : ((row as any)[key] ?? "");

          const isAmt = col.key === "claimedAmount" || col.key === "approvedAmount";
          if (isAmt && typeof (row as any)[col.key] === "number") {
            cell.numFmt = "₹#,##0";
            cell.alignment = { horizontal: "right", vertical: "middle" };
          } else {
            cell.alignment = { vertical: "middle", wrapText: col.key === "rejectionNote" };
          }
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isEven ? "FFF5F3FF" : "FFEDE9FE" } };
          cell.border = { bottom: { style: "hair", color: { argb: "FFE5E7EB" } }, right: { style: "hair", color: { argb: "FFD1D5DB" } } };
        });

        // Coloured status cell
        const sci = COLS.findIndex((c) => c.key === "status") + 1;
        const sc = ws.getCell(idx + 3, sci);
        const argb = STATUS_ARGB[row.status] ?? "FF374151";
        sc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb + "22" } };
        sc.font = { color: { argb }, bold: true, size: 9 };
        sc.alignment = { horizontal: "center", vertical: "middle" };

        ws.getRow(idx + 3).height = 17;
      });

      // Totals row
      const totRow = rows.length + 3;
      ws.getRow(totRow).height = 20;
      COLS.forEach((col, ci) => {
        const cell = ws.getCell(totRow, ci + 1);
        if (col.key === "name") {
          cell.value = `TOTAL (${rows.length} claims)`;
          cell.font = { bold: true };
        } else if (col.key === "claimedAmount") {
          cell.value = rows.reduce((s, r) => s + r.claimedAmount, 0);
          cell.numFmt = "₹#,##0"; cell.font = { bold: true };
          cell.alignment = { horizontal: "right", vertical: "middle" };
        } else if (col.key === "approvedAmount") {
          cell.value = rows.reduce((s, r) => s + (r.approvedAmount ?? 0), 0);
          cell.numFmt = "₹#,##0"; cell.font = { bold: true };
          cell.alignment = { horizontal: "right", vertical: "middle" };
        }
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDE9FE" } };
        cell.border = { top: { style: "medium", color: { argb: "FF7C3AED" } } };
      });

      ws.views = [{ state: "frozen", ySplit: 2, xSplit: 2, activeCell: "C3" }];
      ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: COLS.length } };

      const buffer = await wb.xlsx.writeBuffer();
      reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", `attachment; filename="claims_report_${q.from}_to_${q.to}.xlsx"`)
        .send(Buffer.from(buffer));
    }
  );
}
