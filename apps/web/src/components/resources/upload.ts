import { api } from "@/lib/api";

/**
 * Browser → Google Drive resumable uploads.
 *
 * The API opens a Drive upload session and hands back its URL; the bytes then go
 * straight from the browser to Google, never through our server (whose proxy
 * caps request bodies at 12 MB). Chunks must be multiples of 256 KiB, except the
 * last. A dropped chunk is retried after asking Drive how much it already has.
 */

const CHUNK = 8 * 1024 * 1024;
const MAX_RETRIES = 4;

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf", mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm",
  mkv: "video/x-matroska", mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  txt: "text/plain", csv: "text/csv",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip", swf: "application/x-shockwave-flash", html: "text/html",
};

export function guessMime(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

export class UploadCancelled extends Error {
  constructor() { super("Cancelled"); }
}

type PutResult = { status: number; range: string | null; body: string };

function put(url: string, body: Blob | null, headers: Record<string, string>, signal: AbortSignal,
  onProgress?: (loaded: number) => void): Promise<PutResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    if (onProgress) xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => resolve({ status: xhr.status, range: xhr.getResponseHeader("Range"), body: xhr.responseText });
    xhr.onerror = () => reject(new Error("Network error"));
    const abort = () => { xhr.abort(); reject(new UploadCancelled()); };
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort, { once: true });
    xhr.send(body);
  });
}

/** Bytes Drive has confirmed, from a 308 response's "Range: bytes=0-N". */
function confirmedBytes(range: string | null): number | null {
  const m = range?.match(/bytes=0-(\d+)/);
  return m ? Number(m[1]) + 1 : null;
}

async function sendToDrive(uploadUrl: string, file: File, signal: AbortSignal,
  onProgress: (loaded: number) => void): Promise<{ id: string }> {
  const total = file.size;
  let offset = 0;
  let retries = 0;

  while (true) {
    const end = Math.min(offset + CHUNK, total);
    try {
      const res = await put(
        uploadUrl,
        file.slice(offset, end),
        { "Content-Range": `bytes ${offset}-${end - 1}/${total}` },
        signal,
        (loaded) => onProgress(offset + loaded),
      );
      if (res.status === 200 || res.status === 201) {
        onProgress(total);
        return JSON.parse(res.body);
      }
      if (res.status === 308) {
        // Drive takes the whole chunk. Its Range header says so, but browsers can't
        // read it (not in Google's CORS expose list), so fall back to the chunk end.
        offset = confirmedBytes(res.range) ?? end;
        retries = 0;
        continue;
      }
      if (res.status === 404 || res.status === 410) throw new Error("The upload session expired. Try again.");
      if (res.status < 500 && res.status !== 429) throw new Error(`Google Drive rejected the upload (${res.status})`);
      throw new Error(`Google Drive error (${res.status})`);
    } catch (err) {
      if (err instanceof UploadCancelled || signal.aborted) throw new UploadCancelled();
      if (++retries > MAX_RETRIES || (err instanceof Error && /rejected|expired/.test(err.message))) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** retries));
      // Ask Drive where to resume from. Google doesn't expose the Range header to
      // browsers, so when it's unreadable resend the failed chunk from its start:
      // Drive ignores bytes it already holds (verified against the real API).
      try {
        const status = await put(uploadUrl, null, { "Content-Range": `bytes */${total}` }, signal);
        if (status.status === 200 || status.status === 201) return JSON.parse(status.body);
        if (status.status === 308) offset = confirmedBytes(status.range) ?? offset;
      } catch (probe) {
        if (probe instanceof UploadCancelled) throw probe;
      }
    }
  }
}

/** Reserve → upload → confirm. Cleans up the reservation on failure or cancel. */
export async function uploadFile(opts: {
  resourceId: string;
  file: File;
  parentId: string | null;
  signal: AbortSignal;
  onProgress: (loaded: number) => void;
}): Promise<void> {
  const { data } = await api.post(`/api/v1/resources/${opts.resourceId}/uploads`, {
    name: opts.file.name,
    mimeType: guessMime(opts.file),
    size: opts.file.size,
    parentId: opts.parentId,
  });
  const { itemId, uploadUrl } = data.data as { itemId: string; uploadUrl: string };
  try {
    const driveFile = await sendToDrive(uploadUrl, opts.file, opts.signal, opts.onProgress);
    await api.post(`/api/v1/resources/items/${itemId}/complete`, { driveFileId: driveFile.id });
  } catch (err) {
    api.delete(`/api/v1/resources/items/${itemId}/upload`).catch(() => {});
    throw err;
  }
}

/** Runs `worker` over `items` with at most `limit` in flight. */
export async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await worker(items[next++]);
  });
  await Promise.all(lanes);
}
