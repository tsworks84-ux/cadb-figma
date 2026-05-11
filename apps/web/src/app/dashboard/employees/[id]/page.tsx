"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { formatDate, formatCurrency, getInitials } from "@/lib/utils";
import {
  ArrowLeft, User, GraduationCap, Award, Wallet, CalendarOff,
  Receipt, Shield, BookOpen, Phone, Mail, MapPin, AlertCircle,
  KeyRound, X, Copy, Plus, Trash2, FileText, Upload, Eye,
  CreditCard, Building2, Camera, Pencil, Check,
  ChevronLeft, ChevronRight, ChevronDown, TrendingUp, MinusCircle,
  Star, Calendar, BadgeCheck, UsersRound, Search, ListTodo, CheckCircle2,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// ─── Tab config ─────────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: "Profile",
    items: [
      { id: "personal",  label: "Personal",      icon: User     },
      { id: "documents", label: "Documents",     icon: FileText },
    ],
  },
  {
    label: "Employment",
    items: [
      { id: "education", label: "Education",     icon: GraduationCap },
      { id: "salary",    label: "Salary",         icon: Wallet        },
      { id: "bank",      label: "Bank",           icon: CreditCard    },
      { id: "payout",    label: "Monthly Payout", icon: TrendingUp    },
      { id: "leaves",    label: "Leaves",         icon: CalendarOff   },
      { id: "claims",    label: "Claims",        icon: Receipt       },
    ],
  },
  {
    label: "Learning",
    items: [
      { id: "training",  label: "Training",      icon: BookOpen },
      { id: "policies",  label: "Policies",      icon: Shield   },
    ],
  },
];

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-700",
  ACTIVE: "bg-green-100 text-green-700",
  PROBATION: "bg-yellow-100 text-yellow-700",
  ON_LEAVE: "bg-blue-100 text-blue-700",
  NOTICE_PERIOD: "bg-orange-100 text-orange-700",
  TERMINATED: "bg-red-100 text-red-700",
  RESIGNED: "bg-gray-100 text-gray-700",
  RETIRED: "bg-purple-100 text-purple-700",
  EXITED: "bg-red-50 text-red-500",
};

// ─── Shared UI ───────────────────────────────────────────────────────────────

function CollapsibleCard({
  title, icon: Icon, defaultOpen = true, badge, action, children,
}: {
  title: string;
  icon?: React.ElementType;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center border-b border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex-1 flex items-center gap-2 px-5 py-3.5 text-left min-w-0"
        >
          {Icon && <Icon className="h-4 w-4 text-gray-400 shrink-0" />}
          <span className="font-semibold text-gray-800 text-sm flex-1 truncate">{title}</span>
          {badge}
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
        </button>
        {action && <div className="px-3 shrink-0">{action}</div>}
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-900">{value || <span className="text-gray-300 italic">—</span>}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">{children}</div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-200 py-14 text-center text-sm text-gray-400">
      {label}
    </div>
  );
}

function Input({ label, error, ...props }: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input
        {...props}
        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"
        }`}
      />
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

function Select({ label, error, children, ...props }: { label: string; error?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <select
        {...props}
        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"
        }`}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

// ─── Qualification form ───────────────────────────────────────────────────────

const qualSchema = z.object({
  level: z.enum(["SCHOOL", "UG", "PG", "PHD", "DIPLOMA", "CERTIFICATION", "OTHER"]),
  degreeName: z.string().min(1, "Required"),
  specialization: z.string().optional(),
  institution: z.string().min(1, "Required"),
  boardUniversity: z.string().min(1, "Required"),
  yearOfPassing: z.coerce.number().int().min(1950).max(new Date().getFullYear()),
  percentage: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  cgpa: z.coerce.number().min(0).max(10).optional().or(z.literal("")),
});

type QualForm = z.infer<typeof qualSchema>;

const LEVEL_LABELS: Record<string, string> = {
  SCHOOL: "Schooling (XII / PUC / JC)",
  UG: "Under Graduate (UG)",
  PG: "Post Graduate (PG)",
  PHD: "Doctorate / Ph.D.",
  DIPLOMA: "Diploma",
  CERTIFICATION: "Certification",
  OTHER: "Other",
};

