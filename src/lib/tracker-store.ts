// Client-side store for the issue tracker prototype.
// Persists to localStorage; broadcasts changes via a simple event bus.

export type Category =
  | "Infrastructure"
  | "Energy & Utility Management"
  | "Hospitality Services"
  | "Workplace Op"
  | "Fleet Op, Health Safety"
  | "Admin";

export const CATEGORIES: Category[] = [
  "Infrastructure",
  "Energy & Utility Management",
  "Hospitality Services",
  "Workplace Op",
  "Fleet Op, Health Safety",
  "Admin",
];

export type MediaKind = "text" | "voice" | "video" | "photo" | "file";

export interface Attachment {
  kind: MediaKind;
  name?: string;
  mimeType?: string;
  // data URL (base64). Capped at 5MB.
  dataUrl?: string;
  text?: string;
}

export interface Reply {
  id: string;
  ticketId: string;
  from: "user" | "admin";
  createdAt: number;
  attachment: Attachment;
}

export interface Ticket {
  id: string; // ticket number
  storeCode: string;
  category: Category;
  status: "open" | "closed";
  createdAt: number;
  updatedAt: number;
  title: string;
  attachment: Attachment;
  replies: Reply[];
}

export interface Broadcast {
  id: string;
  storeCode: string;
  message: string;
  createdAt: number;
}

export interface Session {
  role: "user" | "admin";
  name: string;
}

const TICKETS_KEY = "it_tickets_v1";
const BROADCASTS_KEY = "it_broadcasts_v1";
const SESSION_KEY = "it_session_v1";

type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribe(cb: Listener) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function emit() {
  // Bust cached snapshots so the next getX() returns a new stable reference.
  cachedTickets = undefined;
  cachedBroadcasts = undefined;
  cachedSession = undefined;
  sessionLoaded = false;
  listeners.forEach((l) => l());
}

// Cached snapshots — required for useSyncExternalStore to avoid infinite loops.
let cachedTickets: Ticket[] | undefined;
let cachedBroadcasts: Broadcast[] | undefined;
let cachedSession: Session | null | undefined;
let sessionLoaded = false;
const EMPTY_TICKETS: Ticket[] = [];
const EMPTY_BROADCASTS: Broadcast[] = [];

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, val: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(val));
  emit();
}

export function getTickets(): Ticket[] {
  if (typeof window === "undefined") return EMPTY_TICKETS;
  if (cachedTickets === undefined) {
    cachedTickets = read<Ticket[]>(TICKETS_KEY, []);
  }
  return cachedTickets;
}
export function getBroadcasts(): Broadcast[] {
  if (typeof window === "undefined") return EMPTY_BROADCASTS;
  if (cachedBroadcasts === undefined) {
    cachedBroadcasts = read<Broadcast[]>(BROADCASTS_KEY, []);
  }
  return cachedBroadcasts;
}
export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  if (!sessionLoaded) {
    cachedSession = read<Session | null>(SESSION_KEY, null);
    sessionLoaded = true;
  }
  return cachedSession ?? null;
}
export function setSession(s: Session | null) {
  if (typeof window === "undefined") return;
  if (s) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } else {
    window.localStorage.removeItem(SESSION_KEY);
  }
  emit();
}

function genTicketId() {
  const n = Math.floor(Math.random() * 90000) + 10000;
  const d = new Date();
  return `TKT-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${n}`;
}

export function createTicket(input: {
  storeCode: string;
  category: Category;
  attachment: Attachment;
}): Ticket {
  const now = Date.now();
  const title =
    input.attachment.kind === "text" && input.attachment.text
      ? input.attachment.text.slice(0, 80)
      : `${input.category} — ${input.attachment.kind} report`;
  const ticket: Ticket = {
    id: genTicketId(),
    storeCode: input.storeCode.trim().toUpperCase(),
    category: input.category,
    status: "open",
    createdAt: now,
    updatedAt: now,
    title,
    attachment: input.attachment,
    replies: [],
  };
  const list = getTickets();
  list.unshift(ticket);
  write(TICKETS_KEY, list);
  return ticket;
}

export function respondToTicket(ticketId: string, attachment: Attachment) {
  const list = getTickets();
  const t = list.find((x) => x.id === ticketId);
  if (!t) return;
  const reply: Reply = {
    id: `RPL-${Date.now()}`,
    ticketId,
    from: "admin",
    createdAt: Date.now(),
    attachment,
  };
  t.replies.push(reply);
  t.status = "closed";
  t.updatedAt = Date.now();
  write(TICKETS_KEY, list);
}

export function sendBroadcast(storeCode: string, message: string) {
  const list = getBroadcasts();
  const b: Broadcast = {
    id: `MSG-${Date.now()}`,
    storeCode: storeCode.trim().toUpperCase(),
    message,
    createdAt: Date.now(),
  };
  list.unshift(b);
  write(BROADCASTS_KEY, list);
}

export function exportCsv(): string {
  const rows = [
    ["Ticket ID", "Store Code", "Category", "Title", "Status", "Created", "Updated", "Replies"],
    ...getTickets().map((t) => [
      t.id,
      t.storeCode,
      t.category,
      t.title.replace(/[\r\n,]/g, " "),
      t.status,
      new Date(t.createdAt).toISOString(),
      new Date(t.updatedAt).toISOString(),
      String(t.replies.length),
    ]),
  ];
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_EXT = ["pdf", "csv", "xls", "xlsx", "img", "jpg", "jpeg", "png"];
export const BLOCKED_EXT = ["zip"];

export function fileToAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (BLOCKED_EXT.includes(ext)) return reject(new Error(".zip files are not allowed"));
    if (!ALLOWED_EXT.includes(ext))
      return reject(new Error(`Unsupported file type: .${ext}`));
    if (file.size > MAX_FILE_BYTES) return reject(new Error("File exceeds 5MB limit"));
    const r = new FileReader();
    r.onload = () =>
      resolve({
        kind: "file",
        name: file.name,
        mimeType: file.type,
        dataUrl: String(r.result),
      });
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function blobToAttachment(
  blob: Blob,
  kind: MediaKind,
  name: string,
): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    if (blob.size > MAX_FILE_BYTES) return reject(new Error("Recording exceeds 5MB limit"));
    const r = new FileReader();
    r.onload = () =>
      resolve({ kind, name, mimeType: blob.type, dataUrl: String(r.result) });
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
