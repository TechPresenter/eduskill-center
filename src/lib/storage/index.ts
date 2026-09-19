import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Errors } from "@/lib/api/errors";

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

export function mimeFromKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

export function isPrivateKey(key: string): boolean {
  return key.startsWith("private/");
}

export function fileUrl(key: string): string {
  return `/api/files/${key}`;
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

export interface SaveUploadOptions {
  folder: string;
  visibility: Visibility;
  preset?: UploadPreset;
  allowedExts?: readonly string[];
  maxMb?: number;
}

/** Validates and stores an uploaded File. Returns the storage key and a URL that goes through the access-controlled files route. */
export async function saveUpload(file: File, opts: SaveUploadOptions): Promise<StoredFile> {
  const preset = UPLOAD_PRESETS[opts.preset ?? "document"];
  const allowed = (opts.allowedExts ?? preset.exts).map((e) => e.toLowerCase());
  const maxBytes = (opts.maxMb ?? preset.maxMb) * 1024 * 1024;

  if (!file || typeof file.arrayBuffer !== "function") throw Errors.badRequest("No file uploaded");
  if (file.size === 0) throw Errors.badRequest("Uploaded file is empty");
  if (file.size > maxBytes) throw Errors.badRequest(`File is too large. Maximum size is ${opts.maxMb ?? preset.maxMb} MB`);

  const originalName = (file.name || "file").replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  const ext = originalName.includes(".") ? originalName.split(".").pop()!.toLowerCase() : "";
  if (!ext || !allowed.includes(ext)) throw Errors.badRequest(`File type .${ext || "?"} is not allowed. Allowed: ${allowed.join(", ")}`);

  const buffer = Buffer.from(await file.arrayBuffer());
  const sig = detectSignature(buffer);
  const expectedByExt = Object.entries(SIGNATURE_COMPAT).find(([, exts]) => exts.includes(ext))?.[0];
  if (expectedByExt && sig !== expectedByExt) {
    throw Errors.badRequest("File content does not match its extension");
  }
  if (ext === "svg" || ext === "html" || ext === "js") throw Errors.badRequest("This file type is not allowed");

  const mimeType = MIME_BY_EXT[ext] ?? "application/octet-stream";
  const key = sanitizeKey(`${opts.visibility}/${opts.folder.replace(/^\/+|\/+$/g, "")}/${randomUUID()}.${ext}`);
  await getDriver().put(key, buffer, mimeType);
  return { key, url: fileUrl(key), name: originalName, mimeType, size: buffer.length };
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

/** Extracts the storage key from a stored URL (`/api/files/<key>`), or returns null. */
export function keyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/^\/api\/files\/(.+)$/);
  return m ? m[1]! : null;
}
