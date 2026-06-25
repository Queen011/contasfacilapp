import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Clock, CheckCircle2, Plus, Keyboard } from "lucide-react";

const items = [
  { to: "/", label: "Início", icon: Home },
  { to: "/pendentes", label: "Pendentes", icon: Clock },
  { to: "/nova", label: "Nova", icon: Plus, primary: true },
  { to: "/pagas", label: "Pagas", icon: CheckCircle2 },
  { to: "/diagnostico", label: "Teclado", icon: Keyboard },
];

export function BottomNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5 gap-1 px-2 pt-2 pb-2 max-w-2xl mx-auto">
        {items.map((it) => {
          const active = path === it.to;
          const Icon = it.icon;
          if (it.primary) {
            return (
              <li key={it.to} className="flex justify-center">
                <Link
                  to={it.to}
                  className="-mt-6 grid place-items-center h-14 w-14 rounded-2xl text-primary-foreground shadow-lg"
                  style={{ background: "var(--gradient-primary)" }}
                  aria-label={it.label}
                >
                  <Icon size={26} strokeWidth={2.4} />
                </Link>
              </li>
            );
          }
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                className={`flex flex-col items-center gap-0.5 py-1.5 text-[11px] rounded-xl transition ${
                  active ? "text-primary font-semibold" : "text-muted-foreground"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