function AddQualificationModal({
  employeeId,
  onClose,
}: {
  employeeId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<QualForm>({
    resolver: zodResolver(qualSchema),
    defaultValues: { level: "UG", yearOfPassing: new Date().getFullYear() },
  });
  const level = watch("level");

  const mutation = useMutation({
    mutationFn: (data: QualForm) => api.post(`/api/v1/employees/${employeeId}/qualifications`, {
      ...data,
      percentage: data.percentage === "" ? undefined : data.percentage,
      cgpa: data.cgpa === "" ? undefined : data.cgpa,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qualifications", employeeId] });
      toast.success("Qualification added");
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  return (
    <Modal title="Add Qualification" onClose={onClose}>
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <Select label="Education Level" {...register("level")} error={errors.level?.message}>
          {Object.entries(LEVEL_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={level === "SCHOOL" ? "Board / Stream" : "Degree Name"}
            placeholder={level === "SCHOOL" ? "e.g. Science / Commerce" : "e.g. B.Tech"}
            {...register("degreeName")}
            error={errors.degreeName?.message}
          />
          {level !== "SCHOOL" && (
            <Input label="Specialization" placeholder="e.g. Computer Science" {...register("specialization")} />
          )}
        </div>

        <Input
          label="Institution / School"
          placeholder="Name of school / college / university"
          {...register("institution")}
          error={errors.institution?.message}
        />

        <Input
          label={level === "SCHOOL" ? "Board (CBSE / State / ICSE)" : "University / Board"}
          placeholder="e.g. CBSE, Anna University"
          {...register("boardUniversity")}
          error={errors.boardUniversity?.message}
        />

        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Year of Passing"
            type="number"
            min={1950}
            max={new Date().getFullYear()}
            {...register("yearOfPassing")}
            error={errors.yearOfPassing?.message}
          />
          <Input
            label="Percentage %"
            type="number"
            step="0.01"
            min={0}
            max={100}
            placeholder="Optional"
            {...register("percentage")}
          />
          <Input
            label="CGPA"
            type="number"
            step="0.01"
            min={0}
            max={10}
            placeholder="Optional"
            {...register("cgpa")}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {mutation.isPending ? "Saving..." : "Add Qualification"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Certification form ───────────────────────────────────────────────────────

const certSchema = z.object({
  name: z.string().min(1, "Required"),
  issuingBody: z.string().min(1, "Required"),
  credentialId: z.string().optional(),
  issueDate: z.string().min(1, "Required"),
  expiryDate: z.string().optional(),
});

type CertForm = z.infer<typeof certSchema>;

function AddCertificationModal({
  employeeId,
  onClose,
}: {
  employeeId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<CertForm>({
    resolver: zodResolver(certSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: CertForm) =>
      api.post(`/api/v1/employees/${employeeId}/certifications`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certifications", employeeId] });
      toast.success("Certification added");
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  return (
    <Modal title="Add Certification" onClose={onClose}>
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <Input label="Certification Name" placeholder="e.g. AWS Certified Solutions Architect" {...register("name")} error={errors.name?.message} />
        <Input label="Issuing Body" placeholder="e.g. Amazon Web Services" {...register("issuingBody")} error={errors.issuingBody?.message} />
        <Input label="Credential ID" placeholder="Optional" {...register("credentialId")} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Issue Date" type="date" {...register("issueDate")} error={errors.issueDate?.message} />
          <Input label="Expiry Date" type="date" {...register("expiryDate")} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {mutation.isPending ? "Saving..." : "Add Certification"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Bank Detail form ─────────────────────────────────────────────────────────

const bankSchema = z.object({
  accountName: z.string().min(1, "Required"),
  accountNumber: z.string().min(9).max(18, "Max 18 digits"),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code (e.g. SBIN0001234)"),
  bankName: z.string().min(1, "Required"),
  branchName: z.string().min(1, "Required"),
  isPrimary: z.boolean().default(false),
});

type BankForm = z.infer<typeof bankSchema>;

function BankForm({ employeeId, existing, onClose }: { employeeId: string; existing?: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<BankForm>({
    resolver: zodResolver(bankSchema),
    defaultValues: existing
      ? { accountName: existing.accountName, accountNumber: existing.accountNumber, ifscCode: existing.ifscCode, bankName: existing.bankName, branchName: existing.branchName, isPrimary: existing.isPrimary }
      : { isPrimary: false },
  });

  const mutation = useMutation({
    mutationFn: (data: BankForm) =>
      existing
        ? api.put(`/api/v1/employees/${employeeId}/bank-details/${existing.id}`, data)
        : api.post(`/api/v1/employees/${employeeId}/bank-details`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-details", employeeId] });
      toast.success(existing ? "Bank account updated" : "Bank account added");
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  return (
    <Modal title={existing ? "Edit Bank Account" : "Add Bank Account"} onClose={onClose}>
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <Input label="Account Holder Name" placeholder="As per bank records" {...register("accountName")} error={errors.accountName?.message} />
        <Input label="Account Number" placeholder="9–18 digit account number" {...register("accountNumber")} error={errors.accountNumber?.message} />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="IFSC Code"
            placeholder="e.g. SBIN0001234"
            {...register("ifscCode")}
            onChange={(e) => {
              e.target.value = e.target.value.toUpperCase();
            }}
            error={errors.ifscCode?.message}
          />
          <Input label="Bank Name" placeholder="e.g. State Bank of India" {...register("bankName")} error={errors.bankName?.message} />
        </div>
        <Input label="Branch Name" placeholder="e.g. MG Road, Bengaluru" {...register("branchName")} error={errors.branchName?.message} />
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" {...register("isPrimary")} className="rounded border-gray-300" />
          Set as primary account for salary credit
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {mutation.isPending ? "Saving..." : existing ? "Save Changes" : "Add Account"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AddBankModal({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  return <BankForm employeeId={employeeId} onClose={onClose} />;
}

// ─── Personal info edit form ──────────────────────────────────────────────────

const addrSchema = z.object({
  line1: z.string().optional().or(z.literal("")),
  line2: z.string().optional(),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  pincode: z.string().optional().or(z.literal("")),
  country: z.string().default("India"),
});

const personalEditSchema = z.object({
  panEncrypted: z.string()
    .refine((v) => v === "" || /^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/.test(v), "Invalid PAN (e.g. ABCDE1234F)"),
  personalPhone: z.string().length(10, "Must be 10 digits").optional().or(z.literal("")),
  officialPhone: z.string().length(10).optional().or(z.literal("")),
  personalEmail: z.string().email().optional().or(z.literal("")),
  maritalStatus: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]).optional().or(z.literal("")),
  bloodGroup: z.enum(["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"]).optional().or(z.literal("")),
  religion: z.string().optional(),
  currentAddress: addrSchema.optional(),
  permanentAddress: addrSchema.optional(),
  emergencyContactName: z.string().optional().or(z.literal("")),
  emergencyContactPhone: z.string().optional().or(z.literal("")),
  emergencyRelation: z.string().optional().or(z.literal("")),
});

type PersonalEditForm = z.infer<typeof personalEditSchema>;

function EditPersonalForm({
  emp,
  employeeId,
  onClose,
}: {
  emp: any;
  employeeId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const addr = emp.currentAddress as any ?? {};
  const perm = emp.permanentAddress as any;

  const { register, handleSubmit, formState: { errors } } = useForm<PersonalEditForm>({
    resolver: zodResolver(personalEditSchema),
    defaultValues: {
      panEncrypted: "",
      personalPhone: emp.personalPhone ?? "",
      officialPhone: emp.officialPhone ?? "",
      personalEmail: emp.personalEmail ?? "",
      maritalStatus: emp.maritalStatus ?? "",
      bloodGroup: emp.bloodGroup ?? "",
      religion: emp.religion ?? "",
      currentAddress: {
        line1: addr.line1 ?? "",
        line2: addr.line2 ?? "",
        city: addr.city ?? "",
        state: addr.state ?? "",
        pincode: addr.pincode ?? "",
        country: addr.country ?? "India",
      },
      permanentAddress: perm ? {
        line1: perm.line1 ?? "",
        line2: perm.line2 ?? "",
        city: perm.city ?? "",
        state: perm.state ?? "",
        pincode: perm.pincode ?? "",
        country: perm.country ?? "India",
      } : undefined,
      emergencyContactName: emp.emergencyContactName ?? "",
      emergencyContactPhone: emp.emergencyContactPhone ?? "",
      emergencyRelation: emp.emergencyRelation ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: PersonalEditForm) => {
      const payload: Record<string, any> = { ...data };
      if (!payload.panEncrypted) delete payload.panEncrypted;
      else payload.panEncrypted = payload.panEncrypted.toUpperCase();
      if (!payload.personalPhone) delete payload.personalPhone;
      if (!payload.officialPhone) delete payload.officialPhone;
      if (!payload.personalEmail) delete payload.personalEmail;
      if (!payload.maritalStatus) delete payload.maritalStatus;
      if (!payload.bloodGroup) delete payload.bloodGroup;
      if (!payload.currentAddress?.line1) delete payload.currentAddress;
      if (!payload.permanentAddress?.line1) delete payload.permanentAddress;
      if (!payload.emergencyContactName) delete payload.emergencyContactName;
      if (!payload.emergencyContactPhone) delete payload.emergencyContactPhone;
      if (!payload.emergencyRelation) delete payload.emergencyRelation;
      return api.patch(`/api/v1/employees/${employeeId}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee", employeeId] });
      toast.success("Profile updated");
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Update failed"),
  });

  function ErrMsg({ err }: { err?: { message?: string } }) {
    return err?.message ? <p className="text-xs text-red-500 mt-0.5">{err.message}</p> : null;
  }

  function FInput({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</label>
        <input
          {...props}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>
    );
  }

  function FSelect({ label, children, ...props }: { label: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</label>
        <select {...props} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
          {children}
        </select>
      </div>
    );
  }

  function AddressFields({ prefix }: { prefix: "currentAddress" | "permanentAddress" }) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <FInput label="Line 1" {...register(`${prefix}.line1` as any)} />
          <ErrMsg err={(errors as any)[prefix]?.line1} />
        </div>
        <FInput label="Line 2 (optional)" {...register(`${prefix}.line2` as any)} />
        <div>
          <FInput label="City" {...register(`${prefix}.city` as any)} />
          <ErrMsg err={(errors as any)[prefix]?.city} />
        </div>
        <div>
          <FInput label="State" {...register(`${prefix}.state` as any)} />
          <ErrMsg err={(errors as any)[prefix]?.state} />
        </div>
        <div>
          <FInput label="Pincode" maxLength={6} {...register(`${prefix}.pincode` as any)} />
          <ErrMsg err={(errors as any)[prefix]?.pincode} />
        </div>
        <FInput label="Country" {...register(`${prefix}.country` as any)} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">

      {/* Contact */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Contact</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <FInput label="Personal Phone" maxLength={10} {...register("personalPhone")} />
            <ErrMsg err={errors.personalPhone} />
          </div>
          <FInput label="Official Phone" maxLength={10} {...register("officialPhone")} />
          <FInput label="Personal Email" type="email" {...register("personalEmail")} />
        </div>
      </div>

      {/* PAN */}
      <div className="rounded-xl border border-amber-100 bg-amber-50 p-5">
        <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">PAN Number <span className="text-red-500">*</span></h3>
        {emp.pan
          ? <p className="text-xs text-amber-600 mb-3">PAN on file: <span className="font-mono font-semibold">{emp.pan}</span> — enter below only if updating</p>
          : <p className="text-xs text-red-600 font-medium mb-3">PAN not on file — please enter your PAN number</p>
        }
        <div className="max-w-xs">
          <FInput
            label=""
            placeholder={emp.pan ? "Enter new PAN to update" : "e.g. ABCDE1234F (required)"}
            maxLength={10}
            {...register("panEncrypted")}
          />
          <ErrMsg err={errors.panEncrypted} />
        </div>
      </div>

      {/* Personal details */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Personal Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <FSelect label="Marital Status" {...register("maritalStatus")}>
            <option value="">— Not specified —</option>
            {["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </FSelect>
          <FSelect label="Blood Group" {...register("bloodGroup")}>
            <option value="">— Not specified —</option>
            {["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"].map((v) => (
              <option key={v} value={v}>{v.replace("_", " ")}</option>
            ))}
          </FSelect>
          <FInput label="Religion" {...register("religion")} />
        </div>
      </div>

      {/* Current Address */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Current Address</h3>
        <AddressFields prefix="currentAddress" />
      </div>

      {/* Permanent Address */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Permanent Address <span className="font-normal text-gray-400 normal-case">(optional)</span></h3>
        <AddressFields prefix="permanentAddress" />
      </div>

      {/* Emergency Contact */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Emergency Contact</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <FInput label="Name" {...register("emergencyContactName")} />
            <ErrMsg err={errors.emergencyContactName} />
          </div>
          <div>
            <FInput label="Phone" maxLength={10} {...register("emergencyContactPhone")} />
            <ErrMsg err={errors.emergencyContactPhone} />
          </div>
          <div>
            <FInput label="Relation" {...register("emergencyRelation")} />
            <ErrMsg err={errors.emergencyRelation} />
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-end sticky bottom-0 bg-white border-t border-gray-100 py-4 -mx-1 px-1">
        <button type="button" onClick={onClose} className="px-5 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="inline-flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          <Check className="h-4 w-4" />
          {mutation.isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

// ─── Document upload card ─────────────────────────────────────────────────────

const KYC_DOC_TYPES = ["PASSPORT_PHOTO", "PAN_CARD", "AADHAAR_CARD", "ADDRESS_PROOF"];
const EDU_DOC_TYPES  = ["UG_DEGREE", "PG_DEGREE", "DOCTORATE_DEGREE", "BED_DEGREE"];

const DOC_LABELS: Record<string, { label: string; accept: string; hint: string }> = {
  PASSPORT_PHOTO:   { label: "Passport Photo",        accept: "image/jpeg,image/png,image/webp",                       hint: "JPG/PNG · max 5 MB" },
  PAN_CARD:         { label: "PAN Card",               accept: "image/jpeg,image/png,image/webp,application/pdf",       hint: "JPG/PNG/PDF · max 5 MB" },
  AADHAAR_CARD:     { label: "Aadhaar Card",           accept: "image/jpeg,image/png,image/webp,application/pdf",       hint: "JPG/PNG/PDF · max 5 MB" },
  ADDRESS_PROOF:    { label: "Address Proof",          accept: "image/jpeg,image/png,image/webp,application/pdf",       hint: "JPG/PNG/PDF · max 5 MB" },
  UG_DEGREE:        { label: "Undergraduate Degree",   accept: "image/jpeg,image/png,image/webp,application/pdf",       hint: "JPG/PNG/PDF · max 5 MB" },
  PG_DEGREE:        { label: "Post Graduate Degree",   accept: "image/jpeg,image/png,image/webp,application/pdf",       hint: "JPG/PNG/PDF · max 5 MB" },
  DOCTORATE_DEGREE: { label: "Doctorate Degree",       accept: "image/jpeg,image/png,image/webp,application/pdf",       hint: "JPG/PNG/PDF · max 5 MB" },
  BED_DEGREE:       { label: "B.Ed Degree",            accept: "image/jpeg,image/png,image/webp,application/pdf",       hint: "JPG/PNG/PDF · max 5 MB" },
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function DocumentCard({
  docType,
  employeeId,
  existing,
  canWrite = false,
}: {
  docType: string;
  employeeId: string;
  existing?: { id: string; fileUrl: string; mimeType?: string; fileName: string } | null;
  canWrite?: boolean;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { label, accept, hint } = DOC_LABELS[docType];
  const [uploading, setUploading] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/v1/employees/${employeeId}/documents/${existing!.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", employeeId] });
      toast.success(`${label} removed`);
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Delete failed"),
  });

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("type", docType);
      fd.append("label", label);
      fd.append("file", file); // file must come last so multipart fields are readable
      const token = localStorage.getItem("cadb_access_token");
      const res = await fetch(`${API_BASE}/api/v1/employees/${employeeId}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Upload failed");
      }
      qc.invalidateQueries({ queryKey: ["documents", employeeId] });
      toast.success(`${label} uploaded`);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const isImage = existing?.mimeType?.startsWith("image/");
  const previewUrl = existing ? `${API_BASE}${existing.fileUrl}` : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">{label}</span>
        {existing && (
          <div className="flex items-center gap-1.5">
            <a
              href={previewUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <Eye className="h-3.5 w-3.5" /> View
            </a>
            {canWrite && (
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </div>
        )}
      </div>

      <div className="p-4">
        {existing ? (
          isImage ? (
            <img
              src={previewUrl!}
              alt={label}
              className="w-full h-32 object-cover rounded-lg border border-gray-100"
            />
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <FileText className="h-8 w-8 text-blue-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-blue-700 truncate">{existing.fileName}</p>
                <p className="text-xs text-blue-400">PDF document</p>
              </div>
            </div>
          )
        ) : canWrite ? (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full flex flex-col items-center gap-2 py-6 border-2 border-dashed border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {uploading ? (
              <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload className="h-6 w-6 text-gray-400" />
            )}
            <span className="text-xs text-gray-500">{uploading ? "Uploading..." : `Click to upload · ${hint}`}</span>
          </button>
        ) : (
          <div className="py-6 text-center text-xs text-gray-400">No document uploaded.</div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
            e.target.value = "";
          }}
        />

        {existing && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mt-2 w-full text-xs text-center text-blue-600 hover:underline disabled:opacity-50"
          >
            Replace file
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Other Documents Section ─────────────────────────────────────────────────

function OtherDocumentsSection({ employeeId, docs, canWrite = false }: { employeeId: string; docs: any[]; canWrite?: boolean }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => api.delete(`/api/v1/employees/${employeeId}/documents/${docId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["documents", employeeId] }); toast.success("Document removed"); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Delete failed"),
  });

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("type", "OTHER");
      fd.append("label", file.name);
      fd.append("file", file);
      const token = localStorage.getItem("cadb_access_token");
      const res = await fetch(`${API_BASE}/api/v1/employees/${employeeId}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Upload failed"); }
      qc.invalidateQueries({ queryKey: ["documents", employeeId] });
      toast.success("Document uploaded");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">Other Documents</span>
        {canWrite && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
          >
            {uploading ? <div className="h-3.5 w-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Add Document
          </button>
        )}
      </div>

      <div className="divide-y divide-gray-100">
        {docs.length === 0 && !uploading && (
          <div className="px-4 py-6 text-center text-xs text-gray-400">No other documents uploaded yet.</div>
        )}
        {docs.map((d) => (
          <div key={d.id} className="flex items-center justify-between px-4 py-3 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="h-5 w-5 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{d.label || d.fileName}</p>
                <p className="text-xs text-gray-400 truncate">{d.fileName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a href={`${API_BASE}${d.fileUrl}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                <Eye className="h-3.5 w-3.5" /> View
              </a>
              {canWrite && (
                <button
                  onClick={() => deleteMutation.mutate(d.id)}
                  disabled={deleteMutation.isPending}
                  className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
    </div>
  );
}

// ─── Monthly Receivables ──────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function computeNetMonthly(salaryConfig: any): { net: number; dailyRate: number } {
  if (!salaryConfig) return { net: 0, dailyRate: 0 };
  const c = salaryConfig.config as any;
  const type = salaryConfig.employmentType as string;

  if (type === "FULL_TIME") {
    const ctcM      = (c.ctcAnnual ?? 0) / 12;
    const basicPct  = c.basicPct ?? 40;
    const hraPct    = c.hraPct   ?? 50;
    const basic     = ctcM * basicPct / 100;
    const hra       = basic * hraPct / 100;
    const conv      = c.conveyance ?? 0;
    const med       = c.medical    ?? 0;
    const specAllow = Math.max(0, ctcM - basic - hra - conv - med - (c.pfApplicable ? Math.round(Math.min(basic, 15000) * 0.13) : 0));
    const gross     = basic + hra + conv + med + specAllow;
    const pfEmp     = c.pfApplicable ? Math.round(Math.min(basic, 15000) * 0.12) : 0;
    const esicEmp   = c.esicApplicable && gross <= 21000 ? Math.round(gross * 0.0075) : 0;
    const net       = gross - pfEmp - esicEmp - (c.professionalTax ?? 0) - (c.monthlyTDS ?? 0);
    return { net: Math.round(net), dailyRate: Math.round(net / 26) };
  }
  if (type === "CONTRACT" || type === "INTERN") {
    const ret = c.retainershipPerMonth ?? 0;
    const net = ret - Math.round(ret * 0.10) + (c.travelAllowancePerMonth ?? 0);
    return { net: Math.round(net), dailyRate: Math.round(net / 26) };
  }
  // PART_TIME / VISITING — variable
  return { net: 0, dailyRate: 0 };
}

function ReceivableRow({ label, value, sub, variant = "neutral" }: {
  label: string; value: string; sub?: string; variant?: "earn" | "deduct" | "neutral" | "total";
}) {
  const valCls = variant === "earn"   ? "text-green-700 font-semibold"
               : variant === "deduct" ? "text-red-600 font-semibold"
               : variant === "total"  ? "text-blue-700 font-bold text-base"
               : "text-gray-800";
  return (
    <div className={`flex justify-between py-2 text-sm border-b border-gray-50 last:border-0 ${variant === "total" ? "border-t border-gray-200 mt-1 pt-3" : ""}`}>
      <div>
        <span className="text-gray-600">{label}</span>
        {sub && <span className="block text-xs text-gray-400">{sub}</span>}
      </div>
      <span className={valCls}>{value}</span>
    </div>
  );
}

function MonthlyReceivables({ employeeId, salaryConfig }: { employeeId: string; salaryConfig: any }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ["monthly-receivables", employeeId, month, year],
    queryFn: () => api.get(`/api/v1/employees/${employeeId}/monthly-receivables?month=${month}&year=${year}`)
      .then((r) => r.data.data),
  });

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    const next = new Date(year, month, 1);
    if (next > now) return;
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  const { net, dailyRate } = computeNetMonthly(salaryConfig);
  const isVariable = salaryConfig && ["PART_TIME", "VISITING"].includes(salaryConfig.employmentType);

  const claimsTotal  = data?.claims?.total ?? 0;
  const lopDays      = data?.lop?.days ?? 0;
  const lopDeduction = Math.round(lopDays * dailyRate);
  const bonusTotal   = data?.bonus?.total ?? 0;
  const misc         = data?.miscellaneous ?? 0;
  const total        = net + claimsTotal - lopDeduction + bonusTotal + misc;

  if (!salaryConfig) return null;

  const monthNav = (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button onClick={prevMonth} className="p-1 rounded hover:bg-indigo-100 text-indigo-600">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm font-semibold text-indigo-800 min-w-[90px] text-center">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <button onClick={nextMonth} disabled={isCurrentMonth} className="p-1 rounded hover:bg-indigo-100 text-indigo-600 disabled:opacity-30">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="rounded-xl border border-indigo-200 bg-white overflow-hidden">
      {/* Custom header with month navigator */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-indigo-100 bg-indigo-50">
        <TrendingUp className="h-4 w-4 text-indigo-500 shrink-0" />
        <span className="font-semibold text-indigo-900 text-sm flex-1">Monthly Receivables</span>
        {monthNav}
      </div>

      <div className="px-5 py-4">
        {isVariable ? (
          <p className="text-sm text-gray-400 italic py-4 text-center">
            Monthly receivable varies by hours / visits — not applicable for this employment type.
          </p>
        ) : isLoading ? (
          <div className="space-y-2 animate-pulse py-2">
            {[1,2,3,4].map((i) => <div key={i} className="h-6 bg-gray-100 rounded" />)}
          </div>
        ) : (
          <div className="space-y-0">
            <ReceivableRow
              label="Net Monthly Salary"
              sub="After all statutory deductions"
              value={formatCurrency(net)}
            />

            <ReceivableRow
              label={`+ Approved Claims${data?.claims?.items?.length ? ` (${data.claims.items.length})` : ""}`}
              sub={data?.claims?.items?.length
                ? data.claims.items.map((c: any) => `${c.claimNumber}: ${formatCurrency(c.approvedAmount ?? c.claimedAmount)}`).join(" · ")
                : "No approved claims this month"}
              value={claimsTotal > 0 ? `+${formatCurrency(claimsTotal)}` : formatCurrency(0)}
              variant={claimsTotal > 0 ? "earn" : "neutral"}
            />

            <ReceivableRow
              label={lopDays > 0 ? `− Loss of Pay (${lopDays} day${lopDays > 1 ? "s" : ""})` : "− Loss of Pay"}
              sub={lopDays > 0
                ? `${formatCurrency(dailyRate)}/day × ${lopDays} day${lopDays > 1 ? "s" : ""}`
                : "No LOP this month"}
              value={lopDeduction > 0 ? `−${formatCurrency(lopDeduction)}` : formatCurrency(0)}
              variant={lopDeduction > 0 ? "deduct" : "neutral"}
            />

            <ReceivableRow
              label={`+ Performance Bonus${data?.bonus?.items?.length ? ` (${data.bonus.items.length} payout${data.bonus.items.length > 1 ? "s" : ""})` : ""}`}
              sub={data?.bonus?.items?.length
                ? data.bonus.items.map((p: any) => `${p.plan?.title ?? "Bonus"}: ${formatCurrency(p.amount)}`).join(" · ")
                : "No bonus payouts scheduled this month"}
              value={bonusTotal > 0 ? `+${formatCurrency(bonusTotal)}` : formatCurrency(0)}
              variant={bonusTotal > 0 ? "earn" : "neutral"}
            />

            {misc !== 0 && (
              <ReceivableRow
                label={misc > 0 ? "+ Miscellaneous" : "− Miscellaneous"}
                value={misc > 0 ? `+${formatCurrency(misc)}` : `−${formatCurrency(Math.abs(misc))}`}
                variant={misc > 0 ? "earn" : "deduct"}
              />
            )}

            <div className="flex justify-between pt-3 mt-2 border-t-2 border-indigo-200">
              <span className="text-sm font-bold text-indigo-900">Total Receivable</span>
              <span className="text-lg font-bold text-indigo-700">{formatCurrency(total)}</span>
            </div>

            <p className="text-xs text-gray-400 mt-2">
              Bonus reflects scheduled payouts set by the appraising authority.
              Claims include amounts approved in {MONTH_NAMES[month - 1]} {year}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Salary config display ────────────────────────────────────────────────────

function SalaryRow({ label, value, highlight }: { label: string; value: string; highlight?: "earn" | "deduct" | "net" }) {
  const cls = highlight === "earn" ? "text-green-700 font-semibold"
    : highlight === "deduct" ? "text-red-600 font-semibold"
    : highlight === "net" ? "text-blue-700 font-bold text-base"
    : "text-gray-800";
  return (
    <div className="flex justify-between py-1.5 text-sm border-b border-gray-50 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className={cls}>{value}</span>
    </div>
  );
}

// ─── Bonus Plans Card ─────────────────────────────────────────────────────────

const FREQ_LABEL: Record<string, string> = {
  MONTHLY: "Monthly", QUARTERLY: "Quarterly", HALF_YEARLY: "Half-Yearly", YEARLY: "Annual", CUSTOM: "Custom",
};
const FREQ_COLOR: Record<string, string> = {
  MONTHLY: "bg-blue-100 text-blue-700", QUARTERLY: "bg-purple-100 text-purple-700",
  HALF_YEARLY: "bg-indigo-100 text-indigo-700", YEARLY: "bg-orange-100 text-orange-700",
  CUSTOM: "bg-gray-100 text-gray-700",
};
const PAYOUT_STATUS_COLOR: Record<string, string> = {
  SCHEDULED: "bg-yellow-100 text-yellow-700", PAID: "bg-green-100 text-green-700", CANCELLED: "bg-gray-100 text-gray-500",
};

function CustomPayoutRow({
  planId, active, budgetExhausted, remaining, onOpen, onClose, onChange, onSubmit, isPending,
}: {
  planId: string;
  active: { planId: string; amount: string; scheduledDate: string; notes: string } | null;
  budgetExhausted: boolean;
  remaining: number;
  onOpen: () => void;
  onClose: () => void;
  onChange: (patch: Partial<{ amount: string; scheduledDate: string; notes: string }>) => void;
  onSubmit: (p: { planId: string; amount: number; scheduledDate: string; notes?: string }) => void;
  isPending: boolean;
}) {
  if (!active) {
    if (budgetExhausted) {
      return (
        <p className="text-xs text-red-500 font-medium">Budget fully allocated — no more payouts can be added.</p>
      );
    }
    return (
      <button onClick={onOpen} className="text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1">
        <Plus className="h-3 w-3" /> Add payout entry
        <span className="text-gray-400 font-normal">({formatCurrency(remaining)} left)</span>
      </button>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2 mt-2">
      <input
        type="number" placeholder="Amount (₹)"
        value={active.amount}
        onChange={(e) => onChange({ amount: e.target.value })}
        className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400"
      />
      <input
        type="date"
        value={active.scheduledDate}
        onChange={(e) => onChange({ scheduledDate: e.target.value })}
        className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400"
      />
      <div className="flex gap-1 items-center">
        <button
          onClick={() => onSubmit({
            planId,
            amount: parseFloat(active.amount),
            scheduledDate: new Date(active.scheduledDate).toISOString(),
            notes: active.notes || undefined,
          })}
          disabled={isPending || !active.amount || !active.scheduledDate || parseFloat(active.amount || "0") > remaining + 0.001}
          className="rounded-lg bg-amber-500 text-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-600 disabled:opacity-50"
        >Add</button>
        <button onClick={onClose} className="text-xs text-gray-400 px-2">✕</button>
        {active.amount && parseFloat(active.amount) > remaining + 0.001 && (
          <span className="text-xs text-red-500 font-medium">Exceeds budget by {formatCurrency(parseFloat(active.amount) - remaining)}</span>
        )}
      </div>
    </div>
  );
}

function BonusPlansCard({
  employeeId, canAppraise,
}: { employeeId: string; canAppraise: boolean; }) {
  const isReadOnly = !canAppraise;
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", totalAmount: "", frequency: "YEARLY" as string,
    effectiveFrom: "", effectiveTo: "", notes: "",
  });
  const [customPayout, setCustomPayout] = useState<{ planId: string; amount: string; scheduledDate: string; notes: string } | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["bonus-plans", employeeId],
    queryFn: () => api.get(`/api/v1/employees/${employeeId}/bonus-plans`).then((r) => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: () => api.post(`/api/v1/employees/${employeeId}/bonus-plans`, {
      title: form.title, totalAmount: parseFloat(form.totalAmount), frequency: form.frequency,
      effectiveFrom: form.effectiveFrom ? new Date(form.effectiveFrom).toISOString() : undefined,
      effectiveTo: form.effectiveTo ? new Date(form.effectiveTo).toISOString() : undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      toast.success("Bonus plan created");
      setShowForm(false);
      setForm({ title: "", totalAmount: "", frequency: "YEARLY", effectiveFrom: "", effectiveTo: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["bonus-plans", employeeId] });
      qc.invalidateQueries({ queryKey: ["monthly-receivables", employeeId] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ planId, status }: { planId: string; status: string }) =>
      api.patch(`/api/v1/bonus-plans/${planId}`, { status }),
    onSuccess: () => { toast.success("Plan updated"); qc.invalidateQueries({ queryKey: ["bonus-plans", employeeId] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const addPayoutMut = useMutation({
    mutationFn: ({ planId, amount, scheduledDate, notes }: { planId: string; amount: number; scheduledDate: string; notes?: string }) =>
      api.post(`/api/v1/bonus-plans/${planId}/payouts`, { amount, scheduledDate, notes }),
    onSuccess: () => {
      toast.success("Payout entry added");
      setCustomPayout(null);
      qc.invalidateQueries({ queryKey: ["bonus-plans", employeeId] });
      qc.invalidateQueries({ queryKey: ["monthly-receivables", employeeId] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const markPaidMut = useMutation({
    mutationFn: (payoutId: string) => api.patch(`/api/v1/bonus-payouts/${payoutId}/pay`),
    onSuccess: () => {
      toast.success("Marked as paid");
      qc.invalidateQueries({ queryKey: ["bonus-plans", employeeId] });
      qc.invalidateQueries({ queryKey: ["monthly-receivables", employeeId] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const cancelPayoutMut = useMutation({
    mutationFn: (payoutId: string) => api.patch(`/api/v1/bonus-payouts/${payoutId}/cancel`),
    onSuccess: () => {
      toast.success("Payout cancelled");
      qc.invalidateQueries({ queryKey: ["bonus-plans", employeeId] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const activePlans = (plans ?? []).filter((p: any) => p.status !== "COMPLETED");
  const badge = activePlans.length > 0
    ? <span className="rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5">{activePlans.length} active</span>
    : null;

  const addAction = canAppraise ? (
    <button
      onClick={() => setShowForm((s) => !s)}
      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
    >
      <Plus className="h-3.5 w-3.5" /> New Plan
    </button>
  ) : (
    <span className="text-xs text-gray-400 italic">Set by appraising authority</span>
  );

  return (
    <CollapsibleCard title="Bonus Plans" icon={Star} badge={badge} action={addAction} defaultOpen={true}>
      {/* New plan form */}
      {showForm && canAppraise && (
        <div className="px-5 py-4 border-b border-gray-100 bg-amber-50 space-y-3">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">New Bonus Plan</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <input
                placeholder="Plan title (e.g. Performance Bonus FY2026)"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>
            <input
              type="number" placeholder="Total amount (₹)"
              value={form.totalAmount}
              onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
            />
            <select
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value })}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none bg-white"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="HALF_YEARLY">Half-Yearly</option>
              <option value="YEARLY">Annual</option>
              <option value="CUSTOM">Custom (manual entries)</option>
            </select>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Effective From</label>
              <input
                type="date" value={form.effectiveFrom}
                onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Effective To (optional)</label>
              <input
                type="date" value={form.effectiveTo}
                onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <textarea
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none resize-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !form.title || !form.totalAmount || !form.effectiveFrom}
              className="rounded-lg bg-amber-500 text-white px-4 py-1.5 text-sm font-semibold hover:bg-amber-600 disabled:opacity-50"
            >
              {createMut.isPending ? "Creating…" : "Create Plan"}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-2">Cancel</button>
          </div>
          {form.frequency !== "CUSTOM" && form.totalAmount && form.effectiveFrom && (
            <p className="text-xs text-amber-700 bg-amber-100 rounded px-3 py-1.5">
              Payouts will be auto-generated at {FREQ_LABEL[form.frequency].toLowerCase()} intervals.
            </p>
          )}
        </div>
      )}

      {/* Plans list */}
      {isLoading ? (
        <div className="px-5 py-6 space-y-2 animate-pulse">
          {[1, 2].map((i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
        </div>
      ) : !plans?.length ? (
        <div className="py-8 text-center text-sm text-gray-400">
          {canAppraise ? "No bonus plans yet. Use 'New Plan' to create one." : "No bonus plans have been set by your appraiser yet."}
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {(plans as any[]).map((plan) => {
            const isExpanded = expandedPlan === plan.id;
            const scheduled = plan.payouts?.filter((p: any) => p.status === "SCHEDULED") ?? [];
            const paid = plan.payouts?.filter((p: any) => p.status === "PAID") ?? [];
            const committed = (plan.payouts as any[] ?? [])
              .filter((p) => p.status !== "CANCELLED")
              .reduce((s: number, p: any) => s + p.amount, 0);
            const remaining = plan.totalAmount - committed;
            const budgetExhausted = remaining <= 0.001;
            return (
              <div key={plan.id}>
                <button
                  type="button"
                  onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800 truncate">{plan.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${FREQ_COLOR[plan.frequency]}`}>
                        {FREQ_LABEL[plan.frequency]}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        plan.status === "ACTIVE" ? "bg-green-100 text-green-700"
                        : plan.status === "PAUSED" ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-500"
                      }`}>{plan.status}</span>
                      {plan.frequency === "CUSTOM" && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${budgetExhausted ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"}`}>
                          {budgetExhausted ? "Budget full" : `${formatCurrency(remaining)} remaining`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatCurrency(plan.totalAmount)} total · {plan.appraiser?.firstName} {plan.appraiser?.lastName} · {scheduled.length} scheduled · {paid.length} paid
                    </p>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-50 bg-gray-50 px-5 py-4 space-y-3">
                    {plan.notes && <p className="text-xs text-gray-500 italic">{plan.notes}</p>}

                    {/* Payout schedule */}
                    {plan.payouts?.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payout Schedule</p>
                        {(plan.payouts as any[]).map((payout) => (
                          <div key={payout.id} className="flex items-center gap-2 text-sm py-1">
                            <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            <span className="flex-1 text-gray-700">
                              {new Date(payout.scheduledDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                            <span className="font-semibold text-gray-800">{formatCurrency(payout.amount)}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PAYOUT_STATUS_COLOR[payout.status]}`}>
                              {payout.status}
                            </span>
                            {canAppraise && payout.status === "SCHEDULED" && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => markPaidMut.mutate(payout.id)}
                                  disabled={markPaidMut.isPending}
                                  className="text-xs text-green-600 hover:text-green-800 font-medium"
                                >Mark paid</button>
                                <span className="text-gray-300">·</span>
                                <button
                                  onClick={() => cancelPayoutMut.mutate(payout.id)}
                                  disabled={cancelPayoutMut.isPending}
                                  className="text-xs text-red-500 hover:text-red-700 font-medium"
                                >Cancel</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">No payouts scheduled yet.</p>
                    )}

                    {/* Add custom payout */}
                    {canAppraise && plan.frequency === "CUSTOM" && (
                      <CustomPayoutRow
                        planId={plan.id}
                        active={customPayout?.planId === plan.id ? customPayout : null}
                        budgetExhausted={budgetExhausted}
                        remaining={remaining}
                        onOpen={() => setCustomPayout({ planId: plan.id, amount: "", scheduledDate: "", notes: "" })}
                        onClose={() => setCustomPayout(null)}
                        onChange={(patch) => setCustomPayout((prev) => prev ? { ...prev, ...patch } : prev)}
                        onSubmit={(p) => addPayoutMut.mutate(p)}
                        isPending={addPayoutMut.isPending}
                      />
                    )}

                    {/* Plan status actions */}
                    {canAppraise && (
                      <div className="flex gap-2 pt-1 border-t border-gray-100">
                        {plan.status === "ACTIVE" && (
                          <button
                            onClick={() => updateStatusMut.mutate({ planId: plan.id, status: "PAUSED" })}
                            className="text-xs text-yellow-600 hover:text-yellow-800 font-medium"
                          >Pause plan</button>
                        )}
                        {plan.status === "PAUSED" && (
                          <button
                            onClick={() => updateStatusMut.mutate({ planId: plan.id, status: "ACTIVE" })}
                            className="text-xs text-green-600 hover:text-green-800 font-medium"
                          >Resume plan</button>
                        )}
                        {plan.status !== "COMPLETED" && (
                          <button
                            onClick={() => { if (confirm("Mark this plan as completed?")) updateStatusMut.mutate({ planId: plan.id, status: "COMPLETED" }); }}
                            className="text-xs text-gray-400 hover:text-gray-600 font-medium"
                          >Mark complete</button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </CollapsibleCard>
  );
}

// ─── Tax helpers (FY 2025-26) ────────────────────────────────────────────────

interface TaxResult {
  grossAnnual: number; stdDed: number; totalDed: number;
  taxableIncome: number; taxBeforeRebate: number;
  rebate: number; cess: number; totalAnnual: number; monthly: number;
}
function _slabTax(income: number, slabs: { upto: number; rate: number }[]): number {
  let tax = 0; let prev = 0;
  for (const s of slabs) {
    if (income <= prev) break;
    tax += (Math.min(income, s.upto) - prev) * s.rate;
    prev = s.upto;
  }
  return tax;
}
function calcNewRegimeTax(grossAnnual: number): TaxResult {
  const stdDed = 75000;
  const taxableIncome = Math.max(0, grossAnnual - stdDed);
  const taxBeforeRebate = Math.round(_slabTax(taxableIncome, [
    { upto: 400000, rate: 0 }, { upto: 800000, rate: 0.05 }, { upto: 1200000, rate: 0.10 },
    { upto: 1600000, rate: 0.15 }, { upto: 2000000, rate: 0.20 }, { upto: 2400000, rate: 0.25 },
    { upto: Infinity, rate: 0.30 },
  ]));
  const rebate = taxableIncome <= 1200000 ? taxBeforeRebate : 0;
  const cess   = Math.round((taxBeforeRebate - rebate) * 0.04);
  return { grossAnnual, stdDed, totalDed: stdDed, taxableIncome, taxBeforeRebate, rebate, cess, totalAnnual: taxBeforeRebate - rebate + cess, monthly: Math.round((taxBeforeRebate - rebate + cess) / 12) };
}
function calcOldRegimeTax(grossAnnual: number, hraExempt: number, ded80c: number, ded80d: number, profTaxAnnual: number): TaxResult {
  const stdDed = 50000;
  const cap80c = Math.min(ded80c, 150000);
  const cap80d = Math.min(ded80d, 100000);
  const totalDed = stdDed + hraExempt + cap80c + cap80d + profTaxAnnual;
  const taxableIncome = Math.max(0, grossAnnual - totalDed);
  const taxBeforeRebate = Math.round(_slabTax(taxableIncome, [
    { upto: 250000, rate: 0 }, { upto: 500000, rate: 0.05 }, { upto: 1000000, rate: 0.20 }, { upto: Infinity, rate: 0.30 },
  ]));
  const rebate = taxableIncome <= 500000 ? Math.min(taxBeforeRebate, 12500) : 0;
  const cess   = Math.round((taxBeforeRebate - rebate) * 0.04);
  return { grossAnnual, stdDed, totalDed, taxableIncome, taxBeforeRebate, rebate, cess, totalAnnual: taxBeforeRebate - rebate + cess, monthly: Math.round((taxBeforeRebate - rebate + cess) / 12) };
}

// ─── Salary Edit Form ─────────────────────────────────────────────────────────

type BonusCriteria = { name: string; weightage: string; description: string };

function SalaryFLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{children}{required && <span className="text-red-400 ml-0.5">*</span>}</label>;
}
function SalaryFInput({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white" />;
}

function SalaryEditForm({
  employeeId,
  employmentType,
  existing,
  onClose,
}: {
  employeeId: string;
  employmentType: string;
  existing?: any;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const c = existing?.config ?? {};

  const [selectedType, setSelectedType] = useState(employmentType);

  function fmtN(n: number) { return n.toLocaleString("en-IN", { maximumFractionDigits: 0 }); }

  // ── Full-Time state ──────────────────────────────────────────────────────────
  const [ft, setFt] = useState({
    ctcAnnual:          String(c.ctcAnnual    ?? ""),
    basicPct:           String(c.basicPct     ?? 40),
    hraPct:             String(c.hraPct       ?? 50),
    conveyance:         String(c.conveyance   ?? 1600),
    medical:            String(c.medical      ?? 1250),
    pfApplicable:       c.pfApplicable   ?? true,
    esicApplicable:     c.esicApplicable ?? false,
    professionalTax:    String(c.professionalTax ?? 200),
    taxRegime:          (c.taxRegime     ?? "new") as "new" | "old",
    monthlyTDS:         String(c.monthlyTDS   ?? ""),
    tdsOverride:        !!(c.monthlyTDS && c.monthlyTDS > 0),
    oldRegimeHRAExempt: String(c.oldRegimeHRAExempt ?? ""),
    oldRegime80C:       String(c.oldRegime80C ?? 150000),
    oldRegime80D:       String(c.oldRegime80D ?? 25000),
    bonusPct:           String(c.bonusPct ?? 10),
    bonusCriteria:      (c.bonusCriteria ?? []) as BonusCriteria[],
  });

  // ── Part-Time state ──────────────────────────────────────────────────────────
  const [pt, setPt] = useState({
    lectureRatePerHour:         String(c.lectureRatePerHour         ?? ""),
    ptmRatePerHour:             String(c.ptmRatePerHour             ?? ""),
    answerScriptRatePerStudent: String(c.answerScriptRatePerStudent ?? ""),
  });

  // ── Contract / Intern state ──────────────────────────────────────────────────
  const [ct, setCt] = useState({
    retainershipPerMonth:    String(c.retainershipPerMonth    ?? ""),
    travelAllowancePerMonth: String(c.travelAllowancePerMonth ?? ""),
  });

  // ── Visiting state ───────────────────────────────────────────────────────────
  const [vi, setVi] = useState({
    remunerationPerVisit: String(c.remunerationPerVisit ?? ""),
  });

  // Bonus criteria editing
  const [expandedCriteria, setExpandedCriteria] = useState<number | null>(null);
  function addCriteria() {
    const next = ft.bonusCriteria.length;
    setFt({ ...ft, bonusCriteria: [...ft.bonusCriteria, { name: "", weightage: "", description: "" }] });
    setExpandedCriteria(next);
  }
  function removeCriteria(i: number) {
    setFt({ ...ft, bonusCriteria: ft.bonusCriteria.filter((_, j) => j !== i) });
    setExpandedCriteria(null);
  }
  function updateCriteria(i: number, field: keyof BonusCriteria, val: string) {
    setFt({ ...ft, bonusCriteria: ft.bonusCriteria.map((bc, j) => j === i ? { ...bc, [field]: val } : bc) });
  }

  const mutation = useMutation({
    mutationFn: () => {
      let config: Record<string, unknown> = {};
      const type = selectedType;
      if (type === "FULL_TIME") {
        config = {
          ctcAnnual:          parseFloat(ft.ctcAnnual)          || 0,
          basicPct:           parseFloat(ft.basicPct)           || 40,
          hraPct:             parseFloat(ft.hraPct)             || 50,
          conveyance:         parseFloat(ft.conveyance)         || 0,
          medical:            parseFloat(ft.medical)            || 0,
          pfApplicable:       ft.pfApplicable,
          esicApplicable:     ft.esicApplicable,
          professionalTax:    parseFloat(ft.professionalTax)    || 0,
          taxRegime:          ft.taxRegime,
          monthlyTDS:         ft.tdsOverride ? (parseFloat(ft.monthlyTDS) || 0) : 0,
          oldRegimeHRAExempt: parseFloat(ft.oldRegimeHRAExempt) || 0,
          oldRegime80C:       parseFloat(ft.oldRegime80C)       || 150000,
          oldRegime80D:       parseFloat(ft.oldRegime80D)       || 25000,
          bonusPct:           parseFloat(ft.bonusPct)           || 0,
          bonusCriteria:      ft.bonusCriteria,
        };
      } else if (type === "PART_TIME") {
        config = {
          lectureRatePerHour:         parseFloat(pt.lectureRatePerHour)         || 0,
          ptmRatePerHour:             parseFloat(pt.ptmRatePerHour)             || 0,
          answerScriptRatePerStudent: parseFloat(pt.answerScriptRatePerStudent) || 0,
        };
      } else if (type === "CONTRACT" || type === "INTERN") {
        config = {
          retainershipPerMonth:    parseFloat(ct.retainershipPerMonth)    || 0,
          travelAllowancePerMonth: parseFloat(ct.travelAllowancePerMonth) || 0,
          tdsPercentage:           10,
        };
      } else if (type === "VISITING") {
        config = {
          remunerationPerVisit: parseFloat(vi.remunerationPerVisit) || 0,
          tdsPercentage:        10,
        };
      }
      return api.post(`/api/v1/employees/${employeeId}/salary-config`, { employmentType: selectedType, config });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salary-config", employeeId] });
      toast.success("Salary structure saved");
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to save"),
  });

  // ── Full-Time computed values ────────────────────────────────────────────────
  const ctc    = parseFloat(ft.ctcAnnual) || 0;
  const ctcM   = ctc / 12;
  const basic  = ctcM * (parseFloat(ft.basicPct) || 40) / 100;
  const hra    = basic * (parseFloat(ft.hraPct) || 50) / 100;
  const conv   = parseFloat(ft.conveyance) || 0;
  const med    = parseFloat(ft.medical) || 0;
  const pfBase = Math.min(basic, 15000);
  const pfEmp  = ft.pfApplicable  ? Math.round(pfBase * 0.12) : 0;
  const pfEmpr = ft.pfApplicable  ? Math.round(pfBase * 0.13) : 0;
  const esicEmp  = ft.esicApplicable && basic <= 21000 ? Math.round(basic * 0.0075) : 0;
  const esicEmpr = ft.esicApplicable && basic <= 21000 ? Math.round(basic * 0.0325) : 0;
  const specAllow = Math.max(0, ctcM - basic - hra - conv - med - pfEmpr);
  const grossM    = basic + hra + conv + med + specAllow;
  const grossA    = grossM * 12;
  const profTax   = parseFloat(ft.professionalTax) || 0;
  const hraExemptDefault = Math.round(Math.min(hra * 12, basic * 12 * 0.50));
  const hraExempt = parseFloat(ft.oldRegimeHRAExempt) || (ft.oldRegimeHRAExempt === "0" ? 0 : hraExemptDefault);
  const ded80c = parseFloat(ft.oldRegime80C) || 150000;
  const ded80d = parseFloat(ft.oldRegime80D) || 25000;
  const taxResult = ft.taxRegime === "new"
    ? calcNewRegimeTax(grossA)
    : calcOldRegimeTax(grossA, hraExempt, ded80c, ded80d, profTax * 12);
  const autoTDS   = taxResult.monthly;
  const effectiveTDS = ft.tdsOverride ? (parseFloat(ft.monthlyTDS) || 0) : autoTDS;
  const deductions   = pfEmp + esicEmp + profTax + effectiveTDS;
  const netTakeHome  = grossM - deductions;
  const bonusAnnual  = ctc * (parseFloat(ft.bonusPct) || 0) / 100;
  const totalWt      = ft.bonusCriteria.reduce((s, bc) => s + (parseFloat(bc.weightage) || 0), 0);

  function TaxRow({ label, value, sub, color }: { label: string; value: number | string; sub?: boolean; color?: string }) {
    return (
      <div className={`flex justify-between py-1 text-xs ${sub ? "text-gray-400 pl-2" : "text-gray-700"}`}>
        <span>{label}</span>
        <span className={color ?? ""}>{typeof value === "number" ? `₹${fmtN(value)}` : value}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-5">

      {/* ── Employment type selector ── */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Employment Type</label>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
        >
          {["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "VISITING"].map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {/* ── FULL_TIME ── */}
      {selectedType === "FULL_TIME" && (
        <>
          <div>
            <SalaryFLabel required>Annual CTC (₹)</SalaryFLabel>
            <SalaryFInput type="number" min={0} value={ft.ctcAnnual} onChange={(e) => setFt({ ...ft, ctcAnnual: e.target.value })} placeholder="e.g. 600000" className="max-w-xs" />
            {ctcM > 0 && <p className="text-xs text-gray-400 mt-1">Monthly CTC: ₹{fmtN(ctcM)}</p>}
          </div>

          <div className="rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Earnings Breakdown</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <SalaryFLabel required>Basic (% of CTC)</SalaryFLabel>
                <div className="flex items-center gap-2">
                  <input type="number" min={1} max={70} value={ft.basicPct} onChange={(e) => setFt({ ...ft, basicPct: e.target.value })}
                    className="w-20 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  <span className="text-sm text-gray-400">% → ₹{fmtN(basic)}/mo</span>
                </div>
              </div>
              <div>
                <SalaryFLabel required>HRA (% of Basic)</SalaryFLabel>
                <div className="flex items-center gap-2">
                  <input type="number" min={1} max={100} value={ft.hraPct} onChange={(e) => setFt({ ...ft, hraPct: e.target.value })}
                    className="w-20 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  <span className="text-sm text-gray-400">% → ₹{fmtN(hra)}/mo</span>
                </div>
              </div>
              <div><SalaryFLabel>Conveyance (₹/mo)</SalaryFLabel><SalaryFInput type="number" min={0} value={ft.conveyance} onChange={(e) => setFt({ ...ft, conveyance: e.target.value })} placeholder="1600" /></div>
              <div><SalaryFLabel>Medical (₹/mo)</SalaryFLabel><SalaryFInput type="number" min={0} value={ft.medical} onChange={(e) => setFt({ ...ft, medical: e.target.value })} placeholder="1250" /></div>
            </div>
            {ctcM > 0 && (
              <div className="rounded-lg bg-gray-50 px-3 py-2 flex items-center justify-between text-sm">
                <span className="text-gray-500">Special Allowance (auto)</span>
                <span className="font-medium text-gray-700">₹{fmtN(specAllow)}/mo</span>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Deductions</p>
            <div className="flex items-center gap-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={ft.pfApplicable} onChange={(e) => setFt({ ...ft, pfApplicable: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                <span className="text-sm text-gray-700">PF Applicable</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={ft.esicApplicable} onChange={(e) => setFt({ ...ft, esicApplicable: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                <span className="text-sm text-gray-700">ESIC Applicable</span>
              </label>
            </div>
            {ft.pfApplicable && ctcM > 0 && <p className="text-xs text-gray-400">PF on ₹{fmtN(pfBase)}: Employee ₹{fmtN(pfEmp)}/mo · Employer ₹{fmtN(pfEmpr)}/mo</p>}
            {ft.esicApplicable && basic > 21000 && <p className="text-xs text-orange-500">ESIC not applicable — Basic &gt; ₹21,000/mo</p>}
            {ft.esicApplicable && basic <= 21000 && ctcM > 0 && <p className="text-xs text-gray-400">ESIC: Employee ₹{fmtN(esicEmp)}/mo (0.75%) · Employer ₹{fmtN(esicEmpr)}/mo (3.25%)</p>}
            <div>
              <SalaryFLabel>Professional Tax (₹/mo)</SalaryFLabel>
              <SalaryFInput type="number" min={0} value={ft.professionalTax} onChange={(e) => setFt({ ...ft, professionalTax: e.target.value })} placeholder="200" className="max-w-[200px]" />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Income Tax / TDS</p>
            <div className="grid grid-cols-2 gap-3">
              {(["new", "old"] as const).map((r) => (
                <label key={r} className={`flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 cursor-pointer transition-colors ${ft.taxRegime === r ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <input type="radio" name={`taxRegime-${employeeId}`} value={r} checked={ft.taxRegime === r} onChange={() => setFt({ ...ft, taxRegime: r })} className="accent-blue-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{r === "new" ? "New Regime" : "Old Regime"}</p>
                    <p className="text-xs text-gray-400">{r === "new" ? "FY 2025-26 · Std ded ₹75,000" : "HRA exempt + 80C/80D"}</p>
                  </div>
                </label>
              ))}
            </div>
            {ft.taxRegime === "old" && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-3">
                <p className="text-xs font-semibold text-amber-700">Old Regime Deductions</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">HRA Exempt (₹/yr)</label>
                    <SalaryFInput type="number" min={0} value={ft.oldRegimeHRAExempt} onChange={(e) => setFt({ ...ft, oldRegimeHRAExempt: e.target.value })} placeholder={`${hraExemptDefault}`} />
                    <p className="text-xs text-gray-400 mt-0.5">Auto: ₹{fmtN(hraExemptDefault)}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Sec 80C (₹/yr)</label>
                    <SalaryFInput type="number" min={0} max={150000} value={ft.oldRegime80C} onChange={(e) => setFt({ ...ft, oldRegime80C: e.target.value })} placeholder="150000" />
                    <p className="text-xs text-gray-400 mt-0.5">Cap ₹1.5L</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Sec 80D (₹/yr)</label>
                    <SalaryFInput type="number" min={0} max={100000} value={ft.oldRegime80D} onChange={(e) => setFt({ ...ft, oldRegime80D: e.target.value })} placeholder="25000" />
                    <p className="text-xs text-gray-400 mt-0.5">Cap ₹1L</p>
                  </div>
                </div>
              </div>
            )}
            {ctcM > 0 && (
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 space-y-0.5">
                <TaxRow label="Annual Gross Salary" value={grossA} />
                <TaxRow label="Less: Standard Deduction" value={`−₹${fmtN(ft.taxRegime === "new" ? 75000 : 50000)}`} sub />
                {ft.taxRegime === "old" && (
                  <>
                    <TaxRow label="Less: HRA Exemption" value={`−₹${fmtN(hraExempt)}`} sub />
                    <TaxRow label="Less: Sec 80C" value={`−₹${fmtN(Math.min(ded80c, 150000))}`} sub />
                    <TaxRow label="Less: Sec 80D" value={`−₹${fmtN(Math.min(ded80d, 100000))}`} sub />
                    {profTax > 0 && <TaxRow label="Less: Professional Tax" value={`−₹${fmtN(profTax * 12)}`} sub />}
                  </>
                )}
                <div className="border-t border-gray-200 mt-1 pt-1">
                  <TaxRow label="Taxable Income" value={taxResult.taxableIncome} />
                  <TaxRow label="Income Tax (slab-wise)" value={taxResult.taxBeforeRebate} />
                  {taxResult.rebate > 0 && <TaxRow label={ft.taxRegime === "new" ? "Rebate u/s 87A (≤₹12L)" : "Rebate u/s 87A (≤₹5L)"} value={`−₹${fmtN(taxResult.rebate)}`} sub color="text-green-600" />}
                  <TaxRow label="Health & Education Cess @4%" value={taxResult.cess} sub />
                </div>
                <div className="border-t border-gray-300 mt-1 pt-1 flex justify-between text-xs font-bold text-gray-800">
                  <span>Annual Tax Liability</span><span>₹{fmtN(taxResult.totalAnnual)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-blue-700">
                  <span>Monthly TDS (÷12)</span><span>₹{fmtN(autoTDS)}/mo</span>
                </div>
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
              <input type="checkbox" checked={ft.tdsOverride}
                onChange={(e) => setFt({ ...ft, tdsOverride: e.target.checked, monthlyTDS: e.target.checked ? String(autoTDS) : "" })}
                className="h-4 w-4 rounded border-gray-300" />
              Override TDS amount
            </label>
            {ft.tdsOverride && (
              <div>
                <SalaryFLabel>Custom Monthly TDS (₹)</SalaryFLabel>
                <SalaryFInput type="number" min={0} value={ft.monthlyTDS} onChange={(e) => setFt({ ...ft, monthlyTDS: e.target.value })} placeholder={String(autoTDS)} className="max-w-[200px]" />
                <p className="text-xs text-gray-400 mt-0.5">Auto-computed: ₹{fmtN(autoTDS)}/mo</p>
              </div>
            )}
          </div>

          {ctcM > 0 && (
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 grid grid-cols-3 gap-3 text-center">
              <div><p className="text-xs text-blue-500 font-semibold uppercase tracking-wide">Gross/Month</p><p className="text-base font-bold text-blue-800">₹{fmtN(grossM)}</p></div>
              <div><p className="text-xs text-blue-500 font-semibold uppercase tracking-wide">Deductions</p><p className="text-base font-bold text-blue-800">₹{fmtN(deductions)}</p></div>
              <div><p className="text-xs text-blue-500 font-semibold uppercase tracking-wide">Net Take-Home</p><p className="text-base font-bold text-green-700">₹{fmtN(netTakeHome)}</p></div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 p-4 space-y-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Performance Bonus</p>
            <div className="flex items-center gap-3">
              <div className="w-40">
                <SalaryFLabel>Bonus (% of CTC)</SalaryFLabel>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} max={50} value={ft.bonusPct} onChange={(e) => setFt({ ...ft, bonusPct: e.target.value })}
                    className="w-20 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  <span className="text-sm text-gray-400">%</span>
                </div>
              </div>
              {ctcM > 0 && bonusAnnual > 0 && <p className="text-xs text-gray-400 mt-4">Annual bonus target: ₹{fmtN(bonusAnnual)}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-600">Bonus Criteria</p>
                <button type="button" onClick={addCriteria} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                  <Plus className="h-3 w-3" /> Add Criteria
                </button>
              </div>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Criteria</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 w-28">Weightage (%)</th>
                    <th className="px-3 py-2 w-8" />
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {ft.bonusCriteria.map((bc, i) => (
                      <>
                        <tr key={i} className="align-middle">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <input type="text" value={bc.name} onChange={(e) => updateCriteria(i, "name", e.target.value)}
                                className="flex-1 text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1" placeholder="Criteria name" />
                              <button type="button" onClick={() => setExpandedCriteria(expandedCriteria === i ? null : i)}
                                className={`relative shrink-0 rounded p-1 transition-colors ${expandedCriteria === i ? "bg-blue-100 text-blue-600" : bc.description ? "bg-blue-50 text-blue-500 hover:bg-blue-100" : "text-gray-300 hover:text-gray-500"}`}>
                                <FileText className="h-3.5 w-3.5" />
                                {bc.description && expandedCriteria !== i && <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-blue-500" />}
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min={0} max={100} value={bc.weightage} onChange={(e) => updateCriteria(i, "weightage", e.target.value)}
                              className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center" placeholder="0" />
                          </td>
                          <td className="px-3 py-2">
                            <button type="button" onClick={() => removeCriteria(i)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                          </td>
                        </tr>
                        {expandedCriteria === i && (
                          <tr key={`${i}-desc`}><td colSpan={3} className="px-3 pb-3">
                            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                              <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide mb-1.5">Description / KRA Details</p>
                              <textarea value={bc.description} onChange={(e) => updateCriteria(i, "description", e.target.value)} rows={2}
                                className="w-full rounded border border-blue-200 bg-white px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-400 outline-none resize-none" placeholder="Optional details…" />
                            </div>
                          </td></tr>
                        )}
                      </>
                    ))}
                    <tr className={Math.abs(totalWt - 100) < 0.01 ? "bg-green-50" : totalWt > 0 ? "bg-orange-50" : "bg-gray-50"}>
                      <td className="px-3 py-2 text-xs font-semibold text-gray-500">Total</td>
                      <td className={`px-3 py-2 text-center text-xs font-bold ${Math.abs(totalWt - 100) < 0.01 ? "text-green-600" : "text-orange-600"}`}>
                        {totalWt}%{totalWt > 0 && Math.abs(totalWt - 100) >= 0.01 && <span className="ml-1 font-normal">(should be 100)</span>}
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── PART_TIME ── */}
      {selectedType === "PART_TIME" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><SalaryFLabel>Per Hour Rate — Lectures (₹)</SalaryFLabel><SalaryFInput type="number" min={0} value={pt.lectureRatePerHour} onChange={(e) => setPt({ ...pt, lectureRatePerHour: e.target.value })} placeholder="e.g. 500" /></div>
            <div><SalaryFLabel>Per Hour Rate — PTMs (₹)</SalaryFLabel><SalaryFInput type="number" min={0} value={pt.ptmRatePerHour} onChange={(e) => setPt({ ...pt, ptmRatePerHour: e.target.value })} placeholder="e.g. 300" /></div>
          </div>
          <div><SalaryFLabel>Per Student — Answer Script Evaluation (₹)</SalaryFLabel><SalaryFInput type="number" min={0} value={pt.answerScriptRatePerStudent} onChange={(e) => setPt({ ...pt, answerScriptRatePerStudent: e.target.value })} placeholder="e.g. 50" /></div>
          {(() => {
            const lecture = parseFloat(pt.lectureRatePerHour) || 0;
            const ptm     = parseFloat(pt.ptmRatePerHour)     || 0;
            const script  = parseFloat(pt.answerScriptRatePerStudent) || 0;
            const rows = [
              { label: "Lecture (per hour)", rate: lecture, unit: "/hr" },
              { label: "PTM (per hour)", rate: ptm, unit: "/hr" },
              { label: "Answer Script (per student)", rate: script, unit: "/student" },
            ].filter((r) => r.rate > 0);
            if (!rows.length) return null;
            return (
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b border-gray-100"><p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">TDS Breakdown (u/s 194J @10%)</p></div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100">
                    <th className="px-3 py-2 text-left text-xs text-gray-400 font-semibold">Type</th>
                    <th className="px-3 py-2 text-right text-xs text-gray-400 font-semibold">Rate</th>
                    <th className="px-3 py-2 text-right text-xs text-red-400 font-semibold">TDS @10%</th>
                    <th className="px-3 py-2 text-right text-xs text-green-600 font-semibold">Net</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map((r) => (
                      <tr key={r.label}>
                        <td className="px-3 py-2 text-gray-700">{r.label}</td>
                        <td className="px-3 py-2 text-right text-gray-800 font-medium">₹{fmtN(r.rate)}{r.unit}</td>
                        <td className="px-3 py-2 text-right text-red-500">−₹{fmtN(r.rate * 0.1)}</td>
                        <td className="px-3 py-2 text-right text-green-700 font-semibold">₹{fmtN(r.rate * 0.9)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">Actual take-home depends on hours / units worked each month.</p>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── CONTRACT / INTERN ── */}
      {(selectedType === "CONTRACT" || selectedType === "INTERN") && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><SalaryFLabel>Retainership per Month (₹)</SalaryFLabel><SalaryFInput type="number" min={0} value={ct.retainershipPerMonth} onChange={(e) => setCt({ ...ct, retainershipPerMonth: e.target.value })} placeholder="e.g. 30000" /></div>
            <div><SalaryFLabel>Travel Allowance per Month (₹)</SalaryFLabel><SalaryFInput type="number" min={0} value={ct.travelAllowancePerMonth} onChange={(e) => setCt({ ...ct, travelAllowancePerMonth: e.target.value })} placeholder="e.g. 2000" /></div>
          </div>
          {(() => {
            const ret    = parseFloat(ct.retainershipPerMonth)    || 0;
            const travel = parseFloat(ct.travelAllowancePerMonth) || 0;
            const tds    = Math.round(ret * 0.10);
            const net    = ret - tds + travel;
            if (!ret) return null;
            return (
              <>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 border-b border-gray-100"><p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">TDS Breakdown (u/s 194C @10%)</p></div>
                  <div className="divide-y divide-gray-50">
                    <div className="flex justify-between px-3 py-2 text-sm"><span className="text-gray-500">Retainership / month</span><span className="font-medium text-gray-800">₹{fmtN(ret)}</span></div>
                    <div className="flex justify-between px-3 py-2 text-sm"><span className="text-gray-500">TDS @10%</span><span className="font-medium text-red-500">−₹{fmtN(tds)}</span></div>
                    {travel > 0 && <div className="flex justify-between px-3 py-2 text-sm"><span className="text-gray-500">Travel Allowance</span><span className="font-medium text-gray-800">+₹{fmtN(travel)}</span></div>}
                  </div>
                </div>
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 grid grid-cols-3 gap-3 text-center">
                  <div><p className="text-xs text-blue-500 font-semibold uppercase tracking-wide">Retainership</p><p className="text-base font-bold text-blue-800">₹{fmtN(ret)}</p></div>
                  <div><p className="text-xs text-red-400 font-semibold uppercase tracking-wide">TDS (10%)</p><p className="text-base font-bold text-red-600">−₹{fmtN(tds)}</p></div>
                  <div><p className="text-xs text-green-600 font-semibold uppercase tracking-wide">Net Take-Home</p><p className="text-base font-bold text-green-700">₹{fmtN(net)}</p></div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ── VISITING ── */}
      {selectedType === "VISITING" && (
        <div className="space-y-4">
          <div><SalaryFLabel>Remuneration per Visit (₹)</SalaryFLabel><SalaryFInput type="number" min={0} value={vi.remunerationPerVisit} onChange={(e) => setVi({ ...vi, remunerationPerVisit: e.target.value })} placeholder="e.g. 2000" /></div>
          {(() => {
            const rev = parseFloat(vi.remunerationPerVisit) || 0;
            const tds = Math.round(rev * 0.10);
            const net = rev - tds;
            if (!rev) return null;
            return (
              <>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 border-b border-gray-100"><p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">TDS Breakdown (u/s 194J @10%)</p></div>
                  <div className="divide-y divide-gray-50">
                    <div className="flex justify-between px-3 py-2 text-sm"><span className="text-gray-500">Remuneration / visit</span><span className="font-medium text-gray-800">₹{fmtN(rev)}</span></div>
                    <div className="flex justify-between px-3 py-2 text-sm"><span className="text-gray-500">TDS @10%</span><span className="font-medium text-red-500">−₹{fmtN(tds)}</span></div>
                  </div>
                </div>
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 grid grid-cols-3 gap-3 text-center">
                  <div><p className="text-xs text-blue-500 font-semibold uppercase tracking-wide">Per Visit</p><p className="text-base font-bold text-blue-800">₹{fmtN(rev)}</p></div>
                  <div><p className="text-xs text-red-400 font-semibold uppercase tracking-wide">TDS (10%)</p><p className="text-base font-bold text-red-600">−₹{fmtN(tds)}</p></div>
                  <div><p className="text-xs text-green-600 font-semibold uppercase tracking-wide">Net per Visit</p><p className="text-base font-bold text-green-700">₹{fmtN(net)}</p></div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
        <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className="inline-flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
          <Check className="h-4 w-4" />
          {mutation.isPending ? "Saving…" : existing ? "Update Salary Structure" : "Save Salary Structure"}
        </button>
      </div>
    </div>
  );
}

function SalaryConfigCard({ config, hasActivePlan = false }: { config: any; hasActivePlan?: boolean }) {
  const c = config.config as any;
  const type = config.employmentType as string;

  function fmt(n: number | undefined | null) {
    return n != null ? formatCurrency(n) : "—";
  }

  // Derive computed values for FULL_TIME from raw stored percentages
  const ft = (() => {
    if (type !== "FULL_TIME") return null;
    const ctcAnnual    = c.ctcAnnual ?? 0;
    const grossMonthly = ctcAnnual / 12;
    const basicPct     = c.basicPct ?? 40;
    const hraPct       = c.hraPct ?? 50;
    const basic        = grossMonthly * basicPct / 100;
    const hra          = basic * hraPct / 100;
    const conveyance   = c.conveyance ?? 0;
    const medical      = c.medical ?? 0;
    const specialAllowance = Math.max(0, grossMonthly - basic - hra - conveyance - medical);
    const pfEmp        = c.pfApplicable ? Math.round(basic * 0.12) : 0;
    const pfEmpr       = c.pfApplicable ? Math.round(basic * 0.13) : 0;
    const esicEmp      = c.esicApplicable && basic * 12 <= 21000 ? Math.round(grossMonthly * 0.0075) : 0;
    const esicEmpr     = c.esicApplicable && basic * 12 <= 21000 ? Math.round(grossMonthly * 0.0325) : 0;
    const profTax      = c.professionalTax ?? 0;
    const tds          = c.monthlyTDS ?? 0;
    const totalDed     = pfEmp + esicEmp + profTax + tds;
    const netMonthly   = grossMonthly - totalDed;
    const bonusPct     = c.bonusPct ?? 0;
    const bonusAnnual  = basic * 12 * bonusPct / 100;
    return { ctcAnnual, grossMonthly, basic, basicPct, hra, hraPct, conveyance, medical, specialAllowance,
             pfEmp, pfEmpr, esicEmp, esicEmpr, profTax, tds, totalDed, netMonthly, bonusPct, bonusAnnual,
             bonusCriteria: c.bonusCriteria ?? [] };
  })();

  // Derived for CONTRACT/INTERN
  const ct = (() => {
    if (type !== "CONTRACT" && type !== "INTERN") return null;
    const ret    = c.retainershipPerMonth ?? 0;
    const tds    = Math.round(ret * 0.10);
    const travel = c.travelAllowancePerMonth ?? 0;
    return { ret, tds, travel, net: ret - tds + travel };
  })();

  // Derived for VISITING
  const vi = (() => {
    if (type !== "VISITING") return null;
    const rev = c.remunerationPerVisit ?? 0;
    const tds = Math.round(rev * 0.10);
    return { rev, tds, net: rev - tds };
  })();

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-gray-900">Salary Structure</h3>
        <span className="rounded-full bg-blue-50 px-3 py-0.5 text-xs font-medium text-blue-700">
          {type.replace(/_/g, " ")}
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-4">Effective from {formatDate(config.effectiveFrom)}</p>

      {ft && (
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-blue-700">Annual CTC</span>
            <span className="text-lg font-bold text-blue-800">{fmt(ft.ctcAnnual)}</span>
          </div>

          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Monthly Earnings</p>
            <SalaryRow label={`Basic Salary (${ft.basicPct}%)`} value={fmt(ft.basic)} />
            <SalaryRow label={`HRA (${ft.hraPct}% of Basic)`} value={fmt(ft.hra)} />
            {ft.conveyance > 0 && <SalaryRow label="Conveyance Allowance" value={fmt(ft.conveyance)} />}
            {ft.medical > 0 && <SalaryRow label="Medical Allowance" value={fmt(ft.medical)} />}
            {ft.specialAllowance > 0 && <SalaryRow label="Special Allowance" value={fmt(ft.specialAllowance)} />}
            <SalaryRow label="Gross Monthly Pay" value={fmt(ft.grossMonthly)} highlight="earn" />
          </div>

          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Monthly Deductions</p>
            {ft.pfEmp > 0 && <SalaryRow label="PF — Employee (12%)" value={fmt(ft.pfEmp)} highlight="deduct" />}
            {ft.esicEmp > 0 && <SalaryRow label="ESIC — Employee (0.75%)" value={fmt(ft.esicEmp)} highlight="deduct" />}
            {ft.profTax > 0 && <SalaryRow label="Professional Tax" value={fmt(ft.profTax)} highlight="deduct" />}
            <SalaryRow label="Income Tax / TDS" value={fmt(ft.tds)} highlight={ft.tds > 0 ? "deduct" : undefined} />
            <SalaryRow label="Total Deductions" value={fmt(ft.totalDed)} highlight="deduct" />
          </div>

          <div className="rounded-lg bg-green-50 px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-green-700">Monthly Net Take-Home</span>
            <span className="text-lg font-bold text-green-800">{fmt(ft.netMonthly)}</span>
          </div>

          {(ft.pfEmpr > 0 || ft.esicEmpr > 0) && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Employer Contributions</p>
              {ft.pfEmpr > 0 && <SalaryRow label="PF — Employer (13%)" value={fmt(ft.pfEmpr)} />}
              {ft.esicEmpr > 0 && <SalaryRow label="ESIC — Employer (3.25%)" value={fmt(ft.esicEmpr)} />}
            </div>
          )}

          {ft.bonusPct > 0 && hasActivePlan && (
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">
                Performance Bonus — {ft.bonusPct}% of Annual Basic = {fmt(ft.bonusAnnual)} / year
              </p>
              {ft.bonusCriteria.length > 0 && (
                <table className="w-full text-xs mt-1">
                  <thead>
                    <tr>
                      <th className="text-left text-amber-600 pb-1 font-semibold">Criteria</th>
                      <th className="text-right text-amber-600 pb-1 font-semibold">Weightage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ft.bonusCriteria.map((r: any, i: number) => (
                      <tr key={i} className="align-top">
                        <td className="text-gray-700 py-1">
                          <p>{r.name}</p>
                          {r.description && <p className="text-[11px] text-gray-400 mt-0.5">{r.description}</p>}
                        </td>
                        <td className="text-right text-gray-700 py-1 pl-4 whitespace-nowrap">{r.weightage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {type === "PART_TIME" && (
        <div className="space-y-2">
          {(c.lectureRatePerHour ?? 0) > 0 && <SalaryRow label="Lecture rate / hour" value={fmt(c.lectureRatePerHour)} />}
          {(c.ptmRatePerHour ?? 0) > 0 && <SalaryRow label="PTM rate / hour" value={fmt(c.ptmRatePerHour)} />}
          {(c.answerScriptRatePerStudent ?? 0) > 0 && <SalaryRow label="Answer script evaluation / student" value={fmt(c.answerScriptRatePerStudent)} />}
        </div>
      )}

      {ct && (
        <div className="space-y-2">
          <SalaryRow label="Retainership / month" value={fmt(ct.ret)} />
          <SalaryRow label="TDS @10%" value={`−${fmt(ct.tds)}`} highlight="deduct" />
          {ct.travel > 0 && <SalaryRow label="Travel Allowance / month" value={fmt(ct.travel)} />}
          <SalaryRow label="Net Payout / month" value={fmt(ct.net)} highlight="net" />
        </div>
      )}

      {vi && (
        <div className="space-y-2">
          <SalaryRow label="Remuneration / visit" value={fmt(vi.rev)} />
          <SalaryRow label="TDS @10%" value={`−${fmt(vi.tds)}`} highlight="deduct" />
          <SalaryRow label="Net payout / visit" value={fmt(vi.net)} highlight="net" />
        </div>
      )}
    </div>
  );
}

// ─── Monthly Salary Slip ──────────────────────────────────────────────────────

function MonthlySalarySlip({ employeeId, salaryConfig }: { employeeId: string; salaryConfig: any }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ["monthly-receivables", employeeId, month, year],
    queryFn: () =>
      api.get(`/api/v1/employees/${employeeId}/monthly-receivables?month=${month}&year=${year}`)
        .then((r) => r.data.data),
  });

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    const next = new Date(year, month, 1);
    if (next > now) return;
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  if (!salaryConfig) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
        No salary structure defined yet. Contact HR to configure salary.
      </div>
    );
  }

  const c    = salaryConfig.config as any;
  const type = salaryConfig.employmentType as string;
  const isVariable = ["PART_TIME", "VISITING"].includes(type);

  const lopDays      = data?.lop?.days ?? 0;
  const claimsTotal  = data?.claims?.total ?? 0;
  const claimsItems  = data?.claims?.items ?? [];
  const bonusTotal   = data?.bonus?.total ?? 0;
  const bonusItems   = data?.bonus?.items ?? [];
  const misc         = data?.miscellaneous ?? 0;

  const ft = (() => {
    if (type !== "FULL_TIME") return null;
    const ctcAnnual  = c.ctcAnnual ?? 0;
    const gross      = ctcAnnual / 12;
    const basicPct   = c.basicPct ?? 40;
    const hraPct     = c.hraPct   ?? 50;
    const basic      = gross * basicPct / 100;
    const hra        = basic * hraPct / 100;
    const conv       = c.conveyance ?? 0;
    const med        = c.medical    ?? 0;
    const special    = Math.max(0, gross - basic - hra - conv - med);
    const pfEmp      = c.pfApplicable ? Math.round(Math.min(basic, 15000) * 0.12) : 0;
    const esicEmp    = c.esicApplicable && gross <= 21000 ? Math.round(gross * 0.0075) : 0;
    const profTax    = c.professionalTax ?? 0;
    const tds        = c.monthlyTDS ?? 0;
    const dailyRate  = Math.round(gross / 26);
    const lopDed     = Math.round(lopDays * dailyRate);
    const totalDed   = pfEmp + esicEmp + profTax + tds + lopDed;
    const totalAdd   = claimsTotal + bonusTotal + Math.max(0, misc);
    const miscDed    = Math.abs(Math.min(0, misc));
    const netPayout  = gross - totalDed + totalAdd - miscDed;
    return { gross, basic, basicPct, hra, hraPct, conv, med, special,
             pfEmp, esicEmp, profTax, tds, dailyRate, lopDed, totalDed, netPayout };
  })();

  const ct = (() => {
    if (type !== "CONTRACT" && type !== "INTERN") return null;
    const ret        = c.retainershipPerMonth ?? 0;
    const tds        = Math.round(ret * 0.10);
    const travel     = c.travelAllowancePerMonth ?? 0;
    const dailyRate  = Math.round(ret / 26);
    const lopDed     = Math.round(lopDays * dailyRate);
    const netPayout  = ret - tds + travel - lopDed + claimsTotal + bonusTotal;
    return { ret, tds, travel, dailyRate, lopDed, netPayout };
  })();

  function SlipSection({ label, color }: { label: string; color: string }) {
    return <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${color}`}>{label}</p>;
  }

  function SlipRow({ label, value, sub, variant = "neutral" }: {
    label: string; value: string; sub?: string; variant?: "earn" | "deduct" | "neutral";
  }) {
    const valCls = variant === "earn"   ? "text-green-700 font-semibold"
                 : variant === "deduct" ? "text-red-600 font-semibold"
                 : "text-gray-800";
    return (
      <div className="flex justify-between py-2 text-sm border-b border-black/5 last:border-0">
        <div>
          <span className="text-gray-600">{label}</span>
          {sub && <span className="block text-[11px] text-gray-400 mt-0.5">{sub}</span>}
        </div>
        <span className={valCls}>{value}</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-blue-50">
        <TrendingUp className="h-5 w-5 text-indigo-500 shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-indigo-900">Monthly Payout Statement</p>
          <p className="text-xs text-indigo-500 mt-0.5">
            {type.replace(/_/g, " ")} · Effective {formatDate(salaryConfig.effectiveFrom)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-indigo-100 text-indigo-600">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-indigo-800 min-w-[100px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button onClick={nextMonth} disabled={isCurrentMonth} className="p-1.5 rounded-lg hover:bg-indigo-100 text-indigo-600 disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isVariable ? (
        <div className="px-5 py-10 text-center text-sm text-gray-400 italic">
          Monthly payout varies by hours / visits — not applicable for this employment type.
        </div>
      ) : isLoading ? (
        <div className="px-5 py-6 space-y-3 animate-pulse">
          {[1,2,3,4,5,6].map((i) => <div key={i} className="h-6 bg-gray-100 rounded" />)}
        </div>
      ) : ft ? (
        <div className="px-5 py-5 space-y-5">
          {/* Earnings */}
          <div>
            <SlipSection label="Earnings" color="text-green-700" />
            <div className="bg-green-50/50 rounded-lg px-4">
              <SlipRow label={`Basic Salary (${ft.basicPct}%)`}       value={formatCurrency(ft.basic)}   variant="earn" />
              <SlipRow label={`HRA (${ft.hraPct}% of Basic)`}         value={formatCurrency(ft.hra)}     variant="earn" />
              {ft.conv    > 0 && <SlipRow label="Conveyance Allowance" value={formatCurrency(ft.conv)}   variant="earn" />}
              {ft.med     > 0 && <SlipRow label="Medical Allowance"    value={formatCurrency(ft.med)}    variant="earn" />}
              {ft.special > 0 && <SlipRow label="Special Allowance"    value={formatCurrency(ft.special)} variant="earn" />}
            </div>
            <div className="flex justify-between px-4 pt-2 pb-0.5 text-sm font-bold text-green-800">
              <span>Gross Salary</span><span>{formatCurrency(ft.gross)}</span>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <SlipSection label="Deductions" color="text-red-600" />
            <div className="bg-red-50/50 rounded-lg px-4">
              {ft.pfEmp   > 0 && <SlipRow label="PF — Employee (12%)"         value={`−${formatCurrency(ft.pfEmp)}`}  variant="deduct" />}
              {ft.esicEmp > 0 && <SlipRow label="ESIC — Employee (0.75%)"     value={`−${formatCurrency(ft.esicEmp)}`} variant="deduct" />}
              {ft.profTax > 0 && <SlipRow label="Professional Tax"            value={`−${formatCurrency(ft.profTax)}`} variant="deduct" />}
              {ft.tds     > 0 && <SlipRow label="Income Tax / TDS"            value={`−${formatCurrency(ft.tds)}`}    variant="deduct" />}
              {lopDays > 0
                ? <SlipRow
                    label={`Loss of Pay (${lopDays} day${lopDays !== 1 ? "s" : ""})`}
                    sub={`${formatCurrency(ft.dailyRate)}/day × ${lopDays} day${lopDays !== 1 ? "s" : ""}`}
                    value={`−${formatCurrency(ft.lopDed)}`}
                    variant="deduct"
                  />
                : <SlipRow label="Loss of Pay" sub="No LOP this month" value="—" />
              }
            </div>
            <div className="flex justify-between px-4 pt-2 pb-0.5 text-sm font-bold text-red-700">
              <span>Total Deductions</span><span>−{formatCurrency(ft.totalDed)}</span>
            </div>
          </div>

          {/* Additions (claims / bonus / misc) */}
          {(claimsTotal > 0 || bonusTotal > 0 || misc !== 0) && (
            <div>
              <SlipSection label="Additions" color="text-blue-700" />
              <div className="bg-blue-50/50 rounded-lg px-4">
                {claimsTotal > 0 && (
                  <SlipRow
                    label={`Approved Claims (${claimsItems.length})`}
                    sub={claimsItems.map((ci: any) => `${ci.claimNumber}: ${formatCurrency(ci.approvedAmount ?? ci.claimedAmount)}`).join(" · ")}
                    value={`+${formatCurrency(claimsTotal)}`}
                    variant="earn"
                  />
                )}
                {bonusTotal > 0 && (
                  <SlipRow
                    label={`Performance Bonus (${bonusItems.length} payout${bonusItems.length !== 1 ? "s" : ""})`}
                    sub={bonusItems.map((p: any) => `${p.plan?.title ?? "Bonus"}: ${formatCurrency(p.amount)}`).join(" · ")}
                    value={`+${formatCurrency(bonusTotal)}`}
                    variant="earn"
                  />
                )}
                {misc !== 0 && (
                  <SlipRow
                    label={misc > 0 ? "Miscellaneous" : "Miscellaneous Deduction"}
                    value={misc > 0 ? `+${formatCurrency(misc)}` : `−${formatCurrency(Math.abs(misc))}`}
                    variant={misc > 0 ? "earn" : "deduct"}
                  />
                )}
              </div>
            </div>
          )}

          {/* Net */}
          <div className="border-t-2 border-indigo-200 pt-4 flex justify-between items-center">
            <div>
              <p className="text-sm font-bold text-indigo-900">Net Payout</p>
              <p className="text-xs text-indigo-400 mt-0.5">{MONTH_NAMES[month - 1]} {year}</p>
            </div>
            <span className="text-2xl font-bold text-indigo-700">{formatCurrency(ft.netPayout)}</span>
          </div>
          <p className="text-xs text-gray-400">
            Estimated payout. Actual disbursement may vary based on HR adjustments.
          </p>
        </div>
      ) : ct ? (
        <div className="px-5 py-5 space-y-5">
          <div>
            <SlipSection label="Breakdown" color="text-indigo-700" />
            <div className="bg-gray-50 rounded-lg px-4">
              <SlipRow label="Retainership / month"   value={formatCurrency(ct.ret)}    variant="earn" />
              {ct.travel > 0 && <SlipRow label="Travel Allowance"   value={formatCurrency(ct.travel)} variant="earn" />}
              <SlipRow label="TDS @10%"               value={`−${formatCurrency(ct.tds)}`}   variant="deduct" />
              {lopDays > 0 && (
                <SlipRow
                  label={`Loss of Pay (${lopDays} day${lopDays !== 1 ? "s" : ""})`}
                  sub={`${formatCurrency(ct.dailyRate)}/day × ${lopDays}`}
                  value={`−${formatCurrency(ct.lopDed)}`}
                  variant="deduct"
                />
              )}
              {claimsTotal > 0 && <SlipRow label={`Approved Claims (${claimsItems.length})`} value={`+${formatCurrency(claimsTotal)}`} variant="earn" />}
              {bonusTotal  > 0 && <SlipRow label={`Performance Bonus (${bonusItems.length})`} value={`+${formatCurrency(bonusTotal)}`}  variant="earn" />}
            </div>
          </div>
          <div className="border-t-2 border-indigo-200 pt-4 flex justify-between items-center">
            <div>
              <p className="text-sm font-bold text-indigo-900">Net Payout</p>
              <p className="text-xs text-indigo-400 mt-0.5">{MONTH_NAMES[month - 1]} {year}</p>
            </div>
            <span className="text-2xl font-bold text-indigo-700">{formatCurrency(ct.netPayout)}</span>
          </div>
          <p className="text-xs text-gray-400">
            Estimated payout. Actual disbursement may vary based on HR adjustments.
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ─── LoP Section (for Leaves tab) ────────────────────────────────────────────

function LopSection({ employeeId, salaryConfig }: { employeeId: string; salaryConfig: any }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ["monthly-receivables", employeeId, month, year],
    queryFn: () =>
      api.get(`/api/v1/employees/${employeeId}/monthly-receivables?month=${month}&year=${year}`)
        .then((r) => r.data.data),
    staleTime: 2 * 60 * 1000,
  });

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    const next = new Date(year, month, 1);
    if (next > now) return;
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  const lopDays    = data?.lop?.days ?? 0;
  const { dailyRate } = computeNetMonthly(salaryConfig);
  const lopDed     = salaryConfig ? Math.round(lopDays * dailyRate) : null;

  return (
    <div className="rounded-xl border border-orange-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-orange-100 bg-orange-50">
        <MinusCircle className="h-4 w-4 text-orange-500 shrink-0" />
        <span className="font-semibold text-orange-900 text-sm flex-1">Loss of Pay</span>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-orange-100 text-orange-600">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-orange-800 min-w-[90px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button onClick={nextMonth} disabled={isCurrentMonth} className="p-1 rounded hover:bg-orange-100 text-orange-600 disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        {isLoading ? (
          <div className="space-y-2 animate-pulse py-1">
            <div className="h-5 bg-gray-100 rounded w-48" />
            <div className="h-4 bg-gray-100 rounded w-64" />
          </div>
        ) : lopDays === 0 ? (
          <div className="flex items-center gap-3 py-1">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <BadgeCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-700">No Loss of Pay</p>
              <p className="text-xs text-gray-400">Full attendance recorded for {MONTH_NAMES[month - 1]} {year}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-red-600">{lopDays}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">
                {lopDays} day{lopDays !== 1 ? "s" : ""} of Loss of Pay
              </p>
              {lopDed != null && lopDed > 0 && dailyRate > 0 && (
                <p className="text-xs text-red-500 mt-0.5">
                  Salary deduction: {formatCurrency(lopDed)}
                  <span className="text-gray-400"> ({formatCurrency(dailyRate)}/day × {lopDays})</span>
                </p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">
                See <strong>Monthly Payout</strong> tab for full salary impact breakdown.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Edit Employment Form ─────────────────────────────────────────────────────

function EmpFInput({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <input {...props} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
    </div>
  );
}
function EmpFSelect({ label, children, ...props }: { label: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <select {...props} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">{children}</select>
    </div>
  );
}

function EditEmploymentInlineForm({
  emp, employeeId, designations, departments, employees, workLocations, onClose,
}: {
  emp: any;
  employeeId: string;
  designations: { id: string; title: string }[];
  departments: { id: string; name: string; code: string }[];
  employees: any[];
  workLocations: { id: string; name: string }[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    status:           emp.status ?? "",
    employmentType:   emp.employmentType ?? "FULL_TIME",
    joiningDate:      emp.joiningDate ? String(emp.joiningDate).slice(0, 10) : "",
    confirmationDate: emp.confirmationDate ? String(emp.confirmationDate).slice(0, 10) : "",
    designationId:    emp.designationId ?? "",
    departmentId:     emp.departmentId ?? "",
    reportingToId:    emp.reportingTo?.id ?? "",
    workLocation:     emp.workLocation ?? "",
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = {
        status:           form.status || undefined,
        employmentType:   form.employmentType || undefined,
        joiningDate:      form.joiningDate ? new Date(form.joiningDate).toISOString() : undefined,
        confirmationDate: form.confirmationDate ? new Date(form.confirmationDate).toISOString() : undefined,
        designationId:    form.designationId || undefined,
        departmentId:     form.departmentId || undefined,
        reportingToId:    form.reportingToId || null,
        workLocation:     form.workLocation || null,
      };
      return api.patch(`/api/v1/employees/${employeeId}`, payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["employee", employeeId] });
      await qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employment details updated");
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Update failed"),
  });

  const STATUSES = ["DRAFT", "ACTIVE", "PROBATION", "ON_LEAVE", "NOTICE_PERIOD", "TERMINATED", "RESIGNED", "RETIRED", "EXITED"];
  const EMP_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "VISITING", "INTERN"];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <EmpFSelect label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </EmpFSelect>
        <EmpFSelect label="Employment Type" value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
          {EMP_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </EmpFSelect>
        <EmpFInput label="Joining Date" type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} />
        <EmpFInput label="Confirmation Date" type="date" value={form.confirmationDate} onChange={(e) => setForm({ ...form, confirmationDate: e.target.value })} />
        <EmpFSelect label="Designation" value={form.designationId} onChange={(e) => setForm({ ...form, designationId: e.target.value })}>
          <option value="">— Select designation —</option>
          {designations.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
        </EmpFSelect>
        <EmpFSelect label="Department" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
          <option value="">— Select department —</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </EmpFSelect>
        <EmpFSelect label="Reporting To" value={form.reportingToId} onChange={(e) => setForm({ ...form, reportingToId: e.target.value })}>
          <option value="">— None —</option>
          {employees.filter((e) => e.id !== employeeId).map((e) => (
            <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>
          ))}
        </EmpFSelect>
        <EmpFSelect label="Work Location" value={form.workLocation} onChange={(e) => setForm({ ...form, workLocation: e.target.value })}>
          <option value="">— None —</option>
          {workLocations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
        </EmpFSelect>
      </div>
      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          <Check className="h-4 w-4" />
          {mutation.isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("personal");

  const { user: currentUser, updateUser } = useAuthStore();
  const isAdmin = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "HR_ADMIN" || currentUser?.role === "DEPT_HEAD";
  const isSelfView = currentUser?.id === id;
  const canEditPhoto = isAdmin || isSelfView;
  const permissions = usePermissions();

  // Map each profile tab to its controlling permission module
  const TAB_MODULE: Record<string, string> = {
    personal:  "EMP_PROFILE",
    education: "EMP_PROFILE",
    documents: "EMP_DOCUMENTS",
    salary:    "EMP_SALARY",
    bank:      "EMP_BANK",
    payout:    "EMP_PAYOUT",
    leaves:    "EMP_LEAVES",
    claims:    "EMP_LEAVES",
    training:  "TRAINING",
    policies:  "POLICIES",
  };

  const canViewTab = (tabId: string) => {
    const module = TAB_MODULE[tabId];
    if (!module) return true;
    return permissions[module]?.canView ?? false;
  };

  const effectiveNavGroups = isAdmin
    ? NAV_GROUPS
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => canViewTab(item.id)),
        }))
        .filter((group) => group.items.length > 0)
    : [
        {
          label: "Profile",
          items: [
            { id: "personal",  label: "Personal",      icon: User     },
            { id: "documents", label: "Documents",     icon: FileText },
          ],
        },
        {
          label: "Employment",
          items: [
            { id: "education", label: "Education",      icon: GraduationCap },
            { id: "salary",    label: "Salary",         icon: Wallet        },
            { id: "bank",      label: "Bank",            icon: CreditCard    },
            { id: "payout",    label: "Monthly Payout",  icon: TrendingUp    },
          ],
        },
      ];
  const photoRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  async function handlePhotoUpload(file: File) {
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = localStorage.getItem("cadb_access_token");
      const res = await fetch(`${API_BASE}/api/v1/employees/${id}/photo`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Upload failed");
      }
      const json = await res.json();
      qc.invalidateQueries({ queryKey: ["employee", id] });
      if (currentUser?.id === id) updateUser({ photoUrl: json.data.photoUrl });
      toast.success("Profile photo updated");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setPhotoUploading(false);
    }
  }

  const adminCanEdit    = (mod: string) => isAdmin && (permissions[mod]?.canEdit   ?? false);
  const adminCanCreate  = (mod: string) => isAdmin && (permissions[mod]?.canCreate ?? false);
  const adminCanDelete  = (mod: string) => isAdmin && (permissions[mod]?.canDelete ?? false);
  const canEdit = adminCanEdit("EMP_PROFILE") || isSelfView;
  const isSA = currentUser?.role === "SUPER_ADMIN";
  const { data: customRoles = [] } = useQuery<{ name: string; label: string }[]>({
    queryKey: ["custom-roles"],
    queryFn: () => api.get("/api/v1/roles/custom").then((r) => r.data.data),
    enabled: isSA,
    staleTime: 5 * 60 * 1000,
  });
  const [editingPersonal, setEditingPersonal] = useState(() => searchParams.get("edit") === "true");
  const [editingRole, setEditingRole] = useState(false);
  const [roleDraft, setRoleDraft] = useState("");
  const [editingEmployment, setEditingEmployment] = useState(false);
  const [editingSalary, setEditingSalary] = useState(false);

  // Modals
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [showAddQual, setShowAddQual] = useState(false);
  const [showAddCert, setShowAddCert] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);
  const [editingBank, setEditingBank] = useState<any>(null);

  const resetPasswordMutation = useMutation({
    mutationFn: () => api.post(`/api/v1/auth/reset-password/${id}`),
    onSuccess: (res) => setResetResult(res.data.data.temporaryPassword),
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Reset failed"),
  });

  const deleteQualMutation = useMutation({
    mutationFn: (qualId: string) => api.delete(`/api/v1/employees/${id}/qualifications/${qualId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["qualifications", id] }); toast.success("Removed"); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const deleteCertMutation = useMutation({
    mutationFn: (certId: string) => api.delete(`/api/v1/employees/${id}/certifications/${certId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["certifications", id] }); toast.success("Removed"); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const deleteBankMutation = useMutation({
    mutationFn: (bankId: string) => api.delete(`/api/v1/employees/${id}/bank-details/${bankId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank-details", id] }); toast.success("Account removed"); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  // Queries
  const { data: emp, isLoading } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => api.get(`/api/v1/employees/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: qualifications } = useQuery({
    queryKey: ["qualifications", id],
    queryFn: () => api.get(`/api/v1/employees/${id}/qualifications`).then((r) => r.data.data),
    enabled: activeTab === "education",
  });

  const { data: certifications } = useQuery({
    queryKey: ["certifications", id],
    queryFn: () => api.get(`/api/v1/employees/${id}/certifications`).then((r) => r.data.data),
    enabled: activeTab === "education",
  });

  const { data: documents } = useQuery({
    queryKey: ["documents", id],
    queryFn: () => api.get(`/api/v1/employees/${id}/documents`).then((r) => r.data.data),
    enabled: activeTab === "documents",
  });

  const { data: bankDetails } = useQuery({
    queryKey: ["bank-details", id],
    queryFn: () => api.get(`/api/v1/employees/${id}/bank-details`).then((r) => r.data.data),
    enabled: activeTab === "bank",
  });

  const { data: salaryConfig } = useQuery({
    queryKey: ["salary-config", id],
    queryFn: () => api.get(`/api/v1/employees/${id}/salary-config`).then((r) => r.data.data),
    enabled: activeTab === "salary" || activeTab === "payout" || activeTab === "leaves",
  });

  const { data: bonusPlans } = useQuery({
    queryKey: ["bonus-plans", id],
    queryFn: () => api.get(`/api/v1/employees/${id}/bonus-plans`).then((r) => r.data.data),
    enabled: activeTab === "salary",
  });

  const { data: leaveBalances } = useQuery({
    queryKey: ["leave-balances", id],
    queryFn: () => api.get(`/api/v1/employees/${id}/leave-balances`).then((r) => r.data.data),
    enabled: activeTab === "leaves",
  });

  const { data: myLeavePolicy } = useQuery({
    queryKey: ["my-leave-policy", id],
    queryFn: () => api.get(`/api/v1/leave-policies/my`).then((r) => r.data.data),
    enabled: activeTab === "leaves",
  });

  const { data: myLeaves } = useQuery({
    queryKey: ["leaves", id],
    queryFn: () => api.get(`/api/v1/leaves/my`).then((r) => r.data.data),
    enabled: activeTab === "leaves",
  });

  const { data: claims } = useQuery({
    queryKey: ["claims", id],
    queryFn: () => api.get(`/api/v1/claims/my`).then((r) => r.data.data),
    enabled: activeTab === "claims",
  });

  const { data: claimThreshold } = useQuery({
    queryKey: ["claim-threshold"],
    queryFn: () => api.get(`/api/v1/claims/threshold`).then((r) => r.data.data.threshold as number),
    enabled: activeTab === "claims",
  });

  const { data: enrollments } = useQuery({
    queryKey: ["enrollments", id],
    queryFn: () => api.get(`/api/v1/training/my-enrollments`).then((r) => r.data.data),
    enabled: activeTab === "training",
  });

  const { data: policies } = useQuery({
    queryKey: ["policies"],
    queryFn: () => api.get(`/api/v1/policies`).then((r) => r.data.data),
    enabled: activeTab === "policies",
  });

  const { data: deptMemberships, refetch: refetchDepts } = useQuery({
    queryKey: ["dept-memberships", id],
    queryFn: () =>
      api.get(`/api/v1/employees/${id}/departments`).then((r) => r.data.data as {
        primary: { id: string; name: string; code: string; isPrimary: true; isHead: false };
        additional: { membershipId: string; id: string; name: string; code: string; isHead: boolean; addedAt: string; addedBy: string | null }[];
      }),
    enabled: activeTab === "personal" && (isAdmin || isSelfView),
  });

  const { data: allDepts = [] } = useQuery({
    queryKey: ["all-departments"],
    queryFn: () => api.get(`/api/v1/departments`).then((r) => r.data.data as { id: string; name: string; code: string }[]),
    enabled: activeTab === "personal" && isAdmin,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allDesignations = [] } = useQuery({
    queryKey: ["all-designations"],
    queryFn: () => api.get("/api/v1/designations").then((r) => r.data.data as { id: string; title: string }[]),
    enabled: activeTab === "personal" && isAdmin,
    staleTime: 5 * 60 * 1000,
  });

  const { data: profileWorkLocations = [] } = useQuery({
    queryKey: ["work-locations"],
    queryFn: () => api.get("/api/v1/work-locations").then((r) => r.data.data as { id: string; name: string }[]),
    enabled: activeTab === "personal" && isAdmin,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allEmployeesList = [] } = useQuery({
    queryKey: ["employees-list"],
    queryFn: () => api.get("/api/v1/employees", { params: { limit: 500 } }).then((r) => r.data.data),
    enabled: activeTab === "personal" && isAdmin && editingEmployment,
    staleTime: 5 * 60 * 1000,
  });

  const [showAddDept, setShowAddDept] = useState(false);
  const [addDeptId, setAddDeptId] = useState("");
  const [addDeptIsHead, setAddDeptIsHead] = useState(false);
  const [addDeptLoading, setAddDeptLoading] = useState(false);

  async function handleAddDept() {
    if (!addDeptId) return;
    setAddDeptLoading(true);
    try {
      await api.post(`/api/v1/employees/${id}/departments`, { departmentId: addDeptId, isHead: addDeptIsHead });
      toast.success("Added to department");
      refetchDepts();
      setShowAddDept(false);
      setAddDeptId("");
      setAddDeptIsHead(false);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Failed to add department");
    } finally {
      setAddDeptLoading(false);
    }
  }

  async function handleToggleHead(deptId: string, currentIsHead: boolean) {
    try {
      await api.patch(`/api/v1/employees/${id}/departments/${deptId}`, { isHead: !currentIsHead });
      toast.success(currentIsHead ? "Removed as Head of Department" : "Set as Head of Department");
      refetchDepts();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Failed to update");
    }
  }

  const [changingPrimaryDept, setChangingPrimaryDept] = useState(false);
  const [newPrimaryDeptId, setNewPrimaryDeptId] = useState("");
  const [changingPrimaryLoading, setChangingPrimaryLoading] = useState(false);

  async function handleChangePrimaryDept() {
    if (!newPrimaryDeptId) return;
    setChangingPrimaryLoading(true);
    try {
      await api.patch(`/api/v1/employees/${id}`, { departmentId: newPrimaryDeptId });
      queryClient.invalidateQueries({ queryKey: ["employee", id] });
      refetchDepts();
      toast.success("Primary department updated");
      setChangingPrimaryDept(false);
      setNewPrimaryDeptId("");
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Failed to update department");
    } finally {
      setChangingPrimaryLoading(false);
    }
  }

  async function handleRemoveDept(deptId: string) {
    try {
      await api.delete(`/api/v1/employees/${id}/departments/${deptId}`);
      toast.success("Removed from department");
      refetchDepts();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Failed to remove");
    }
  }

  const queryClient = useQueryClient();
  const { data: teamMembers = [], isLoading: teamLoading } = useQuery({
    queryKey: ["employee-team", id],
    queryFn: () => api.get(`/api/v1/employees/${id}/team`).then((r) => r.data.data),
    enabled: activeTab === "team" && isAdmin,
  });

  const [memberSearchQ, setMemberSearchQ] = useState("");
  const { data: memberSearchResults = [] } = useQuery({
    queryKey: ["team-search", id, memberSearchQ],
    queryFn: () =>
      api.get(`/api/v1/employees/${id}/team/search`, { params: { q: memberSearchQ } }).then((r) => r.data.data),
    enabled: activeTab === "team" && isAdmin,
  });

  const addMemberMutation = useMutation({
    mutationFn: (memberId: string) => api.post(`/api/v1/employees/${id}/team`, { memberId }),
    onSuccess: () => {
      toast.success("Team member added");
      queryClient.invalidateQueries({ queryKey: ["employee-team", id] });
      queryClient.invalidateQueries({ queryKey: ["team-search", id] });
      setMemberSearchQ("");
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed to add"),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => api.delete(`/api/v1/employees/${id}/team/${memberId}`),
    onSuccess: () => {
      toast.success("Team member removed");
      queryClient.invalidateQueries({ queryKey: ["employee-team", id] });
      queryClient.invalidateQueries({ queryKey: ["team-search", id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed to remove"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-gray-100 rounded" />
        <div className="h-32 bg-gray-100 rounded-xl" />
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (!emp) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <AlertCircle className="h-10 w-10 mb-3" />
        <p>Employee not found.</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-blue-600 hover:underline">Go back</button>
      </div>
    );
  }

  const addr = emp.currentAddress as any;
  const permAddr = emp.permanentAddress as any;

  // Group documents by type
  const docByType: Record<string, any> = {};
  if (documents) {
    for (const d of documents) {
      docByType[d.type] = d;
    }
  }

  const isSelf = isSelfView;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Back */}
      {isAdmin ? (
        <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-4 w-4" /> Back to Employees
        </button>
      ) : (
        <button onClick={() => router.push("/dashboard/home")} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </button>
      )}

      {/* Profile header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start gap-5">
          {/* Avatar or passport photo — click to upload */}
          <div
            className={`relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white text-2xl font-bold overflow-hidden ${canEditPhoto ? "cursor-pointer group" : ""}`}
            onClick={() => canEditPhoto && photoRef.current?.click()}
            title={canEditPhoto ? "Click to change profile photo" : undefined}
          >
            {emp.photoUrl ? (
              <img src={`${API_BASE}${emp.photoUrl}`} alt="photo" className="h-full w-full object-cover" />
            ) : (
              getInitials(emp.firstName, emp.lastName)
            )}
            {canEditPhoto && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {photoUploading
                  ? <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Camera className="h-6 w-6 text-white" />
                }
              </div>
            )}
          </div>
          <input
            ref={photoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePhotoUpload(f);
              e.target.value = "";
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">
                {emp.firstName} {emp.middleName ? emp.middleName + " " : ""}{emp.lastName}
              </h1>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[emp.status] ?? "bg-gray-100 text-gray-700"}`}>
                {emp.status?.replace("_", " ")}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{emp.designation?.title} · {emp.department?.name}</p>
            <p className="text-xs font-mono text-gray-400 mt-1">{emp.employeeCode}</p>
          </div>
          <div className="hidden sm:flex flex-col gap-1.5 text-xs text-gray-500 shrink-0">
            {adminCanEdit("EMP_PROFILE") && (
              <button
                onClick={() => { setResetResult(null); setShowResetModal(true); }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 transition-colors mb-1"
              >
                <KeyRound className="h-3.5 w-3.5" /> Reset Password
              </button>
            )}
            <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{emp.email}</span>
            <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{emp.personalPhone}</span>
            {addr && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{addr.city}, {addr.state}</span>}
          </div>
        </div>
      </div>

      {/* Nav + content */}
      <div className={isAdmin ? "flex gap-6 items-start" : "space-y-4"}>

        {/* ── Admin: sidebar nav ── */}
        {isAdmin && (
          <nav className="w-44 shrink-0 space-y-5 sticky top-6">
            {effectiveNavGroups.map((group) => (
              <div key={group.label}>
                <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{group.label}</p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          activeTab === item.id
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div>
              <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Admin</p>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveTab("team")}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === "team"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-purple-600 hover:bg-purple-50 hover:text-purple-800"
                  }`}
                >
                  <UsersRound className="h-4 w-4 shrink-0" />
                  Team
                </button>
              </div>
            </div>
          </nav>
        )}

        {/* ── Employee: tab bar ── */}
        {!isAdmin && (
          <div className="flex gap-1 border-b border-gray-200 pb-px">
            {effectiveNavGroups.flatMap((g) => g.items).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === item.id
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div className={isAdmin ? "flex-1 min-w-0 space-y-4" : "space-y-4"}>

        {/* ── Personal ── */}
        {activeTab === "personal" && (
          <div className="space-y-4">
            {/* Edit / View toggle bar */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {editingPersonal
                  ? "Edit your contact, address and emergency details below."
                  : "View your personal profile information."}
              </p>
              {canEdit && !editingPersonal && (
                <button
                  onClick={() => setEditingPersonal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit Profile
                </button>
              )}
            </div>

            {editingPersonal ? (
              <EditPersonalForm emp={emp} employeeId={id} onClose={() => setEditingPersonal(false)} />
            ) : (
            <><Section title="Personal Information">
              <Field label="First Name" value={emp.firstName} />
              <Field label="Middle Name" value={emp.middleName} />
              <Field label="Last Name" value={emp.lastName} />
              <Field label="Gender" value={emp.gender} />
              <Field label="Date of Birth" value={emp.dateOfBirth ? formatDate(emp.dateOfBirth) : null} />
              <Field label="Marital Status" value={emp.maritalStatus} />
              <Field label="Blood Group" value={emp.bloodGroup?.replace("_", " ")} />
              <Field label="Nationality" value={emp.nationality} />
              <Field label="Religion" value={emp.religion} />
              <Field
                label="PAN Number"
                value={emp.pan ?? <span className="text-red-500 text-xs font-medium">Not on file — please update</span>}
              />
            </Section>
            <Section title="Contact">
              <Field label="Personal Phone" value={emp.personalPhone} />
              <Field label="Official Phone" value={emp.officialPhone} />
              <Field label="Official Email" value={emp.email} />
              <Field label="Personal Email" value={emp.personalEmail} />
            </Section>
            <Section title="Current Address">
              <Field label="Line 1" value={addr?.line1} />
              <Field label="Line 2" value={addr?.line2} />
              <Field label="City" value={addr?.city} />
              <Field label="State" value={addr?.state} />
              <Field label="Pincode" value={addr?.pincode} />
              <Field label="Country" value={addr?.country} />
            </Section>
            {permAddr && (
              <Section title="Permanent Address">
                <Field label="Line 1" value={permAddr?.line1} />
                <Field label="Line 2" value={permAddr?.line2} />
                <Field label="City" value={permAddr?.city} />
                <Field label="State" value={permAddr?.state} />
                <Field label="Pincode" value={permAddr?.pincode} />
                <Field label="Country" value={permAddr?.country} />
              </Section>
            )}
            <Section title="Emergency Contact">
              <Field label="Name" value={emp.emergencyContactName} />
              <Field label="Phone" value={emp.emergencyContactPhone} />
              <Field label="Relation" value={emp.emergencyRelation} />
            </Section>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Employment</h3>
                <div className="flex items-center gap-2">
                  {isSelf && !isAdmin && (
                    <span className="text-xs text-gray-400 italic">Managed by HR</span>
                  )}
                  {adminCanEdit("EMP_PROFILE") && !editingEmployment && (
                    <button
                      onClick={() => setEditingEmployment(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  )}
                </div>
              </div>

              {editingEmployment ? (
                <EditEmploymentInlineForm
                  emp={emp}
                  employeeId={id}
                  designations={allDesignations}
                  departments={allDepts}
                  employees={allEmployeesList}
                  workLocations={profileWorkLocations}
                  onClose={() => setEditingEmployment(false)}
                />
              ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                {/* Employee Code — read-only, auto-generated */}
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-0.5">Employee Code</p>
                  <p className="text-sm font-medium text-gray-800 font-mono">{emp.employeeCode ?? "—"}</p>
                </div>
                {/* Role — SA can change via dropdown */}
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-0.5">Access Role</p>
                  {isSA && editingRole ? (
                    <div className="flex items-center gap-1">
                      <select
                        autoFocus
                        value={roleDraft}
                        onChange={(e) => setRoleDraft(e.target.value)}
                        className="rounded border border-blue-400 px-2 py-0.5 text-sm focus:outline-none bg-white"
                      >
                        <option value="EMPLOYEE">Employee</option>
                        <option value="DEPT_HEAD">Manager (Dept Head)</option>
                        <option value="HR_ADMIN">HR Admin</option>
                        <option value="SUPER_ADMIN">Super Admin</option>
                        {customRoles.length > 0 && <option disabled>──────────</option>}
                        {customRoles.map((r) => (
                          <option key={r.name} value={r.name}>{r.label}</option>
                        ))}
                      </select>
                      <button onClick={async () => {
                        try {
                          await api.patch(`/api/v1/employees/${id}`, { role: roleDraft });
                          await queryClient.invalidateQueries({ queryKey: ["employee", id] });
                          toast.success("Role updated");
                          setEditingRole(false);
                        } catch (err: any) {
                          toast.error(err.response?.data?.error ?? "Update failed");
                        }
                      }} className="text-green-600 hover:text-green-800">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setEditingRole(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-gray-800">
                        {{ EMPLOYEE: "Employee", DEPT_HEAD: "Manager", HR_ADMIN: "HR Admin", SUPER_ADMIN: "Super Admin" }[(emp as any).role as string] ?? (emp as any).role ?? "—"}
                      </p>
                      {isSA && (
                        <button
                          onClick={() => { setRoleDraft((emp as any).role ?? "EMPLOYEE"); setEditingRole(true); }}
                          className="text-gray-300 hover:text-blue-500 transition-colors"
                          title="Change role"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-0.5">Status</p>
                  {emp.status ? (
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[emp.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {emp.status.replace(/_/g, " ")}
                    </span>
                  ) : <p className="text-sm text-gray-300">—</p>}
                </div>
                <Field label="Employment Type" value={emp.employmentType?.replace(/_/g, " ")} />
                <Field label="Joining Date" value={emp.joiningDate ? formatDate(emp.joiningDate) : null} />
                <Field label="Confirmation Date" value={emp.confirmationDate ? formatDate(emp.confirmationDate) : null} />
                <Field label="Designation" value={emp.designation?.title} />
                <Field label="Department" value={emp.department?.name} />
                <Field label="Reporting To" value={emp.reportingTo ? `${emp.reportingTo.firstName} ${emp.reportingTo.lastName}` : null} />
                <Field label="Work Location" value={(emp as any).workLocation} />
              </div>
              )}
            </div>

            {/* ── Department Memberships ── */}
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Department Memberships</h3>
                {adminCanCreate("EMP_PROFILE") && (
                  <button
                    onClick={() => setShowAddDept(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Department
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {/* Primary department */}
                {changingPrimaryDept ? (
                  <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/50 px-4 py-3">
                    <Building2 className="h-4 w-4 text-blue-400 shrink-0" />
                    <select
                      autoFocus
                      value={newPrimaryDeptId}
                      onChange={(e) => setNewPrimaryDeptId(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Select new primary department —</option>
                      {allDepts.filter((d) => d.id !== emp.departmentId).map((d) => (
                        <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                    <button
                      onClick={handleChangePrimaryDept}
                      disabled={!newPrimaryDeptId || changingPrimaryLoading}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> Save
                    </button>
                    <button
                      onClick={() => { setChangingPrimaryDept(false); setNewPrimaryDeptId(""); }}
                      className="p-1 rounded text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-blue-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{emp.department?.name}</p>
                      <p className="text-xs text-gray-400">{emp.department?.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 rounded-full px-2.5 py-0.5 font-medium">Primary</span>
                    {adminCanEdit("EMP_PROFILE") && (
                      <button
                        onClick={() => { setNewPrimaryDeptId(""); setChangingPrimaryDept(true); }}
                        className="text-xs text-gray-400 hover:text-blue-600 font-medium hover:underline"
                        title="Change primary department"
                      >
                        Change
                      </button>
                    )}
                  </div>
                </div>
                )}

                {/* Additional departments from memberships */}
                {deptMemberships?.additional.map((m) => (
                  <div key={m.membershipId} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{m.name}</p>
                        <p className="text-xs text-gray-400">{m.code}{m.addedBy ? ` · Added by ${m.addedBy}` : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* HoD toggle */}
                      {adminCanEdit("EMP_PROFILE") ? (
                        <button
                          onClick={() => handleToggleHead(m.id, m.isHead)}
                          title={m.isHead ? "Remove as Head of Department" : "Set as Head of Department"}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
                            m.isHead
                              ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                              : "bg-gray-50 text-gray-400 border-gray-200 hover:border-amber-200 hover:text-amber-600"
                          }`}
                        >
                          <Star className={`h-3 w-3 ${m.isHead ? "fill-amber-500 text-amber-500" : ""}`} />
                          {m.isHead ? "HoD" : "Set HoD"}
                        </button>
                      ) : m.isHead ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5 font-medium">
                          <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> HoD
                        </span>
                      ) : null}

                      {adminCanDelete("EMP_PROFILE") && (
                        <button
                          onClick={() => handleRemoveDept(m.id)}
                          className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Remove from department"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {deptMemberships && deptMemberships.additional.length === 0 && (
                  <p className="text-xs text-gray-400 italic px-1">No additional department memberships.</p>
                )}
              </div>

              {/* Add department inline form */}
              {showAddDept && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                  <Building2 className="h-4 w-4 text-blue-400 shrink-0" />
                  <select
                    value={addDeptId}
                    onChange={(e) => setAddDeptId(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="">Select department…</option>
                    {allDepts
                      .filter((d) => d.id !== emp.department?.id && !deptMemberships?.additional.some((m) => m.id === d.id))
                      .map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={addDeptIsHead}
                      onChange={(e) => setAddDeptIsHead(e.target.checked)}
                      className="h-3.5 w-3.5 rounded"
                    />
                    Head of Dept
                  </label>
                  <button
                    onClick={handleAddDept}
                    disabled={!addDeptId || addDeptLoading}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {addDeptLoading ? "Adding…" : "Add"}
                  </button>
                  <button
                    onClick={() => { setShowAddDept(false); setAddDeptId(""); setAddDeptIsHead(false); }}
                    className="p-1 rounded text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            </>
            )}
          </div>
        )}

        {/* ── Qualifications ── */}
        {/* ── Education (Qualifications + Certifications) ── */}
        {activeTab === "education" && (
          <div className="space-y-6">
            {/* Academic Qualifications */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Academic Qualifications</h2>
                {(adminCanCreate("EMP_PROFILE") || isSelfView) && (
                  <button
                    onClick={() => setShowAddQual(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Qualification
                  </button>
                )}
              </div>

              {["SCHOOL", "UG", "PG", "PHD", "DIPLOMA", "CERTIFICATION", "OTHER"].map((level) => {
                const items = qualifications?.filter((q: any) => q.level === level) ?? [];
                if (!items.length) return null;
                return (
                  <div key={level}>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{LEVEL_LABELS[level]}</p>
                    <div className="space-y-2">
                      {items.map((q: any) => (
                        <div key={q.id} className="rounded-xl border border-gray-200 bg-white p-5">
                          <div className="flex items-start justify-between">
                            <div className="space-y-0.5">
                              <p className="font-semibold text-gray-900">{q.degreeName}</p>
                              {q.specialization && <p className="text-sm text-blue-600">{q.specialization}</p>}
                              <p className="text-sm text-gray-600">{q.institution}</p>
                              <p className="text-xs text-gray-400">{q.boardUniversity}</p>
                            </div>
                            <div className="flex items-start gap-3 shrink-0">
                              <div className="text-right">
                                <p className="text-sm font-semibold text-gray-800">{q.yearOfPassing}</p>
                                {q.percentage != null && <p className="text-xs text-gray-500">{q.percentage}%</p>}
                                {q.cgpa != null && <p className="text-xs text-gray-500">CGPA {q.cgpa}</p>}
                              </div>
                              {(adminCanDelete("EMP_PROFILE") || isSelfView) && (
                                <button
                                  onClick={() => deleteQualMutation.mutate(q.id)}
                                  disabled={deleteQualMutation.isPending}
                                  className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50 mt-0.5"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {!qualifications?.length && <Empty label="No qualifications added yet. Click 'Add Qualification' to get started." />}
            </div>

            <hr className="border-gray-100" />

            {/* Professional Certifications */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Professional Certifications</h2>
                {(adminCanCreate("EMP_PROFILE") || isSelfView) && (
                  <button
                    onClick={() => setShowAddCert(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Certification
                  </button>
                )}
              </div>

              {!certifications?.length ? (
                <Empty label="No certifications added yet." />
              ) : (
                certifications.map((c: any) => (
                  <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-gray-900">{c.name}</p>
                        <p className="text-sm text-gray-500">{c.issuingBody}</p>
                        {c.credentialId && <p className="text-xs text-gray-400">ID: {c.credentialId}</p>}
                      </div>
                      <div className="flex items-start gap-3 shrink-0">
                        <div className="text-right text-xs text-gray-400">
                          <p>Issued: {formatDate(c.issueDate)}</p>
                          {c.expiryDate && <p className="mt-0.5">Expires: {formatDate(c.expiryDate)}</p>}
                          {c.isVerified && <span className="inline-flex mt-1 items-center gap-1 text-green-600 font-medium">✓ Verified</span>}
                        </div>
                        {(adminCanDelete("EMP_PROFILE") || isSelfView) && (
                          <button
                            onClick={() => deleteCertMutation.mutate(c.id)}
                            disabled={deleteCertMutation.isPending}
                            className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50 mt-0.5"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Documents ── */}
        {activeTab === "documents" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-1">Identity & KYC Documents</h2>
              <p className="text-xs text-gray-400 mb-4">Upload official documents for identity verification and records. Accepted: JPG, PNG, PDF (max 5 MB each).</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {KYC_DOC_TYPES.map((docType) => (
                  <DocumentCard key={docType} docType={docType} employeeId={id} existing={docByType[docType] ?? null} canWrite={adminCanCreate("EMP_DOCUMENTS") || adminCanDelete("EMP_DOCUMENTS") || isSelfView} />
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-1">Educational Documents</h2>
              <p className="text-xs text-gray-400 mb-4">Upload degree certificates and educational qualifications. Accepted: JPG, PNG, PDF (max 5 MB each).</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {EDU_DOC_TYPES.map((docType) => (
                  <DocumentCard key={docType} docType={docType} employeeId={id} existing={docByType[docType] ?? null} canWrite={adminCanCreate("EMP_DOCUMENTS") || adminCanDelete("EMP_DOCUMENTS") || isSelfView} />
                ))}
              </div>
            </div>

            <OtherDocumentsSection
              employeeId={id}
              docs={(documents ?? []).filter((d: any) => d.type === "OTHER")}
              canWrite={adminCanCreate("EMP_DOCUMENTS") || adminCanDelete("EMP_DOCUMENTS") || isSelfView}
            />
          </div>
        )}

        {/* ── Salary ── */}
        {activeTab === "salary" && (
          <div className="space-y-4">
            {/* Permanent salary structure — first */}
            <CollapsibleCard
              title="Salary Structure"
              icon={Wallet}
              defaultOpen={true}
              action={
                adminCanEdit("EMP_SALARY") && !editingSalary ? (
                  <button
                    onClick={() => setEditingSalary(true)}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {salaryConfig ? "Edit" : "Add Salary"}
                  </button>
                ) : undefined
              }
            >
              {editingSalary ? (
                <SalaryEditForm
                  employeeId={id}
                  employmentType={emp?.employmentType ?? "FULL_TIME"}
                  existing={salaryConfig}
                  onClose={() => setEditingSalary(false)}
                />
              ) : salaryConfig ? (
                <SalaryConfigCard
                  config={salaryConfig}
                  hasActivePlan={(bonusPlans ?? []).some((p: any) => p.status === "ACTIVE")}
                />
              ) : (
                <div className="px-5 py-8 text-center text-sm text-gray-400">
                  No salary structure defined yet.
                  {adminCanEdit("EMP_SALARY") && (
                    <button
                      onClick={() => setEditingSalary(true)}
                      className="ml-2 text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Add now
                    </button>
                  )}
                </div>
              )}
            </CollapsibleCard>

            {/* Bonus plans — second */}
            <BonusPlansCard
              employeeId={id}
              canAppraise={isAdmin || currentUser?.role === "DEPT_HEAD"}
            />
          </div>
        )}

        {/* ── Bank ── */}
        {activeTab === "bank" && (
          <div className="space-y-4">
            <CollapsibleCard
              title="Bank Accounts"
              icon={Building2}
              defaultOpen={true}
              action={
                (adminCanCreate("EMP_BANK") || isSelfView) ? (
                  <button
                    onClick={() => setShowAddBank(true)}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Account
                  </button>
                ) : undefined
              }
            >
              {!bankDetails?.length ? (
                <div className="py-8 text-center text-sm text-gray-400">
                  No bank accounts added. Add one for salary credit.
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {bankDetails.map((b: any) => (
                    <div key={b.id} className="px-5 py-4 flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <CreditCard className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-800">{b.bankName}</p>
                            {b.isPrimary && (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Primary</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{b.accountName}</p>
                          <p className="text-xs font-mono text-gray-400 mt-0.5">
                            ••••{b.accountNumber.slice(-4)} · IFSC: {b.ifscCode}
                          </p>
                          <p className="text-xs text-gray-400">{b.branchName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {(adminCanEdit("EMP_BANK") || isSelfView) && (
                          <button
                            onClick={() => setEditingBank(b)}
                            className="text-gray-300 hover:text-blue-500 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {(adminCanDelete("EMP_BANK") || isSelfView) && (
                          <button
                            onClick={() => deleteBankMutation.mutate(b.id)}
                            disabled={deleteBankMutation.isPending}
                            className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleCard>
          </div>
        )}

        {/* ── Monthly Payout ── */}
        {activeTab === "payout" && (
          <div className="space-y-4">
            <MonthlySalarySlip employeeId={id} salaryConfig={salaryConfig} />
          </div>
        )}

        {/* ── Leaves ── */}
        {activeTab === "leaves" && (
          <div className="space-y-4">
            {/* Leave policy banner */}
            {myLeavePolicy ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 flex items-start gap-3">
                <CalendarOff className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-900">{myLeavePolicy.name}</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Your leave entitlements:{" "}
                    {(myLeavePolicy.rules as any[]).filter((r: any) => r.daysPerYear > 0)
                      .map((r: any) => `${r.daysPerYear} ${r.leaveType.charAt(0) + r.leaveType.slice(1).toLowerCase().replace("_", " ")}`)
                      .join(" · ")}
                  </p>
                </div>
              </div>
            ) : !leaveBalances?.length ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-700">
                No leave policy assigned to your grade yet. Contact HR to set up your leave entitlements.
              </div>
            ) : null}

            {/* Leave balance cards — accrual view */}
            {leaveBalances?.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                  <p className="font-semibold text-gray-900 text-sm">Leave Balance Summary</p>
                  <p className="text-xs text-gray-400">
                    {(() => { const d = new Date(); const fy = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `FY ${fy}–${fy + 1} · accrued monthly`; })()}
                  </p>
                </div>
                <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  {leaveBalances.map((lb: any) => {
                    const LEAVE_COLORS: Record<string, { bg: string; accent: string }> = {
                      CASUAL:       { bg: "bg-blue-50",   accent: "text-blue-600" },
                      SICK:         { bg: "bg-red-50",    accent: "text-red-600" },
                      EARNED:       { bg: "bg-green-50",  accent: "text-green-600" },
                      MATERNITY:    { bg: "bg-pink-50",   accent: "text-pink-600" },
                      PATERNITY:    { bg: "bg-indigo-50", accent: "text-indigo-600" },
                      COMPENSATORY: { bg: "bg-orange-50", accent: "text-orange-600" },
                      UNPAID:       { bg: "bg-gray-50",   accent: "text-gray-600" },
                      SPECIAL:      { bg: "bg-purple-50", accent: "text-purple-600" },
                    };
                    const colors = LEAVE_COLORS[lb.leaveType] ?? { bg: "bg-gray-50", accent: "text-gray-600" };
                    const pct = lb.accrued > 0 ? Math.min(100, (lb.availed / lb.accrued) * 100) : 0;
                    return (
                      <div key={lb.id} className={`rounded-xl p-4 ${colors.bg}`}>
                        <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${colors.accent}`}>
                          {lb.leaveType.replace(/_/g, " ")}
                        </p>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Accrued</span>
                            <span className="font-semibold text-gray-800">{lb.accrued}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Availed</span>
                            <span className="font-semibold text-gray-800">{lb.availed}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs border-t border-black/5 pt-1.5">
                            <span className="text-gray-500">Balance</span>
                            <span className={`font-bold text-sm ${lb.balance <= 0 ? "text-red-600" : colors.accent}`}>
                              {lb.balance}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 h-1.5 rounded-full bg-black/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : "bg-current opacity-60"} ${colors.accent}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="mt-1 text-right text-[10px] text-gray-400">
                          {lb.used} used · {lb.pending} pending
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50">
                  <p className="text-xs text-gray-500">
                    Annual entitlement:{" "}
                    {leaveBalances.map((lb: any) =>
                      `${lb.leaveType.charAt(0) + lb.leaveType.slice(1).toLowerCase().replace(/_/g, " ")} ${lb.allocated}`
                    ).join(" · ")}
                  </p>
                </div>
              </div>
            )}

            {!myLeaves?.length ? (
              <Empty label="No leave applications." />
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-5 py-3 text-left text-xs text-gray-500 font-semibold uppercase">Type</th>
                      <th className="px-5 py-3 text-left text-xs text-gray-500 font-semibold uppercase">From</th>
                      <th className="px-5 py-3 text-left text-xs text-gray-500 font-semibold uppercase">To</th>
                      <th className="px-5 py-3 text-left text-xs text-gray-500 font-semibold uppercase">Days</th>
                      <th className="px-5 py-3 text-left text-xs text-gray-500 font-semibold uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {myLeaves.map((l: any) => (
                      <tr key={l.id} className="hover:bg-gray-50 text-sm">
                        <td className="px-5 py-3">{l.leaveType}</td>
                        <td className="px-5 py-3">{formatDate(l.fromDate)}</td>
                        <td className="px-5 py-3">{formatDate(l.toDate)}</td>
                        <td className="px-5 py-3">{l.totalDays}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            l.status === "APPROVED" ? "bg-green-100 text-green-700" :
                            l.status === "REJECTED" ? "bg-red-100 text-red-700" :
                            "bg-yellow-100 text-yellow-700"}`}>
                            {l.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Loss of Pay section */}
            <LopSection employeeId={id} salaryConfig={salaryConfig} />
          </div>
        )}

        {/* ── Claims ── */}
        {activeTab === "claims" && (
          <div className="space-y-4">
            {/* Entitlement / payout context banner */}
            {(() => {
              const empType = emp?.employmentType as string | undefined;
              const isVariable = empType === "PART_TIME" || empType === "VISITING";
              const approved = (claims ?? []).filter((c: any) => c.status === "APPROVED" || c.status === "PAID");
              const paid     = (claims ?? []).filter((c: any) => c.status === "PAID");
              const pending  = (claims ?? []).filter((c: any) => c.status === "SUBMITTED");
              const approvedTotal = approved.reduce((s: number, c: any) => s + (c.approvedAmount ?? c.claimedAmount), 0);
              const paidTotal     = paid.reduce((s: number, c: any) => s + (c.approvedAmount ?? c.claimedAmount), 0);
              const thr = claimThreshold ?? 250;
              return (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-2">
                  <p className="text-sm font-semibold text-blue-800">Reimbursement Entitlement</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="bg-white rounded-lg py-2 px-3 shadow-sm">
                      <p className="text-xs text-gray-500">Approved (total)</p>
                      <p className="text-base font-bold text-green-700">{formatCurrency(approvedTotal)}</p>
                    </div>
                    <div className="bg-white rounded-lg py-2 px-3 shadow-sm">
                      <p className="text-xs text-gray-500">Already Paid</p>
                      <p className="text-base font-bold text-emerald-600">{formatCurrency(paidTotal)}</p>
                    </div>
                    <div className="bg-white rounded-lg py-2 px-3 shadow-sm">
                      <p className="text-xs text-gray-500">Pending Approval</p>
                      <p className="text-base font-bold text-amber-600">{pending.length} claim{pending.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="bg-white rounded-lg py-2 px-3 shadow-sm">
                      <p className="text-xs text-gray-500">Receipt Required Above</p>
                      <p className="text-base font-bold text-gray-700">{formatCurrency(thr)}</p>
                    </div>
                  </div>
                  {isVariable ? (
                    <p className="text-xs text-blue-700 mt-1">
                      Approved claims are reimbursed separately from the variable monthly payout — they are not included in the per-hour / per-visit calculation.
                    </p>
                  ) : (
                    <p className="text-xs text-blue-700 mt-1">
                      Approved claims are added to the monthly salary payout. Amounts marked <span className="font-semibold">Paid</span> have already been disbursed.
                    </p>
                  )}
                </div>
              );
            })()}

            {!claims?.length ? (
              <Empty label="No reimbursement claims." />
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-5 py-3 text-left text-xs text-gray-500 font-semibold uppercase">Claim #</th>
                      <th className="px-5 py-3 text-left text-xs text-gray-500 font-semibold uppercase">Type</th>
                      <th className="px-5 py-3 text-left text-xs text-gray-500 font-semibold uppercase">Title</th>
                      <th className="px-5 py-3 text-left text-xs text-gray-500 font-semibold uppercase">Claimed</th>
                      <th className="px-5 py-3 text-left text-xs text-gray-500 font-semibold uppercase">Approved</th>
                      <th className="px-5 py-3 text-left text-xs text-gray-500 font-semibold uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {claims.map((c: any) => (
                      <tr key={c.id} className="hover:bg-gray-50 text-sm">
                        <td className="px-5 py-3 font-mono text-xs text-gray-400">{c.claimNumber}</td>
                        <td className="px-5 py-3">{c.claimType}</td>
                        <td className="px-5 py-3">{c.title}</td>
                        <td className="px-5 py-3">{formatCurrency(c.claimedAmount)}</td>
                        <td className="px-5 py-3">{c.approvedAmount ? formatCurrency(c.approvedAmount) : "—"}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            c.status === "APPROVED" || c.status === "PAID" ? "bg-green-100 text-green-700" :
                            c.status === "REJECTED" ? "bg-red-100 text-red-700" :
                            c.status === "SUBMITTED" ? "bg-blue-100 text-blue-700" :
                            "bg-gray-100 text-gray-700"}`}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Training ── */}
        {activeTab === "training" && (
          <div className="space-y-3">
            {!enrollments?.length ? (
              <Empty label="No training enrollments." />
            ) : (
              enrollments.map((e: any) => (
                <div key={e.id} className="rounded-xl border border-gray-200 bg-white p-5 flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{e.program.title}</p>
                    <p className="text-sm text-gray-500">{e.program.provider ?? "Internal"} · {e.program.mode}</p>
                    {e.completedAt && <p className="text-xs text-green-600 mt-1">Completed {formatDate(e.completedAt)}</p>}
                    {e.score != null && <p className="text-xs text-gray-400">Score: {e.score}</p>}
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${
                    e.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                    e.status === "IN_PROGRESS" ? "bg-yellow-100 text-yellow-700" :
                    "bg-blue-100 text-blue-700"}`}>
                    {e.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Policies ── */}
        {activeTab === "policies" && (
          <div className="space-y-3">
            {!policies?.length ? (
              <Empty label="No policy documents published." />
            ) : (
              policies.map((p: any) => (
                <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{p.title}</p>
                    <p className="text-xs text-gray-400">{p.category} · v{p.version} · {formatDate(p.publishedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.requiresAck && <span className="text-xs text-orange-600 font-medium">Requires Ack</span>}
                    <a href={p.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View</a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Team (admin only) ── */}
        {activeTab === "team" && (
          <div className="space-y-5">
            {/* Search & add */}
            <div className="rounded-xl border border-purple-200 bg-purple-50 overflow-hidden">
              <div className="px-5 py-4 border-b border-purple-100 flex items-center gap-2">
                <UsersRound className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="font-semibold text-purple-900 text-sm">Add Team Member</p>
                  <p className="text-xs text-purple-600 mt-0.5">Search any employee to add to this person's team</p>
                </div>
              </div>
              <div className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    value={memberSearchQ}
                    onChange={(e) => setMemberSearchQ(e.target.value)}
                    placeholder="Search employees…"
                    className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {memberSearchResults.length > 0 && (
                  <ul className="mt-2 rounded-lg border border-gray-100 divide-y divide-gray-50 max-h-56 overflow-y-auto">
                    {memberSearchResults.map((emp: any) => (
                      <li key={emp.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                          <p className="text-xs text-gray-500">{emp.employeeCode} · {emp.designation?.title} · {emp.department?.name}</p>
                        </div>
                        <button
                          onClick={() => addMemberMutation.mutate(emp.id)}
                          disabled={addMemberMutation.isPending}
                          className="ml-3 shrink-0 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          <Plus className="h-3 w-3" /> Add
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {memberSearchQ.length > 0 && memberSearchResults.length === 0 && (
                  <p className="mt-2 text-xs text-gray-400 text-center py-2">No matching employees found</p>
                )}
              </div>
            </div>

            {/* Current team list */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <p className="font-semibold text-gray-900 text-sm">
                  Team Members
                  <span className="ml-2 text-xs font-normal text-gray-400">({teamMembers.length})</span>
                </p>
              </div>
              {teamLoading ? (
                <div className="p-5 space-y-3">
                  {[1, 2].map((i) => <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />)}
                </div>
              ) : teamMembers.length === 0 ? (
                <div className="py-10 text-center">
                  <UsersRound className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">No team members added yet</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {teamMembers.map((tm: any) => (
                    <li key={tm.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold overflow-hidden">
                        {tm.member.photoUrl
                          ? <img src={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}${tm.member.photoUrl}`} alt="" className="h-full w-full object-cover" />
                          : `${tm.member.firstName[0]}${tm.member.lastName[0]}`
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{tm.member.firstName} {tm.member.lastName}</p>
                        <p className="text-xs text-gray-500">{tm.member.employeeCode} · {tm.member.designation?.title}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {tm.presence === "ON_LEAVE" ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700">
                            <CalendarOff className="h-3 w-3" /> On Leave
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                            <CheckCircle2 className="h-3 w-3" /> Present
                          </span>
                        )}
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${tm.member.firstName} ${tm.member.lastName} from this team?`))
                              removeMemberMutation.mutate(tm.memberId);
                          }}
                          disabled={removeMemberMutation.isPending}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Tasks summary (placeholder) */}
            {teamMembers.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-gray-400" />
                  <p className="font-semibold text-gray-900 text-sm">Tasks Overview</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {teamMembers.map((tm: any) => (
                    <div key={tm.id} className="flex items-center gap-3 px-5 py-3">
                      <p className="flex-1 text-sm text-gray-700">{tm.member.firstName} {tm.member.lastName}</p>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-gray-500">Total <strong className="text-gray-800">{tm.tasks.total}</strong></span>
                        <span className="text-orange-600">Due <strong>{tm.tasks.due}</strong></span>
                        <span className="text-green-600">Done <strong>{tm.tasks.completed}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        </div>
      </div>

      {/* ── Modals ── */}
      {showAddQual && <AddQualificationModal employeeId={id} onClose={() => setShowAddQual(false)} />}
      {showAddCert && <AddCertificationModal employeeId={id} onClose={() => setShowAddCert(false)} />}
      {showAddBank && <AddBankModal employeeId={id} onClose={() => setShowAddBank(false)} />}
      {editingBank && <BankForm employeeId={id} existing={editingBank} onClose={() => setEditingBank(null)} />}

      {/* Reset Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-orange-600" /> Reset Password
              </h2>
              <button onClick={() => { setShowResetModal(false); setResetResult(null); }}>
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            {!resetResult ? (
              <>
                <p className="text-sm text-gray-600 mb-5">
                  This will generate a new temporary password for{" "}
                  <span className="font-semibold">{emp.firstName} {emp.lastName}</span> and force them to
                  set a new password on next login. All existing sessions will be invalidated.
                </p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setShowResetModal(false); setResetResult(null); }} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button
                    onClick={() => resetPasswordMutation.mutate()}
                    disabled={resetPasswordMutation.isPending}
                    className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60"
                  >
                    {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg bg-green-50 border border-green-200 p-4 mb-4">
                  <p className="text-xs font-semibold text-green-700 uppercase mb-1">Temporary Password</p>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-lg font-bold text-green-800 tracking-wider">{resetResult}</code>
                    <button onClick={() => { navigator.clipboard.writeText(resetResult); toast.success("Copied!"); }} className="text-green-600 hover:text-green-800">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-4">Share this password securely. The employee will be prompted to change it on next login.</p>
                <button onClick={() => { setShowResetModal(false); setResetResult(null); }} className="w-full px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">Done</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
