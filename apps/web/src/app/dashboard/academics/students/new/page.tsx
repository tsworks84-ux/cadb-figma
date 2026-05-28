"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowLeft, Check, User, Users2, ClipboardList,
  GraduationCap, KeyRound, ChevronRight, ChevronLeft,
  Camera, X,
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
function Card({ children, title, mark }: {
  children: React.ReactNode;
  title?: string;
  mark?: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden mb-5">
      {title && (
        <div className="flex items-center gap-3 px-[22px] py-[18px] border-b bg-[#fbfcfe]" style={{ borderColor: "#f0f2f5" }}>
          {mark && (
            <div className="w-7 h-7 rounded-[9px] flex items-center justify-center shrink-0 text-[11px] font-black"
              style={{ background: "#eef2ff", color: "#28245f" }}>
              {mark}
            </div>
          )}
          <h3 className="text-[18px] font-black text-gray-800 m-0">{title}</h3>
        </div>
      )}
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function FieldWarn({ msg }: { msg: string }) {
  return <p className="mt-1.5 text-xs text-amber-600 font-medium">{msg}</p>;
}

const OCCUPATION_OPTIONS = ["Service", "Self-Employed", "Business-Owner", "Professional", "Retired", "Other", "NA"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TODAY = new Date().toISOString().split("T")[0];

function DOBInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <>
      <FInput type="date" value={value} max={TODAY} onChange={(e) => onChange(e.target.value)} />
      {value && value > TODAY && <FieldWarn msg="Date of birth cannot be in the future" />}
    </>
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
  courseId: string; programmeType: string;
  admissionDate: string; academicYear: string;
  totalFee: string; discountType: "percent" | "amount"; discountValue: string;
  paidFee: string; paymentDate: string; paymentMode: string; receiptNumber: string; paymentNote: string;
  instalmentPlan: string; customInstalmentCount: string; firstDueDate: string;
  customItems: { dueDate: string; amount: string }[];
  batchId: string;
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
  courseId: "", programmeType: "",
  admissionDate: "", academicYear: "",
  totalFee: "", discountType: "amount", discountValue: "",
  paidFee: "", paymentDate: "", paymentMode: "", receiptNumber: "", paymentNote: "",
  instalmentPlan: "NONE", customInstalmentCount: "3", firstDueDate: "",
  customItems: [{ dueDate: "", amount: "" }, { dueDate: "", amount: "" }, { dueDate: "", amount: "" }],
  batchId: "",
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
      <Card title="Profile" mark="P">
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
      <Card title="Contact & Demographics" mark="CD">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Email */}
          <div>
            <Label required>Email</Label>
            <FInput type="email" placeholder="student@email.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
            {form.email && !EMAIL_RE.test(form.email) && <FieldWarn msg="Enter a valid email address" />}
          </div>

          {/* Mobile — country code + number, full half-width */}
          <div>
            <Label>Mobile</Label>
            <div className="flex gap-2">
              <FSelect className="w-[80px] shrink-0 px-2"><option>+91</option></FSelect>
              <FInput placeholder="10-digit mobile" value={form.phone} inputMode="numeric"
                onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} className="flex-1 min-w-0" />
            </div>
            {form.phone && form.phone.length !== 10 && <FieldWarn msg="Mobile number must be 10 digits" />}
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
                      ? "bg-[#f1efff] border-[#8b5cf6] text-[#28245f]"
                      : "bg-white border-gray-200 text-gray-500 hover:border-violet-200 hover:text-[#28245f]"
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
      <Card title="Address" mark="A">
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><Label>Street / Flat / Building</Label><FInput placeholder="Address line" value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
            <div><Label>Area / Locality</Label><FInput placeholder="Area" value={form.area} onChange={(e) => set("area", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div><Label>Landmark</Label><FInput placeholder="Landmark" value={form.landmark} onChange={(e) => set("landmark", e.target.value)} /></div>
            <div><Label>City</Label><FInput placeholder="City" value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
            <div><Label>State</Label><FInput placeholder="State" value={form.state} onChange={(e) => set("state", e.target.value)} /></div>
            <div>
              <Label>PIN Code</Label>
              <FInput placeholder="560001" value={form.pincode} inputMode="numeric"
                onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} />
              {form.pincode && form.pincode.length !== 6 && <FieldWarn msg="PIN code must be exactly 6 digits" />}
            </div>
          </div>
        </div>
      </Card>

      {/* Academic context card */}
      <Card title="Academic Context" mark="AC">
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
    <div>
      <div className="flex gap-2">
        <FSelect className="w-[90px] shrink-0 px-2"><option>+91</option></FSelect>
        <FInput placeholder="10-digit number" value={value} inputMode="numeric"
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))} />
      </div>
      {value && value.length !== 10 && <FieldWarn msg="Must be exactly 10 digits" />}
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
      <Card title="Father / Parent / Guardian" mark="FG">
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
            <div>
              <Label>Occupation</Label>
              <FSelect value={form.parentOccupation} onChange={(e) => set("parentOccupation", e.target.value)}>
                <option value="">Select occupation</option>
                {OCCUPATION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </FSelect>
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <FInput type="email" placeholder="Email address" value={form.parentEmail} onChange={(e) => set("parentEmail", e.target.value)} />
            {form.parentEmail && !EMAIL_RE.test(form.parentEmail) && <FieldWarn msg="Enter a valid email address" />}
          </div>
        </div>
      </Card>

      <Card title="Mother's Information" mark="M">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><Label>Full Name</Label><FInput placeholder="Full name" value={form.motherName} onChange={(e) => set("motherName", e.target.value)} /></div>
            <div>
              <Label>Occupation</Label>
              <FSelect value={form.motherOccupation} onChange={(e) => set("motherOccupation", e.target.value)}>
                <option value="">Select occupation</option>
                {OCCUPATION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </FSelect>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><Label>Mobile</Label><PhoneField value={form.motherPhone} onChange={(v) => set("motherPhone", v)} /></div>
            <div>
              <Label>Email</Label>
              <FInput type="email" placeholder="Email address" value={form.motherEmail} onChange={(e) => set("motherEmail", e.target.value)} />
              {form.motherEmail && !EMAIL_RE.test(form.motherEmail) && <FieldWarn msg="Enter a valid email address" />}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Communication Preference" mark="CP">
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
                    ? "border-[#8b5cf6] bg-[#f1efff]"
                    : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                <div className={cn(
                  "mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                  form.communicationContact === value ? "border-[#6d5dfc]" : "border-gray-300"
                )}>
                  {form.communicationContact === value && (
                    <div className="h-2 w-2 rounded-full" style={{ background: "#6d5dfc" }} />
                  )}
                </div>
                <div>
                  <p className={cn("text-sm font-semibold", form.communicationContact === value ? "text-[#28245f]" : "text-gray-700")}>{label}</p>
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "white", border: "1px solid #e6e8ef", borderRadius: 16, padding: 18, boxShadow: "0 8px 22px rgba(20,23,53,.05)" }}>
      <span style={{ color: "#7c8598", fontSize: 12, fontWeight: 850, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{label}</span>
      <strong style={{ display: "block", marginTop: 8, fontSize: 22, lineHeight: 1, color: "#111827" }}>{value}</strong>
    </div>
  );
}

// ── Section: Admission ────────────────────────────────────────────────────────

function AdmissionSection({ form, set, courses, academicYears, instalmentPlans }: {
  form: FormState;
  set: (k: keyof FormState, v: any) => void;
  courses: any[];
  academicYears: any[];
  instalmentPlans: any[];
}) {
  const totalFeeNum = parseFloat(form.totalFee || "0");
  const discountNum = parseFloat(form.discountValue || "0");
  const netFee      = Math.max(0, form.discountType === "percent"
    ? totalFeeNum - (totalFeeNum * discountNum / 100)
    : totalFeeNum - discountNum);
  const paidNum     = parseFloat(form.paidFee || "0");
  const pendingNum  = Math.max(0, netFee - paidNum);
  const selectedPlan = form.instalmentPlan !== "NONE" && form.instalmentPlan !== "CUSTOM"
    ? (instalmentPlans as any[]).find(p => p.id === form.instalmentPlan)
    : null;

  const handleCourseChange = (id: string) => {
    set("courseId", id);
    const c = courses.find((x: any) => x.id === id);
    if (c?.fee && !form.totalFee) set("totalFee", String(c.fee));
  };

  return (
    <div className="space-y-5">

      {/* Course / Programme */}
      <Card title="Course / Programme" mark="CP">
        <div className="grid grid-cols-2 gap-[14px]">
          <div>
            <Label required>Course</Label>
            <FSelect value={form.courseId} onChange={(e) => handleCourseChange(e.target.value)}>
              <option value="">Select a course</option>
              {courses.filter((c: any) => c.isActive).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </FSelect>
          </div>
          <div>
            <Label>Programme Type</Label>
            <FSelect value={form.programmeType} onChange={(e) => set("programmeType", e.target.value)}>
              <option value="">Select type</option>
              <option>Regular Classroom</option>
              <option>Hybrid</option>
              <option>Test Series</option>
            </FSelect>
          </div>
        </div>
      </Card>

      {/* Admission Details */}
      <Card title="Admission Details" mark="AD">
        <div className="grid grid-cols-3 gap-[14px]">
          <div>
            <Label>Admission Number</Label>
            <FInput readOnly placeholder="Auto-generated on save" value="" className="bg-gray-50 text-gray-400 cursor-default font-mono" />
          </div>
          <div>
            <Label>Admission Date</Label>
            <FInput type="date" max="2099-12-31" min="1900-01-01" value={form.admissionDate} onChange={(e) => set("admissionDate", e.target.value)} />
          </div>
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

      {/* Fee & Payment */}
      <Card title="Fee & Payment" mark="₹">
        <div className="space-y-[14px]">
          <div className="grid grid-cols-3 gap-[14px]">
            <div>
              <Label>Total Fee</Label>
              <FInput type="number" min="0" placeholder="0.00" value={form.totalFee} onChange={(e) => set("totalFee", e.target.value)} />
            </div>
            <div>
              <Label>Discount</Label>
              <div className="flex gap-2">
                <div className="flex shrink-0 rounded-xl overflow-hidden border border-gray-200">
                  <button type="button" onClick={() => set("discountType", "percent")}
                    className={cn("px-3 py-1 text-sm font-bold transition-colors", form.discountType === "percent" ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50")}>%</button>
                  <button type="button" onClick={() => set("discountType", "amount")}
                    className={cn("px-3 py-1 text-sm font-bold border-l border-gray-200 transition-colors", form.discountType === "amount" ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50")}>₹</button>
                </div>
                <FInput type="number" min="0" placeholder={form.discountType === "percent" ? "e.g. 10" : "0.00"}
                  value={form.discountValue} onChange={(e) => set("discountValue", e.target.value)} className="flex-1" />
              </div>
            </div>
            <div>
              <Label>Net Payable</Label>
              <FInput readOnly placeholder="Auto calculated" value={totalFeeNum > 0 ? netFee.toFixed(2) : ""} className="bg-gray-50 text-gray-700 cursor-default font-semibold" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-[14px]">
            <div>
              <Label>Amount Paid</Label>
              <FInput type="number" min="0" placeholder="0.00" value={form.paidFee} onChange={(e) => set("paidFee", e.target.value)} />
            </div>
            <div>
              <Label>Payment Date</Label>
              <FInput type="date" max="2099-12-31" min="1900-01-01" value={form.paymentDate} onChange={(e) => set("paymentDate", e.target.value)} />
            </div>
            <div>
              <Label>Mode of Payment</Label>
              <FSelect value={form.paymentMode} onChange={(e) => set("paymentMode", e.target.value)}>
                <option value="">Select mode</option>
                {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
              </FSelect>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-[14px]">
            <div>
              <Label>Receipt Number</Label>
              <FInput placeholder="Receipt / ref no." value={form.receiptNumber} onChange={(e) => set("receiptNumber", e.target.value)} />
            </div>
            <div>
              <Label>Note</Label>
              <FInput placeholder="Payment or admission note" value={form.paymentNote} onChange={(e) => set("paymentNote", e.target.value)} />
            </div>
          </div>
        </div>
      </Card>

      {/* Instalment Plan */}
      <Card title="Instalment Plan" mark="IP">
        <div className="space-y-[14px]">
          <div className="grid grid-cols-2 gap-[14px]">
            <div>
              <Label>Plan</Label>
              <FSelect value={form.instalmentPlan} onChange={(e) => set("instalmentPlan", e.target.value)}>
                <option value="NONE">No instalment plan</option>
                {(instalmentPlans as any[]).filter((p: any) => p.isActive).map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.course ? ` — ${p.course.name}` : ""} ({p.items?.length ?? 0} instalments)
                  </option>
                ))}
                <option value="CUSTOM">Custom plan</option>
              </FSelect>
            </div>
            <div>
              <Label>Pending Amount</Label>
              <FInput readOnly placeholder="Auto calculated" value={pendingNum > 0 ? pendingNum.toFixed(2) : ""}
                className="bg-gray-50 text-gray-700 cursor-default font-semibold" />
            </div>
          </div>

          {/* Settings plan preview */}
          {selectedPlan?.items?.length > 0 && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">Plan Schedule</p>
              <div className="space-y-2">
                {selectedPlan.items.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-4 text-sm">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-black shrink-0">{item.instalmentNo}</span>
                    <span className="flex-1 font-medium text-gray-700">{item.label ?? `Instalment ${item.instalmentNo}`}</span>
                    <span className="font-bold text-gray-900">₹{Number(item.amount).toLocaleString()}</span>
                    <span className="text-gray-400 text-xs text-right">
                      {item.dueDate
                        ? new Date(item.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                        : item.daysFromAdmission != null ? `${item.daysFromAdmission} days from admission` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom plan per-row editor */}
          {form.instalmentPlan === "CUSTOM" && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-48">
                  <Label>Number of Instalments</Label>
                  <FSelect value={form.customInstalmentCount} onChange={(e) => {
                    const n = parseInt(e.target.value) || 3;
                    set("customInstalmentCount", e.target.value);
                    set("customItems", Array.from({ length: n }, (_, i) => form.customItems[i] ?? { dueDate: "", amount: "" }));
                  }}>
                    {["2","3","4","6","12"].map(n => <option key={n} value={n}>{n} instalments</option>)}
                  </FSelect>
                </div>
              </div>

              <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 space-y-3">
                <div className="grid grid-cols-[28px_1fr_1fr] gap-3 mb-1">
                  <div />
                  <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Due Date</p>
                  <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Amount (₹)</p>
                </div>
                {form.customItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[28px_1fr_1fr] gap-3 items-center">
                    <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-black shrink-0">
                      {idx + 1}
                    </span>
                    <FInput type="date" max="2099-12-31" min="1900-01-01" value={item.dueDate} onChange={(e) => {
                      const updated = [...form.customItems];
                      updated[idx] = { ...updated[idx], dueDate: e.target.value };
                      set("customItems", updated);
                    }} />
                    <FInput type="number" min="0" placeholder="0.00" value={item.amount} onChange={(e) => {
                      const updated = [...form.customItems];
                      updated[idx] = { ...updated[idx], amount: e.target.value };
                      set("customItems", updated);
                    }} />
                  </div>
                ))}

                {(() => {
                  const customTotal = form.customItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
                  const anyAmounts  = form.customItems.some(i => i.amount !== "");
                  if (anyAmounts && pendingNum > 0 && Math.abs(customTotal - pendingNum) > 0.5) {
                    return (
                      <p className="text-xs text-amber-600 font-medium pt-1">
                        Instalments total ₹{customTotal.toLocaleString()} — pending fee is ₹{pendingNum.toFixed(2)}. Amounts don&apos;t match.
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          )}
        </div>
      </Card>

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
  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: () => api.get("/api/v1/academics/locations").then((r) => r.data.data),
    staleTime: 10 * 60 * 1000,
  });
  const activeYears = (academicYears as any[]).filter((y: any) => !y.isArchived);

  const [filterYear, setFilterYear] = useState("");
  const [filterCity, setFilterCity] = useState("");

  useEffect(() => {
    if (activeYears.length > 0 && !filterYear) setFilterYear(activeYears[0].name);
  }, [activeYears.length]);

  const filteredBatches = activeBatches.filter((b: any) => {
    if (filterYear && b.academicYear !== filterYear) return false;
    if (filterCity && b.location?.id !== filterCity) return false;
    return true;
  });

  const selectedBatch = activeBatches.find((b: any) => b.id === form.batchId);

  return (
    <div className="space-y-5">

      {/* Batch Assignment */}
      <Card title="Batch Assignment" mark="BA">
        <div className="space-y-[14px]">
          <div className="grid grid-cols-2 gap-[14px]">
            <div>
              <Label>Academic Year</Label>
              <FSelect value={filterYear} onChange={(e) => { setFilterYear(e.target.value); set("batchId", ""); }}>
                <option value="">All years</option>
                {activeYears.map((y: any) => (
                  <option key={y.id} value={y.name}>{y.name}</option>
                ))}
              </FSelect>
            </div>
            <div>
              <Label>City</Label>
              <FSelect value={filterCity} onChange={(e) => { setFilterCity(e.target.value); set("batchId", ""); }}>
                <option value="">All cities</option>
                {(locations as any[]).filter((l: any) => l.isActive).map((l: any) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </FSelect>
            </div>
          </div>
          <div>
            <Label>Select Batch</Label>
            <FSelect value={form.batchId} onChange={(e) => set("batchId", e.target.value)}>
              <option value="">Select a batch</option>
              {filteredBatches.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </FSelect>
          </div>
        </div>
      </Card>

      {/* Batch Preview */}
      {selectedBatch && (
        <Card title="Batch Preview" mark="PV">
          <div className="grid grid-cols-4 gap-[14px]">
            <StatCard label="Strength" value={String(selectedBatch._count?.students ?? 0)} />
            <StatCard label="Schedule" value={selectedBatch.academicYear ?? "—"} />
            <StatCard label="Start Date" value={selectedBatch.startDate ? new Date(selectedBatch.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"} />
            <StatCard label="Subjects" value={String(selectedBatch._count?.batchSubjects ?? "—")} />
          </div>
        </Card>
      )}

    </div>
  );
}

// ── Section: Login Info ───────────────────────────────────────────────────────

const CHOICE_OPTIONS = [
  { label: "Force password change" },
  { label: "Prevent password reuse" },
  { label: "Email credentials" },
  { label: "SMS / WhatsApp later" },
] as const;

function LoginInfoSection({ form }: { form: FormState }) {
  const [active, setActive] = useState<Record<string, boolean>>({
    "Force password change":  true,
    "Prevent password reuse": true,
    "Email credentials":      false,
    "SMS / WhatsApp later":   false,
  });

  const toggle = (label: string) => setActive((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <div className="space-y-5">

      {/* Login Credentials */}
      <Card title="Student Login Credentials" mark="LC">
        <div>
          <div className="grid grid-cols-2 gap-[14px]">
            <div>
              <Label>Login Email</Label>
              <FInput readOnly placeholder="Auto from student email" value={form.email || ""}
                className="bg-gray-50 text-gray-500 cursor-default" />
            </div>
            <div>
              <Label>Default Password</Label>
              <FInput readOnly value="Welcome@123"
                className="bg-gray-50 font-mono text-gray-700 cursor-default tracking-wider" />
            </div>
          </div>

          {/* 4 choice cards */}
          <div className="grid grid-cols-4 gap-[10px] mt-4">
            {CHOICE_OPTIONS.map(({ label }) => {
              const on = active[label];
              return (
                <button key={label} type="button" onClick={() => toggle(label)}
                  style={{
                    minHeight: 54,
                    border: `1px solid ${on ? "#8b5cf6" : "#e6e8ef"}`,
                    background: on ? "#f1efff" : "white",
                    borderRadius: 14,
                    padding: "10px 13px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    color: on ? "#28245f" : "#4b5563",
                    fontWeight: 850,
                    fontSize: 13,
                    cursor: "pointer",
                    textAlign: "left" as const,
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                    border: on ? "5px solid #6d5dfc" : "2px solid #a8b0bf",
                    background: on ? "white" : "transparent",
                  }} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Final Review */}
      <Card title="Final Review" mark="✓">
        <div className="grid grid-cols-4 gap-[14px]">
          <StatCard label="Profile"   value={isComplete("personal",  form) ? "Ready"    : "Incomplete"} />
          <StatCard label="Parents"   value={isComplete("parents",   form) ? "Added"    : "Incomplete"} />
          <StatCard label="Admission" value={isComplete("admission", form) ? "Ready"    : "Draft"}      />
          <StatCard label="Batch"     value={isComplete("batch",     form) ? "Assigned" : "Optional"}   />
        </div>
      </Card>

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
  const { data: instalmentPlans = [] } = useQuery({ queryKey: ["instalment-plans"], queryFn: () => api.get("/api/v1/academics/instalment-plans").then((r) => r.data.data), staleTime: 5 * 60 * 1000 });

  const buildPayload = () => {
    const dateOfBirth = form.dob && form.dob.length === 10 ? form.dob : undefined;
    const totalFeeNum   = parseFloat(form.totalFee    || "0");
    const discountNum   = parseFloat(form.discountValue || "0");
    const discountAmount = discountNum > 0
      ? (form.discountType === "percent" ? (totalFeeNum * discountNum / 100) : discountNum)
      : undefined;
    const netFee        = Math.max(0, totalFeeNum - (discountAmount ?? 0));
    const paidNum       = parseFloat(form.paidFee || "0");
    const pendingNum    = Math.max(0, netFee - paidNum);

    // Instalments — from Settings plan or custom
    let instalments: { instalmentNo: number; label?: string; amount: number; dueDate?: string; daysFromAdmission?: number }[] = [];
    if (form.instalmentPlan !== "NONE") {
      if (form.instalmentPlan === "CUSTOM") {
        instalments = form.customItems
          .filter(item => item.dueDate && item.amount)
          .map((item, i) => ({
            instalmentNo: i + 1,
            label: `Instalment ${i + 1}`,
            amount: parseFloat(item.amount),
            dueDate: item.dueDate,
          }));
      } else {
        const plan = (instalmentPlans as any[]).find(p => p.id === form.instalmentPlan);
        if (plan?.items?.length) {
          instalments = plan.items.map((item: any) => ({
            instalmentNo: item.instalmentNo,
            label: item.label ?? undefined,
            amount: Number(item.amount),
            dueDate: item.dueDate ? new Date(item.dueDate).toISOString().split("T")[0] : undefined,
            daysFromAdmission: item.daysFromAdmission ?? undefined,
          }));
        }
      }
    }

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
      totalFee: totalFeeNum > 0 ? totalFeeNum : undefined,
      discountType: discountAmount ? "AMOUNT" as const : undefined,
      discountAmount: discountAmount ? Math.round(discountAmount * 100) / 100 : undefined,
      paidFee: form.paidFee ? parseFloat(form.paidFee) : undefined,
      paymentDate: form.paymentDate || undefined,
      paymentMode: form.paymentMode || undefined,
      receiptNumber: form.receiptNumber || undefined,
      paymentNote: form.paymentNote || undefined,
      batchId: form.batchId || undefined,
      instalments: instalments.length > 0 ? instalments : undefined,
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

  // Validate phone/email fields before save; clear invalid ones if user declines to proceed
  const validateAndSave = (redirect: boolean) => {
    let f = { ...form };
    const warnings: { field: keyof FormState; msg: string }[] = [];
    if (f.phone       && f.phone.length !== 10)          warnings.push({ field: "phone",       msg: `Student mobile "${f.phone}" is not 10 digits.` });
    if (f.email       && !EMAIL_RE.test(f.email))        warnings.push({ field: "email",       msg: `Student email "${f.email}" looks invalid.` });
    if (f.parentPhone && f.parentPhone.length !== 10)    warnings.push({ field: "parentPhone", msg: `Father mobile "${f.parentPhone}" is not 10 digits.` });
    if (f.parentEmail && !EMAIL_RE.test(f.parentEmail))  warnings.push({ field: "parentEmail", msg: `Father email "${f.parentEmail}" looks invalid.` });
    if (f.motherPhone && f.motherPhone.length !== 10)    warnings.push({ field: "motherPhone", msg: `Mother mobile "${f.motherPhone}" is not 10 digits.` });
    if (f.motherEmail && !EMAIL_RE.test(f.motherEmail))  warnings.push({ field: "motherEmail", msg: `Mother email "${f.motherEmail}" looks invalid.` });

    for (const w of warnings) {
      const proceed = window.confirm(`⚠ ${w.msg}\n\nSave anyway? (Click Cancel to clear that field first)`);
      if (!proceed) {
        setFormState((prev) => ({ ...prev, [w.field]: "" }));
        return; // stop — let user fix it
      }
    }
    saveMut.mutate(redirect);
  };

  // Initials for nav avatar
  const initials = ((form.firstName[0] ?? "") + (form.lastName[0] ?? "")).toUpperCase() || "ST";

  return (
    <div className="flex flex-col h-full" style={{ background: "#f4f6fa" }}>

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
            <p className="text-[13px] font-extrabold text-gray-400">Students / New</p>
            <h1 className="text-[28px] font-black text-gray-900 leading-tight">New Student</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 mr-2">
            <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "#eef2ff" }}>
              <span className="text-xs font-bold" style={{ color: "#28245f" }}>
                {user ? `${user.firstName[0]}${user.lastName[0]}` : "—"}
              </span>
            </div>
            <span className="text-sm text-gray-500">{user ? `${user.firstName} ${user.lastName}` : "—"}</span>
          </div>
          <button
            onClick={() => validateAndSave(false)}
            disabled={!canDraft || saveMut.isPending}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 transition-all shadow-sm"
          >
            Save Draft
          </button>
          <button
            onClick={() => validateAndSave(true)}
            disabled={!canSubmit || saveMut.isPending}
            className="flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-extrabold text-white disabled:opacity-50 transition-all" style={{ background: "linear-gradient(135deg, #28245f, #4f46e5)", boxShadow: "0 12px 24px rgba(79,70,229,.25)" }}
          >
            <Check className="h-4 w-4" />
            {saveMut.isPending ? "Saving…" : "Save Student"}
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left nav */}
        <aside className="hidden md:flex flex-col w-[292px] shrink-0 bg-white border-r border-gray-100">

          {/* Student preview */}
          <div className="flex items-center gap-[13px] px-[22px] py-[22px] border-b border-gray-100">
            <div
              className="flex items-center justify-center shrink-0 overflow-hidden"
              style={{ width: 58, height: 58, borderRadius: 18, background: "linear-gradient(135deg, #28245f, #7c3aed)" }}
            >
              {form.photoUrl
                ? <img src={form.photoUrl} alt="" className="h-full w-full object-cover" />
                : <span className="text-base font-bold text-white">{initials}</span>
              }
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-bold text-gray-800 truncate leading-tight">
                {[form.firstName, form.lastName].filter(Boolean).join(" ") || "New Student"}
              </p>
              <p className="text-xs text-gray-400 truncate mt-0.5">{form.email || "No email yet"}</p>
            </div>
          </div>

          {/* Section nav */}
          <nav className="flex-1 px-[14px] py-[18px]" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {SECTIONS.map(({ id, label, num }, i) => {
              const active  = section === i;
              const done    = isComplete(id, form);
              return (
                <button key={id} onClick={() => setSection(i)}
                  className="w-full text-left transition-all duration-150"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "32px minmax(0,1fr) auto",
                    alignItems: "center",
                    gap: "10px",
                    minHeight: "52px",
                    borderRadius: "14px",
                    padding: "8px 12px",
                    fontWeight: 850,
                    color: active ? "white" : "#6b7280",
                    background: active ? "linear-gradient(135deg, #28245f, #4f46e5)" : "transparent",
                    boxShadow: active ? "0 12px 24px rgba(79,70,229,.22)" : "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {/* Step indicator: checkmark when done, number otherwise */}
                  <div style={{
                    width: 28, height: 28, borderRadius: 9,
                    display: "grid", placeItems: "center",
                    fontSize: done ? 15 : 12, fontWeight: 900,
                    background: active ? "white" : done ? "#dcfce7" : "#f1f5f9",
                    color: active ? "#28245f" : done ? "#16a34a" : "#94a3b8",
                  }}>{done && !active ? "✓" : num}</div>
                  <span style={{ fontSize: 14 }}>{label}</span>
                  {done && !active && (
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#16a34a", background: "#dcfce7", borderRadius: 999, padding: "1px 7px" }}>Done</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Progress */}
          <div className="mt-auto px-[22px] py-[18px] border-t border-gray-100">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[13px] font-extrabold text-gray-400">Profile complete</span>
              <span className="text-[13px] font-bold text-gray-600">{Math.round((completedCount / SECTIONS.length) * 100)}%</span>
            </div>
            <div className="w-full rounded-full overflow-hidden" style={{ height: 8, background: "#eef2f7" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(completedCount / SECTIONS.length) * 100}%`,
                  background: "linear-gradient(90deg, #ff914d, #a8d879)",
                }}
              />
            </div>
            <p className="text-[12px] text-gray-400 mt-2.5">{completedCount} of {SECTIONS.length} sections done</p>
          </div>
        </aside>

        {/* Form content */}
        <main className="flex-1 overflow-y-auto px-8 py-7 pb-[108px]">
          <div className="max-w-[1120px] mx-auto">
            {section === 0 && <PersonalSection  form={form} set={set} schools={schools} grades={grades} />}
            {section === 1 && <ParentsSection   form={form} set={set} />}
            {section === 2 && <AdmissionSection form={form} set={set} courses={courses} academicYears={academicYears} instalmentPlans={instalmentPlans} />}
            {section === 3 && <BatchSection     form={form} set={set} batches={batches} />}
            {section === 4 && <LoginInfoSection form={form} />}
          </div>
        </main>
      </div>

      {/* ── Bottom nav ──────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center justify-between gap-4 border-t px-7"
        style={{
          minHeight: 78,
          background: "rgba(255,255,255,.92)",
          backdropFilter: "blur(12px)",
          borderColor: "#e6e8ef",
        }}
      >
        <span className="text-sm font-extrabold text-gray-400">
          Step <strong className="text-gray-700">{section + 1}</strong> of {SECTIONS.length}
          <span className="mx-2 text-gray-300">·</span>
          <strong className="text-gray-700">{SECTIONS[section].label}</strong>
        </span>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSection((s) => Math.max(0, s - 1))}
            disabled={section === 0}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-extrabold text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-all"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <button
            onClick={() => validateAndSave(false)}
            disabled={!canDraft || saveMut.isPending}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-extrabold text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-all"
          >
            Save Draft
          </button>
          {section < SECTIONS.length - 1 ? (
            <button
              onClick={() => setSection((s) => s + 1)}
              className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-extrabold text-white transition-all"
              style={{ background: "linear-gradient(135deg, #28245f, #4f46e5)", boxShadow: "0 12px 24px rgba(79,70,229,.25)" }}
            >
              Next: {SECTIONS[section + 1].label} <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => validateAndSave(true)}
              disabled={!canSubmit || saveMut.isPending}
              className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50 transition-all"
              style={{ background: "linear-gradient(135deg, #28245f, #4f46e5)", boxShadow: "0 12px 24px rgba(79,70,229,.25)" }}
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
