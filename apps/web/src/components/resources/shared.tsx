"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronDown, FileArchive, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo,
  Folder, Globe, Link2, Lock, Presentation, Search, Users, X, File as FileIcon, Youtube,
} from "lucide-react";
import { api } from "@/lib/api";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const BRAND = "#2C3E7C";

export type Visibility = "PRIVATE" | "ALL_STAFF" | "DEPARTMENTS";

export type ResourceMeta = {
  categories: { id: string; name: string; isDefault: boolean; count: number }[];
  departments: { id: string; name: string }[];
  myDepartmentIds: string[];
  permissions: { canCreate: boolean; canEditAny: boolean; canDeleteAny: boolean; canHideAny: boolean; moderator: boolean };
  driveConfigured: boolean;
  maxUploadBytes: number;
};

export type ResourcePerms = { canManage: boolean; canDelete: boolean; canHide: boolean; isOwner: boolean };

export type ResourceSummary = ResourcePerms & {
  id: string;
  title: string;
  description: string | null;
  category: { id: string; name: string };
  visibility: Visibility;
  isHidden: boolean;
  owner: { id: string; name: string };
  departments: { id: string; name: string }[];
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ResourceItem = {
  id: string;
  parentId: string | null;
  kind: "FOLDER" | "FILE" | "LINK";
  name: string;
  url: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  isHidden: boolean;
  createdAt: string;
  createdBy: string | null;
};

export type ResourceDetail = Omit<ResourceSummary, "itemCount"> & { items: ResourceItem[] };

/** Every key a resource change can make stale — see feedback on cache invalidation. */
export function invalidateResources(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: ["resources"] });
  qc.invalidateQueries({ queryKey: ["resources-meta"] });
  if (id) qc.invalidateQueries({ queryKey: ["resource", id] });
}

export function useResourceMeta(enabled = true) {
  return useQuery<ResourceMeta>({
    queryKey: ["resources-meta"],
    queryFn: () => api.get("/api/v1/resources/meta").then((r) => r.data.data),
    enabled,
    staleTime: 60 * 1000,
  });
}

export const errorText = (e: any, fallback: string) => e?.response?.data?.error ?? fallback;

export function formatBytes(n: number | null | undefined) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function youtubeId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  return m ? m[1] : null;
}

export type PreviewKind = "image" | "pdf" | "video" | "audio" | "text" | "youtube" | null;

export function previewKind(item: ResourceItem): PreviewKind {
  if (item.kind === "LINK") return youtubeId(item.url) ? "youtube" : null;
  if (item.kind !== "FILE") return null;
  const m = item.mimeType ?? "";
  if (m.startsWith("image/") && m !== "image/svg+xml") return "image";
  if (m === "application/pdf") return "pdf";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m.startsWith("text/plain") || m === "text/csv") return "text";
  return null;
}

export function ItemIcon({ item, className = "h-5 w-5" }: { item: ResourceItem; className?: string }) {
  if (item.kind === "FOLDER") return <Folder className={`${className} text-amber-500`} />;
  if (item.kind === "LINK") {
    return youtubeId(item.url)
      ? <Youtube className={`${className} text-red-500`} />
      : <Link2 className={`${className} text-sky-600`} />;
  }
  const m = item.mimeType ?? "";
  const name = item.name.toLowerCase();
  if (m.startsWith("video/")) return <FileVideo className={`${className} text-purple-600`} />;
  if (m.startsWith("image/")) return <FileImage className={`${className} text-emerald-600`} />;
  if (m.startsWith("audio/")) return <FileAudio className={`${className} text-pink-600`} />;
  if (m === "application/pdf") return <FileText className={`${className} text-red-600`} />;
  if (/\.(pptx?|key|odp)$/.test(name)) return <Presentation className={`${className} text-orange-500`} />;
  if (/\.(xlsx?|csv|ods)$/.test(name)) return <FileSpreadsheet className={`${className} text-green-600`} />;
  if (/\.(zip|rar|7z|tar|gz)$/.test(name)) return <FileArchive className={`${className} text-gray-500`} />;
  if (/\.(docx?|odt|rtf|txt)$/.test(name)) return <FileText className={`${className} text-blue-600`} />;
  return <FileIcon className={`${className} text-gray-400`} />;
}

export function VisibilityBadge({ r }: { r: Pick<ResourceSummary, "visibility" | "departments"> }) {
  if (r.visibility === "PRIVATE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
        <Lock className="h-3 w-3" /> Private
      </span>
    );
  }
  if (r.visibility === "ALL_STAFF") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <Globe className="h-3 w-3" /> All staff
      </span>
    );
  }
  const names = r.departments.map((d) => d.name);
  return (
    <span
      title={names.join(", ")}
      className="inline-flex max-w-full items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
    >
      <Users className="h-3 w-3 shrink-0" />
      <span className="truncate">{names.length === 1 ? names[0] : `${names.length} departments`}</span>
    </span>
  );
}

export const FIELD =
  "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#2C3E7C] focus:outline-none focus:ring-1 focus:ring-[#2C3E7C]";

