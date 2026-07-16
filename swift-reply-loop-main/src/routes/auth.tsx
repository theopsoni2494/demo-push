import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { LifeBuoy, ShieldCheck, User as UserIcon, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Serenity Desk" },
      { name: "description", content: "Sign in to the issue tracker." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      return toast.error("Please fill in email and password");
    }

    const trimmedEmail = email.trim().toLowerCase();
    const isEmailAdmin = trimmedEmail.endsWith("admin.com") || trimmedEmail.endsWith("@admin.com");
    const resolvedRole = isEmailAdmin ? "admin" : "user";

    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password: password,
          options: {
            data: {
              name: fullName.trim() || trimmedEmail.split("@")[0],
              role: resolvedRole,
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          toast.success("Account created and logged in!");
          navigate({ to: resolvedRole === "admin" ? "/admin" : "/dashboard" });
        } else {
          toast.success("Account registered! verification link has been sent to your email.");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: password,
        });

        if (error) throw error;

        toast.success("Signed in successfully!");
        
        // Fetch role to route
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();

        navigate({ to: profile?.role === "admin" ? "/admin" : "/dashboard" });
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin(role: "user" | "admin") {
    // For admin, use an email ending in admin.com to trigger the automatic admin rule
    const demoEmail = role === "admin" ? "admin@admin.com" : "user@demo.com";
    const demoPass = "demopassword";
    
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPass,
      });

      if (error) {
        toast.info(`Creating standard demo ${role} account...`);
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: demoEmail,
          password: demoPass,
          options: {
            data: {
              name: role === "admin" ? "Demo Admin" : "Demo User",
              role: role,
            },
          },
        });
        
        if (signUpError) throw signUpError;
        
        // Retry sign in
        const { error: retryError } = await supabase.auth.signInWithPassword({
          email: demoEmail,
          password: demoPass,
        });
        
        if (retryError) throw retryError;
        
        toast.success(`Demo ${role} signed in successfully!`);
        navigate({ to: role === "admin" ? "/admin" : "/dashboard" });
      } else {
        toast.success(`Demo ${role} signed in!`);
        navigate({ to: role === "admin" ? "/admin" : "/dashboard" });
      }
    } catch (err: any) {
      toast.error(err.message || "Demo login failed");
    } finally {
      setLoading(false);
    }
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
          <h2 className="text-2xl font-semibold tracking-tight">
            {isSignUp ? "Create an account" : "Welcome back"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignUp ? "Register your store account below." : "Sign in to continue to your dashboard."}
          </p>

          <div className="mt-6 space-y-3">
            {isSignUp && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Full Name
                </label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  required
                  className="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none ring-ring/30 transition focus:ring-2"
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none ring-ring/30 transition focus:ring-2"
              />
              {isSignUp && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Emails ending with <span className="font-semibold text-foreground">admin.com</span> will automatically receive Admin rights.
                </p>
              )}
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
                required
                className="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none ring-ring/30 transition focus:ring-2"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Authenticating..." : isSignUp ? "Sign Up" : "Sign In"}
          </button>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition"
            >
              {isSignUp ? (
                <>
                  <LogIn className="h-3 w-3" /> Already have an account? Sign In
                </>
              ) : (
                <>
                  <UserPlus className="h-3 w-3" /> Don't have an account? Sign Up
                </>
              )}
            </button>
          </div>

          <div className="mt-6 border-t pt-4 grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleDemoLogin("user")}
              className="flex items-center justify-center gap-1.5 rounded-lg border bg-background py-2 text-muted-foreground transition hover:bg-muted"
            >
              <UserIcon className="h-3.5 w-3.5" /> User demo
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleDemoLogin("admin")}
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
