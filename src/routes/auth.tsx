import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { setSession } from "@/lib/tracker-store";
import { LifeBuoy, ShieldCheck, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Issue Tracker" },
      { name: "description", content: "Sign in to the issue tracker." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const u = username.trim().toLowerCase();
    if ((u === "admin" && password === "admin") || u === "admin") {
      setSession({ role: "admin", name: "Admin" });
      navigate({ to: "/admin" });
      return;
    }
    if (u === "user" || u.length > 0) {
      setSession({ role: "user", name: username || "User" });
      navigate({ to: "/dashboard" });
      return;
    }
    toast.error("Enter credentials");
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-primary/10 via-accent/30 to-background p-12 lg:flex">
        <div className="flex items-center gap-2 text-foreground">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <LifeBuoy className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Serenity Desk</span>
        </div>
        <div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-foreground">
            A calm place to report,<br />resolve, and reply.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            One unified inbox for every store. Report issues with text, voice, video, or files —
            and get resolutions delivered back with clarity.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Serenity Desk</p>
      </div>

      <div className="flex w-full items-center justify-center bg-background p-6 lg:w-1/2">
        <form
          onSubmit={submit}
          className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm"
        >
          <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to continue to your dashboard.
          </p>

          <div className="mt-6 space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="user or admin"
                className="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none ring-ring/30 transition focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none ring-ring/30 transition focus:ring-2"
              />
            </div>
          </div>

          <button
            type="submit"
            className="mt-6 w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
          >
            Sign in
          </button>

          <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setUsername("user");
                setPassword("user");
              }}
              className="flex items-center justify-center gap-1.5 rounded-lg border bg-background py-2 text-muted-foreground transition hover:bg-muted"
            >
              <UserIcon className="h-3.5 w-3.5" /> User demo
            </button>
            <button
              type="button"
              onClick={() => {
                setUsername("admin");
                setPassword("admin");
              }}
              className="flex items-center justify-center gap-1.5 rounded-lg border bg-background py-2 text-muted-foreground transition hover:bg-muted"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Admin demo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
