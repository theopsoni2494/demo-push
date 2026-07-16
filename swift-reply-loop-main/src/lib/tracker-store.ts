import { supabase } from "./supabase";

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
  publicUrl?: string; // Stored asset URL from Supabase Storage
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

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(cb: Listener) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function emit() {
  listeners.forEach((l) => l());
}

// In-memory cache variables for synchronous reads
let cachedTickets: Ticket[] = [];
let cachedBroadcasts: Broadcast[] = [];
let cachedSession: Session | null = null;
let sessionLoaded = false;

export function getTickets(): Ticket[] {
  return cachedTickets;
}

export function getBroadcasts(): Broadcast[] {
  return cachedBroadcasts;
}

export function getSession(): Session | null {
  return cachedSession;
}

export async function setSession(s: Session | null) {
  if (!s) {
    await supabase.auth.signOut();
  }
}

// -------------------------------------------------------------
// Database Sync and Real-Time Listeners
// -------------------------------------------------------------

export async function syncTickets() {
  const { data: joinedData, error } = await supabase
    .from("tickets")
    .select("*, replies(*)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching tickets from Supabase:", error);
    return;
  }

  cachedTickets = (joinedData || []).map((t: any) => ({
    id: t.id,
    storeCode: t.store_code,
    category: t.category as Category,
    status: t.status as "open" | "closed",
    createdAt: new Date(t.created_at).getTime(),
    updatedAt: new Date(t.updated_at).getTime(),
    title: t.title,
    attachment: t.attachment as Attachment,
    replies: (t.replies || [])
      .map((r: any) => ({
        id: r.id,
        ticketId: r.ticket_id,
        from: r.from_role as "user" | "admin",
        createdAt: new Date(r.created_at).getTime(),
        attachment: r.attachment as Attachment,
      }))
      .sort((a: any, b: any) => a.createdAt - b.createdAt),
  }));

  emit();
}

export async function syncBroadcasts() {
  const { data, error } = await supabase
    .from("broadcasts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching broadcasts from Supabase:", error);
    return;
  }

  cachedBroadcasts = (data || []).map((b: any) => ({
    id: b.id,
    storeCode: b.store_code,
    message: b.message,
    createdAt: new Date(b.created_at).getTime(),
  }));

  emit();
}

// Load current auth session and listen to changes
async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  await handleSession(session);

  supabase.auth.onAuthStateChange(async (_event, session) => {
    await handleSession(session);
  });
}

async function handleSession(session: any) {
  if (session?.user) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("name, role")
      .eq("id", session.user.id)
      .single();

    if (error) {
      console.error("Error fetching user profile:", error);
    }

    cachedSession = {
      role: (profile?.role as "user" | "admin") || "user",
      name: profile?.name || session.user.email || "User",
    };
  } else {
    cachedSession = null;
  }
  sessionLoaded = true;
  emit();
}

// Global initialization logic on the client side
if (typeof window !== "undefined") {
  initAuth();
  syncTickets();
  syncBroadcasts();

  // Listen to postgres changes in real-time
  supabase
    .channel("schema-db-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => {
      syncTickets();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "replies" }, () => {
      syncTickets();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "broadcasts" }, () => {
      syncBroadcasts();
    })
    .subscribe();
}

// -------------------------------------------------------------
// Helper: Upload Base64 File to Supabase Storage
// -------------------------------------------------------------

async function uploadBase64ToStorage(dataUrl: string, fileName: string): Promise<string> {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  const blob = new Blob([u8arr], { type: mime });

  // Generate unique filename path
  const ext = fileName.split(".").pop() || "";
  const path = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;

  const { error } = await supabase.storage
    .from("attachments")
    .upload(path, blob, {
      contentType: mime,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const { data: urlData } = supabase.storage
    .from("attachments")
    .getPublicUrl(path);

  return urlData.publicUrl;
}

// -------------------------------------------------------------
// Ticket, Reply, and Broadcast Actions
// -------------------------------------------------------------

function genTicketId() {
  const n = Math.floor(Math.random() * 90000) + 10000;
  const d = new Date();
  return `TKT-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${n}`;
}

export async function createTicket(input: {
  storeCode: string;
  category: Category;
  attachment: Attachment;
}): Promise<Ticket | null> {
  const now = Date.now();
  const title =
    input.attachment.kind === "text" && input.attachment.text
      ? input.attachment.text.slice(0, 80)
      : `${input.category} — ${input.attachment.kind} report`;

  const ticketId = genTicketId();
  const finalAttachment = { ...input.attachment };

  if (finalAttachment.dataUrl) {
    try {
      const fileName = finalAttachment.name || `photo_${Date.now()}.png`;
      const publicUrl = await uploadBase64ToStorage(finalAttachment.dataUrl, fileName);
      finalAttachment.publicUrl = publicUrl;
      delete finalAttachment.dataUrl; // clear base64 data to save DB space
    } catch (err) {
      console.error("Storage upload failed for ticket creation:", err);
    }
  }

  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("tickets").insert({
    id: ticketId,
    store_code: input.storeCode.trim().toUpperCase(),
    category: input.category,
    status: "open",
    title,
    attachment: finalAttachment,
    user_id: user?.id || null,
  });

  if (error) {
    console.error("Error inserting ticket:", error);
    return null;
  }

  return {
    id: ticketId,
    storeCode: input.storeCode.trim().toUpperCase(),
    category: input.category,
    status: "open",
    createdAt: now,
    updatedAt: now,
    title,
    attachment: finalAttachment,
    replies: [],
  };
}

export async function respondToTicket(ticketId: string, attachment: Attachment) {
  const finalAttachment = { ...attachment };
  const replyId = `RPL-${Date.now()}`;

  if (finalAttachment.dataUrl) {
    try {
      const fileName = finalAttachment.name || `photo_${Date.now()}.png`;
      const publicUrl = await uploadBase64ToStorage(finalAttachment.dataUrl, fileName);
      finalAttachment.publicUrl = publicUrl;
      delete finalAttachment.dataUrl;
    } catch (err) {
      console.error("Storage upload failed for reply creation:", err);
    }
  }

  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("replies").insert({
    id: replyId,
    ticket_id: ticketId,
    from_role: "admin",
    attachment: finalAttachment,
    user_id: user?.id || null,
  });

  if (error) {
    console.error("Error creating reply in Supabase:", error);
    return;
  }

  // Update updated_at of parent ticket
  await supabase
    .from("tickets")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", ticketId);
}

export async function closeTicket(ticketId: string) {
  const { error } = await supabase
    .from("tickets")
    .update({
      status: "closed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  if (error) {
    console.error("Error closing ticket in Supabase:", error);
  }
}

export async function sendBroadcast(storeCode: string, message: string) {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("broadcasts").insert({
    id: `MSG-${Date.now()}`,
    store_code: storeCode.trim().toUpperCase(),
    message,
    user_id: user?.id || null,
  });

  if (error) {
    console.error("Error inserting broadcast in Supabase:", error);
  }
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
