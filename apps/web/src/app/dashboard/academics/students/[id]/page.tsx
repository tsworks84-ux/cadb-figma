"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { usePermissions } from "@/hooks/usePermissions";
import {
  ArrowLeft, User, ClipboardList, GraduationCap, CalendarCheck,
  BookOpenCheck, BarChart2, MessageSquare, Bell, FolderOpen,
  LifeBuoy, KeyRound, Edit2, X, Save, Camera, Phone, Mail,
  BadgeCheck, Shield, RotateCcw, Archive, ArchiveRestore,
  BookOpen, Calendar, CreditCard, Building2, MapPin, Hash,
  ChevronDown, ChevronUp, CheckCircle2, Clock, AlertCircle, Plus,
  Users2, Banknote, Trash2, IndianRupee, Info, AlertTriangle, Pin,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

// ── Helpers ────────────────────────────────────────────────────────────────────

function FInput({ label, value, onChange, type = "text", disabled = false, className = "" }: {
  label: string; value: string; onChange?: (v: string) => void;
  type?: string; disabled?: boolean; className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-xs font-medium text-gray-500">{label}</label>
      {disabled ? (
        <p className="text-sm text-gray-800 py-2 px-3 bg-gray-50 rounded-lg border border-transparent min-h-[38px] break-words">
          {value || <span className="text-gray-400">—</span>}
        </p>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white text-gray-700"
        />
      )}
    </div>
  );
}

function FSelect({ label, value, onChange, disabled = false, children, className = "" }: {
  label: string; value: string; onChange?: (v: string) => void;
  disabled?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-xs font-medium text-gray-500">{label}</label>
      {disabled ? (
        <p className="text-sm text-gray-800 py-2 px-3 bg-gray-50 rounded-lg border border-transparent min-h-[38px]">
          {value || <span className="text-gray-400">—</span>}
        </p>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white text-gray-700"
        >
          {children}
        </select>
      )}
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, action }: {
  title: string; icon: any; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        </div>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

type AnnType = "GENERAL" | "IMPORTANT" | "URGENT";
const ANN_META: Record<AnnType, { border: string; bg: string; icon: React.ElementType; iconColor: string }> = {
  GENERAL:   { border: "border-l-blue-400",   bg: "bg-blue-50",   icon: Info,          iconColor: "text-blue-500"   },
  IMPORTANT: { border: "border-l-orange-400", bg: "bg-orange-50", icon: AlertTriangle,  iconColor: "text-orange-500" },
  URGENT:    { border: "border-l-red-500",    bg: "bg-red-50",    icon: AlertCircle,   iconColor: "text-red-500"    },
};

function NoticeBoardTab() {
  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["student-announcements-admin"],
    queryFn: () => api.get("/api/v1/announcements/all").then((r) =>
      (r.data.data as any[]).filter((a: any) => a.audience === "STUDENTS" && a.status === "PUBLISHED")
    ),
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
          <Bell className="h-7 w-7 text-indigo-300" />
        </div>
        <p className="font-semibold text-gray-500">Notice Board</p>
        <p className="text-sm text-gray-400 mt-1">No student notices published yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
        Published notices for students ({announcements.length})
      </p>
      {announcements.map((a: any) => {
        const meta = ANN_META[a.type as AnnType] ?? ANN_META.GENERAL;
        const Icon = meta.icon;
        return (
          <div key={a.id} className={`rounded-xl border-l-4 px-5 py-4 ${meta.border} ${meta.bg}`}>
            <div className="flex items-start gap-3">
              {a.pinned && <Pin className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />}
              <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${meta.iconColor}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{a.title}</p>
                <p className="text-sm text-gray-600 mt-1">{a.body}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {a.postedBy?.firstName} {a.postedBy?.lastName} · {a.publishedAt ? formatDate(a.publishedAt) : ""}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ComingSoon({ label, icon: Icon }: { label: string; icon: any }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-indigo-300" />
      </div>
      <p className="font-semibold text-gray-500">{label}</p>
      <p className="text-sm text-gray-400 mt-1">This section is coming soon.</p>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "bg-green-50 text-green-700 border-green-100",
  INACTIVE:  "bg-gray-100 text-gray-600 border-gray-200",
  SUSPENDED: "bg-red-50 text-red-600 border-red-100",
  GRADUATED: "bg-blue-50 text-blue-600 border-blue-100",
  DROPPED:   "bg-amber-50 text-amber-600 border-amber-100",
};

function fmt(date: string | null | undefined) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

// ── TABS ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "profile",      label: "Profile",          icon: User           },
  { id: "admission",    label: "Admission",         icon: ClipboardList  },
  { id: "batch",        label: "Batch",             icon: GraduationCap  },
  { id: "attendance",   label: "Attendance",        icon: CalendarCheck  },
  { id: "assignments",  label: "Assignments",       icon: BookOpenCheck  },
  { id: "assessments",  label: "Assessments",       icon: BarChart2      },
  { id: "ptms",         label: "PTMs",              icon: MessageSquare  },
  { id: "noticeboard",  label: "Notice Board",      icon: Bell           },
  { id: "documents",    label: "Documents",         icon: FolderOpen     },
  { id: "assistance",   label: "Assistance",        icon: LifeBuoy       },
  { id: "login",        label: "Login Credentials", icon: KeyRound       },
];

// ── Profile Tab ───────────────────────────────────────────────────────────────

function ProfileTab({ student, canEdit, onRefetch }: { student: any; canEdit: boolean; onRefetch: () => void }) {
  const qc = useQueryClient();
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingParents,  setEditingParents]  = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [personal, setPersonal] = useState({
    firstName: "", lastName: "", middleName: "", gender: "",
    dateOfBirth: "", phone: "", email: "", rollNumber: "", nationality: "",
    address: { line1: "", city: "", state: "", pincode: "", country: "" },
  });

  const [parents, setParents] = useState({
    parentName: "", parentPhone: "", parentEmail: "", parentRelation: "",
    parentOccupation: "", motherName: "", motherPhone: "", motherEmail: "",
    motherOccupation: "", communicationContact: "",
    communicationContactName: "", communicationContactPhone: "",
  });

  useEffect(() => {
    const addr = (student.address as any) ?? {};
    setPersonal({
      firstName: student.firstName ?? "",
      lastName:  student.lastName  ?? "",
      middleName: student.middleName ?? "",
      gender:    student.gender    ?? "",
      dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split("T")[0] : "",
      phone:     student.phone     ?? "",
      email:     student.email     ?? "",
      rollNumber: student.rollNumber ?? "",
      nationality: student.nationality ?? "",
      address: {
        line1:   addr.line1   ?? "",
        city:    addr.city    ?? "",
        state:   addr.state   ?? "",
        pincode: addr.pincode ?? "",
        country: addr.country ?? "",
      },
    });
    setParents({
      parentName:        student.parentName        ?? "",
      parentPhone:       student.parentPhone       ?? "",
      parentEmail:       student.parentEmail       ?? "",
      parentRelation:    student.parentRelation    ?? "",
      parentOccupation:  student.parentOccupation  ?? "",
      motherName:        student.motherName        ?? "",
      motherPhone:       student.motherPhone       ?? "",
      motherEmail:       student.motherEmail       ?? "",
      motherOccupation:  student.motherOccupation  ?? "",
      communicationContact:      student.communicationContact      ?? "",
      communicationContactName:  student.communicationContactName  ?? "",
      communicationContactPhone: student.communicationContactPhone ?? "",
    });
  }, [student]);

  const updateMut = useMutation({
    mutationFn: (data: any) => api.patch(`/api/v1/academics/students/${student.id}`, data),
    onSuccess: () => {
      toast.success("Updated");
      setEditingPersonal(false);
      setEditingParents(false);
      qc.invalidateQueries({ queryKey: ["student", student.id] });
      onRefetch();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to update"),
  });

  const photoMut = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api.patch(`/api/v1/academics/students/${student.id}/photo`, fd);
    },
    onSuccess: () => {
      toast.success("Photo updated");
      qc.invalidateQueries({ queryKey: ["student", student.id] });
      onRefetch();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to upload photo"),
  });

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  function setAddr(field: string, val: string) {
    setPersonal((prev) => ({ ...prev, address: { ...prev.address, [field]: val } }));
  }

  return (
    <div className="space-y-5">
      {/* Photo + Identity row */}
      <SectionCard title="Personal Details" icon={User} action={
        canEdit && !editingPersonal ? (
          <button onClick={() => setEditingPersonal(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
            <Edit2 className="h-3.5 w-3.5" /> Edit
          </button>
        ) : canEdit && editingPersonal ? (
          <div className="flex items-center gap-2">
            <button onClick={() => setEditingPersonal(false)}
              className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => updateMut.mutate({ ...personal, address: personal.address })}
              disabled={updateMut.isPending}
              className="flex items-center gap-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              <Save className="h-3.5 w-3.5" /> Save
            </button>
          </div>
        ) : null
      }>
          <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
          {/* Photo */}
          <div className="flex sm:flex-col items-center gap-4 sm:gap-0 shrink-0">
            <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-indigo-100 text-indigo-600 overflow-hidden flex items-center justify-center text-2xl font-bold">
              {student.photoUrl
                ? <img src={`${apiBase}${student.photoUrl}`} alt="photo" className="h-full w-full object-cover" />
                : `${student.firstName[0]}${student.lastName[0]}`}
              {canEdit && (
                <>
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 active:opacity-100 transition-opacity cursor-pointer">
                    <Camera className="h-5 w-5 text-white" />
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) photoMut.mutate(f); }}
                  />
                </>
              )}
            </div>
            <p className="sm:mt-2 font-mono text-xs text-gray-400">{student.studentCode}</p>
          </div>

          {/* Fields grid */}
          <div className="flex-1 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
            <FInput label="First Name"   value={personal.firstName}   onChange={(v) => setPersonal((p) => ({ ...p, firstName: v }))}   disabled={!editingPersonal} />
            <FInput label="Middle Name"  value={personal.middleName}  onChange={(v) => setPersonal((p) => ({ ...p, middleName: v }))}  disabled={!editingPersonal} />
            <FInput label="Last Name"    value={personal.lastName}    onChange={(v) => setPersonal((p) => ({ ...p, lastName: v }))}    disabled={!editingPersonal} />
            <FSelect label="Gender" value={personal.gender} onChange={(v) => setPersonal((p) => ({ ...p, gender: v }))} disabled={!editingPersonal}>
              <option value="">Select gender</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </FSelect>
            <FInput label="Date of Birth" value={personal.dateOfBirth} onChange={(v) => setPersonal((p) => ({ ...p, dateOfBirth: v }))} type="date" disabled={!editingPersonal} />
            <FInput label="Phone"         value={personal.phone}       onChange={(v) => setPersonal((p) => ({ ...p, phone: v }))}       disabled={!editingPersonal} />
            <FInput label="Email"         value={personal.email}       onChange={(v) => setPersonal((p) => ({ ...p, email: v }))}       type="email" disabled={!editingPersonal} />
            <FInput label="Roll Number"   value={personal.rollNumber}  onChange={(v) => setPersonal((p) => ({ ...p, rollNumber: v }))}  disabled={!editingPersonal} />
            <FInput label="Nationality"   value={personal.nationality} onChange={(v) => setPersonal((p) => ({ ...p, nationality: v }))} disabled={!editingPersonal} />
          </div>
        </div>

        {/* Address sub-section */}
        <div className="mt-5 pt-4 border-t border-gray-50">
          <p className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Address</p>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
            <FInput label="Address Line" value={personal.address.line1}   onChange={(v) => setAddr("line1", v)}   disabled={!editingPersonal} className="sm:col-span-2" />
            <FInput label="City"         value={personal.address.city}    onChange={(v) => setAddr("city", v)}    disabled={!editingPersonal} />
            <FInput label="State"        value={personal.address.state}   onChange={(v) => setAddr("state", v)}   disabled={!editingPersonal} />
            <FInput label="Pincode"      value={personal.address.pincode} onChange={(v) => setAddr("pincode", v)} disabled={!editingPersonal} />
            <FInput label="Country"      value={personal.address.country} onChange={(v) => setAddr("country", v)} disabled={!editingPersonal} />
          </div>
        </div>
      </SectionCard>

      {/* Parent / Guardian Details */}
      <SectionCard title="Parent / Guardian Details" icon={Users2} action={
        canEdit && !editingParents ? (
          <button onClick={() => setEditingParents(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
            <Edit2 className="h-3.5 w-3.5" /> Edit
          </button>
        ) : canEdit && editingParents ? (
          <div className="flex items-center gap-2">
            <button onClick={() => setEditingParents(false)}
              className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => updateMut.mutate(parents)}
              disabled={updateMut.isPending}
              className="flex items-center gap-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              <Save className="h-3.5 w-3.5" /> Save
            </button>
          </div>
        ) : null
      }>
        {/* Father */}
        <p className="text-xs font-semibold text-gray-500 mb-3">Father / Guardian</p>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 md:grid-cols-3 mb-5">
          <FInput label="Name"       value={parents.parentName}       onChange={(v) => setParents((p) => ({ ...p, parentName: v }))}       disabled={!editingParents} />
          <FInput label="Phone"      value={parents.parentPhone}      onChange={(v) => setParents((p) => ({ ...p, parentPhone: v }))}      disabled={!editingParents} />
          <FInput label="Email"      value={parents.parentEmail}      onChange={(v) => setParents((p) => ({ ...p, parentEmail: v }))}      disabled={!editingParents} />
          <FSelect label="Relation"  value={parents.parentRelation}   onChange={(v) => setParents((p) => ({ ...p, parentRelation: v }))}  disabled={!editingParents}>
            <option value="">Select relation</option>
            {["Father","Mother","Guardian","Grandparent","Uncle","Aunt","Sibling","Other"].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </FSelect>
          <FInput label="Occupation" value={parents.parentOccupation} onChange={(v) => setParents((p) => ({ ...p, parentOccupation: v }))} disabled={!editingParents} />
        </div>

        {/* Mother */}
        <p className="text-xs font-semibold text-gray-500 mb-3 pt-4 border-t border-gray-50">Mother</p>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 md:grid-cols-3 mb-5">
          <FInput label="Name"       value={parents.motherName}       onChange={(v) => setParents((p) => ({ ...p, motherName: v }))}       disabled={!editingParents} />
          <FInput label="Phone"      value={parents.motherPhone}      onChange={(v) => setParents((p) => ({ ...p, motherPhone: v }))}      disabled={!editingParents} />
          <FInput label="Email"      value={parents.motherEmail}      onChange={(v) => setParents((p) => ({ ...p, motherEmail: v }))}      disabled={!editingParents} />
          <FInput label="Occupation" value={parents.motherOccupation} onChange={(v) => setParents((p) => ({ ...p, motherOccupation: v }))} disabled={!editingParents} />
        </div>

        {/* Communication contact */}
        <p className="text-xs font-semibold text-gray-500 mb-3 pt-4 border-t border-gray-50">Communication Contact</p>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
          <FSelect label="Contact via" value={parents.communicationContact} onChange={(v) => setParents((p) => ({ ...p, communicationContact: v }))} disabled={!editingParents}>
            <option value="">Select</option>
            <option value="FATHER">Father</option>
            <option value="MOTHER">Mother</option>
            <option value="BOTH">Both</option>
            <option value="OTHER">Other</option>
          </FSelect>
          {parents.communicationContact === "OTHER" && (
            <>
              <FInput label="Contact Name"  value={parents.communicationContactName}  onChange={(v) => setParents((p) => ({ ...p, communicationContactName: v }))}  disabled={!editingParents} />
              <FInput label="Contact Phone" value={parents.communicationContactPhone} onChange={(v) => setParents((p) => ({ ...p, communicationContactPhone: v }))} disabled={!editingParents} />
            </>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// ── Admission Tab ─────────────────────────────────────────────────────────────

const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque", "DD", "Card", "Online"];

const emptyPayForm = () => ({
  amount: "", paymentMode: "", paymentDate: new Date().toISOString().split("T")[0],
  receiptNumber: "", note: "", instalmentId: "",
});

function AdmissionTab({ student, canEdit, onRefetch }: { student: any; canEdit: boolean; onRefetch: () => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payForm, setPayForm] = useState(emptyPayForm());
  const [quickPayInstalmentId, setQuickPayInstalmentId] = useState<string | null>(null);

  // Instalment editing
  const [editingInstalments, setEditingInstalments] = useState(false);
  const [instalEdits, setInstalEdits] = useState<Record<string, { amount: string; dueDate: string; label: string }>>({});
  const [newInstalRows, setNewInstalRows] = useState<{ tempId: string; label: string; dueDate: string; amount: string }[]>([]);

  const [form, setForm] = useState({
    admissionNumber: "", admissionDate: "", academicYear: "",
    gradeId: "", courseId: "", totalFee: "", discountType: "", discountAmount: "",
  });

  useEffect(() => {
    setForm({
      admissionNumber: student.admissionNumber ?? "",
      admissionDate:   student.admissionDate ? new Date(student.admissionDate).toISOString().split("T")[0] : "",
      academicYear:    student.academicYear   ?? "",
      gradeId:         student.gradeId        ?? "",
      courseId:        student.courseId       ?? "",
      totalFee:        student.totalFee       != null ? String(student.totalFee)        : "",
      discountType:    student.discountType   ?? "",
      discountAmount:  student.discountAmount != null ? String(student.discountAmount) : "",
    });
  }, [student]);

  const { data: grades = [] } = useQuery({ queryKey: ["grades"], queryFn: () => api.get("/api/v1/academics/grades").then((r) => r.data.data), staleTime: 5 * 60 * 1000 });
  const { data: courses = [] } = useQuery({ queryKey: ["courses"], queryFn: () => api.get("/api/v1/academics/courses").then((r) => r.data.data), staleTime: 5 * 60 * 1000 });
  const { data: academicYears = [] } = useQuery({ queryKey: ["academic-years"], queryFn: () => api.get("/api/v1/academics/academic-years").then((r) => r.data.data), staleTime: 10 * 60 * 1000 });

  const refetchStudent = () => { qc.invalidateQueries({ queryKey: ["student", student.id] }); onRefetch(); };

  const updateMut = useMutation({
    mutationFn: (data: any) => api.patch(`/api/v1/academics/students/${student.id}`, data),
    onSuccess: () => { toast.success("Updated"); setEditing(false); refetchStudent(); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to update"),
  });

  const addPaymentMut = useMutation({
    mutationFn: (data: any) => api.post(`/api/v1/academics/students/${student.id}/payment-logs`, data),
    onSuccess: () => { toast.success("Payment recorded"); setShowPayForm(false); setPayForm(emptyPayForm()); setQuickPayInstalmentId(null); refetchStudent(); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to record payment"),
  });

  const deletePaymentMut = useMutation({
    mutationFn: (logId: string) => api.delete(`/api/v1/academics/students/${student.id}/payment-logs/${logId}`),
    onSuccess: () => { toast.success("Payment removed"); refetchStudent(); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const set = (field: string, val: string) => setForm((p) => ({ ...p, [field]: val }));
  const setPay = (field: string, val: string) => setPayForm((p) => ({ ...p, [field]: val }));

  const startEditInstalments = () => {
    const initial: Record<string, { amount: string; dueDate: string; label: string }> = {};
    (student.instalments ?? []).forEach((ins: any) => {
      initial[ins.id] = {
        amount:  String(ins.amount),
        dueDate: ins.dueDate ? new Date(ins.dueDate).toISOString().split("T")[0] : "",
        label:   ins.label ?? `Instalment ${ins.instalmentNo}`,
      };
    });
    setInstalEdits(initial);
    setNewInstalRows([]);
    setEditingInstalments(true);
  };

  const addNewInstalRow = () => {
    setNewInstalRows((prev) => [
      ...prev,
      { tempId: `new-${Date.now()}`, label: `Instalment ${(student.instalments?.length ?? 0) + prev.length + 1}`, dueDate: "", amount: "" },
    ]);
  };

  const updateInstalmentMut = useMutation({
    mutationFn: async () => {
      // Update existing instalments
      const updatePromises = Object.entries(instalEdits).map(([instalmentId, v]) =>
        api.patch(`/api/v1/academics/students/${student.id}/instalments/${instalmentId}`, {
          amount:  parseFloat(v.amount) || 0,
          dueDate: v.dueDate || null,
          label:   v.label || undefined,
        })
      );
      // Create new instalment rows
      const createPromises = newInstalRows
        .filter((r) => r.amount)
        .map((r) =>
          api.post(`/api/v1/academics/students/${student.id}/instalments`, {
            label:   r.label,
            amount:  parseFloat(r.amount),
            dueDate: r.dueDate || null,
          })
        );
      await Promise.all([...updatePromises, ...createPromises]);
    },
    onSuccess: () => { toast.success("Instalments updated"); setEditingInstalments(false); setNewInstalRows([]); refetchStudent(); },
    onError:   (e: any) => toast.error(e.response?.data?.error ?? "Failed to update instalments"),
  });

  const handleSave = () => {
    const payload: any = {
      admissionNumber: form.admissionNumber || undefined,
      admissionDate:   form.admissionDate   || undefined,
      academicYear:    form.academicYear     || undefined,
      gradeId:         form.gradeId          || undefined,
      courseId:        form.courseId         || undefined,
      discountType:    form.discountType     || undefined,
    };
    if (form.totalFee      !== "") payload.totalFee      = parseFloat(form.totalFee);
    if (form.discountAmount !== "") payload.discountAmount = parseFloat(form.discountAmount);
    updateMut.mutate(payload);
  };

  const handleAddPayment = () => {
    const amt = parseFloat(payForm.amount || "0");
    if (!payForm.amount || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (amt > 0 && (!payForm.paymentMode || !payForm.paymentDate || !payForm.receiptNumber)) {
      toast.error("Payment Mode, Date, and Receipt No. are required");
      return;
    }
    addPaymentMut.mutate({
      amount:        amt,
      paymentMode:   payForm.paymentMode   || undefined,
      paymentDate:   payForm.paymentDate   || undefined,
      receiptNumber: payForm.receiptNumber || undefined,
      note:          payForm.note          || undefined,
      instalmentId:  payForm.instalmentId  || undefined,
    });
  };

  const openQuickPay = (ins: any) => {
    setPayForm({ ...emptyPayForm(), amount: String(ins.amount), instalmentId: ins.id });
    setQuickPayInstalmentId(ins.id);
    setShowPayForm(true);
  };

  const paidFee    = student.paidFee ?? 0;
  const totalFee   = student.totalFee ?? 0;
  const discount   = student.discountAmount ?? 0;
  const balanceDue = Math.max(0, totalFee - discount - paidFee);
  const paymentLogs: any[] = student.paymentLogs ?? [];
  const instalments: any[] = student.instalments ?? [];

  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white text-gray-700";

  return (
    <div className="space-y-5">

      {/* Enrollment Details */}
      <SectionCard title="Enrollment Details" icon={ClipboardList} action={
        canEdit && !editing ? (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
            <Edit2 className="h-3.5 w-3.5" /> Edit
          </button>
        ) : canEdit && editing ? (
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(false)} className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={updateMut.isPending} className="flex items-center gap-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              <Save className="h-3.5 w-3.5" /> Save
            </button>
          </div>
        ) : null
      }>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
          <FInput label="Admission Number" value={form.admissionNumber} onChange={(v) => set("admissionNumber", v)} disabled={!editing} />
          <FInput label="Admission Date"   value={form.admissionDate}   onChange={(v) => set("admissionDate", v)}   type="date" disabled={!editing} />
          {editing ? (
            <FSelect label="Academic Year" value={form.academicYear} onChange={(v) => set("academicYear", v)}>
              <option value="">Select academic year</option>
              {(academicYears as any[]).filter((y) => !y.isArchived).map((y) => <option key={y.id} value={y.name}>{y.name}</option>)}
            </FSelect>
          ) : <FInput label="Academic Year" value={form.academicYear} disabled />}
          {editing ? (
            <>
              <FSelect label="Grade" value={form.gradeId} onChange={(v) => set("gradeId", v)}>
                <option value="">No grade</option>
                {(grades as any[]).map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </FSelect>
              <FSelect label="Course" value={form.courseId} onChange={(v) => set("courseId", v)}>
                <option value="">No course</option>
                {(courses as any[]).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </FSelect>
            </>
          ) : (
            <>
              <FInput label="Grade"  value={student.grade?.name  ?? ""} disabled />
              <FInput label="Course" value={student.course?.name ?? ""} disabled />
            </>
          )}
          <FInput label="School" value={student.school?.name ?? ""} disabled />
        </div>
      </SectionCard>

      {/* Fee Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total Fee",   value: fmtCurrency(totalFee),   color: "border-blue-100  bg-blue-50  text-blue-700"  },
          { label: "Paid",        value: fmtCurrency(paidFee),    color: "border-green-100 bg-green-50 text-green-700" },
          { label: "Discount",    value: fmtCurrency(discount),   color: "border-amber-100 bg-amber-50 text-amber-700" },
          { label: "Balance Due", value: fmtCurrency(balanceDue), color: balanceDue > 0 ? "border-red-100 bg-red-50 text-red-700" : "border-green-100 bg-green-50 text-green-700" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl border px-4 py-3 ${color}`}>
            <p className="text-xs font-medium opacity-70">{label}</p>
            <p className="text-lg font-bold mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Fee Settings (editable: total fee, discount) */}
      {editing && (
        <SectionCard title="Fee Configuration" icon={CreditCard}>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
            <FInput label="Total Fee" value={form.totalFee} onChange={(v) => set("totalFee", v)} type="number" disabled={false} />
            <FSelect label="Discount Type" value={form.discountType} onChange={(v) => set("discountType", v)}>
              <option value="">None</option>
              <option value="AMOUNT">Amount (₹)</option>
              <option value="PERCENTAGE">Percentage (%)</option>
            </FSelect>
            <FInput label="Discount Value" value={form.discountAmount} onChange={(v) => set("discountAmount", v)} type="number" disabled={false} />
          </div>
        </SectionCard>
      )}

      {/* Instalment Schedule */}
      {instalments.length > 0 && (
        <SectionCard title="Instalment Schedule" icon={Banknote} action={
          canEdit ? (
            <div className="flex items-center gap-2">
              {editingInstalments ? (
                <>
                  <button onClick={addNewInstalRow}
                    className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors border border-indigo-100">
                    <Plus className="h-3 w-3" /> Add Instalment
                  </button>
                  <button onClick={() => { setEditingInstalments(false); setNewInstalRows([]); }}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
                    Cancel
                  </button>
                  <button onClick={() => updateInstalmentMut.mutate()} disabled={updateInstalmentMut.isPending}
                    className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                    <Save className="h-3.5 w-3.5" /> {updateInstalmentMut.isPending ? "Saving…" : "Save Plan"}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={startEditInstalments}
                    className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
                    <Edit2 className="h-3.5 w-3.5" /> Edit Plan
                  </button>
                  <button onClick={() => { setPayForm(emptyPayForm()); setQuickPayInstalmentId(null); setShowPayForm(true); }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Add Payment
                  </button>
                </>
              )}
            </div>
          ) : null
        }>
          {/* Sum warning when editing */}
          {editingInstalments && (() => {
            const editTotal = Object.values(instalEdits).reduce((s, v) => s + (parseFloat(v.amount) || 0), 0)
              + newInstalRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
            const netFee = Math.max(0, totalFee - discount);
            return Math.abs(editTotal - netFee) > 0.5 && netFee > 0 ? (
              <div className="mb-3 rounded-lg bg-amber-50 border border-amber-100 px-4 py-2.5 text-xs text-amber-700 font-medium">
                Instalments total {fmtCurrency(editTotal)} — net fee is {fmtCurrency(netFee)}. Amounts don&apos;t match.
              </div>
            ) : null;
          })()}

          <div className="divide-y divide-gray-50">
            {instalments.map((ins: any) => {
              const isOverdue = !ins.isPaid && ins.dueDate && new Date(ins.dueDate) < new Date();
              const ed = instalEdits[ins.id];
              return (
                <div key={ins.id} className="py-3">
                  {editingInstalments && ed ? (
                    /* Editable row */
                    <div className="flex items-center gap-3">
                      <span className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {ins.instalmentNo}
                      </span>
                      <input
                        className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                        placeholder="Label"
                        value={ed.label}
                        onChange={(e) => setInstalEdits((p) => ({ ...p, [ins.id]: { ...p[ins.id], label: e.target.value } }))}
                      />
                      <input
                        type="date"
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                        value={ed.dueDate}
                        onChange={(e) => setInstalEdits((p) => ({ ...p, [ins.id]: { ...p[ins.id], dueDate: e.target.value } }))}
                      />
                      <input
                        type="number" min="0"
                        className="w-28 rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-semibold focus:border-indigo-400 focus:outline-none text-right"
                        value={ed.amount}
                        onChange={(e) => setInstalEdits((p) => ({ ...p, [ins.id]: { ...p[ins.id], amount: e.target.value } }))}
                      />
                      {ins.isPaid
                        ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-100 rounded-full px-2.5 py-1 shrink-0"><CheckCircle2 className="h-3 w-3" /> Paid</span>
                        : <span className="text-xs text-gray-400 shrink-0">Pending</span>
                      }
                    </div>
                  ) : (
                    /* Read-only row */
                    <div className="flex items-center gap-3">
                      <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${ins.isPaid ? "bg-green-100 text-green-700" : isOverdue ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"}`}>
                        {ins.instalmentNo}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{ins.label ?? `Instalment ${ins.instalmentNo}`}</p>
                        {ins.dueDate && <p className="text-xs text-gray-400">Due: {fmt(ins.dueDate)}</p>}
                      </div>
                      <span className="text-sm font-bold text-gray-700 shrink-0">{fmtCurrency(ins.amount)}</span>
                      {ins.isPaid ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-100 rounded-full px-2.5 py-1">
                          <CheckCircle2 className="h-3 w-3" /> Paid
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 ${isOverdue ? "text-red-600 bg-red-50 border border-red-100" : "text-amber-600 bg-amber-50 border border-amber-100"}`}>
                            {isOverdue ? <><AlertCircle className="h-3 w-3" /> Overdue</> : <><Clock className="h-3 w-3" /> Pending</>}
                          </span>
                          {canEdit && (
                            <button onClick={() => openQuickPay(ins)}
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-full px-2.5 py-1 transition-colors">
                              Record Payment
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Payment records for this instalment */}
                  {ins.isPaid && ins.paidAt && (
                    <p className="text-xs text-gray-400 mt-1 ml-10">
                      Paid {fmt(ins.paidAt)}{ins.paidAmount ? ` · ${fmtCurrency(ins.paidAmount)}` : ""}{ins.paymentMode ? ` · ${ins.paymentMode}` : ""}
                    </p>
                  )}
                </div>
              );
            })}

            {/* New instalment rows (edit mode only) */}
            {editingInstalments && newInstalRows.map((row, idx) => (
              <div key={row.tempId} className="py-3 flex items-center gap-3 border-t border-dashed border-indigo-200 bg-indigo-50/30 rounded-lg px-2">
                <span className="h-7 w-7 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                  {(instalments.length) + idx + 1}
                </span>
                <input
                  className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  placeholder="Label"
                  value={row.label}
                  onChange={(e) => setNewInstalRows((p) => p.map((r, i) => i === idx ? { ...r, label: e.target.value } : r))}
                />
                <input
                  type="date"
                  className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  value={row.dueDate}
                  onChange={(e) => setNewInstalRows((p) => p.map((r, i) => i === idx ? { ...r, dueDate: e.target.value } : r))}
                />
                <input
                  type="number" min="0"
                  placeholder="Amount"
                  className="w-28 rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-semibold focus:border-indigo-400 focus:outline-none text-right"
                  value={row.amount}
                  onChange={(e) => setNewInstalRows((p) => p.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r))}
                />
                <button onClick={() => setNewInstalRows((p) => p.filter((_, i) => i !== idx))}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Payment History */}
      <SectionCard title="Payment History" icon={IndianRupee} action={
        canEdit && instalments.length === 0 ? (
          <button onClick={() => { setPayForm(emptyPayForm()); setShowPayForm(true); }}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add Payment
          </button>
        ) : canEdit && instalments.length > 0 ? (
          <button onClick={() => { setPayForm(emptyPayForm()); setShowPayForm(true); }}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add Payment
          </button>
        ) : null
      }>

        {/* Add Payment inline form */}
        {showPayForm && (
          <div className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">
              {quickPayInstalmentId ? `Record Payment — ${instalments.find(i => i.id === quickPayInstalmentId)?.label ?? "Instalment"}` : "New Payment Entry"}
            </p>
            {(() => {
              const payAmt = parseFloat(payForm.amount || "0");
              const req = payAmt > 0;
              return (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Amount (₹) *</label>
                    <input type="number" min="0" placeholder="0.00" value={payForm.amount} onChange={(e) => setPay("amount", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Payment Mode {req && <span className="text-amber-500">*</span>}
                    </label>
                    <select value={payForm.paymentMode} onChange={(e) => setPay("paymentMode", e.target.value)}
                      className={`${inputCls}${req && !payForm.paymentMode ? " border-amber-300" : ""}`}>
                      <option value="">Select mode</option>
                      {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                    </select>
                    {req && !payForm.paymentMode && <p className="text-xs text-amber-600 mt-1">Required</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Payment Date {req && <span className="text-amber-500">*</span>}
                    </label>
                    <input type="date" value={payForm.paymentDate} onChange={(e) => setPay("paymentDate", e.target.value)}
                      className={`${inputCls}${req && !payForm.paymentDate ? " border-amber-300" : ""}`} />
                    {req && !payForm.paymentDate && <p className="text-xs text-amber-600 mt-1">Required</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Receipt / Ref No. {req && <span className="text-amber-500">*</span>}
                    </label>
                    <input type="text" placeholder={req ? "Required" : "Optional"} value={payForm.receiptNumber} onChange={(e) => setPay("receiptNumber", e.target.value)}
                      className={`${inputCls}${req && !payForm.receiptNumber ? " border-amber-300" : ""}`} />
                    {req && !payForm.receiptNumber && <p className="text-xs text-amber-600 mt-1">Required</p>}
                  </div>
                  {instalments.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Link to Instalment</label>
                      <select value={payForm.instalmentId} onChange={(e) => setPay("instalmentId", e.target.value)} className={inputCls}>
                        <option value="">None (general payment)</option>
                        {instalments.filter(i => !i.isPaid).map((i: any) => (
                          <option key={i.id} value={i.id}>{i.label ?? `Instalment ${i.instalmentNo}`} — {fmtCurrency(i.amount)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className={instalments.length > 0 ? "" : "sm:col-span-2"}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Note</label>
                    <input type="text" placeholder="Optional" value={payForm.note} onChange={(e) => setPay("note", e.target.value)} className={inputCls} />
                  </div>
                </div>
              );
            })()}
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => { setShowPayForm(false); setPayForm(emptyPayForm()); setQuickPayInstalmentId(null); }}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-white transition-colors border border-transparent hover:border-gray-200">
                Cancel
              </button>
              <button onClick={handleAddPayment} disabled={addPaymentMut.isPending}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                <Save className="h-3.5 w-3.5" /> {addPaymentMut.isPending ? "Saving…" : "Save Payment"}
              </button>
            </div>
          </div>
        )}

        {/* Log list */}
        {paymentLogs.length === 0 && !showPayForm ? (
          <div className="text-center py-8">
            <IndianRupee className="h-8 w-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No payments recorded yet.</p>
            {canEdit && <p className="text-xs text-gray-400 mt-1">Click "Add Payment" to log the first payment.</p>}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {paymentLogs.map((log: any) => (
              <div key={log.id} className="flex items-start justify-between gap-3 py-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-green-50 border border-green-100 flex items-center justify-center shrink-0 mt-0.5">
                    <IndianRupee className="h-3.5 w-3.5 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-green-700">{fmtCurrency(log.amount)}</span>
                      {log.paymentMode && <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{log.paymentMode}</span>}
                      {log.instalment && (
                        <span className="text-xs bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5 border border-indigo-100">
                          {log.instalment.label ?? `Instalment ${log.instalment.instalmentNo}`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {log.paymentDate ? fmt(log.paymentDate) : fmt(log.createdAt)}
                      {log.receiptNumber && <> · Receipt: {log.receiptNumber}</>}
                      {log.note && <> · {log.note}</>}
                    </p>
                  </div>
                </div>
                {canEdit && (
                  <button onClick={() => { if (confirm("Remove this payment entry?")) deletePaymentMut.mutate(log.id); }}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Batch Tab ─────────────────────────────────────────────────────────────────

function BatchRow({ sb, student, canEdit, onRemoved }: { sb: any; student: any; canEdit: boolean; onRemoved: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const { data: batchSubjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ["batch-subjects", sb.batchId],
    queryFn: () => api.get(`/api/v1/academics/batches/${sb.batchId}/subjects`).then((r) => r.data.data),
    enabled: expanded,
  });

  const removeMut = useMutation({
    mutationFn: () => api.delete(`/api/v1/academics/batches/${sb.batchId}/students/${student.id}`),
    onSuccess: () => { toast.success("Removed from batch"); onRemoved(); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  return (
    <div className="border-b border-gray-50 last:border-0">
      <div
        className="flex items-start gap-3 px-5 py-4 hover:bg-gray-50/50 transition-colors cursor-pointer"
        onClick={() => { setExpanded((v) => !v); setConfirmRemove(false); }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {sb.batch.academicYear} · {sb.batch.name}
          </p>
          {sb.batch.grade?.name && (
            <p className="text-xs text-gray-400 mt-0.5">{sb.batch.grade.name}{sb.batch.location?.name ? ` · ${sb.batch.location.name}` : ""}</p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">
            Added {new Date(sb.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-medium rounded-full px-2.5 py-1 border ${sb.batch.isActive ? "bg-green-50 text-green-700 border-green-100" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
            {sb.batch.isActive ? "Active" : "Inactive"}
          </span>
          {canEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmRemove((v) => !v); setExpanded(false); }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors px-1.5 py-1 rounded"
              title="Remove from batch"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Inline remove confirm */}
      {confirmRemove && (
        <div className="px-5 pb-4 flex items-center gap-3 bg-red-50/60 border-t border-red-100">
          <p className="text-xs text-red-700 flex-1">Remove from <strong>{sb.batch.name}</strong>?</p>
          <button onClick={() => setConfirmRemove(false)} className="text-xs text-gray-500 px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50">Cancel</button>
          <button onClick={() => removeMut.mutate()} disabled={removeMut.isPending}
            className="text-xs text-white px-2 py-1 rounded bg-red-500 hover:bg-red-600 disabled:opacity-50">
            {removeMut.isPending ? "Removing…" : "Remove"}
          </button>
        </div>
      )}

      {/* Subjects expand */}
      {expanded && (
        <div className="border-t border-gray-50 bg-gray-50/40">
          {loadingSubjects ? (
            <p className="text-xs text-gray-400 px-8 py-3">Loading subjects…</p>
          ) : batchSubjects.length === 0 ? (
            <p className="text-xs text-gray-400 px-8 py-3">No subjects assigned to this batch</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {batchSubjects.map((bs: any) => (
                <div key={bs.id} className="flex items-center justify-between px-8 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{bs.subject.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{bs.subject.code}</p>
                  </div>
                  {bs.employee && (
                    <p className="text-xs text-gray-500">{bs.employee.firstName} {bs.employee.lastName}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BatchTab({ student, canEdit, onRefetch }: { student: any; canEdit: boolean; onRefetch: () => void }) {
  const qc = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);
  const [filterYear, setFilterYear] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("");

  const currentBatchIds = new Set((student.studentBatches ?? []).map((sb: any) => sb.batchId));
  const hasBatches = (student.studentBatches ?? []).length > 0;

  const { data: academicYears = [] } = useQuery({
    queryKey: ["academic-years"],
    queryFn: () => api.get("/api/v1/academics/academic-years").then((r) => r.data.data),
    staleTime: 10 * 60 * 1000,
    enabled: showPicker,
  });

  const { data: allBatches = [] } = useQuery({
    queryKey: ["batches"],
    queryFn: () => api.get("/api/v1/academics/batches?archived=false").then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
    enabled: showPicker,
  });

  const activeYears = (academicYears as any[]).filter((y) => !y.isArchived);

  // Exclude batches the student is already in
  const filteredBatches = (allBatches as any[]).filter(
    (b) => !b.isArchived && !currentBatchIds.has(b.id) && (!filterYear || b.academicYear === filterYear)
  );

  useEffect(() => {
    if (activeYears.length > 0 && !filterYear) setFilterYear(activeYears[0].name);
  }, [activeYears.length]);

  const assignMut = useMutation({
    mutationFn: (batchId: string) => api.put(`/api/v1/academics/batches/${batchId}/students/${student.id}`, {}),
    onSuccess: () => {
      toast.success("Added to batch");
      setShowPicker(false);
      setSelectedBatchId("");
      qc.invalidateQueries({ queryKey: ["student", student.id] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      onRefetch();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const invalidateAfterRemove = () => {
    qc.invalidateQueries({ queryKey: ["student", student.id] });
    qc.invalidateQueries({ queryKey: ["batches"] });
    onRefetch();
  };

  const history: any[] = student.batchHistory ?? [];

  return (
    <div className="space-y-5">
      {/* ── Current Batches ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">Batches</span>
            {hasBatches && (
              <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{(student.studentBatches ?? []).length}</span>
            )}
          </div>
          {canEdit && (
            <button
              onClick={() => { setShowPicker((v) => !v); setSelectedBatchId(""); }}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 active:bg-indigo-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add to Batch
            </button>
          )}
        </div>

        {/* Batch picker */}
        {showPicker && (
          <div className="border-b border-gray-100 px-5 py-4 bg-gray-50/60 space-y-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add to Batch</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Academic Year</label>
                <select value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setSelectedBatchId(""); }}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white text-gray-700">
                  <option value="">— All years —</option>
                  {activeYears.map((y: any) => <option key={y.id} value={y.name}>{y.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Batch</label>
                <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white text-gray-700">
                  <option value="">— Select a batch —</option>
                  {filteredBatches.length === 0 && <option disabled>All batches already assigned</option>}
                  {filteredBatches.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}{b._count?.studentBatches != null ? ` · ${b._count.studentBatches} students` : ""}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowPicker(false); setSelectedBatchId(""); }}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-white transition-colors">
                Cancel
              </button>
              <button
                onClick={() => { if (selectedBatchId) assignMut.mutate(selectedBatchId); }}
                disabled={!selectedBatchId || assignMut.isPending}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <GraduationCap className="h-3.5 w-3.5" />
                {assignMut.isPending ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        )}

        {/* Batch list */}
        {hasBatches ? (
          <div className="divide-y divide-gray-50">
            {(student.studentBatches ?? []).map((sb: any) => (
              <BatchRow key={sb.id} sb={sb} student={student} canEdit={canEdit} onRemoved={invalidateAfterRemove} />
            ))}
          </div>
        ) : !showPicker ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <GraduationCap className="h-10 w-10 text-gray-200 mb-2" />
            <p className="text-sm font-medium text-gray-400">Not assigned to any batch</p>
          </div>
        ) : null}
      </div>

      {/* ── Batch History ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
          <Clock className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Previous Batches</span>
          {history.length > 0 && (
            <span className="ml-auto text-xs text-gray-400">{history.length} batch{history.length !== 1 ? "es" : ""}</span>
          )}
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No previous batches</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {history.map((h: any) => (
              <div key={h.id} className="flex items-start gap-3 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700">
                    {h.academicYear ? `${h.academicYear} ` : ""}{h.batchName}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(h.assignedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    {" → "}
                    {new Date(h.removedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-gray-400 bg-gray-100 rounded-full px-2.5 py-1 border border-gray-200">
                  Past
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Login Credentials Tab ─────────────────────────────────────────────────────

function CredRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 px-5 py-3 border-b border-gray-50 last:border-0">
      <span className="w-28 shrink-0 text-xs font-medium text-gray-400 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0 text-sm text-gray-800">{children}</div>
    </div>
  );
}

function CredSection({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50/60">
        <Icon className="h-4 w-4 text-indigo-400" />
        <span className="text-sm font-semibold text-gray-700">{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── Assignments Tab ───────────────────────────────────────────────────────────

const ASSIGN_STYLE: Record<string, { bar: string; bg: string; text: string; border: string; label: string }> = {
  APPROVED:      { bar: "bg-green-500",  bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200",  label: "Approved"     },
  SUBMITTED:     { bar: "bg-blue-500",   bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200",   label: "Submitted"    },
  IN_PROCESS:    { bar: "bg-violet-500", bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", label: "Under Review" },
  REJECTED:      { bar: "bg-orange-500", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", label: "Rejected"     },
  NOT_SUBMITTED: { bar: "bg-amber-400",  bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  label: "Pending"      },
  OVERDUE:       { bar: "bg-red-500",    bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",    label: "Overdue"      },
  ARCHIVED:      { bar: "bg-gray-300",   bg: "bg-gray-50",   text: "text-gray-500",   border: "border-gray-200",   label: "Archived"     },
};

function AssignmentsTab({ student }: { student: any }) {
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth() - 2, 1);
  const defaultTo   = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [dateFrom,      setDateFrom]      = useState(defaultFrom.toISOString().split("T")[0]);
  const [dateTo,        setDateTo]        = useState(defaultTo.toISOString().split("T")[0]);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [statusFilter,  setStatusFilter]  = useState("");
  const [view,          setView]          = useState<"list" | "stats">("list");

  const params = new URLSearchParams({ dateFrom, dateTo });
  if (subjectFilter) params.set("subjectId", subjectFilter);

  const { data, isLoading } = useQuery({
    queryKey: ["student-assignments", student.id, dateFrom, dateTo, subjectFilter],
    queryFn: () => api.get(`/api/v1/academics/students/${student.id}/assignments?${params}`).then((r) => r.data),
    enabled: !!student.id,
  });

  const allItems: any[] = data?.data ?? [];
  const stats = data?.stats ?? { total: 0, approved: 0, submitted: 0, inProcess: 0, rejected: 0, notSubmitted: 0, overdue: 0, completionRate: 0 };
  const items = statusFilter ? allItems.filter((a) => a.displayStatus === statusFilter) : allItems;

  const subjects = useMemo(() => {
    const map = new Map<string, any>();
    for (const a of allItems) { if (a.subject) map.set(a.subject.id, a.subject); }
    return Array.from(map.values());
  }, [allItems]);

  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { label: string; total: number; approved: number }>();
    for (const a of allItems) {
      if (a.status === "ARCHIVED") continue;
      const d = new Date(a.submissionDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
      if (!map.has(key)) map.set(key, { label, total: 0, approved: 0 });
      const e = map.get(key)!;
      e.total++;
      if (a.displayStatus === "APPROVED") e.approved++;
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => ({ ...v, rate: v.total > 0 ? Math.round((v.approved / v.total) * 100) : 0 }));
  }, [allItems]);

  const subjectBreakdown = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string; total: number; approved: number; overdue: number }>();
    for (const a of allItems) {
      if (!a.subject || a.status === "ARCHIVED") continue;
      const key = a.subject.id;
      if (!map.has(key)) map.set(key, { ...a.subject, total: 0, approved: 0, overdue: 0 });
      const e = map.get(key)!;
      e.total++;
      if (a.displayStatus === "APPROVED") e.approved++;
      if (a.displayStatus === "OVERDUE")  e.overdue++;
    }
    return Array.from(map.values()).map((s) => ({
      ...s,
      rate: s.total > 0 ? Math.round((s.approved / s.total) * 100) : 0,
    }));
  }, [allItems]);

  const rateTextColor = (r: number) => r >= 75 ? "text-green-600" : r >= 50 ? "text-amber-600" : "text-red-600";
  const rateBarColor  = (r: number) => r >= 75 ? "bg-green-500"   : r >= 50 ? "bg-amber-500"   : "bg-red-500";

  const STATUS_OPTS = [
    { value: "",              label: "All Statuses"  },
    { value: "NOT_SUBMITTED", label: "Pending"       },
    { value: "OVERDUE",       label: "Overdue"       },
    { value: "SUBMITTED",     label: "Submitted"     },
    { value: "IN_PROCESS",    label: "Under Review"  },
    { value: "APPROVED",      label: "Approved"      },
    { value: "REJECTED",      label: "Rejected"      },
  ];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
            {(["list", "stats"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  view === v ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-50"
                }`}>
                {v === "list" ? "Assignment List" : "Statistics"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-400 font-medium whitespace-nowrap">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-indigo-400" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-400 font-medium whitespace-nowrap">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-indigo-400" />
            </div>
          </div>
          {subjects.length > 0 && (
            <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-indigo-400">
              <option value="">All Subjects</option>
              {subjects.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          )}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-indigo-400">
            {STATUS_OPTS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Assigned", value: String(stats.total),          color: "text-gray-800",  bg: "bg-white"     },
          { label: "Approved",       value: String(stats.approved),       color: "text-green-700", bg: "bg-green-50"  },
          { label: "Overdue",        value: String(stats.overdue),        color: "text-red-700",   bg: "bg-red-50"    },
          { label: "Completion %",   value: `${stats.completionRate}%`,   color: rateTextColor(stats.completionRate), bg: "bg-indigo-50" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl border border-gray-100 px-4 py-3 text-center`}>
            <p className={`text-2xl font-black ${color}`}>{isLoading ? "—" : value}</p>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-center">
          <BookOpenCheck className="h-8 w-8 text-gray-200 mb-3" />
          <p className="text-sm font-semibold text-gray-400">No assignments found</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting the date range or filters.</p>
        </div>
      ) : view === "list" ? (
        <div className="space-y-2">
          {items.map((a: any) => {
            const style   = ASSIGN_STYLE[a.displayStatus] ?? ASSIGN_STYLE.NOT_SUBMITTED;
            const dueFmt  = new Date(a.submissionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
            const asnFmt  = new Date(a.assignmentDate).toLocaleDateString("en-IN",  { day: "2-digit", month: "short" });
            return (
              <div key={a.id} className={`bg-white rounded-xl border ${style.border} flex overflow-hidden`}>
                <div className={`w-1.5 shrink-0 ${style.bar}`} />
                <div className="flex-1 px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{a.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                      {a.subject && (
                        <span className="text-xs text-indigo-600 font-medium">{a.subject.name} ({a.subject.code})</span>
                      )}
                      {a.faculty && (
                        <span className="text-xs text-gray-400">{a.faculty.firstName} {a.faculty.lastName}</span>
                      )}
                    </div>
                    {a.topics && <p className="text-xs text-gray-400 truncate mt-0.5">{a.topics}</p>}
                    {a.submission?.reviewNote && (
                      <p className="text-xs text-orange-600 mt-0.5 italic">"{a.submission.reviewNote}"</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 sm:flex-col sm:items-end shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Assigned {asnFmt}</p>
                      <p className="text-xs font-medium text-gray-600">Due {dueFmt}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Big completion rate card */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 flex flex-col sm:flex-row items-center gap-6">
            <div className="text-center shrink-0">
              <p className={`text-5xl font-black ${rateTextColor(stats.completionRate)}`}>{stats.completionRate}%</p>
              <p className="text-xs text-gray-400 mt-1 font-medium">Completion Rate</p>
              <p className="text-xs text-gray-300 mt-0.5">{stats.approved} of {stats.total} approved</p>
            </div>
            <div className="flex-1 w-full grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { label: "Pending",     value: stats.notSubmitted, color: "text-amber-700",  bg: "bg-amber-50"  },
                { label: "Overdue",     value: stats.overdue,      color: "text-red-700",    bg: "bg-red-50"    },
                { label: "Submitted",   value: stats.submitted,    color: "text-blue-700",   bg: "bg-blue-50"   },
                { label: "In Review",   value: stats.inProcess,    color: "text-violet-700", bg: "bg-violet-50" },
                { label: "Approved",    value: stats.approved,     color: "text-green-700",  bg: "bg-green-50"  },
                { label: "Rejected",    value: stats.rejected,     color: "text-orange-700", bg: "bg-orange-50" },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`${bg} rounded-lg px-3 py-2 text-center`}>
                  <p className={`text-lg font-black ${color}`}>{value}</p>
                  <p className="text-[10px] text-gray-400 font-medium">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly trend */}
          {monthlyTrend.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <p className="text-sm font-semibold text-gray-800">Monthly Completion Trend</p>
              </div>
              <div className="px-5 py-4 space-y-3">
                {monthlyTrend.map((m) => (
                  <div key={m.label} className="flex items-center gap-3">
                    <p className="text-xs font-medium text-gray-500 w-20 shrink-0">{m.label}</p>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className={`h-2 rounded-full transition-all ${rateBarColor(m.rate)}`}
                        style={{ width: `${m.rate}%` }} />
                    </div>
                    <p className={`text-xs font-bold w-9 text-right shrink-0 ${rateTextColor(m.rate)}`}>{m.rate}%</p>
                    <p className="text-xs text-gray-400 w-16 text-right shrink-0">{m.approved}/{m.total}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subject breakdown */}
          {subjectBreakdown.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <p className="text-sm font-semibold text-gray-800">Subject-wise Breakdown</p>
              </div>
              <div className="divide-y divide-gray-50">
                {subjectBreakdown.map((s) => (
                  <div key={s.id} className="px-5 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.code}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-green-600 font-medium">{s.approved} done</span>
                      {s.overdue > 0 && <span className="text-xs text-red-500 font-medium">{s.overdue} overdue</span>}
                      <span className="text-xs text-gray-300">·</span>
                      <span className={`text-sm font-black ${rateTextColor(s.rate)}`}>{s.rate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Attendance Tab ────────────────────────────────────────────────────────────

function AttendanceTab({ student }: { student: any }) {
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth() - 2, 1);

  const [dateFrom, setDateFrom] = useState(defaultFrom.toISOString().split("T")[0]);
  const [dateTo,   setDateTo]   = useState(today.toISOString().split("T")[0]);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [view, setView] = useState<"classes" | "stats">("classes");

  const params = new URLSearchParams({ dateFrom, dateTo });
  if (subjectFilter) params.set("subjectId", subjectFilter);

  const { data, isLoading } = useQuery({
    queryKey: ["student-attendance", student.id, dateFrom, dateTo, subjectFilter],
    queryFn: () => api.get(`/api/v1/academics/students/${student.id}/attendance?${params}`).then((r) => r.data),
    enabled: !!student.id,
  });

  const classes: any[] = data?.data ?? [];
  const stats = data?.stats ?? { total: 0, present: 0, absent: 0, unrecorded: 0, percentage: 0, bySubject: [] };

  const subjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    for (const c of classes) { if (c.subject) map.set(c.subject.id, c.subject); }
    return Array.from(map.values());
  }, [classes]);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const c of classes) {
      const key = (c.date as string).split("T")[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [classes]);

  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { label: string; total: number; present: number; absent: number }>();
    for (const c of classes) {
      const d = new Date(c.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
      if (!map.has(key)) map.set(key, { label, total: 0, present: 0, absent: 0 });
      const entry = map.get(key)!;
      entry.total++;
      if (c.attendanceStatus === "PRESENT") entry.present++;
      else if (c.attendanceStatus === "ABSENT") entry.absent++;
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => ({
        ...v,
        percentage: v.present + v.absent > 0 ? Math.round((v.present / (v.present + v.absent)) * 100) : 0,
      }));
  }, [classes]);

  function attStyle(s: string) {
    if (s === "PRESENT") return { bar: "bg-green-500", bg: "bg-green-50", text: "text-green-700", border: "border-green-200", label: "Present" };
    if (s === "ABSENT")  return { bar: "bg-red-500",   bg: "bg-red-50",   text: "text-red-700",   border: "border-red-200",   label: "Absent"  };
    return { bar: "bg-gray-300", bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200", label: "Unrecorded" };
  }
  const pctTextColor = (p: number) => p >= 85 ? "text-green-600" : p >= 75 ? "text-amber-600" : "text-red-600";
  const pctBarColor  = (p: number) => p >= 85 ? "bg-green-500"   : p >= 75 ? "bg-amber-500"   : "bg-red-500";

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
            {(["classes", "stats"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  view === v ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-50"
                }`}>
                {v === "classes" ? "Class List" : "Statistics"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-400 font-medium whitespace-nowrap">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-indigo-400" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-400 font-medium whitespace-nowrap">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-indigo-400" />
            </div>
          </div>
          {subjects.length > 0 && (
            <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-indigo-400">
              <option value="">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Classes",  value: String(stats.total),      color: "text-gray-800",  bg: "bg-white"      },
          { label: "Present",        value: String(stats.present),    color: "text-green-700", bg: "bg-green-50"   },
          { label: "Absent",         value: String(stats.absent),     color: "text-red-700",   bg: "bg-red-50"     },
          { label: "Attendance %",   value: `${stats.percentage}%`,   color: pctTextColor(stats.percentage), bg: "bg-indigo-50" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl border border-gray-100 px-4 py-3 text-center`}>
            <p className={`text-2xl font-black ${color}`}>{isLoading ? "—" : value}</p>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-center">
          <CalendarCheck className="h-8 w-8 text-gray-200 mb-3" />
          <p className="text-sm font-semibold text-gray-400">No classes found</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting the date range or subject filter.</p>
        </div>
      ) : view === "classes" ? (
        <div className="space-y-5">
          {grouped.map(([dateKey, dayClasses]) => {
            const d = new Date(dateKey + "T00:00:00");
            const dayLabel = d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
            return (
              <div key={dateKey}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">{dayLabel}</p>
                <div className="space-y-2">
                  {dayClasses.map((c: any) => {
                    const col   = attStyle(c.attendanceStatus);
                    const start = new Date(c.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
                    const end   = new Date(c.endTime).toLocaleTimeString("en-IN",   { hour: "2-digit", minute: "2-digit", hour12: true });
                    return (
                      <div key={c.id} className={`bg-white rounded-xl border ${col.border} flex overflow-hidden`}>
                        <div className={`w-1.5 shrink-0 ${col.bar}`} />
                        <div className="flex-1 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 min-w-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              {c.subject ? c.subject.name : "—"}
                              {c.subject?.code && <span className="ml-1.5 text-xs font-normal text-gray-400">({c.subject.code})</span>}
                            </p>
                            {c.topics && <p className="text-xs text-gray-400 truncate mt-0.5">{c.topics}</p>}
                            {c.faculty && (
                              <p className="text-xs text-gray-400 mt-0.5">{c.faculty.firstName} {c.faculty.lastName}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 sm:flex-col sm:items-end shrink-0">
                            <p className="text-xs text-gray-400 font-medium whitespace-nowrap">{start} – {end}</p>
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${col.bg} ${col.text}`}>
                              {col.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Monthly trend */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <p className="text-sm font-semibold text-gray-800">Monthly Attendance Trend</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              {monthlyTrend.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No data</p>
              ) : monthlyTrend.map((m) => (
                <div key={m.label} className="flex items-center gap-3">
                  <p className="text-xs font-medium text-gray-500 w-20 shrink-0">{m.label}</p>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className={`h-2 rounded-full transition-all ${pctBarColor(m.percentage)}`}
                      style={{ width: `${m.percentage}%` }} />
                  </div>
                  <p className={`text-xs font-bold w-9 text-right shrink-0 ${pctTextColor(m.percentage)}`}>{m.percentage}%</p>
                  <p className="text-xs text-gray-400 w-16 text-right shrink-0">{m.present}/{m.present + m.absent} cls</p>
                </div>
              ))}
            </div>
          </div>

          {/* Subject breakdown */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <p className="text-sm font-semibold text-gray-800">Subject-wise Breakdown</p>
            </div>
            {stats.bySubject.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No subject data</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {(stats.bySubject as any[]).map((s) => (
                  <div key={s.id} className="px-5 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.code}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-green-600 font-medium">{s.present}P</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-red-600 font-medium">{s.absent}A</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className={`text-sm font-black ${pctTextColor(s.percentage)}`}>{s.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LoginTab({ student, canEdit, onRefetch }: { student: any; canEdit: boolean; onRefetch: () => void }) {
  const qc = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const portalUrl = `${(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000")
    .replace(":4001", ":3002")   // staging
    .replace(":4000", ":3000")   // production
  }/student/login`;

  const resetPwdMut = useMutation({
    mutationFn: () => api.post(`/api/v1/academics/students/${student.id}/reset-password`, {}),
    onSuccess: () => {
      toast.success("Password reset to Welcome@123");
      qc.invalidateQueries({ queryKey: ["student", student.id] });
      onRefetch();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const comingSoonAction = (label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => toast.info(`${label} — coming soon`)}
      className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-400 hover:border-indigo-200 hover:text-indigo-500 transition-colors"
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="space-y-5">
      {/* PDF button */}
      <div className="flex justify-end">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <BadgeCheck className="h-3.5 w-3.5" /> Download PDF
        </button>
      </div>

      {/* ── Student credentials ──────────────────────────── */}
      <CredSection title="Student" icon={KeyRound}>
        <CredRow label="Portal URL">
          <a href={portalUrl} target="_blank" rel="noopener noreferrer"
            className="text-indigo-600 hover:underline break-all text-xs">{portalUrl}</a>
        </CredRow>
        <CredRow label="Username">
          <span className="font-mono">{student.email}</span>
        </CredRow>
        <CredRow label="Password">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`font-mono ${student.mustChangePassword ? "text-amber-600 font-semibold" : "text-gray-400"}`}>
              {student.mustChangePassword
                ? showPassword ? "Welcome@123" : "••••••••••"
                : showPassword ? "Welcome@123" : "Changed by student"}
            </span>
            {student.mustChangePassword && (
              <button onClick={() => setShowPassword((v) => !v)}
                className="text-xs text-indigo-500 hover:underline">
                {showPassword ? "hide" : "show"}
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => { if (confirm(`Reset ${student.firstName}'s password to Welcome@123?`)) resetPwdMut.mutate(); }}
                disabled={resetPwdMut.isPending}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:border-indigo-200 hover:text-indigo-600 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="h-3 w-3" /> reset password
              </button>
            )}
            {comingSoonAction("send sms", <Phone className="h-3 w-3" />)}
            {comingSoonAction("send email", <Mail className="h-3 w-3" />)}
          </div>
        </CredRow>
        <CredRow label="Status">
          {student.mustChangePassword ? (
            <span className="inline-flex items-center gap-1.5 text-amber-600 text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
              Awaiting first login
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-green-600 text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
              Password set by student
            </span>
          )}
        </CredRow>
        <CredRow label="Email">{student.email}</CredRow>
      </CredSection>

      {/* ── Father / Guardian ────────────────────────────── */}
      <CredSection title="Father / Guardian" icon={Users2}>
        <CredRow label="Name">
          {student.parentName
            ? <span className="font-medium">{student.parentName}</span>
            : <span className="text-gray-300">—</span>}
        </CredRow>
        <CredRow label="Phone">
          <div className="flex flex-wrap items-center gap-2">
            <span>{student.parentPhone || <span className="text-gray-300">—</span>}</span>
            {student.parentPhone && comingSoonAction("send sms", <Phone className="h-3 w-3" />)}
          </div>
        </CredRow>
        <CredRow label="Email">
          <div className="flex flex-wrap items-center gap-2">
            <span>{student.parentEmail || <span className="text-gray-300">—</span>}</span>
            {student.parentEmail && comingSoonAction("send email", <Mail className="h-3 w-3" />)}
          </div>
        </CredRow>
        <CredRow label="Relation">{student.parentRelation || <span className="text-gray-300">—</span>}</CredRow>
        <CredRow label="Parent portal">
          <span className="text-xs text-gray-400 italic">Coming soon</span>
        </CredRow>
      </CredSection>

      {/* ── Mother ───────────────────────────────────────── */}
      <CredSection title="Mother" icon={Users2}>
        <CredRow label="Name">
          {student.motherName
            ? <span className="font-medium">{student.motherName}</span>
            : <span className="text-gray-300">—</span>}
        </CredRow>
        <CredRow label="Phone">
          <div className="flex flex-wrap items-center gap-2">
            <span>{student.motherPhone || <span className="text-gray-300">—</span>}</span>
            {student.motherPhone && comingSoonAction("send sms", <Phone className="h-3 w-3" />)}
          </div>
        </CredRow>
        <CredRow label="Email">
          <div className="flex flex-wrap items-center gap-2">
            <span>{student.motherEmail || <span className="text-gray-300">—</span>}</span>
            {student.motherEmail && comingSoonAction("send email", <Mail className="h-3 w-3" />)}
          </div>
        </CredRow>
        <CredRow label="Parent portal">
          <span className="text-xs text-gray-400 italic">Coming soon</span>
        </CredRow>
      </CredSection>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function StudentDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useAuthStore();
  const permissions = usePermissions();
  const qc = useQueryClient();

  const [tab, setTab] = useState("profile");
  const tabsRef = useRef<HTMLDivElement>(null);

  const canEdit =
    user?.role === "SUPER_ADMIN" ||
    user?.role === "HR_ADMIN" ||
    (permissions["STU_PROFILE"]?.canEdit ?? false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["student", id],
    queryFn: () => api.get(`/api/v1/academics/students/${id}`).then((r) => r.data.data),
    staleTime: 30 * 1000,
  });

  const archiveMut = useMutation({
    mutationFn: () => api.patch(`/api/v1/academics/students/${id}/archive`, {}),
    onSuccess: () => {
      toast.success(data?.isArchived ? "Student unarchived" : "Student archived");
      qc.invalidateQueries({ queryKey: ["student", id] });
      refetch();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="space-y-3 w-80">
          <div className="h-5 w-48 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <div>
          <p className="font-semibold text-gray-500">Student not found</p>
          <button onClick={() => router.back()} className="mt-3 text-sm text-indigo-600 hover:underline">Go back</button>
        </div>
      </div>
    );
  }

  const student = data;
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 sm:px-6 sm:py-4 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors shrink-0">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold overflow-hidden shrink-0">
            {student.photoUrl
              ? <img src={`${apiBase}${student.photoUrl}`} alt="photo" className="h-full w-full object-cover" />
              : `${student.firstName[0]}${student.lastName[0]}`}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-sm font-bold text-gray-900 sm:text-base">{student.firstName} {student.middleName ? `${student.middleName} ` : ""}{student.lastName}</h1>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium border ${STATUS_COLORS[student.status] ?? STATUS_COLORS.INACTIVE}`}>
                {student.status}
              </span>
              {student.isArchived && (
                <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium border border-gray-200 bg-gray-100 text-gray-500">Archived</span>
              )}
              {student.mustChangePassword && (
                <span className="hidden sm:inline-flex rounded-full px-2 py-0.5 text-xs font-medium border border-amber-100 bg-amber-50 text-amber-600">pwd pending</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5 font-mono truncate">
              {student.studentCode}
              {student.batch && ` · ${student.batch.academicYear} ${student.batch.name}`}
            </p>
          </div>

          {canEdit && (
            <button
              onClick={() => { if (confirm(`${student.isArchived ? "Unarchive" : "Archive"} this student?`)) archiveMut.mutate(); }}
              disabled={archiveMut.isPending}
              className="shrink-0 flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {student.isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{student.isArchived ? "Unarchive" : "Archive"}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div
        ref={tabsRef}
        className="bg-white border-b border-gray-100 px-6 flex gap-0.5 overflow-x-auto shrink-0 scrollbar-none"
      >
        {TABS.map(({ id: tid, label, icon: Icon }) => (
          <button
            key={tid}
            onClick={() => setTab(tid)}
            className={`flex items-center gap-1.5 px-3.5 py-3 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === tid
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        <div className="max-w-5xl mx-auto">
          {tab === "profile"     && <ProfileTab   student={student} canEdit={canEdit} onRefetch={refetch} />}
          {tab === "admission"   && <AdmissionTab student={student} canEdit={canEdit} onRefetch={refetch} />}
          {tab === "batch"       && <BatchTab     student={student} canEdit={canEdit} onRefetch={refetch} />}
          {tab === "attendance"  && <AttendanceTab student={student} />}
          {tab === "assignments" && <AssignmentsTab student={student} />}
          {tab === "assessments" && <ComingSoon label="Assessments"  icon={BarChart2}      />}
          {tab === "ptms"        && <ComingSoon label="PTMs"         icon={MessageSquare}  />}
          {tab === "noticeboard" && <NoticeBoardTab />}
          {tab === "documents"   && <ComingSoon label="Documents"    icon={FolderOpen}     />}
          {tab === "assistance"  && <ComingSoon label="Assistance"   icon={LifeBuoy}       />}
          {tab === "login"       && <LoginTab    student={student} canEdit={canEdit} onRefetch={refetch} />}
        </div>
      </div>
    </div>
  );
}
