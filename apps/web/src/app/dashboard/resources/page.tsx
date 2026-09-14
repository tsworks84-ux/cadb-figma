"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, EyeOff, FolderOpen, Pencil, Plus, Search, Settings2, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { usePermissionsState } from "@/hooks/usePermissions";
import {
  BRAND, BTN_PRIMARY, BTN_SECONDARY, FIELD, Modal, ResourceFormModal, VisibilityBadge,
  errorText, fmtDate, invalidateResources, useResourceMeta,
  type ResourceMeta, type ResourceSummary,
} from "@/components/resources/shared";

type Scope = "all" | "mine" | "shared";

const SCOPES: { value: Scope; label: string }[] = [
  { value: "all", label: "All" },
  { value: "mine", label: "My resources" },
  { value: "shared", label: "Shared with me" },
];

// ── Categories ───────────────────────────────────────────────────────────────

function AddCategoryModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const add = useMutation({
    mutationFn: () => api.post("/api/v1/resources/categories", { name }),
    onSuccess: () => { toast.success("Category added"); invalidateResources(qc); onClose(); },
    onError: (e) => toast.error(errorText(e, "Could not add the category")),
  });
  return (
    <Modal
      title="New category"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
          <button onClick={() => add.mutate()} disabled={!name.trim() || add.isPending} className={BTN_PRIMARY}>
            {add.isPending ? "Adding…" : "Add category"}
          </button>
        </>
      }
    >
      <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) add.mutate(); }}
        maxLength={60}
        autoFocus
        className={FIELD}
        placeholder="e.g. Question Banks"
      />
      <p className="mt-2 text-xs text-gray-500">Categories are shared: everyone who uses Resources will see this one.</p>
    </Modal>
  );
}

