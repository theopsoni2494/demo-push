import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getSession } from "@/lib/tracker-store";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Serenity Desk" }] }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    const s = getSession();
    if (!s) navigate({ to: "/auth", replace: true });
    else if (s.role === "admin") navigate({ to: "/admin", replace: true });
    else navigate({ to: "/dashboard", replace: true });
  }, [navigate]);
  return null;
}
