import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  Inbox,
  CheckCheck,
  Store,
  Tag,
  Download,
  Send,
  LogOut,
  LifeBuoy,
  ArrowLeft,
  MessageSquare,
} from "lucide-react";
import {
  exportCsv,
  getSession,
  getTickets,
  respondToTicket,
  sendBroadcast,
  setSession,
  subscribe,
  type Ticket,
  closeTicket,
} from "@/lib/tracker-store";
import { MediaComposer, AttachmentPreview } from "@/components/tracker/MediaComposer";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin — Serenity Desk" }] }),
  component: AdminPage,
});

type Tab = "open" | "underlying" | "closed" | "stores" | "titles" | "download" | "broadcast";

const TABS: { key: Tab; label: string; icon: typeof Inbox }[] = [
  { key: "open", label: "Opened issues", icon: Inbox },
  { key: "underlying", label: "Underlying queries", icon: MessageSquare },
  { key: "closed", label: "Closed issues", icon: CheckCheck },
  { key: "stores", label: "Store codes", icon: Store },
  { key: "titles", label: "Issue titles", icon: Tag },
  { key: "download", label: "Download data", icon: Download },
  { key: "broadcast", label: "Send alert", icon: Send },
];

function useStore<T>(g: () => T): T {
  return useSyncExternalStore((cb) => subscribe(cb), g, g);
}

