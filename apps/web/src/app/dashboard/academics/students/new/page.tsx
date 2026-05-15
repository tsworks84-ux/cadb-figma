"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowLeft, Upload, Check, User, Users2, ClipboardList,
  GraduationCap, KeyRound, ChevronRight, ChevronLeft,
  Camera, X, CheckCircle2, Circle, ChevronDown, ChevronUp,
  Plus, Trash2, Percent, IndianRupee, Clock, History, Link2, Layers,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

// ── Design tokens ─────────────────────────────────────────────────────────────
// All inputs: rounded-xl, shadow-sm, focus:ring-4/indigo-50 + border-indigo-400
// Cards: rounded-2xl bg-white shadow-sm border border-gray-100
// Nav: filled pill — active bg-indigo-600 text-white, else text-gray-500

// ── Primitives ────────────────────────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function FInput({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-800 shadow-sm",
        "placeholder:text-gray-300 transition-all duration-150",
        "focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-50",
        className
      )}
    />
  );
}

function FSelect({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-700 shadow-sm",
        "transition-all duration-150 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-50",
        className
      )}
    >
      {children}
    </select>
  );
}

// Wraps a logical group in a white card
function Card({ children, title, icon: Icon }: {
  children: React.ReactNode;
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden mb-5">
      {title && (
        <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-50 bg-gray-50/60">
          {Icon && <Icon className="h-4 w-4 text-gray-400" />}
          <h3 className="text-sm font-semibold text-gray-600 tracking-wide">{title}</h3>
        </div>
      )}
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function DOBInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <FInput
      placeholder="DD / MM / YYYY"
      value={value}
      maxLength={10}
      className="font-mono tracking-widest"
      onChange={(e) => {
        const d = e.target.value.replace(/\D/g, "").slice(0, 8);
        let f = d;
        if (d.length > 4) f = `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
        else if (d.length > 2) f = `${d.slice(0, 2)}/${d.slice(2)}`;
        onChange(f);
      }}
    />
  );
}

// ── Sections config ───────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "personal",  label: "Personal",   icon: User,          num: 1 },
  { id: "parents",   label: "Parents",    icon: Users2,        num: 2 },
  { id: "admission", label: "Admission",  icon: ClipboardList, num: 3 },
  { id: "batch",     label: "Batch",      icon: GraduationCap, num: 4 },
  { id: "login",     label: "Login Credentials", icon: KeyRound,      num: 5 },
];

// ── Form state ────────────────────────────────────────────────────────────────

type FormState = {
  photoUrl: string; photoFile: File | null;
  rollNumber: string; firstName: string; middleName: string; lastName: string;
  email: string; phone: string; gender: string; dob: string;
  address: string; area: string; landmark: string; city: string; state: string; pincode: string;
  schoolId: string; gradeId: string; nationality: string;
  parentName: string; parentPhone: string; parentEmail: string; parentRelation: string; parentOccupation: string;
  motherName: string; motherPhone: string; motherEmail: string; motherOccupation: string;
  communicationContact: "FATHER" | "MOTHER" | "BOTH" | "OTHER";
  communicationContactName: string; communicationContactPhone: string;
  courseId: string;
  admissionDate: string; academicYear: string;
  totalFee: string;
  discountType: "PERCENTAGE" | "AMOUNT";
  discountValue: string;
  paidFee: string; paymentDate: string; paymentMode: string; receiptNumber: string; paymentNote: string;
  instalments: Array<{ id: string; instalmentNo: number; label: string; amount: string; dueDate: string }>;
  batchId: string;
  subjectIds: string[];
};

const INITIAL: FormState = {
  photoUrl: "", photoFile: null,
  rollNumber: "", firstName: "", middleName: "", lastName: "",
  email: "", phone: "", gender: "", dob: "",
  address: "", area: "", landmark: "", city: "", state: "", pincode: "",
  schoolId: "", gradeId: "", nationality: "Indian",
  parentName: "", parentPhone: "", parentEmail: "", parentRelation: "Father", parentOccupation: "",
  motherName: "", motherPhone: "", motherEmail: "", motherOccupation: "",
  communicationContact: "FATHER", communicationContactName: "", communicationContactPhone: "",
  courseId: "",
  admissionDate: "", academicYear: "",
  totalFee: "", discountType: "AMOUNT", discountValue: "",
  paidFee: "", paymentDate: "", paymentMode: "", receiptNumber: "", paymentNote: "",
  instalments: [],
  batchId: "",
  subjectIds: [],
};

const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque", "DD", "Card", "Online"];
const RELATIONS     = ["Father", "Mother", "Guardian", "Sibling", "Grandparent", "Other"];

function hasContactFn(f: FormState) {
  return !!(f.parentPhone || f.parentEmail || f.motherPhone || f.motherEmail ||
    (f.communicationContact === "OTHER" && f.communicationContactPhone));
}

function isComplete(id: string, f: FormState) {
  if (id === "personal")  return !!(f.firstName && f.lastName && f.email);
  if (id === "parents")   return !!((f.parentName || f.motherName) && hasContactFn(f));
  if (id === "admission") return !!(f.courseId);
  if (id === "batch")     return !!f.batchId;
  if (id === "login")     return !!f.email;
  return false;
}

// ── Section: Personal ─────────────────────────────────────────────────────────

function PersonalSection({ form, set, schools, grades }: {
  form: FormState; set: (k: keyof FormState, v: any) => void;
  schools: any[]; grades: any[];
}) {
  const photoInput = useRef<HTMLInputElement>(null);
  const apiBase    = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  return (
    <div className="space-y-5">

      {/* Photo + Identity card */}
      <Card title="Profile" icon={User}>
        <div className="flex items-center gap-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div
              onClick={() => photoInput.current?.click()}
              className={cn(
                "h-24 w-24 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center overflow-hidden cursor-pointer transition-all duration-200",
                "hover:border-indigo-300 hover:bg-indigo-50 group"
              )}
            >
              {form.photoUrl
                ? <img src={form.photoUrl.startsWith("blob:") ? form.photoUrl : `${apiBase}${form.photoUrl}`} alt="" className="h-full w-full object-cover" />
                : <>
                    <Camera className="h-6 w-6 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                    <span className="text-[10px] text-gray-300 group-hover:text-indigo-400 mt-1 transition-colors">Upload</span>
                  </>
              }
            </div>
            {form.photoUrl && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); set("photoUrl", ""); set("photoFile", null); }}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-gray-900/70 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <input ref={photoInput} type="file" accept="image/*" className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) { set("photoFile", file); set("photoUrl", URL.createObjectURL(file)); }
            }}
          />

          {/* Roll No + Name */}
          <div className="flex-1 grid grid-cols-4 gap-3">
            <div>
              <Label>Roll No.</Label>
              <FInput placeholder="Auto" value={form.rollNumber} onChange={(e) => set("rollNumber", e.target.value)} />
            </div>
            <div>
              <Label required>First Name</Label>
              <FInput placeholder="First name" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </div>
            <div>
              <Label>Middle</Label>
              <FInput placeholder="Optional" value={form.middleName} onChange={(e) => set("middleName", e.target.value)} />
            </div>
            <div>
              <Label required>Last Name</Label>
              <FInput placeholder="Last name" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </div>
          </div>
        </div>
      </Card>

      {/* Contact card */}
      <Card title="Contact & Demographics" icon={User}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Email */}
          <div>
            <Label required>Email</Label>
            <FInput type="email" placeholder="student@email.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>

          {/* Mobile — country code + number, full half-width */}
          <div>
            <Label>Mobile</Label>
            <div className="flex gap-2">
              <FSelect className="w-[80px] shrink-0 px-2"><option>+91</option></FSelect>
              <FInput placeholder="Mobile number" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="flex-1 min-w-0" />
            </div>
          </div>

          {/* Date of Birth */}
          <div>
            <Label>Date of Birth</Label>
            <DOBInput value={form.dob} onChange={(v) => set("dob", v)} />
          </div>

          {/* Gender */}
          <div>
            <Label required>Gender</Label>
            <div className="flex gap-2 mt-1">
              {(["MALE", "FEMALE", "OTHER"] as const).map((g) => (
                <button key={g} type="button" onClick={() => set("gender", g)}
                  className={cn(
                    "px-5 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-150 shadow-sm",
                    form.gender === g
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-indigo-100"
                      : "bg-white border-gray-200 text-gray-500 hover:border-indigo-200 hover:text-indigo-600"
                  )}
                >
                  {g.charAt(0) + g.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Address card */}
      <Card title="Address" icon={User}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><Label>Street / Flat / Building</Label><FInput placeholder="Address line" value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
            <div><Label>Area / Locality</Label><FInput placeholder="Area" value={form.area} onChange={(e) => set("area", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div><Label>Landmark</Label><FInput placeholder="Landmark" value={form.landmark} onChange={(e) => set("landmark", e.target.value)} /></div>
            <div><Label>City</Label><FInput placeholder="City" value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
            <div><Label>State</Label><FInput placeholder="State" value={form.state} onChange={(e) => set("state", e.target.value)} /></div>
            <div><Label>PIN Code</Label><FInput placeholder="560001" value={form.pincode} onChange={(e) => set("pincode", e.target.value)} /></div>
          </div>
        </div>
      </Card>

      {/* Academic context card */}
      <Card title="Academic Context" icon={GraduationCap}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <Label>School / College</Label>
            <FSelect value={form.schoolId} onChange={(e) => set("schoolId", e.target.value)}>
              <option value="">Select school</option>
              {schools.map((s: any) => <option key={s.id} value={s.id}>{s.name}{s.city ? ` — ${s.city}` : ""}</option>)}
            </FSelect>
          </div>
          <div>
            <Label>Class / Grade</Label>
            <FSelect value={form.gradeId} onChange={(e) => set("gradeId", e.target.value)}>
              <option value="">Select grade</option>
              {grades.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </FSelect>
          </div>
          <div>
            <Label>Nationality</Label>
            <FInput placeholder="e.g. Indian" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Section: Parents ──────────────────────────────────────────────────────────

function PhoneField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      <FSelect className="w-[90px] shrink-0 px-2"><option>+91</option></FSelect>
      <FInput placeholder="Phone number" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

type CommContact = "FATHER" | "MOTHER" | "BOTH" | "OTHER";

function ParentsSection({ form, set }: { form: FormState; set: (k: keyof FormState, v: any) => void }) {
  const hasContact = hasContactFn(form);

  const COMM_OPTIONS: { value: CommContact; label: string; sub: string }[] = [
    { value: "FATHER", label: "Father / Guardian", sub: "Use father's contact" },
    { value: "MOTHER", label: "Mother",             sub: "Use mother's contact" },
    { value: "BOTH",   label: "Both",               sub: "Send to both"         },
    { value: "OTHER",  label: "Other Contact",      sub: "Specify separately"   },
  ];

  return (
    <div className="space-y-5">
      <Card title="Father / Parent / Guardian" icon={Users2}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><Label>Full Name</Label><FInput placeholder="Full name" value={form.parentName} onChange={(e) => set("parentName", e.target.value)} /></div>
            <div>
              <Label>Relation</Label>
              <FSelect value={form.parentRelation} onChange={(e) => set("parentRelation", e.target.value)}>
                {RELATIONS.map((r) => <option key={r}>{r}</option>)}
              </FSelect>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><Label>Mobile</Label><PhoneField value={form.parentPhone} onChange={(v) => set("parentPhone", v)} /></div>
            <div><Label>Occupation</Label><FInput placeholder="Occupation" value={form.parentOccupation} onChange={(e) => set("parentOccupation", e.target.value)} /></div>
          </div>
          <div><Label>Email</Label><FInput type="email" placeholder="Email address" value={form.parentEmail} onChange={(e) => set("parentEmail", e.target.value)} /></div>
        </div>
      </Card>

      <Card title="Mother's Information" icon={Users2}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><Label>Full Name</Label><FInput placeholder="Full name" value={form.motherName} onChange={(e) => set("motherName", e.target.value)} /></div>
            <div><Label>Occupation</Label><FInput placeholder="Occupation" value={form.motherOccupation} onChange={(e) => set("motherOccupation", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><Label>Mobile</Label><PhoneField value={form.motherPhone} onChange={(v) => set("motherPhone", v)} /></div>
            <div><Label>Email</Label><FInput type="email" placeholder="Email address" value={form.motherEmail} onChange={(e) => set("motherEmail", e.target.value)} /></div>
          </div>
        </div>
      </Card>

      <Card title="Communication Preference" icon={Users2}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {COMM_OPTIONS.map(({ value, label, sub }) => (
              <button
                key={value}
                type="button"
                onClick={() => set("communicationContact", value)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-4 text-left transition-all duration-150 shadow-sm",
                  form.communicationContact === value
                    ? "border-indigo-400 bg-indigo-50 shadow-indigo-100"
                    : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                <div className={cn(
                  "mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                  form.communicationContact === value ? "border-indigo-500" : "border-gray-300"
                )}>
                  {form.communicationContact === value && (
                    <div className="h-2 w-2 rounded-full bg-indigo-500" />
                  )}
                </div>
                <div>
                  <p className={cn("text-sm font-semibold", form.communicationContact === value ? "text-indigo-700" : "text-gray-700")}>{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                </div>
              </button>
            ))}
          </div>

          {form.communicationContact === "OTHER" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><Label>Contact Name</Label><FInput placeholder="Full name" value={form.communicationContactName} onChange={(e) => set("communicationContactName", e.target.value)} /></div>
                <div><Label>Contact Phone *</Label><PhoneField value={form.communicationContactPhone} onChange={(v) => set("communicationContactPhone", v)} /></div>
              </div>
            </div>
          )}

          {!hasContact && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-4 py-2.5">
              <div className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
              <p className="text-sm text-red-500">At least one contact number or email is required.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── Section: Admission ────────────────────────────────────────────────────────

function AdmissionSection({ form, set, courses, academicYears }: {
  form: FormState;
  set: (k: keyof FormState, v: any) => void;
  courses: any[];
  academicYears: any[];
}) {
  const [feeExpanded, setFeeExpanded] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState("");

  const selectedCourse = courses.find((c) => c.id === form.courseId);

  // Fetch instalment plans for selected course (+ generic plans)
  const { data: instalmentPlans = [] } = useQuery({
    queryKey: ["instalment-plans", form.courseId],
    queryFn: () => api.get(`/api/v1/academics/instalment-plans${form.courseId ? `?courseId=${form.courseId}` : ""}`).then((r) => r.data.data),
    enabled: true,
  });

  // Auto-fill fee from course (only if totalFee is empty)
  const handleCourseChange = (id: string) => {
    set("courseId", id);
    setSelectedPlanId("");
    const c = courses.find((x) => x.id === id);
    if (c?.fee && !form.totalFee) set("totalFee", String(c.fee));
  };

  // Apply selected plan to instalment rows
  const applyPlan = () => {
    const plan = instalmentPlans.find((p: any) => p.id === selectedPlanId);
    if (!plan?.items?.length) return;
    const admDate = form.admissionDate ? new Date(form.admissionDate) : null;
    const rows = (plan.items as any[]).map((item: any) => {
      let dueDate = "";
      if (admDate && item.daysFromAdmission != null) {
        const d = new Date(admDate);
        d.setDate(d.getDate() + item.daysFromAdmission);
        dueDate = d.toISOString().split("T")[0];
      }
      return {
        id: crypto.randomUUID(),
        instalmentNo: item.instalmentNo,
        label: item.label ?? `Instalment ${item.instalmentNo}`,
        amount: String(item.amount),
        dueDate,
      };
    });
    set("instalments", rows);
  };

  // Discount calculation
  const totalFeeNum   = parseFloat(form.totalFee    || "0");
  const discountNum   = form.discountType === "PERCENTAGE"
    ? totalFeeNum * (parseFloat(form.discountValue || "0") / 100)
    : parseFloat(form.discountValue || "0");
  const netFee        = Math.max(0, totalFeeNum - discountNum);
  const paidNum       = parseFloat(form.paidFee || "0");
  const pendingNum    = Math.max(0, netFee - paidNum);
  const instalSum     = form.instalments.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const instalRemain  = Math.max(0, pendingNum - instalSum);

  const addInstalment = () => {
    const no = form.instalments.length + 1;
    set("instalments", [
      ...form.instalments,
      { id: crypto.randomUUID(), instalmentNo: no, label: `Instalment ${no}`, amount: "", dueDate: "" },
    ]);
  };

  const updateInstalment = (id: string, field: string, val: string) => {
    set("instalments", form.instalments.map((i) => i.id === id ? { ...i, [field]: val } : i));
  };

  const removeInstalment = (id: string) => {
    const updated = form.instalments
      .filter((i) => i.id !== id)
      .map((i, idx) => ({ ...i, instalmentNo: idx + 1, label: `Instalment ${idx + 1}` }));
    set("instalments", updated);
  };

  return (
    <div className="space-y-5">

      {/* Course */}
      <Card title="Course / Programme" icon={ClipboardList}>
        <div className="space-y-4">
          <div>
            <Label required>Course</Label>
            <FSelect value={form.courseId} onChange={(e) => handleCourseChange(e.target.value)}>
              <option value="">— Select a course —</option>
              {courses.filter((c) => c.isActive).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `[${c.code}] ` : ""}{c.name}{c.duration ? ` · ${c.duration} Yr` : ""}
                </option>
              ))}
            </FSelect>
          </div>
          {selectedCourse && (
            <div className="flex items-center gap-4 rounded-xl border border-indigo-100 bg-indigo-50/60 px-5 py-3.5">
              <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                <ClipboardList className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-indigo-900">{selectedCourse.name}</p>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-indigo-500">
                  {selectedCourse.code     && <span className="font-mono">{selectedCourse.code}</span>}
                  {selectedCourse.duration && <span>{selectedCourse.duration}</span>}
                  {selectedCourse.fee      && <span className="font-semibold">₹{selectedCourse.fee.toLocaleString()}</span>}
                  {selectedCourse.description && <span className="text-indigo-400 truncate">{selectedCourse.description}</span>}
                </div>
              </div>
              <CheckCircle2 className="h-5 w-5 text-indigo-400 shrink-0" />
            </div>
          )}
        </div>
      </Card>

      {/* Admission Details */}
      <Card title="Admission Details" icon={ClipboardList}>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Admission Number</Label>
            <FInput
              readOnly
              placeholder="Auto-generated on save"
              value=""
              className="bg-gray-50 text-gray-400 cursor-default font-mono"
            />
          </div>
          <div><Label>Admission Date</Label><FInput type="date" value={form.admissionDate} onChange={(e) => set("admissionDate", e.target.value)} /></div>
          <div>
            <Label>Academic Year</Label>
            <FSelect value={form.academicYear} onChange={(e) => set("academicYear", e.target.value)}>
              <option value="">Select year</option>
              {academicYears.filter((y: any) => y.isActive).map((y: any) => (
                <option key={y.id} value={y.name}>{y.name}</option>
              ))}
            </FSelect>
          </div>
        </div>
      </Card>

      {/* Fee & Payment — collapsible */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        {/* Summary header — always visible, click to expand/collapse */}
        <button
          type="button"
          onClick={() => setFeeExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-gray-50/60 hover:bg-gray-100/60 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <IndianRupee className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-600">Fee & Payment</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            {totalFeeNum > 0 && (
              <>
                <span className="text-gray-400">Course fee <span className="font-semibold text-gray-700">₹{totalFeeNum.toLocaleString()}</span></span>
                {discountNum > 0 && <span className="text-green-600">− ₹{discountNum.toFixed(0)}</span>}
                <span className="text-gray-400">Net <span className="font-bold text-gray-800">₹{netFee.toLocaleString()}</span></span>
                {paidNum > 0 && <span className="text-indigo-600">Paid ₹{paidNum.toLocaleString()}</span>}
                {pendingNum > 0 && <span className="font-semibold text-orange-600">Due ₹{pendingNum.toLocaleString()}</span>}
              </>
            )}
            {feeExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </button>

        {feeExpanded && (
          <div className="px-6 py-5 space-y-6">
            {/* Fee calculation */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Fee Calculation</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Total Fee (₹)</Label>
                  <FInput type="number" min="0" placeholder="0.00" value={form.totalFee}
                    onChange={(e) => set("totalFee", e.target.value)} />
                  {selectedCourse?.fee && form.totalFee !== String(selectedCourse.fee) && (
                    <button type="button" onClick={() => set("totalFee", String(selectedCourse.fee))}
                      className="text-xs text-indigo-500 hover:text-indigo-700 mt-1 font-medium">
                      ← Reset to course fee (₹{selectedCourse.fee.toLocaleString()})
                    </button>
                  )}
                </div>
                <div>
                  <Label>Discount</Label>
                  <div className="flex gap-2">
                    {/* Toggle % / ₹ */}
                    <div className="flex rounded-xl border border-gray-200 overflow-hidden shadow-sm shrink-0">
                      <button type="button"
                        onClick={() => set("discountType", "PERCENTAGE")}
                        className={cn("flex items-center gap-1 px-3 py-2.5 text-sm font-semibold transition-colors",
                          form.discountType === "PERCENTAGE" ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                        )}>
                        <Percent className="h-3.5 w-3.5" />
                      </button>
                      <button type="button"
                        onClick={() => set("discountType", "AMOUNT")}
                        className={cn("flex items-center gap-1 px-3 py-2.5 text-sm font-semibold transition-colors",
                          form.discountType === "AMOUNT" ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                        )}>
                        <IndianRupee className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <FInput type="number" min="0"
                      placeholder={form.discountType === "PERCENTAGE" ? "e.g. 10" : "0.00"}
                      value={form.discountValue}
                      onChange={(e) => set("discountValue", e.target.value)} />
                  </div>
                  {discountNum > 0 && (
                    <p className="text-xs text-green-600 mt-1 font-medium">
                      ₹{discountNum.toFixed(2)} discount applied
                    </p>
                  )}
                </div>
              </div>

              {/* Net fee highlight */}
              {totalFeeNum > 0 && (
                <div className="mt-4 flex items-center justify-between rounded-xl bg-gray-50 border border-gray-100 px-5 py-3">
                  <span className="text-sm text-gray-500">Net Payable</span>
                  <span className="text-xl font-bold text-gray-900">₹{netFee.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>

            {/* Initial payment */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Initial Payment</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><Label>Amount Paid (₹)</Label><FInput type="number" min="0" placeholder="0.00" value={form.paidFee} onChange={(e) => set("paidFee", e.target.value)} /></div>
                <div><Label>Payment Date</Label><FInput type="date" value={form.paymentDate} onChange={(e) => set("paymentDate", e.target.value)} /></div>
                <div>
                  <Label>Mode of Payment</Label>
                  <FSelect value={form.paymentMode} onChange={(e) => set("paymentMode", e.target.value)}>
                    <option value="">Select mode</option>
                    {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
                  </FSelect>
                </div>
                <div><Label>Receipt Number</Label><FInput placeholder="Receipt / ref no." value={form.receiptNumber} onChange={(e) => set("receiptNumber", e.target.value)} /></div>
              </div>

              {/* Pending display */}
              {totalFeeNum > 0 && (
                <div className={cn(
                  "mt-4 flex items-center justify-between rounded-xl border px-5 py-3",
                  pendingNum > 0 ? "border-orange-200 bg-orange-50" : "border-green-200 bg-green-50"
                )}>
                  <span className="text-sm font-medium text-gray-600">
                    {pendingNum > 0 ? "Outstanding Balance" : "Fully Paid"}
                  </span>
                  <span className={cn("text-xl font-bold", pendingNum > 0 ? "text-orange-700" : "text-green-700")}>
                    {pendingNum > 0 ? `₹${pendingNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "₹0.00"}
                  </span>
                </div>
              )}
            </div>

            {/* Note */}
            <div>
              <Label>Note</Label>
              <textarea
                rows={2}
                placeholder="Any note about this payment or admission..."
                value={form.paymentNote}
                onChange={(e) => set("paymentNote", e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-800 shadow-sm placeholder:text-gray-300 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-50 resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Instalment Plan */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-gray-50/60">
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-600">Instalment Plan</span>
            {form.instalments.length > 0 && (
              <span className="ml-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5">
                {form.instalments.length}
              </span>
            )}
          </div>
          <button type="button" onClick={addInstalment}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm">
            <Plus className="h-3.5 w-3.5" /> Add Instalment
          </button>
        </div>

        {/* Plan selector */}
        {instalmentPlans.length > 0 && (
          <div className="flex items-center gap-3 px-6 py-3.5 border-b border-gray-50 bg-indigo-50/30">
            <Layers className="h-4 w-4 text-indigo-400 shrink-0" />
            <FSelect
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="flex-1 py-2 text-sm"
            >
              <option value="">Apply a template plan…</option>
              {instalmentPlans.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.course ? ` — ${p.course.name}` : " — Generic"} ({p.items?.length ?? 0} instalments)
                </option>
              ))}
            </FSelect>
            <button
              type="button"
              disabled={!selectedPlanId}
              onClick={applyPlan}
              className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <Check className="h-3.5 w-3.5" /> Apply
            </button>
          </div>
        )}

        <div className="px-6 py-4">
          {form.instalments.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center mb-2">
                <Clock className="h-5 w-5 text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">No instalment plan defined.</p>
              <p className="text-xs text-gray-300 mt-0.5">Full amount due at once, or click "Add Instalment" to split.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Header row */}
              <div className="grid grid-cols-[40px_1fr_160px_160px_44px] gap-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-1">
                <span>#</span><span>Label</span><span>Amount (₹)</span><span>Due Date</span><span />
              </div>
              {form.instalments.map((ins) => (
                <div key={ins.id} className="grid grid-cols-[40px_1fr_160px_160px_44px] gap-3 items-center">
                  <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600">
                    {ins.instalmentNo}
                  </div>
                  <FInput placeholder="e.g. 1st Instalment" value={ins.label}
                    onChange={(e) => updateInstalment(ins.id, "label", e.target.value)} />
                  <FInput type="number" min="0" placeholder="0.00" value={ins.amount}
                    onChange={(e) => updateInstalment(ins.id, "amount", e.target.value)} />
                  <FInput type="date" value={ins.dueDate}
                    onChange={(e) => updateInstalment(ins.id, "dueDate", e.target.value)} />
                  <button type="button" onClick={() => removeInstalment(ins.id)}
                    className="h-9 w-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {/* Running total + payment link note */}
              <div className="mt-2 pt-3 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500">Total planned: <span className="font-semibold text-gray-800">₹{instalSum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></span>
                  {instalRemain > 0 && (
                    <span className="text-orange-500 font-medium">Unplanned: ₹{instalRemain.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  )}
                  {instalRemain === 0 && instalSum > 0 && (
                    <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Fully planned</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Link2 className="h-3.5 w-3.5" />
                  <span>Payment links via Razorpay — coming soon</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment History */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-50 bg-gray-50/60">
          <History className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-600">Payment History</span>
        </div>
        <div className="flex flex-col items-center py-8 text-center px-6">
          <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center mb-2">
            <History className="h-5 w-5 text-gray-300" />
          </div>
          <p className="text-sm text-gray-400">No payments recorded yet.</p>
          <p className="text-xs text-gray-300 mt-0.5">History will appear here after the student record is saved and payments are processed.</p>
        </div>
      </div>

    </div>
  );
}

// ── Section: Batch ────────────────────────────────────────────────────────────

function BatchSection({ form, set, batches }: { form: FormState; set: (k: keyof FormState, v: any) => void; batches: any[] }) {
  const activeBatches = batches.filter((b: any) => !b.isArchived);

  const { data: academicYears = [] } = useQuery({
    queryKey: ["academic-years"],
    queryFn: () => api.get("/api/v1/academics/academic-years").then((r) => r.data.data),
    staleTime: 10 * 60 * 1000,
  });
  const activeYears = (academicYears as any[]).filter((y) => !y.isArchived);

  const [filterYear, setFilterYear] = useState("");

  // Initialize to the first active year once they load
  useEffect(() => {
    if (activeYears.length > 0 && !filterYear) {
      setFilterYear(activeYears[0].name);
    }
  }, [activeYears.length]);

  const filteredBatches = filterYear
    ? activeBatches.filter((b: any) => b.academicYear === filterYear)
    : activeBatches;

  const selectedBatch = activeBatches.find((b: any) => b.id === form.batchId);

  // Fetch subjects for the selected batch
  const { data: batchSubjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ["batch-subjects", form.batchId],
    queryFn: () => api.get(`/api/v1/academics/batches/${form.batchId}/subjects`).then((r) => r.data.data),
    enabled: !!form.batchId,
  });

  // Auto-select ALL subjects when they first load for a batch
  useEffect(() => {
    if (batchSubjects.length > 0 && form.subjectIds.length === 0) {
      set("subjectIds", batchSubjects.map((bs: any) => bs.subject.id));
    }
  }, [batchSubjects]);

  const handleBatchChange = (id: string) => {
    set("batchId", id);
    set("subjectIds", []);
  };

  const toggleSubject = (subjectId: string) => {
    const current = form.subjectIds;
    set("subjectIds", current.includes(subjectId)
      ? current.filter((s) => s !== subjectId)
      : [...current, subjectId]
    );
  };

  return (
    <div className="space-y-5">
      <Card title="Batch Assignment" icon={GraduationCap}>
        <div className="space-y-5">

          {/* Step 1 — Academic Year */}
          <div>
            <Label>Academic Year</Label>
            <FSelect
              value={filterYear}
              onChange={(e) => {
                setFilterYear(e.target.value);
                set("batchId", "");
                set("subjectIds", []);
              }}
            >
              <option value="">— All years —</option>
              {activeYears.map((y: any) => (
                <option key={y.id} value={y.name}>{y.name}</option>
              ))}
            </FSelect>
          </div>

          {/* Step 2 — Batch */}
          <div>
            <Label>Select Batch</Label>
            <FSelect value={form.batchId} onChange={(e) => handleBatchChange(e.target.value)}>
              <option value="">— Select a batch —</option>
              {filteredBatches.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}{b._count?.students != null ? ` (${b._count.students} students)` : ""}
                </option>
              ))}
            </FSelect>
          </div>

          {/* Step 3 — Subjects */}
          {form.batchId && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Enrolled Subjects</Label>
                {!loadingSubjects && batchSubjects.length > 0 && (
                  <span className="text-xs text-gray-400">
                    {form.subjectIds.length} / {batchSubjects.length} selected
                  </span>
                )}
              </div>
              {loadingSubjects ? (
                <div className="space-y-2">
                  {[1,2,3,4].map((i) => <div key={i} className="h-11 rounded-xl bg-gray-100 animate-pulse" />)}
                </div>
              ) : batchSubjects.length === 0 ? (
                <p className="text-sm text-gray-400">No subjects assigned to this batch yet.</p>
              ) : (
                <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
                  {batchSubjects.map((bs: any) => {
                    const enrolled = form.subjectIds.includes(bs.subject.id);
                    return (
                      <button
                        key={bs.subject.id}
                        type="button"
                        onClick={() => toggleSubject(bs.subject.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                          enrolled ? "bg-white hover:bg-gray-50/50" : "bg-gray-50/60 hover:bg-gray-100/60"
                        )}
                      >
                        {/* Checkbox visual */}
                        <div className={cn(
                          "h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
                          enrolled ? "border-indigo-500 bg-indigo-600" : "border-gray-300 bg-white"
                        )}>
                          {enrolled && <Check className="h-3 w-3 text-white" />}
                        </div>
                        {/* Subject info */}
                        <div className="flex-1 min-w-0">
                          <span className={cn("text-sm font-medium", enrolled ? "text-gray-800" : "text-gray-400 line-through")}>
                            {bs.subject.name}
                          </span>
                          {bs.subject.code && (
                            <span className="ml-2 font-mono text-xs text-gray-400">{bs.subject.code}</span>
                          )}
                        </div>
                        {!enrolled && (
                          <span className="text-xs text-gray-400 shrink-0">Not enrolled</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {!loadingSubjects && batchSubjects.length > 0 && form.subjectIds.length < batchSubjects.length && (
                <p className="text-xs text-amber-600 mt-2 font-medium">
                  {batchSubjects.length - form.subjectIds.length} subject{(batchSubjects.length - form.subjectIds.length) !== 1 ? "s" : ""} not enrolled
                </p>
              )}
            </div>
          )}

          {/* Selected batch preview */}
          {selectedBatch && (
            <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 p-5">
              <div className="h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-base font-bold text-indigo-900">{selectedBatch.name}</p>
                <p className="text-sm text-indigo-500 mt-0.5">
                  {selectedBatch.academicYear} · {selectedBatch._count?.students ?? 0} students enrolled
                  {form.subjectIds.length > 0 && ` · ${form.subjectIds.length} subject${form.subjectIds.length !== 1 ? "s" : ""} selected`}
                </p>
              </div>
              <CheckCircle2 className="ml-auto h-5 w-5 text-indigo-400" />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── Section: Login Info ───────────────────────────────────────────────────────

function LoginInfoSection({ form }: { form: FormState }) {
  return (
    <div className="space-y-5">
      <Card title="Student Login Credentials" icon={KeyRound}>
        <div className="space-y-4 max-w-md">
          <div>
            <Label>Login Email</Label>
            <FInput readOnly value={form.email || "—"} className="bg-gray-50/80 text-gray-500 cursor-default" />
          </div>
          <div>
            <Label>Default Password</Label>
            <FInput readOnly value="Welcome@123" className="bg-gray-50/80 font-mono text-gray-700 cursor-default tracking-wider" />
          </div>
        </div>
      </Card>

      <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
            <Check className="h-3 w-3 text-white" />
          </div>
          <p className="text-sm text-blue-800">Student will be prompted to change this password on first login.</p>
        </div>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
            <Check className="h-3 w-3 text-white" />
          </div>
          <p className="text-sm text-blue-800">The default password cannot be reused as the new password.</p>
        </div>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-5 w-5 rounded-full bg-blue-300 flex items-center justify-center shrink-0">
            <Circle className="h-3 w-3 text-white" />
          </div>
          <p className="text-sm text-blue-600">Sharing credentials via Email, SMS, or WhatsApp — coming soon.</p>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewStudentPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [section, setSection] = useState(0);
  const [form, setFormState] = useState<FormState>(INITIAL);

  const set = (k: keyof FormState, v: any) => setFormState((prev) => ({ ...prev, [k]: v }));

  const { data: schools = [] } = useQuery({ queryKey: ["schools"], queryFn: () => api.get("/api/v1/academics/schools").then((r) => r.data.data), staleTime: 5 * 60 * 1000 });
  const { data: grades  = [] } = useQuery({ queryKey: ["grades"],  queryFn: () => api.get("/api/v1/academics/grades").then((r) => r.data.data),  staleTime: 5 * 60 * 1000 });
  const { data: courses       = [] } = useQuery({ queryKey: ["courses"],        queryFn: () => api.get("/api/v1/academics/courses").then((r) => r.data.data),        staleTime: 5 * 60 * 1000 });
  const { data: academicYears = [] } = useQuery({ queryKey: ["academic-years"], queryFn: () => api.get("/api/v1/academics/academic-years").then((r) => r.data.data), staleTime: 5 * 60 * 1000 });
  const { data: batches = [] } = useQuery({ queryKey: ["batches"], queryFn: () => api.get("/api/v1/academics/batches?archived=false").then((r) => r.data.data), staleTime: 5 * 60 * 1000 });

  const buildPayload = () => {
    let dateOfBirth: string | undefined;
    if (form.dob.length === 10) {
      const [dd, mm, yyyy] = form.dob.split("/");
      if (dd && mm && yyyy) dateOfBirth = `${yyyy}-${mm}-${dd}`;
    }
    const totalFeeNum = parseFloat(form.totalFee || "0");
    const discountAmount = form.discountValue
      ? form.discountType === "PERCENTAGE"
        ? totalFeeNum * (parseFloat(form.discountValue) / 100)
        : parseFloat(form.discountValue)
      : undefined;

    return {
      firstName: form.firstName, lastName: form.lastName, middleName: form.middleName || undefined,
      email: form.email, phone: form.phone || undefined, gender: form.gender || undefined, dateOfBirth,
      address: { address: form.address, area: form.area, landmark: form.landmark, city: form.city, state: form.state, pincode: form.pincode, country: "India" },
      nationality: form.nationality || undefined, rollNumber: form.rollNumber || undefined,
      schoolId: form.schoolId || undefined, gradeId: form.gradeId || undefined, courseId: form.courseId || undefined,
      parentName: form.parentName || undefined, parentPhone: form.parentPhone || undefined, parentEmail: form.parentEmail || undefined,
      parentRelation: form.parentRelation || undefined, parentOccupation: form.parentOccupation || undefined,
      motherName: form.motherName || undefined, motherPhone: form.motherPhone || undefined,
      motherEmail: form.motherEmail || undefined, motherOccupation: form.motherOccupation || undefined,
      communicationContact: form.communicationContact || undefined,
      communicationContactName: form.communicationContactName || undefined,
      communicationContactPhone: form.communicationContactPhone || undefined,
      admissionDate: form.admissionDate || undefined, academicYear: form.academicYear || undefined,
      totalFee: form.totalFee ? totalFeeNum : undefined,
      discountType: form.discountValue ? form.discountType : undefined,
      discountAmount,
      paidFee: form.paidFee ? parseFloat(form.paidFee) : undefined,
      paymentDate: form.paymentDate || undefined,
      paymentMode: form.paymentMode || undefined,
      receiptNumber: form.receiptNumber || undefined,
      paymentNote: form.paymentNote || undefined,
      batchId: form.batchId || undefined,
      instalments: form.instalments
        .filter((i) => i.amount && i.dueDate)
        .map((i) => ({
          instalmentNo: i.instalmentNo,
          label:        i.label || undefined,
          amount:       parseFloat(i.amount),
          dueDate:      i.dueDate,
        })),
    };
  };

  const saveMut = useMutation({
    mutationFn: async (redirect: boolean) => {
      const res = await api.post("/api/v1/academics/students", buildPayload());
      const studentId = res.data.data.id;
      if (form.photoFile) {
        const fd = new FormData();
        fd.append("file", form.photoFile);
        await api.patch(`/api/v1/academics/students/${studentId}/photo`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      }
      return { student: res.data.data, defaultPassword: res.data.defaultPassword, redirect };
    },
    onSuccess: ({ student, defaultPassword, redirect }) => {
      toast.success(`${student.firstName} ${student.lastName} — ${student.studentCode} | Password: ${defaultPassword}`, { duration: 8000 });
      if (redirect) router.push("/dashboard/academics/students");
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to save student"),
  });

  const hasContact = hasContactFn(form);
  const canSubmit  = !!form.firstName && !!form.lastName && !!form.email && !!hasContact;
  const canDraft   = !!form.firstName && !!form.lastName && !!form.email;
  const completedCount = SECTIONS.filter((s) => isComplete(s.id, form)).length;

  // Initials for nav avatar
  const initials = ((form.firstName[0] ?? "") + (form.lastName[0] ?? "")).toUpperCase() || "ST";

  return (
    <div className="flex flex-col h-full" style={{ background: "#F4F6F9" }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard/academics/students")}
            className="h-9 w-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-xs text-gray-400 font-medium">Students / New</p>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">New Student</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 mr-2">
            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
              <span className="text-xs font-bold text-indigo-600">
                {user ? `${user.firstName[0]}${user.lastName[0]}` : "—"}
              </span>
            </div>
            <span className="text-sm text-gray-500">{user ? `${user.firstName} ${user.lastName}` : "—"}</span>
          </div>
          <button
            onClick={() => saveMut.mutate(false)}
            disabled={!canDraft || saveMut.isPending}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 transition-all shadow-sm"
          >
            Save Draft
          </button>
          <button
            onClick={() => saveMut.mutate(true)}
            disabled={!canSubmit || saveMut.isPending}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm shadow-indigo-200"
          >
            <Check className="h-4 w-4" />
            {saveMut.isPending ? "Saving…" : "Save Student"}
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left nav */}
        <aside className="w-60 shrink-0 bg-white border-r border-gray-100 flex flex-col">

          {/* Student preview */}
          <div className="px-5 py-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                {form.photoUrl
                  ? <img src={form.photoUrl} alt="" className="h-full w-full object-cover" />
                  : <span className="text-sm font-bold text-white">{initials}</span>
                }
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {[form.firstName, form.lastName].filter(Boolean).join(" ") || "New Student"}
                </p>
                <p className="text-xs text-gray-400 truncate">{form.email || "No email yet"}</p>
              </div>
            </div>
          </div>

          {/* Section nav */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {SECTIONS.map(({ id, label, icon: Icon, num }, i) => {
              const active    = section === i;
              const completed = isComplete(id, form);
              return (
                <button key={id} onClick={() => setSection(i)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all duration-150",
                    active
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                  )}
                >
                  <Icon className={cn("h-4.5 w-4.5 shrink-0", active ? "text-white" : "text-gray-400")} />
                  <span className="flex-1 text-sm font-medium">{label}</span>
                  {!active && completed && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                  {!active && !completed && <div className="h-4 w-4 rounded-full border-2 border-gray-200 flex items-center justify-center shrink-0"><span className="text-[9px] font-bold text-gray-400">{num}</span></div>}
                </button>
              );
            })}
          </nav>

          {/* Progress */}
          <div className="px-5 py-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-400">Profile complete</span>
              <span className="text-xs font-bold text-gray-600">{Math.round((completedCount / SECTIONS.length) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${(completedCount / SECTIONS.length) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-2">{completedCount} of {SECTIONS.length} sections done</p>
          </div>
        </aside>

        {/* Form content */}
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-3xl mx-auto">
            {section === 0 && <PersonalSection  form={form} set={set} schools={schools} grades={grades} />}
            {section === 1 && <ParentsSection   form={form} set={set} />}
            {section === 2 && <AdmissionSection form={form} set={set} courses={courses} academicYears={academicYears} />}
            {section === 3 && <BatchSection     form={form} set={set} batches={batches} />}
            {section === 4 && <LoginInfoSection form={form} />}
          </div>
        </main>
      </div>

      {/* ── Bottom nav ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-t border-gray-100 px-8 py-3 flex items-center justify-between">
        <span className="text-sm text-gray-400">
          Step <span className="font-semibold text-gray-600">{section + 1}</span> of {SECTIONS.length}
          <span className="mx-2 text-gray-200">·</span>
          <span className="font-semibold text-gray-600">{SECTIONS[section].label}</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSection((s) => Math.max(0, s - 1))}
            disabled={section === 0}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-all"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <button
            onClick={() => saveMut.mutate(false)}
            disabled={!canDraft || saveMut.isPending}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-all"
          >
            Save Draft
          </button>
          {section < SECTIONS.length - 1 ? (
            <button onClick={() => setSection((s) => s + 1)}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200"
            >
              Next: {SECTIONS[section + 1].label} <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => saveMut.mutate(true)}
              disabled={!canSubmit || saveMut.isPending}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm shadow-indigo-200"
            >
              <Check className="h-4 w-4" />
              {saveMut.isPending ? "Saving…" : "Save Student"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