/** Rename / delete categories — moderators only. */
function ManageCategoriesModal({ meta, onClose }: { meta: ResourceMeta; onClose: () => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const { canEditAny, canDeleteAny } = meta.permissions;

  const rename = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/resources/categories/${id}`, { name: draft }),
    onSuccess: () => { toast.success("Category renamed"); setEditing(null); invalidateResources(qc); },
    onError: (e) => toast.error(errorText(e, "Could not rename the category")),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/resources/categories/${id}`),
    onSuccess: () => { toast.success("Category deleted"); invalidateResources(qc); },
    onError: (e) => toast.error(errorText(e, "Could not delete the category")),
  });

  return (
    <Modal title="Manage categories" subtitle="Counts include only resources you can see" onClose={onClose}>
      <ul className="divide-y divide-gray-100">
        {meta.categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-2.5">
            {editing === c.id ? (
              <>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={60} autoFocus className={FIELD} />
                <button onClick={() => rename.mutate(c.id)} disabled={!draft.trim() || rename.isPending} className={BTN_PRIMARY}>Save</button>
                <button onClick={() => setEditing(null)} className="rounded-md p-2 text-gray-400 hover:bg-gray-100" aria-label="Cancel"><X size={16} /></button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{c.name}</span>
                <span className="shrink-0 text-xs text-gray-400">{c.count}</span>
                {canEditAny && (
                  <button onClick={() => { setEditing(c.id); setDraft(c.name); }} className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 active:bg-gray-200" aria-label={`Rename ${c.name}`}>
                    <Pencil size={15} />
                  </button>
                )}
                {canDeleteAny && (
                  <button
                    onClick={() => { if (confirm(`Delete the category "${c.name}"?`)) remove.mutate(c.id); }}
                    disabled={c.isDefault || remove.isPending}
                    title={c.isDefault ? "Built-in categories can be renamed but not deleted" : undefined}
                    className="rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 active:bg-red-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                    aria-label={`Delete ${c.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ResourcesPage() {
  const router = useRouter();
  const { permissions, ready } = usePermissionsState();
  const canView = permissions.RESOURCES?.canView ?? false;

  const [categoryId, setCategoryId] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [managingCategories, setManagingCategories] = useState(false);

  const { data: meta } = useResourceMeta(ready && canView);
  const term = search.trim();
  const { data: resources = [], isLoading, isError, error, refetch } = useQuery<ResourceSummary[]>({
    queryKey: ["resources", categoryId, scope, term],
    queryFn: () => api.get("/api/v1/resources", {
      params: { categoryId: categoryId || undefined, scope, q: term || undefined },
    }).then((r) => r.data.data),
    enabled: ready && canView,
    placeholderData: (prev) => prev,
  });

  if (!ready) return <div className="py-16 text-center text-sm text-gray-400">Loading…</div>;

  if (!canView) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium text-gray-700">You don&apos;t have access to Resources</p>
        <p className="mt-1 text-sm text-gray-500">Ask a Super Admin to grant your role view on Resources.</p>
      </div>
    );
  }

  const perms = meta?.permissions;
  const total = meta?.categories.reduce((n, c) => n + c.count, 0) ?? 0;

  return (
    <div className="space-y-4">
      {creating && meta && (
        <ResourceFormModal
          meta={meta}
          defaultCategoryId={categoryId || undefined}
          onClose={() => setCreating(false)}
          onSaved={(id) => router.push(`/dashboard/resources/${id}`)}
        />
      )}
      {addingCategory && <AddCategoryModal onClose={() => setAddingCategory(false)} />}
      {managingCategories && meta && <ManageCategoriesModal meta={meta} onClose={() => setManagingCategories(false)} />}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: BRAND }}>
            <FolderOpen className="text-white" size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Resources</h1>
            <p className="text-sm text-gray-500">Books, teaching aids, videos and more</p>
          </div>
        </div>
        {perms?.canCreate && (
          <button onClick={() => setCreating(true)} className={`${BTN_PRIMARY} w-full sm:w-auto`}>
            <Plus size={16} /> New resource
          </button>
        )}
      </div>

      {meta && !meta.driveConfigured && perms?.canCreate && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>File uploads are not set up yet: Google Drive isn&apos;t connected on this server. You can still create resources, folders and links.</span>
        </div>
      )}

      {/* Categories */}
      <div className="flex items-center gap-2">
        <div className="-mx-4 flex flex-1 gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
          {[{ id: "", name: "All", count: total }, ...(meta?.categories ?? [])].map((c) => {
            const active = categoryId === c.id;
            return (
              <button
                key={c.id || "all"}
                onClick={() => setCategoryId(c.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-[#2C3E7C] bg-[#2C3E7C] text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 active:bg-gray-100"
                }`}
              >
                {c.name}
                <span className={`text-xs ${active ? "text-white/70" : "text-gray-400"}`}>{c.count}</span>
              </button>
            );
          })}
          {perms?.canCreate && (
            <button
              onClick={() => setAddingCategory(true)}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 active:bg-gray-100"
            >
              <Plus size={14} /> Category
            </button>
          )}
        </div>
        {(perms?.canEditAny || perms?.canDeleteAny) && (
          <button
            onClick={() => setManagingCategories(true)}
            className="shrink-0 rounded-md border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 active:bg-gray-100"
            title="Manage categories"
            aria-label="Manage categories"
          >
            <Settings2 size={16} />
          </button>
        )}
      </div>

      {/* Scope + search */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-full rounded-lg border border-gray-200 bg-white p-0.5 sm:w-auto">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              onClick={() => setScope(s.value)}
              className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none ${
                scope === s.value ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles and file names"
            className={`${FIELD} pl-9`}
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-gray-400">Loading resources…</div>
      ) : isError ? (
        <div className="py-16 text-center">
          <p className="text-sm text-red-600">{errorText(error, "Could not load resources")}</p>
          <button onClick={() => refetch()} className="mt-2 text-sm font-medium text-[#2C3E7C] hover:underline">Try again</button>
        </div>
      ) : resources.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-14 text-center">
          <FolderOpen className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">
            {term ? "Nothing matches your search" : scope === "mine" ? "You haven't added any resources yet" : "No resources here yet"}
          </p>
          {perms?.canCreate && !term && (
            <button onClick={() => setCreating(true)} className={`${BTN_PRIMARY} mt-4`}>
              <Plus size={16} /> New resource
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {resources.map((r) => (
            <Link
              key={r.id}
              href={`/dashboard/resources/${r.id}`}
              className={`group flex flex-col rounded-xl border bg-white p-4 transition-shadow hover:shadow-md active:bg-gray-50 ${
                r.isHidden ? "border-dashed border-gray-300 opacity-75" : "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-400">{r.category.name}</span>
                {r.isHidden && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    <EyeOff className="h-3 w-3" /> Hidden
                  </span>
                )}
              </div>
              <h3 className="mt-1 line-clamp-2 font-semibold text-gray-900 group-hover:text-[#2C3E7C]">{r.title}</h3>
              {r.description && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{r.description}</p>}
              <div className="mt-auto pt-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <VisibilityBadge r={r} />
                  <span className="text-xs text-gray-500">{r.itemCount} item{r.itemCount === 1 ? "" : "s"}</span>
                </div>
                <p className="mt-2 truncate text-xs text-gray-400">
                  {r.isOwner ? "You" : r.owner.name} · updated {fmtDate(r.updatedAt)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
