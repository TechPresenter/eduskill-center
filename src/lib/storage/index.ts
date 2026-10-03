import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Errors } from "@/lib/api/errors";
import { stripBasePath, withBasePath } from "@/lib/base-path";

export type Visibility = "public" | "private";

export interface StoredFile {
  key: string;
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

interface StorageDriver {
  put(key: string, data: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  mp4: "video/mp4",
  zip: "application/zip",
};

export const UPLOAD_PRESETS = {
  image: { exts: ["jpg", "jpeg", "png", "webp"], maxMb: 5 },
  document: { exts: ["jpg", "jpeg", "png", "webp", "pdf"], maxMb: 5 },
  resume: { exts: ["pdf", "doc", "docx"], maxMb: 5 },
  material: { exts: ["pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg", "mp4", "zip", "txt"], maxMb: 50 },
  csv: { exts: ["csv"], maxMb: 10 },
} as const;

export type UploadPreset = keyof typeof UPLOAD_PRESETS;

function sanitizeKey(key: string): string {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..") || normalized.includes("\0")) throw Errors.badRequest("Invalid file key");
  if (!/^[a-zA-Z0-9_\-./]+$/.test(normalized)) throw Errors.badRequest("Invalid file key");
  return normalized;
}

/**
 * The key exactly as the storage driver will read it (backslashes become `/`, leading slashes are
 * dropped, traversal and odd characters are refused with a 400). Access checks MUST run on this
 * value, never on the raw request path: `/private/...` and `\private/...` name the same file as
 * `private/...`.
 */
export function normalizeKey(key: string): string {
  return sanitizeKey(key);
}

export function mimeFromKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

export function isPrivateKey(key: string): boolean {
  // Normalised the way the driver resolves keys, so a leading `/` or `\` cannot hide a private key.
  return key.replace(/\\/g, "/").replace(/^\/+/, "").startsWith("private/");
}

/**
 * Browser-usable URL for a stored key, carrying the deployment sub-path when there is one
 * (`/api/files/<key>` at the root, `/center/api/files/<key>` under /center). These strings end up
 * in `<img src>`, `<a href>` and API payloads as raw text, and Next never prefixes raw strings —
 * so the prefix has to be baked in here rather than at each of the ~80 render sites.
 */
export function fileUrl(key: string): string {
  return withBasePath(`/api/files/${key}`);
}

// ───────────── Local driver ─────────────

class LocalDriver implements StorageDriver {
  constructor(private baseDir: string) {}

  private resolve(key: string) {
    const full = path.resolve(this.baseDir, sanitizeKey(key));
    if (!full.startsWith(path.resolve(this.baseDir))) throw Errors.badRequest("Invalid file key");
    return full;
  }

  async put(key: string, data: Buffer) {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  }

  async get(key: string) {
    try {
      return await fs.readFile(this.resolve(key));
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    try {
      await fs.unlink(this.resolve(key));
    } catch {
      /* ignore */
    }
  }
}

// ───────────── S3 driver ─────────────

class S3Driver implements StorageDriver {
  private clientPromise: Promise<import("@aws-sdk/client-s3").S3Client> | null = null;
  constructor(private bucket: string) {}

  private async client() {
    if (!this.clientPromise) {
      this.clientPromise = import("@aws-sdk/client-s3").then(({ S3Client }) => {
        return new S3Client({
          region: process.env.S3_REGION || "ap-south-1",
          endpoint: process.env.S3_ENDPOINT || undefined,
          forcePathStyle: !!process.env.S3_ENDPOINT,
          credentials:
            process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
              ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
              : undefined,
        });
      });
    }
    return this.clientPromise;
  }

  async put(key: string, data: Buffer, mimeType: string) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const c = await this.client();
    await c.send(new PutObjectCommand({ Bucket: this.bucket, Key: sanitizeKey(key), Body: data, ContentType: mimeType }));
  }

  async get(key: string) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const c = await this.client();
    try {
      const res = await c.send(new GetObjectCommand({ Bucket: this.bucket, Key: sanitizeKey(key) }));
      const bytes = await res.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const c = await this.client();
    try {
      await c.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: sanitizeKey(key) }));
    } catch {
      /* ignore */
    }
  }
}

let driver: StorageDriver | null = null;

function getDriver(): StorageDriver {
  if (driver) return driver;
  if ((process.env.STORAGE_DRIVER ?? "local") === "s3") {
    if (!process.env.S3_BUCKET) throw new Error("S3_BUCKET is required when STORAGE_DRIVER=s3");
    driver = new S3Driver(process.env.S3_BUCKET);
  } else {
    driver = new LocalDriver(path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? "./storage"));
  }
  return driver;
}

// ───────────── Validation ─────────────

