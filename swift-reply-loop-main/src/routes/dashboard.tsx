import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  Building2,
  Zap,
  Coffee,
  Briefcase,
  Truck,
  ShieldAlert,
  History,
  LogOut,
  LifeBuoy,
  X,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import {
  CATEGORIES,
  type Category,
  createTicket,
  getBroadcasts,
  getSession,
  getTickets,
  setSession,
  subscribe,
  closeTicket,
} from "@/lib/tracker-store";
import { MediaComposer, AttachmentPreview } from "@/components/tracker/MediaComposer";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Dashboard — Serenity Desk" }] }),
  component: Dashboard,
});

const ICONS: Record<Category, typeof Building2> = {
  Infrastructure: Building2,
  "Energy & Utility Management": Zap,
  "Hospitality Services": Coffee,
  "Workplace Op": Briefcase,
  "Fleet Op, Health Safety": Truck,
  Admin: ShieldAlert,
};

function useStore<T>(getSnap: () => T): T {
  return useSyncExternalStore(
    (cb) => subscribe(cb),
    getSnap,
    getSnap,
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const session = useStore(getSession);
  const [category, setCategory] = useState<Category | null>(null);
  const [pastOpen, setPastOpen] = useState(false);
  const [storeCode, setStoreCode] = useState("");
  const [pendingCategory, setPendingCategory] = useState<Category | null>(null);
  const [confirmedStore, setConfirmedStore] = useState<string>("");
  const [confirmation, setConfirmation] = useState<{ ticketId: string } | null>(null);

  useEffect(() => {
    if (!session) navigate({ to: "/auth" });
    if (session?.role === "admin") navigate({ to: "/admin" });
  }, [session, navigate]);

  function pickCategory(c: Category) {
    setPendingCategory(c);
    setStoreCode(confirmedStore);
  }

  function confirmStoreCode(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[A-Za-z0-9-]{3,}$/.test(storeCode.trim())) {
      toast.error("Enter a valid store code (3+ characters)");
      return;
    }
    setConfirmedStore(storeCode.trim().toUpperCase());
    setCategory(pendingCategory);
    setPendingCategory(null);
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        active={pastOpen ? "past" : category ? "chat" : "home"}
        onHome={() => {
          setCategory(null);
          setPastOpen(false);
        }}
        onPast={() => {
          setCategory(null);
          setPastOpen(true);
        }}
        onLogout={() => {
          setSession(null);
          navigate({ to: "/auth" });
        }}
        name={session?.name ?? "User"}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-10">
          {!category && !pastOpen && (
            <HomeGrid
              storeCode={confirmedStore}
              onPick={pickCategory}
              onPast={() => setPastOpen(true)}
            />
          )}
          {category && (
            <ChatView
              category={category}
              storeCode={confirmedStore}
              onBack={() => setCategory(null)}
              onSubmit={async (a) => {
                const t = await createTicket({
                  storeCode: confirmedStore,
                  category,
                  attachment: a,
                });
                if (t) {
                  setConfirmation({ ticketId: t.id });
                }
              }}
            />
          )}
          {pastOpen && <RecentQueries storeCode={confirmedStore} />}
        </div>
      </main>

      {pendingCategory && (
        <Modal onClose={() => setPendingCategory(null)}>
          <form onSubmit={confirmStoreCode} className="p-6">
            <h3 className="text-lg font-semibold tracking-tight">Enter store code</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              We'll attach this code to your <span className="font-medium text-foreground">{pendingCategory}</span> report.
            </p>
            <input
              autoFocus
              value={storeCode}
              onChange={(e) => setStoreCode(e.target.value.toUpperCase())}
              placeholder="e.g. STR-1042"
              className="mt-4 w-full rounded-xl border bg-background px-4 py-3 text-sm font-medium uppercase tracking-wide outline-none ring-ring/30 focus:ring-2"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingCategory(null)}
                className="rounded-xl px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
              >
                Continue
              </button>
            </div>
          </form>
        </Modal>
      )}

      {confirmation && (
        <Modal onClose={() => setConfirmation(null)}>
          <div className="p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-7 w-7" style={{ color: "oklch(0.55 0.14 160)" }} />
            </div>
            <h3 className="mt-4 text-lg font-semibold tracking-tight">Issue submitted</h3>
            <p className="mt-1 text-sm text-muted-foreground">Your ticket has been logged.</p>
            <div className="mt-4 rounded-xl border bg-muted/40 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Ticket number</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-foreground">
                {confirmation.ticketId}
              </p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirmation(null)}
                className="rounded-xl border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
              >
                Stay
              </button>
              <button
                onClick={() => {
                  setConfirmation(null);
                  setCategory(null);
                }}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
              >
                Address another issue
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Sidebar({
  active,
  onHome,
  onPast,
  onLogout,
  name,
}: {
  active: "home" | "chat" | "past";
  onHome: () => void;
  onPast: () => void;
  onLogout: () => void;
  name: string;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card/60 backdrop-blur md:flex">
      <div className="flex items-center gap-2 px-6 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <LifeBuoy className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">Serenity Desk</p>
          <p className="text-xs text-muted-foreground">Store portal</p>
        </div>
      </div>
      <nav className="mt-2 flex-1 space-y-1 px-3">
        <button
          onClick={onHome}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
            active !== "past"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Briefcase className="h-4 w-4" /> Report an issue
        </button>
        <button
          onClick={onPast}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
            active === "past"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <History className="h-4 w-4" /> Recent queries
        </button>
      </nav>
      <div className="border-t p-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-semibold">
            {name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="text-xs text-muted-foreground">Store user</p>
          </div>
          <button
            onClick={onLogout}
            title="Sign out"
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function HomeGrid({
  storeCode,
  onPick,
  onPast,
}: {
  storeCode: string;
  onPick: (c: Category) => void;
  onPast: () => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Report a new issue
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            What do you need help with?
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a category. We'll ask for your store code, then open a quiet chat.
          </p>
        </div>
        {storeCode && (
          <span className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
            Store: <span className="font-mono text-foreground">{storeCode}</span>
          </span>
        )}
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((c) => {
          const Icon = ICONS[c];
          return (
            <button
              key={c}
              onClick={() => onPick(c)}
              className="group flex items-start gap-4 rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{c}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Report an issue in this area.
                </p>
              </div>
            </button>
          );
        })}
        <button
          onClick={onPast}
          className="group flex items-start gap-4 rounded-2xl border border-dashed bg-card/40 p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <History className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Recent queries</p>
            <p className="mt-1 text-xs text-muted-foreground">
              View all your active or resolved queries and alerts.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

function ChatView({
  category,
  storeCode,
  onBack,
  onSubmit,
}: {
  category: Category;
  storeCode: string;
  onBack: () => void;
  onSubmit: (a: Parameters<typeof createTicket>[0]["attachment"]) => void;
}) {
  const Icon = ICONS[category];
  return (
    <div>
      <button
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{category}</h1>
          <p className="text-sm text-muted-foreground">
            Store <span className="font-mono text-foreground">{storeCode}</span> · describe the issue below
          </p>
        </div>
      </div>
      <MediaComposer onSubmit={onSubmit} />
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Pick one input method per submission. Files up to 5MB.
      </p>
    </div>
  );
}

function RecentQueries({ storeCode }: { storeCode: string }) {
  const tickets = useStore(getTickets);
  const broadcasts = useStore(getBroadcasts);
  const [filter, setFilter] = useState(storeCode);

  const items = useMemo(() => {
    const code = filter.trim().toUpperCase();
    const filtered = tickets.filter(
      (t) => !code || t.storeCode === code,
    );
    const msgs = broadcasts.filter((b) => !code || b.storeCode === code);
    return { filtered, msgs };
  }, [tickets, broadcasts, filter]);

  async function handleClose(id: string) {
    await closeTicket(id);
    toast.success(`Query ${id} closed successfully.`);
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Recent queries</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Track your active issues, resolutions, and admin announcements.
      </p>
      <div className="mt-5 flex items-center gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value.toUpperCase())}
          placeholder="Filter by store code"
          className="w-full max-w-xs rounded-xl border bg-background px-3.5 py-2 text-sm font-mono uppercase outline-none ring-ring/30 focus:ring-2"
        />
      </div>

      {items.msgs.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Alerts from admin
          </h2>
          <div className="space-y-2">
            {items.msgs.map((b) => (
              <div key={b.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">{b.storeCode}</span>
                  <span>{new Date(b.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-foreground">{b.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Your Queries
        </h2>
        {items.filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/40 py-16 text-center text-sm text-muted-foreground">
            No queries found for this store code.
          </div>
        ) : (
          <div className="space-y-3">
            {items.filtered.map((t) => {
              const isClosed = t.status === "closed";
              const isUnderlying = t.status === "open" && t.replies.length > 0;
              const statusLabel = isClosed ? "Closed" : isUnderlying ? "Underlying Query" : "Opened";

              return (
                <details
                  key={t.id}
                  className="group rounded-2xl border bg-card shadow-sm transition hover:shadow-md"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{t.id}</span>
                        <span>·</span>
                        <span>{t.category}</span>
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-foreground">{t.title}</p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        isClosed
                          ? "bg-success/15"
                          : isUnderlying
                            ? "bg-warning/15 text-warning-foreground"
                            : "bg-primary/10 text-primary",
                      )}
                      style={
                        isClosed
                          ? { color: "oklch(0.45 0.13 160)" }
                          : isUnderlying
                            ? { color: "oklch(0.45 0.15 75)" }
                            : undefined
                      }
                    >
                      {statusLabel}
                    </span>
                  </summary>
                  <div className="border-t px-5 py-4">
                    <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Your report</p>
                    <AttachmentPreview a={t.attachment} />

                    {t.replies.length > 0 && (
                      <>
                        <p className="mt-4 mb-2 text-xs uppercase tracking-wide text-muted-foreground">Admin reply</p>
                        <div className="space-y-3">
                          {t.replies.map((r) => (
                            <div key={r.id} className="rounded-xl border bg-muted/20 p-3">
                              <AttachmentPreview a={r.attachment} />
                              <div className="mt-1 text-right text-[10px] text-muted-foreground">
                                {new Date(r.createdAt).toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {!isClosed && (
                      <div className="mt-6 border-t pt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            handleClose(t.id);
                          }}
                          className="rounded-xl border border-destructive bg-background px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive hover:text-destructive-foreground transition shadow-sm"
                        >
                          CLOSE THIS QUERY
                        </button>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border bg-card shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
