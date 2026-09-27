import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  PackageSearch,
  AlertTriangle,
  Banknote,
  Calculator,
  Upload,
  Plug,
  LogOut,
} from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/dashboard", label: "اللوحة", icon: LayoutDashboard },
  { to: "/orders", label: "الأوردرات", icon: PackageSearch },
  { to: "/review", label: "يحتاج انتباهك", icon: AlertTriangle },
  { to: "/payouts", label: "التحويلات", icon: Banknote },
  { to: "/pricing", label: "جدول الأسعار", icon: Calculator },
  { to: "/import", label: "استيراد", icon: Upload },
  { to: "/connect", label: "ربط بوسطة", icon: Plug },
] as const;

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">
              ت
            </span>
            <span className="text-base font-bold text-foreground">تسوية</span>
          </Link>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="size-4" />
            خروج
          </button>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 pb-2">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}
            >
              <n.icon className="size-4" />
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="mb-5 text-2xl font-bold text-foreground">{title}</h1>
        {children}
      </main>
    </div>
  );
}