function detectSignature(buf: Buffer): string | null {
  if (buf.length < 4) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (buf.subarray(0, 4).toString("ascii") === "%PDF") return "pdf";
  if (buf[0] === 0x50 && buf[1] === 0x4b) return "zip"; // docx/xlsx/zip
  if (buf[0] === 0xd0 && buf[1] === 0xcf) return "ole"; // doc/xls
  return null;
}

const SIGNATURE_COMPAT: Record<string, string[]> = {
  jpg: ["jpg", "jpeg"],
  png: ["png"],
  webp: ["webp"],
  pdf: ["pdf"],
  zip: ["docx", "xlsx", "zip"],
  ole: ["doc", "xls"],
};

/**
 * MIME types a browser may declare (`File.type`) for each extension we accept. Browsers derive
 * File.type from the OS registry, so the lists carry the common platform variants: Windows labels
 * a .csv `application/vnd.ms-excel` when Excel is installed, some Android pickers call a .docx a
 * plain zip, older IE said `image/pjpeg`.
 */
const DECLARED_MIME_BY_EXT: Record<string, readonly string[]> = {
  jpg: ["image/jpeg", "image/jpg", "image/pjpeg"],
  jpeg: ["image/jpeg", "image/jpg", "image/pjpeg"],
  png: ["image/png", "image/x-png"],
  webp: ["image/webp"],
  gif: ["image/gif"],
  pdf: ["application/pdf", "application/x-pdf", "application/acrobat"],
  doc: ["application/msword", "application/doc", "application/vnd.ms-word"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip", "application/x-zip-compressed"],
  xls: ["application/vnd.ms-excel", "application/excel", "application/x-excel", "application/x-msexcel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "application/x-zip-compressed"],
  csv: ["text/csv", "text/plain", "application/csv", "text/x-csv", "text/comma-separated-values", "application/vnd.ms-excel"],
  txt: ["text/plain"],
  mp4: ["video/mp4", "application/mp4", "video/x-m4v"],
  zip: ["application/zip", "application/x-zip-compressed", "application/x-zip", "multipart/x-zip"],
};

/** Declared types that are never acceptable for an upload, whatever its extension. */
const DANGEROUS_DECLARED_MIME = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/xml|application\/xml|(text|application)\/(x-)?(java|ecma)script|application\/x-(msdownload|msdos-program|executable|sh|bat|httpd-php|php)|application\/(x-)?php|application\/vnd\.microsoft\.portable-executable|application\/hta)\b/;

const KNOWN_DECLARED_MIMES = new Set(Object.values(DECLARED_MIME_BY_EXT).flat());

/**
 * Rejects an obvious disagreement between the browser-declared MIME type and the extension — e.g.
 * `text/html` on a `.pdf`, or `image/png` on a `.docx`. An empty or generic declaration
 * (`application/octet-stream`) is accepted, as is an unfamiliar vendor type we have no opinion on:
 * the magic-byte check below stays the authority on what the bytes actually are.
 */
function assertDeclaredMimeMatches(declared: string | undefined, ext: string) {
  const mime = (declared ?? "").split(";")[0]!.trim().toLowerCase();
  if (!mime || mime === "application/octet-stream" || mime === "binary/octet-stream") return;
  if (DANGEROUS_DECLARED_MIME.test(mime)) throw Errors.badRequest("This file type is not allowed");
  const expected = DECLARED_MIME_BY_EXT[ext];
  if (!expected || expected.includes(mime)) return;
  // A type we recognise as belonging to a DIFFERENT extension is a mismatch, not a quirk.
  if (KNOWN_DECLARED_MIMES.has(mime) || mime.startsWith("image/") || mime.startsWith("video/") || mime.startsWith("audio/")) {
    throw Errors.badRequest("File type does not match its extension");
  }
}

export interface UploadLimits {
  preset?: UploadPreset;
  allowedExts?: readonly string[];
  maxMb?: number;
}

export interface SaveUploadOptions extends UploadLimits {
  folder: string;
  visibility: Visibility;
}

/**
 * An upload that has passed every check (size, extension allow-list, magic bytes) and is holding
 * its bytes in memory, ready for `storeValidatedUpload` to write.
 *
 * Splitting validation from the write lets a caller reject a bad file BEFORE it creates any
 * database row, so a 6 MB resume or a `.exe` renamed to `.pdf` leaves nothing behind at all.
 * `saveUpload` remains the one-shot form for the ~25 callers that write first and have nothing
 * to roll back.
 */
export interface ValidatedUpload {
  buffer: Buffer;
  /** Sanitised original file name, e.g. `my_resume.pdf`. */
  name: string;
  ext: string;
  mimeType: string;
  size: number;
}

/**
 * Validates an uploaded File without writing it anywhere: size against the preset's cap, the
 * extension against the preset's allow-list, the browser-declared MIME type against that
 * extension, and the leading bytes against that extension — so a renamed executable is rejected
 * however its name is spelled.
 */
export async function validateUpload(file: File, limits: UploadLimits = {}): Promise<ValidatedUpload> {
  const preset = UPLOAD_PRESETS[limits.preset ?? "document"];
  const allowed = (limits.allowedExts ?? preset.exts).map((e) => e.toLowerCase());
  const maxMb = limits.maxMb ?? preset.maxMb;
  const maxBytes = maxMb * 1024 * 1024;

  if (!file || typeof file.arrayBuffer !== "function") throw Errors.badRequest("No file uploaded");
  if (file.size === 0) throw Errors.badRequest("Uploaded file is empty");
  if (file.size > maxBytes) throw Errors.badRequest(`File is too large. Maximum size is ${maxMb} MB`);

  const originalName = (file.name || "file").replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  const ext = originalName.includes(".") ? originalName.split(".").pop()!.toLowerCase() : "";
  if (!ext || !allowed.includes(ext)) throw Errors.badRequest(`File type .${ext || "?"} is not allowed. Allowed: ${allowed.join(", ")}`);
  if (ext === "svg" || ext === "html" || ext === "htm" || ext === "js") throw Errors.badRequest("This file type is not allowed");
  assertDeclaredMimeMatches(file.type, ext);

  const buffer = Buffer.from(await file.arrayBuffer());
  const sig = detectSignature(buffer);
  const expectedByExt = Object.entries(SIGNATURE_COMPAT).find(([, exts]) => exts.includes(ext))?.[0];
  if (expectedByExt && sig !== expectedByExt) {
    throw Errors.badRequest("File content does not match its extension");
  }

  const mimeType = MIME_BY_EXT[ext] ?? "application/octet-stream";
  return { buffer, name: originalName, ext, mimeType, size: buffer.length };
}

/** Writes an already-validated upload and returns its key plus an access-controlled URL. */
export async function storeValidatedUpload(v: ValidatedUpload, opts: { folder: string; visibility: Visibility }): Promise<StoredFile> {
  const key = sanitizeKey(`${opts.visibility}/${opts.folder.replace(/^\/+|\/+$/g, "")}/${randomUUID()}.${v.ext}`);
  await getDriver().put(key, v.buffer, v.mimeType);
  return { key, url: fileUrl(key), name: v.name, mimeType: v.mimeType, size: v.size };
}

/** Validates and stores an uploaded File. Returns the storage key and a URL that goes through the access-controlled files route. */
export async function saveUpload(file: File, opts: SaveUploadOptions): Promise<StoredFile> {
  return storeValidatedUpload(await validateUpload(file, opts), opts);
}

export async function putBuffer(key: string, data: Buffer, mimeType?: string): Promise<StoredFile> {
  const safe = sanitizeKey(key);
  const mt = mimeType ?? mimeFromKey(safe);
  await getDriver().put(safe, data, mt);
  return { key: safe, url: fileUrl(safe), name: path.basename(safe), mimeType: mt, size: data.length };
}

export async function readStoredFile(key: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const safe = sanitizeKey(key);
  const buffer = await getDriver().get(safe);
  if (!buffer) return null;
  return { buffer, mimeType: mimeFromKey(safe) };
}

export async function deleteStoredFile(key: string): Promise<void> {
  await getDriver().delete(sanitizeKey(key));
}

/**
 * Extracts the storage key from a stored URL, or returns null.
 *
 * Tolerant on purpose: rows written before the sub-path deployment hold `/api/files/<key>` while
 * new rows hold `/center/api/files/<key>`, and some rows hold a fully absolute URL. All three
 * resolve to the same key, so no data migration is needed and a deployment can move between the
 * root and a sub-path without orphaning files.
 */
export function keyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let pathname = url;
  if (/^[a-zA-Z][a-zA-Z0-9+.\-]*:\/\//.test(pathname)) {
    try {
      pathname = new URL(pathname).pathname;
    } catch {
      return null;
    }
  }
  const m = stripBasePath(pathname).match(/^\/api\/files\/(.+)$/);
  if (!m) return null;
  const key = m[1]!;
  // Defence in depth: a traversal key could otherwise satisfy an `isFileUrlUnder` ownership check
  // before `sanitizeKey` rejects it further down.
  return key.includes("..") || key.includes("\0") ? null : key;
}

/**
 * True when `url` is a stored-file URL whose key sits under `keyPrefix` (e.g.
 * `private/students/<id>/`). Use this instead of `url.startsWith("/api/files/…")` in ownership
 * checks: the raw string carries the deployment sub-path, this does not.
 */
export function isFileUrlUnder(url: string | null | undefined, keyPrefix: string): boolean {
  const key = keyFromUrl(url);
  return !!key && key.startsWith(keyPrefix.replace(/^\/+/, ""));
}