function AdminPage() {
  const navigate = useNavigate();
  const session = useStore(getSession);
  const [tab, setTab] = useState<Tab>("open");
  const [responding, setResponding] = useState<Ticket | null>(null);

  useEffect(() => {
    if (!session) navigate({ to: "/auth" });
    if (session?.role === "user") navigate({ to: "/dashboard" });
  }, [session, navigate]);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card/60 backdrop-blur md:flex">
        <div className="flex items-center gap-2 px-6 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <LifeBuoy className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Serenity Desk</p>
            <p className="text-xs text-muted-foreground">Admin console</p>
          </div>
        </div>
        <nav className="mt-2 flex-1 space-y-1 px-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setResponding(null);
                setTab(t.key);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                tab === t.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-xl px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-semibold">
              A
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">Admin</p>
              <p className="text-xs text-muted-foreground">Backend team</p>
            </div>
            <button
              onClick={() => {
                setSession(null);
                navigate({ to: "/auth" });
              }}
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-10">
          {responding ? (
            <RespondView ticket={responding} onBack={() => setResponding(null)} />
          ) : (
            <>
              {tab === "open" && <TicketList type="open" onRespond={setResponding} />}
              {tab === "underlying" && <TicketList type="underlying" onRespond={setResponding} />}
              {tab === "closed" && <TicketList type="closed" />}
              {tab === "stores" && <StoresView />}
              {tab === "titles" && <TitlesView />}
              {tab === "download" && <DownloadView />}
              {tab === "broadcast" && <BroadcastView />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function TicketList({
  type,
  onRespond,
}: {
  type: "open" | "underlying" | "closed";
  onRespond?: (t: Ticket) => void;
}) {
  const tickets = useStore(getTickets).filter((t) => {
    if (type === "open") return t.status === "open" && t.replies.length === 0;
    if (type === "underlying") return t.status === "open" && t.replies.length > 0;
    return t.status === "closed";
  });

  const titleText =
    type === "open"
      ? "Opened issues"
      : type === "underlying"
        ? "Underlying queries"
        : "Closed issues";

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">{titleText}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"}
      </p>

      {tickets.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed bg-card/40 py-16 text-center text-sm text-muted-foreground">
          No {type === "underlying" ? "underlying" : type} tickets yet.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {tickets.map((t) => (
            <div key={t.id} className="rounded-2xl border bg-card p-5 shadow-sm transition hover:shadow-md">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono font-semibold text-foreground">{t.id}</span>
                    <span>·</span>
                    <span className="rounded-full bg-muted px-2 py-0.5">{t.category}</span>
                    <span>·</span>
                    <span className="font-mono">{t.storeCode}</span>
                    <span>·</span>
                    <span>{new Date(t.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">{t.title}</p>
                  <div className="mt-3">
                    <AttachmentPreview a={t.attachment} />
                  </div>
                  {t.replies.length > 0 && (
                    <div className="mt-4 border-t pt-4">
                      <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Replies</p>
                      <div className="space-y-2">
                        {t.replies.map((r) => (
                          <div key={r.id} className="rounded-xl border bg-muted/20 p-3">
                            <AttachmentPreview a={r.attachment} />
                            <div className="mt-1 text-right text-[10px] text-muted-foreground">
                              {new Date(r.createdAt).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 items-end">
                  {type !== "closed" && onRespond && (
                    <button
                      onClick={() => onRespond(t)}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
                    >
                      Respond
                    </button>
                  )}
                  {type !== "closed" && (
                    <button
                      onClick={async () => {
                        await closeTicket(t.id);
                        toast.success(`Query ${t.id} closed`);
                      }}
                      className="rounded-xl border border-destructive bg-background px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive hover:text-destructive-foreground transition shadow-sm"
                    >
                      CLOSE THIS QUERY
                    </button>
                  )}
                  {type === "closed" && (
                    <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium" style={{ color: "oklch(0.45 0.13 160)" }}>
                      Resolved
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RespondView({ ticket, onBack }: { ticket: Ticket; onBack: () => void }) {
  return (
    <div>
      <button
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono font-semibold text-foreground">{ticket.id}</span>
          <span>{ticket.category} · {ticket.storeCode}</span>
        </div>
        <p className="mt-2 text-sm font-medium">{ticket.title}</p>
        <div className="mt-4 rounded-xl border bg-muted/30 p-4">
          <AttachmentPreview a={ticket.attachment} />
        </div>
      </div>
      <h2 className="mb-3 mt-6 text-sm font-medium text-muted-foreground">Your response</h2>
      <MediaComposer
        onSubmit={async (a) => {
          await respondToTicket(ticket.id, a);
          toast.success(`Reply sent · notified store ${ticket.storeCode}`);
          onBack();
        }}
      />
    </div>
  );
}

function StoresView() {
  const tickets = useStore(getTickets);
  const grouped = useMemo(() => {
    const map = new Map<string, { open: number; closed: number; last: number }>();
    for (const t of tickets) {
      const g = map.get(t.storeCode) ?? { open: 0, closed: 0, last: 0 };
      if (t.status === "open") g.open++;
      else g.closed++;
      g.last = Math.max(g.last, t.updatedAt);
      map.set(t.storeCode, g);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].last - a[1].last);
  }, [tickets]);

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Store codes</h1>
      <p className="mt-2 text-sm text-muted-foreground">Stores with active or historical tickets.</p>
      {grouped.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed bg-card/40 py-16 text-center text-sm text-muted-foreground">
          No stores yet.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Store</th>
                <th className="px-5 py-3 text-left font-medium">Open</th>
                <th className="px-5 py-3 text-left font-medium">Closed</th>
                <th className="px-5 py-3 text-left font-medium">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(([code, g]) => (
                <tr key={code} className="border-b last:border-0 transition hover:bg-muted/30">
                  <td className="px-5 py-3 font-mono font-medium">{code}</td>
                  <td className="px-5 py-3">{g.open}</td>
                  <td className="px-5 py-3">{g.closed}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {new Date(g.last).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TitlesView() {
  const tickets = useStore(getTickets);
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Issue titles</h1>
      <p className="mt-2 text-sm text-muted-foreground">All reported issues at a glance.</p>
      {tickets.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed bg-card/40 py-16 text-center text-sm text-muted-foreground">
          No issues yet.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Ticket</th>
                <th className="px-5 py-3 text-left font-medium">Title</th>
                <th className="px-5 py-3 text-left font-medium">Category</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-b last:border-0 transition hover:bg-muted/30">
                  <td className="px-5 py-3 font-mono text-xs">{t.id}</td>
                  <td className="px-5 py-3">{t.title}</td>
                  <td className="px-5 py-3 text-muted-foreground">{t.category}</td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        t.status === "open"
                          ? "bg-warning/15 text-warning-foreground"
                          : "bg-success/15",
                      )}
                      style={t.status === "open" ? { color: "oklch(0.45 0.15 75)" } : { color: "oklch(0.45 0.13 160)" }}
                    >
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DownloadView() {
  function download() {
    const csv = exportCsv();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `serenity-desk-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export downloaded");
  }
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Download data</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Export the full ticket log as CSV.
      </p>
      <div className="mt-8 rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Download className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Full dataset (CSV)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ticket ID, store code, category, title, status, and timestamps.
        </p>
        <button
          onClick={download}
          className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          Download CSV
        </button>
      </div>
    </div>
  );
}

function BroadcastView() {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !msg.trim()) return toast.error("Both fields are required");
    await sendBroadcast(code, msg);
    toast.success(`Alert sent to ${code.toUpperCase()}`);
    setMsg("");
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Send alert</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Broadcast a message to a specific store's Past replies feed.
      </p>
      <form onSubmit={submit} className="mt-8 max-w-xl space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Store code
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="STR-1042"
            className="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm font-mono uppercase outline-none ring-ring/30 focus:ring-2"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Message
          </label>
          <textarea
            rows={5}
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Type your alert…"
            className="w-full resize-none rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none ring-ring/30 focus:ring-2"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          <Send className="h-4 w-4" /> Send alert
        </button>
      </form>
    </div>
  );
}
