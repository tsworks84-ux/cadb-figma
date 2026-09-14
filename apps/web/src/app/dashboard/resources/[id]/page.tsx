"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, Download, ExternalLink, Eye, EyeOff,
  FolderInput, FolderPlus, FolderUp, Link2, MoreVertical, Pencil, Trash2, Upload, X, XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { usePermissionsState } from "@/hooks/usePermissions";
import {
  API_BASE, BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, FIELD, ItemIcon, Modal, ResourceFormModal,
  VisibilityBadge, errorText, fmtDate, formatBytes, invalidateResources, previewKind, useResourceMeta,
  youtubeId, type ResourceDetail, type ResourceItem,
} from "@/components/resources/shared";
import { UploadCancelled, runPool, uploadFile } from "@/components/resources/upload";

// ── Upload queue ─────────────────────────────────────────────────────────────

type Task = {
  key: string;
  label: string;
  size: number;
  loaded: number;
  status: "queued" | "uploading" | "done" | "error" | "cancelled";
  error?: string;
};

function UploadPanel({ tasks, onCancelAll, onDismiss }: {
  tasks: Task[];
  onCancelAll: () => void;
  onDismiss: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const active = tasks.filter((t) => t.status === "queued" || t.status === "uploading").length;
  const failed = tasks.filter((t) => t.status === "error").length;
  const size = tasks.reduce((n, t) => n + t.size, 0);
  const loaded = tasks.reduce((n, t) => n + (t.status === "done" ? t.size : t.loaded), 0);
  const pct = size ? Math.round((loaded / size) * 100) : 100;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-96 sm:rounded-xl sm:border">
      <div className="flex items-center gap-2 px-4 py-3">
        <button onClick={() => setCollapsed((c) => !c)} className="min-w-0 flex-1 text-left">
          <p className="text-sm font-medium text-gray-900">
            {active ? `Uploading ${active} file${active === 1 ? "" : "s"}… ${pct}%` : failed ? `${failed} upload${failed === 1 ? "" : "s"} failed` : "Uploads complete"}
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div className={`h-full transition-all ${failed && !active ? "bg-red-500" : "bg-[#2C3E7C]"}`} style={{ width: `${pct}%` }} />
          </div>
        </button>
        {active ? (
          <button onClick={onCancelAll} className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 active:bg-gray-200">Cancel</button>
        ) : (
          <button onClick={onDismiss} className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100" aria-label="Close"><X size={16} /></button>
        )}
      </div>
      {!collapsed && (
        <ul className="max-h-56 overflow-y-auto border-t border-gray-100 py-1">
          {tasks.map((t) => (
            <li key={t.key} className="flex items-center gap-2 px-4 py-1.5 text-xs">
              {t.status === "done" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                : t.status === "error" || t.status === "cancelled" ? <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                : <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-gray-200 border-t-[#2C3E7C]" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-gray-700" title={t.label}>{t.label}</span>
                {t.error && <span className="block truncate text-red-600" title={t.error}>{t.error}</span>}
              </span>
              <span className="shrink-0 text-gray-400">
                {t.status === "uploading" ? `${Math.round((t.loaded / Math.max(t.size, 1)) * 100)}%` : formatBytes(t.size)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Small modals ─────────────────────────────────────────────────────────────

function NameModal({ title, initial = "", action, onSubmit, onClose, pending }: {
  title: string; initial?: string; action: string; pending: boolean;
  onSubmit: (name: string) => void; onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
          <button onClick={() => onSubmit(name.trim())} disabled={!name.trim() || pending} className={BTN_PRIMARY}>{action}</button>
        </>
      }
    >
      <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onSubmit(name.trim()); }}
        maxLength={250}
        autoFocus
        className={FIELD}
      />
    </Modal>
  );
}

function LinkModal({ item, onSubmit, onClose, pending }: {
  item?: ResourceItem; pending: boolean;
  onSubmit: (v: { name: string; url: string }) => void; onClose: () => void;
}) {
  const [url, setUrl] = useState(item?.url ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const normalised = url.trim() && !/^https?:\/\//i.test(url.trim()) ? `https://${url.trim()}` : url.trim();
  return (
    <Modal
      title={item ? "Edit link" : "Add link"}
      subtitle="YouTube links play right here; other links open in a new tab"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
          <button
            onClick={() => onSubmit({ url: normalised, name: name.trim() || normalised })}
            disabled={!normalised || pending}
            className={BTN_PRIMARY}
          >
            {item ? "Save" : "Add link"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Link</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} autoFocus className={FIELD} placeholder="https://" inputMode="url" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Name <span className="text-gray-400">(optional)</span></label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={250} className={FIELD} placeholder="e.g. PhET — Projectile Motion" />
        </div>
      </div>
    </Modal>
  );
}

function MoveModal({ item, items, onSubmit, onClose, pending }: {
  item: ResourceItem; items: ResourceItem[]; pending: boolean;
  onSubmit: (parentId: string | null) => void; onClose: () => void;
}) {
  // Folders in tree order, minus the item itself and anything inside it.
  const options = useMemo(() => {
    const blocked = new Set<string>([item.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const i of items) {
        if (i.parentId && blocked.has(i.parentId) && !blocked.has(i.id)) { blocked.add(i.id); grew = true; }
      }
    }
    const out: { id: string; name: string; depth: number }[] = [];
    const walk = (parentId: string | null, depth: number) => {
      items
        .filter((i) => i.kind === "FOLDER" && i.parentId === parentId && !blocked.has(i.id))
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((f) => { out.push({ id: f.id, name: f.name, depth }); walk(f.id, depth + 1); });
    };
    walk(null, 0);
    return out;
  }, [item, items]);
  const [target, setTarget] = useState<string | null>(item.parentId);

  const Row = ({ id, name, depth }: { id: string | null; name: string; depth: number }) => (
    <button
      onClick={() => setTarget(id)}
      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${target === id ? "bg-[#2C3E7C]/10 font-medium text-[#2C3E7C]" : "text-gray-700 hover:bg-gray-50 active:bg-gray-100"}`}
      style={{ paddingLeft: 12 + depth * 18 }}
    >
      <FolderInput className="h-4 w-4 shrink-0 text-amber-500" />
      <span className="truncate">{name}</span>
    </button>
  );

  return (
    <Modal
      title={`Move "${item.name}"`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
          <button onClick={() => onSubmit(target)} disabled={target === item.parentId || pending} className={BTN_PRIMARY}>Move here</button>
        </>
      }
    >
      <div className="space-y-0.5">
        <Row id={null} name="Top level" depth={0} />
        {options.map((o) => <Row key={o.id} id={o.id} name={o.name} depth={o.depth + 1} />)}
      </div>
    </Modal>
  );
}

async function openAccessUrl(itemId: string, download = false) {
  const { data } = await api.get(`/api/v1/resources/items/${itemId}/access`);
  return `${API_BASE}${data.data.path}${download ? "?download=1" : ""}`;
}

/**
 * Downloads go through a short-lived signed URL rather than an Authorization
 * header, so a plain navigation works and the browser streams large files to
 * disk instead of holding them in memory as a blob.
 */
async function downloadItem(item: ResourceItem) {
  try {
    const url = await openAccessUrl(item.id, true);
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    toast.error(errorText(e, "Could not download the file"));
  }
}

function PreviewModal({ item, onClose }: { item: ResourceItem; onClose: () => void }) {
  const kind = previewKind(item);
  const { data: src, error, isLoading } = useQuery({
    queryKey: ["resource-access", item.id],
    queryFn: () => openAccessUrl(item.id),
    enabled: item.kind === "FILE",
    staleTime: 30 * 60 * 1000,
  });
  const { data: text } = useQuery({
    queryKey: ["resource-text", item.id],
    queryFn: () => fetch(src!).then((r) => r.text()).then((t) => t.slice(0, 200_000)),
    enabled: kind === "text" && !!src,
  });
  const yt = youtubeId(item.url);

  return (
    <Modal
      wide
      title={item.name}
      subtitle={item.kind === "FILE" ? `${formatBytes(item.sizeBytes)}${item.createdBy ? ` · added by ${item.createdBy}` : ""}` : item.url ?? undefined}
      onClose={onClose}
      footer={
        item.kind === "FILE" ? (
          <button onClick={() => downloadItem(item)} className={BTN_SECONDARY}><Download size={16} /> Download</button>
        ) : item.url ? (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className={BTN_SECONDARY}><ExternalLink size={16} /> Open original</a>
        ) : undefined
      }
    >
      <div className="flex min-h-[40vh] items-center justify-center rounded-lg bg-gray-950/5">
        {yt ? (
          <iframe
            className="aspect-video w-full rounded-lg"
            src={`https://www.youtube-nocookie.com/embed/${yt}`}
            title={item.name}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : isLoading ? (
          <span className="text-sm text-gray-400">Loading…</span>
        ) : error || !src ? (
          <span className="text-sm text-red-600">{errorText(error, "Could not open the file")}</span>
        ) : kind === "image" ? (
          <img src={src} alt={item.name} className="max-h-[70vh] w-auto rounded-lg object-contain" />
        ) : kind === "pdf" ? (
          <iframe src={src} title={item.name} className="h-[70vh] w-full rounded-lg bg-white" />
        ) : kind === "video" ? (
          <video src={src} controls autoPlay playsInline className="max-h-[70vh] w-full rounded-lg bg-black" />
        ) : kind === "audio" ? (
          <audio src={src} controls autoPlay className="w-full max-w-lg" />
        ) : kind === "text" ? (
          <pre className="max-h-[70vh] w-full overflow-auto whitespace-pre-wrap rounded-lg bg-white p-4 text-xs text-gray-700">{text ?? "Loading…"}</pre>
        ) : (
          <div className="px-4 py-10 text-center">
            <ItemIcon item={item} className="mx-auto h-10 w-10" />
            <p className="mt-3 text-sm text-gray-600">This file type can&apos;t be previewed here.</p>
            <button onClick={() => downloadItem(item)} className={`${BTN_PRIMARY} mt-4`}><Download size={16} /> Download</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Row menu ─────────────────────────────────────────────────────────────────

function RowMenu({ children }: { children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 active:bg-gray-200"
        aria-label="Actions"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: React.ElementType; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${danger ? "text-red-600 hover:bg-red-50 active:bg-red-100" : "text-gray-700 hover:bg-gray-50 active:bg-gray-100"}`}
    >
      <Icon size={15} /> {label}
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type Dialog =
  | { type: "edit" }
  | { type: "folder" }
  | { type: "link"; item?: ResourceItem }
  | { type: "rename"; item: ResourceItem }
  | { type: "move"; item: ResourceItem }
  | { type: "preview"; item: ResourceItem }
  | { type: "delete" }
  | null;

export default function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const { permissions, ready } = usePermissionsState();
  const canView = permissions.RESOURCES?.canView ?? false;

  const [folderId, setFolderId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dragging, setDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const { data: meta } = useResourceMeta(ready && canView);
  const { data: r, isLoading, error } = useQuery<ResourceDetail>({
    queryKey: ["resource", id],
    queryFn: () => api.get(`/api/v1/resources/${id}`).then((res) => res.data.data),
    enabled: ready && canView,
  });

  const items = r?.items ?? [];
  // A folder that vanished (deleted, or hidden by someone) drops you back to the top.
  const currentFolder = folderId ? items.find((i) => i.id === folderId && i.kind === "FOLDER") ?? null : null;
  useEffect(() => { if (folderId && r && !currentFolder) setFolderId(null); }, [folderId, r, currentFolder]);

  const breadcrumb = useMemo(() => {
    const trail: ResourceItem[] = [];
    let cur = currentFolder;
    while (cur) {
      trail.unshift(cur);
      const parentId: string | null = cur.parentId;
      cur = parentId ? items.find((i) => i.id === parentId) ?? null : null;
    }
    return trail;
  }, [currentFolder, items]);

  const visible = useMemo(() => {
    const here = items.filter((i) => i.parentId === (currentFolder?.id ?? null));
    const order = { FOLDER: 0, FILE: 1, LINK: 1 } as const;
    return here.sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [items, currentFolder]);

  const refresh = () => invalidateResources(qc, id);

  // ── Mutations ──
  const createFolder = useMutation({
    mutationFn: (name: string) => api.post(`/api/v1/resources/${id}/folders`, { name, parentId: currentFolder?.id ?? null }),
    onSuccess: () => { toast.success("Folder created"); setDialog(null); refresh(); },
    onError: (e) => toast.error(errorText(e, "Could not create the folder")),
  });
  const saveLink = useMutation({
    mutationFn: (v: { name: string; url: string; item?: ResourceItem }) => v.item
      ? api.patch(`/api/v1/resources/items/${v.item.id}`, { name: v.name, url: v.url })
      : api.post(`/api/v1/resources/${id}/links`, { name: v.name, url: v.url, parentId: currentFolder?.id ?? null }),
    onSuccess: (_d, v) => { toast.success(v.item ? "Link updated" : "Link added"); setDialog(null); refresh(); },
    onError: (e) => toast.error(errorText(e, "Could not save the link")),
  });
  const updateItem = useMutation({
    mutationFn: (v: { itemId: string; body: Record<string, unknown>; done: string }) =>
      api.patch(`/api/v1/resources/items/${v.itemId}`, v.body),
    onSuccess: (_d, v) => { toast.success(v.done); setDialog(null); refresh(); },
    onError: (e) => toast.error(errorText(e, "Could not update the item")),
  });
  const hideItem = useMutation({
    mutationFn: (v: { item: ResourceItem; hidden: boolean }) =>
      api.post(`/api/v1/resources/items/${v.item.id}/hide`, { hidden: v.hidden }),
    onSuccess: (_d, v) => { toast.success(v.hidden ? `"${v.item.name}" is now hidden` : `"${v.item.name}" is visible again`); refresh(); },
    onError: (e) => toast.error(errorText(e, "Could not change visibility")),
  });
  const deleteItem = useMutation({
    mutationFn: (item: ResourceItem) => api.delete(`/api/v1/resources/items/${item.id}`),
    onSuccess: () => { toast.success("Deleted"); refresh(); },
    onError: (e) => toast.error(errorText(e, "Could not delete the item")),
  });
  const hideResource = useMutation({
    mutationFn: (hidden: boolean) => api.post(`/api/v1/resources/${id}/hide`, { hidden }),
    onSuccess: (_d, hidden) => { toast.success(hidden ? "Resource hidden" : "Resource visible again"); refresh(); },
    onError: (e) => toast.error(errorText(e, "Could not change visibility")),
  });
  const deleteResource = useMutation({
    mutationFn: () => api.delete(`/api/v1/resources/${id}`),
    onSuccess: () => {
      toast.success("Resource deleted");
      invalidateResources(qc);
      qc.removeQueries({ queryKey: ["resource", id] });
      router.push("/dashboard/resources");
    },
    onError: (e) => toast.error(errorText(e, "Could not delete the resource")),
  });

  // ── Uploads ──
  const uploading = tasks.some((t) => t.status === "queued" || t.status === "uploading");
  useEffect(() => {
    if (!uploading) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);

  const patchTask = (key: string, patch: Partial<Task>) =>
    setTasks((cur) => cur.map((t) => (t.key === key ? { ...t, ...patch } : t)));

  async function startUpload(files: File[]) {
    if (!files.length || !r) return;
    if (!meta?.driveConfigured) {
      toast.error("File uploads are not set up yet: Google Drive isn't connected on this server.");
      return;
    }
    const tooBig = files.filter((f) => f.size > (meta?.maxUploadBytes ?? Infinity));
    if (tooBig.length) {
      toast.error(`${tooBig.length} file(s) are over the ${formatBytes(meta!.maxUploadBytes)} limit and were skipped`);
    }
    const accepted = files.filter((f) => f.size > 0 && f.size <= (meta?.maxUploadBytes ?? Infinity));
    if (!accepted.length) return;

    const baseFolder = currentFolder?.id ?? null;
    const controller = abortRef.current && !abortRef.current.signal.aborted && uploading ? abortRef.current : new AbortController();
    abortRef.current = controller;

    const batch = accepted.map((file, n) => ({
      file,
      key: `${Date.now()}-${n}-${file.name}`,
      // Folder picks carry "Top/sub/file.pdf"; plain file picks have no path.
      path: ((file as File & { webkitRelativePath?: string }).webkitRelativePath || "").split("/").slice(0, -1),
    }));
    setTasks((cur) => [
      ...cur.filter((t) => t.status === "queued" || t.status === "uploading"),
      ...batch.map((b) => ({ key: b.key, label: [...b.path, b.file.name].join("/"), size: b.file.size, loaded: 0, status: "queued" as const })),
    ]);

    // Recreate the picked folder structure first, one path segment at a time.
    const folderIds = new Map<string, string | null>([["", baseFolder]]);
    try {
      for (const b of batch) {
        for (let depth = 1; depth <= b.path.length; depth++) {
          const key = b.path.slice(0, depth).join("/");
          if (folderIds.has(key)) continue;
          const parent = folderIds.get(b.path.slice(0, depth - 1).join("/")) ?? null;
          const { data } = await api.post(`/api/v1/resources/${id}/folders`, { name: b.path[depth - 1], parentId: parent });
          folderIds.set(key, data.data.id);
        }
      }
    } catch (e) {
      toast.error(errorText(e, "Could not create the folders for this upload"));
      setTasks((cur) => cur.map((t) => batch.some((b) => b.key === t.key) ? { ...t, status: "error", error: "Folder could not be created" } : t));
      refresh();
      return;
    }

    await runPool(batch, 3, async (b) => {
      if (controller.signal.aborted) { patchTask(b.key, { status: "cancelled" }); return; }
      patchTask(b.key, { status: "uploading" });
      try {
        await uploadFile({
          resourceId: id,
          file: b.file,
          parentId: folderIds.get(b.path.join("/")) ?? baseFolder,
          signal: controller.signal,
          onProgress: (loaded) => patchTask(b.key, { loaded }),
        });
        patchTask(b.key, { status: "done", loaded: b.file.size });
      } catch (e) {
        if (e instanceof UploadCancelled) patchTask(b.key, { status: "cancelled", error: "Cancelled" });
        else patchTask(b.key, { status: "error", error: errorText(e, e instanceof Error ? e.message : "Upload failed") });
      }
      refresh();
    });
  }

  // ── Render ──
  if (!ready) return <div className="py-16 text-center text-sm text-gray-400">Loading…</div>;
  if (!canView) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium text-gray-700">You don&apos;t have access to Resources</p>
        <p className="mt-1 text-sm text-gray-500">Ask a Super Admin to grant your role view on Resources.</p>
      </div>
    );
  }
  if (isLoading) return <div className="py-16 text-center text-sm text-gray-400">Loading…</div>;
  if (error || !r) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium text-gray-700">{errorText(error, "Resource not found")}</p>
        <p className="mt-1 text-sm text-gray-500">It may have been deleted, hidden, or made private.</p>
        <Link href="/dashboard/resources" className="mt-4 inline-block text-sm font-medium text-[#2C3E7C] hover:underline">Back to Resources</Link>
      </div>
    );
  }

  return (
    <div
      className="space-y-4 pb-24"
      onDragOver={(e) => { if (r.canManage && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={(e) => {
        if (!r.canManage) return;
        e.preventDefault();
        setDragging(false);
        startUpload(Array.from(e.dataTransfer.files));
      }}
    >
      {/* Dialogs */}
      {dialog?.type === "edit" && meta && <ResourceFormModal meta={meta} resource={r} onClose={() => setDialog(null)} />}
      {dialog?.type === "folder" && (
        <NameModal title="New folder" action="Create" pending={createFolder.isPending}
          onSubmit={(name) => createFolder.mutate(name)} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "link" && (
        <LinkModal item={dialog.item} pending={saveLink.isPending}
          onSubmit={(v) => saveLink.mutate({ ...v, item: dialog.item })} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "rename" && (
        <NameModal title="Rename" initial={dialog.item.name} action="Save" pending={updateItem.isPending}
          onSubmit={(name) => updateItem.mutate({ itemId: dialog.item.id, body: { name }, done: "Renamed" })}
          onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "move" && (
        <MoveModal item={dialog.item} items={items} pending={updateItem.isPending}
          onSubmit={(parentId) => updateItem.mutate({ itemId: dialog.item.id, body: { parentId }, done: "Moved" })}
          onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "preview" && <PreviewModal item={dialog.item} onClose={() => setDialog(null)} />}
      {dialog?.type === "delete" && (
        <Modal
          title="Delete this resource?"
          onClose={() => setDialog(null)}
          footer={
            <>
              <button onClick={() => setDialog(null)} className={BTN_SECONDARY}>Cancel</button>
              <button onClick={() => deleteResource.mutate()} disabled={deleteResource.isPending} className={BTN_DANGER}>
                <Trash2 size={16} /> Delete
              </button>
            </>
          }
        >
          <p className="text-sm text-gray-600">
            &ldquo;{r.title}&rdquo; and all {items.length} item(s) in it will be removed from CADB. The files go to the
            Google Drive trash, where a Drive manager can restore them for 30 days.
          </p>
        </Modal>
      )}

      {tasks.length > 0 && (
        <UploadPanel tasks={tasks} onCancelAll={() => abortRef.current?.abort()} onDismiss={() => setTasks([])} />
      )}

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-[#2C3E7C]/10 backdrop-blur-[1px]">
          <div className="rounded-xl border-2 border-dashed border-[#2C3E7C] bg-white px-8 py-6 text-center shadow-lg">
            <Upload className="mx-auto h-8 w-8 text-[#2C3E7C]" />
            <p className="mt-2 text-sm font-medium text-gray-800">Drop files to upload to {currentFolder?.name ?? r.title}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <Link href="/dashboard/resources" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft size={15} /> Resources
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{r.category.name}</p>
            <h1 className="mt-0.5 break-words text-2xl font-bold text-gray-900">{r.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <VisibilityBadge r={r} />
              {r.isHidden && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  <EyeOff className="h-3 w-3" /> Hidden
                </span>
              )}
              <span className="text-xs text-gray-500">
                {r.isOwner ? "Yours" : `By ${r.owner.name}`} · created {fmtDate(r.createdAt)}
              </span>
            </div>
            {r.visibility === "DEPARTMENTS" && r.departments.length > 1 && (
              <p className="mt-1.5 text-xs text-gray-500">Shared with {r.departments.map((d) => d.name).join(", ")}</p>
            )}
            {r.description && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{r.description}</p>}
          </div>
          {(r.canManage || r.canHide || r.canDelete) && (
            <div className="grid shrink-0 grid-cols-3 gap-2 sm:flex">
              {r.canManage && (
                <button onClick={() => setDialog({ type: "edit" })} className={BTN_SECONDARY}><Pencil size={15} /> Edit</button>
              )}
              {r.canHide && r.visibility !== "PRIVATE" && (
                <button onClick={() => hideResource.mutate(!r.isHidden)} disabled={hideResource.isPending} className={BTN_SECONDARY}>
                  {r.isHidden ? <><Eye size={15} /> Unhide</> : <><EyeOff size={15} /> Hide</>}
                </button>
              )}
              {r.canDelete && (
                <button onClick={() => setDialog({ type: "delete" })} className={`${BTN_SECONDARY} text-red-600 hover:bg-red-50`}><Trash2 size={15} /> Delete</button>
              )}
            </div>
          )}
        </div>
        {r.isHidden && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Hidden: only the owner and moderators can see this resource right now.
          </p>
        )}
      </div>

      {/* Toolbar */}
      {r.canManage && (
        <div className="flex flex-wrap gap-2">
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => { startUpload(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
          <input
            ref={folderInput}
            type="file"
            multiple
            hidden
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            onChange={(e) => { startUpload(Array.from(e.target.files ?? [])); e.target.value = ""; }}
          />
          <button onClick={() => fileInput.current?.click()} className={`${BTN_PRIMARY} flex-1 sm:flex-none`}><Upload size={15} /> Upload files</button>
          <button onClick={() => folderInput.current?.click()} className={`${BTN_SECONDARY} hidden sm:inline-flex`}><FolderUp size={15} /> Upload folder</button>
          <button onClick={() => setDialog({ type: "folder" })} className={`${BTN_SECONDARY} flex-1 sm:flex-none`}><FolderPlus size={15} /> New folder</button>
          <button onClick={() => setDialog({ type: "link" })} className={`${BTN_SECONDARY} flex-1 sm:flex-none`}><Link2 size={15} /> Add link</button>
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 overflow-x-auto whitespace-nowrap text-sm scrollbar-none">
        <button onClick={() => setFolderId(null)} className={`rounded px-1.5 py-0.5 ${currentFolder ? "text-gray-500 hover:bg-gray-100 hover:text-gray-800" : "font-medium text-gray-900"}`}>
          All items
        </button>
        {breadcrumb.map((f, n) => (
          <span key={f.id} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />
            <button
              onClick={() => setFolderId(f.id)}
              className={`max-w-[12rem] truncate rounded px-1.5 py-0.5 ${n === breadcrumb.length - 1 ? "font-medium text-gray-900" : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"}`}
            >
              {f.name}
            </button>
          </span>
        ))}
      </nav>

      {/* Items */}
      <div className="rounded-xl border border-gray-200 bg-white">
        {visible.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="text-sm font-medium text-gray-700">{currentFolder ? "This folder is empty" : "Nothing in this resource yet"}</p>
            {r.canManage && <p className="mt-1 text-sm text-gray-500">Upload files, add a link, or drag files onto this page.</p>}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            <li className="hidden grid-cols-[minmax(0,1fr)_7rem_9rem_2.5rem] gap-3 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-400 md:grid">
              <span>Name</span><span>Size</span><span>Added</span><span />
            </li>
            {visible.map((item) => {
              const open = () => {
                if (item.kind === "FOLDER") return setFolderId(item.id);
                if (previewKind(item)) return setDialog({ type: "preview", item });
                if (item.kind === "LINK" && item.url) return window.open(item.url, "_blank", "noopener,noreferrer");
                setDialog({ type: "preview", item });
              };
              return (
                <li
                  key={item.id}
                  onClick={open}
                  className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-3 px-4 py-2.5 hover:bg-gray-50 active:bg-gray-100 md:grid-cols-[minmax(0,1fr)_7rem_9rem_2.5rem] ${item.isHidden ? "opacity-60" : ""}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ItemIcon item={item} className="h-5 w-5 shrink-0" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm text-gray-800">
                        <span className="truncate" title={item.name}>{item.name}</span>
                        {item.isHidden && <EyeOff className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="Hidden" />}
                        {item.kind === "LINK" && !youtubeId(item.url) && <ExternalLink className="h-3 w-3 shrink-0 text-gray-400" />}
                      </p>
                      <p className="truncate text-xs text-gray-400 md:hidden">
                        {item.kind === "FILE" ? `${formatBytes(item.sizeBytes)} · ` : ""}{fmtDate(item.createdAt)}
                      </p>
                    </div>
                  </div>
                  <span className="hidden text-sm text-gray-500 md:block">{item.kind === "FILE" ? formatBytes(item.sizeBytes) : "—"}</span>
                  <span className="hidden truncate text-sm text-gray-500 md:block" title={item.createdBy ?? undefined}>{fmtDate(item.createdAt)}</span>
                  <RowMenu>
                    {(close) => (
                      <>
                        {item.kind === "FILE" && (
                          <MenuItem icon={Download} label="Download" onClick={() => { close(); downloadItem(item); }} />
                        )}
                        {item.kind === "LINK" && item.url && (
                          <MenuItem icon={ExternalLink} label="Open link" onClick={() => { close(); window.open(item.url!, "_blank", "noopener,noreferrer"); }} />
                        )}
                        {r.canManage && (
                          <>
                            <MenuItem icon={Pencil} label={item.kind === "LINK" ? "Edit" : "Rename"} onClick={() => {
                              close();
                              setDialog(item.kind === "LINK" ? { type: "link", item } : { type: "rename", item });
                            }} />
                            <MenuItem icon={FolderInput} label="Move" onClick={() => { close(); setDialog({ type: "move", item }); }} />
                          </>
                        )}
                        {r.canHide && (
                          <MenuItem
                            icon={item.isHidden ? Eye : EyeOff}
                            label={item.isHidden ? "Unhide" : "Hide"}
                            onClick={() => { close(); hideItem.mutate({ item, hidden: !item.isHidden }); }}
                          />
                        )}
                        {r.canDelete && (
                          <MenuItem icon={Trash2} label="Delete" danger onClick={() => {
                            close();
                            const extra = item.kind === "FOLDER" ? " and everything inside it" : "";
                            if (confirm(`Delete "${item.name}"${extra}?`)) deleteItem.mutate(item);
                          }} />
                        )}
                      </>
                    )}
                  </RowMenu>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