/** A native select ignores most box styling, so it is appearance-none plus our own chevron. */
export function SelectField({ value, onChange, options, placeholder, className = "" }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${FIELD} appearance-none pr-8 ${value ? "text-gray-700" : "text-gray-400"}`}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </div>
  );
}

/** Bottom sheet on phones, centred dialog from sm up. */
export function Modal({ title, subtitle, onClose, children, footer, wide = false }: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${wide ? "sm:max-w-4xl" : "sm:max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-xs text-gray-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:bg-gray-200" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">{footer}</div>}
      </div>
    </div>
  );
}

export const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-md bg-[#2C3E7C] px-4 py-2 text-sm font-medium text-white hover:bg-[#23326a] active:bg-[#1c2855] disabled:opacity-50";
export const BTN_SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50";
export const BTN_DANGER =
  "inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 active:bg-red-800 disabled:opacity-50";

const VISIBILITY_OPTIONS: { value: Visibility; label: string; hint: string; Icon: React.ElementType }[] = [
  { value: "PRIVATE", label: "Private", hint: "Only you. Not visible to anyone else, Super Admins included.", Icon: Lock },
  { value: "ALL_STAFF", label: "All staff", hint: "Everyone on the team who can open Resources.", Icon: Globe },
  { value: "DEPARTMENTS", label: "Selected departments", hint: "Only members of the departments you pick. Super Admins always see it.", Icon: Users },
];

/** Create a resource, or edit one when `resource` is passed. */
export function ResourceFormModal({ meta, resource, defaultCategoryId, onClose, onSaved }: {
  meta: ResourceMeta;
  resource?: ResourceSummary | ResourceDetail;
  defaultCategoryId?: string;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(resource?.title ?? "");
  const [description, setDescription] = useState(resource?.description ?? "");
  const [categoryId, setCategoryId] = useState(resource?.category.id ?? defaultCategoryId ?? meta.categories[0]?.id ?? "");
  const [visibility, setVisibility] = useState<Visibility>(resource?.visibility ?? "PRIVATE");
  const [departmentIds, setDepartmentIds] = useState<string[]>(
    resource?.departments.map((d) => d.id) ?? meta.myDepartmentIds,
  );
  const [deptSearch, setDeptSearch] = useState("");

  const depts = useMemo(() => {
    const term = deptSearch.trim().toLowerCase();
    return term ? meta.departments.filter((d) => d.name.toLowerCase().includes(term)) : meta.departments;
  }, [meta.departments, deptSearch]);

  // Only the owner may make a resource private (the API enforces this too).
  const privateLocked = !!resource && !resource.isOwner && resource.visibility !== "PRIVATE";

  const save = useMutation({
    mutationFn: () => {
      const body = { title, description: description || null, categoryId, visibility, departmentIds };
      return resource
        ? api.patch(`/api/v1/resources/${resource.id}`, body)
        : api.post("/api/v1/resources", body);
    },
    onSuccess: (res) => {
      toast.success(resource ? "Resource updated" : "Resource created");
      invalidateResources(qc, resource?.id);
      onSaved?.(res.data.data.id);
      onClose();
    },
    onError: (e) => toast.error(errorText(e, "Could not save the resource")),
  });

  const toggleDept = (id: string) =>
    setDepartmentIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const valid = title.trim() && categoryId && (visibility !== "DEPARTMENTS" || departmentIds.length > 0);

  return (
    <Modal
      title={resource ? "Edit resource" : "New resource"}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
          <button onClick={() => save.mutate()} disabled={!valid || save.isPending} className={BTN_PRIMARY}>
            {save.isPending ? "Saving…" : resource ? "Save changes" : "Create resource"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={FIELD}
            placeholder="e.g. Class 11 Physics — Kinematics" autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Description <span className="text-gray-400">(optional)</span></label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} className={FIELD} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Category</label>
          <SelectField
            value={categoryId}
            onChange={setCategoryId}
            options={meta.categories.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">Who can see it</label>
          <div className="space-y-2">
            {VISIBILITY_OPTIONS.map(({ value, label, hint, Icon }) => {
              const disabled = value === "PRIVATE" && privateLocked;
              const active = visibility === value;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={disabled}
                  onClick={() => setVisibility(value)}
                  className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    active ? "border-[#2C3E7C] bg-[#2C3E7C]/5" : "border-gray-200 hover:bg-gray-50 active:bg-gray-100"
                  }`}
                >
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${active ? "border-[#2C3E7C]" : "border-gray-300"}`}>
                    {active && <span className="h-2 w-2 rounded-full bg-[#2C3E7C]" />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                      <Icon className="h-3.5 w-3.5 text-gray-500" /> {label}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500">
                      {disabled ? "Only the owner can make a resource private." : hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {visibility === "DEPARTMENTS" && (
          <div className="rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-gray-400" />
              <input
                value={deptSearch}
                onChange={(e) => setDeptSearch(e.target.value)}
                placeholder="Search departments"
                className="w-full bg-transparent text-sm focus:outline-none"
              />
              <span className="shrink-0 text-xs text-gray-500">{departmentIds.length} selected</span>
            </div>
            <ul className="max-h-48 overflow-y-auto py-1">
              {depts.map((d) => (
                <li key={d.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100">
                    <input
                      type="checkbox"
                      checked={departmentIds.includes(d.id)}
                      onChange={() => toggleDept(d.id)}
                      className="h-4 w-4 rounded border-gray-300 text-[#2C3E7C] focus:ring-[#2C3E7C]"
                    />
                    {d.name}
                  </label>
                </li>
              ))}
              {depts.length === 0 && <li className="px-3 py-3 text-center text-xs text-gray-400">No departments match</li>}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
