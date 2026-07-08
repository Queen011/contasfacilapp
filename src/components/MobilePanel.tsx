import type { ReactNode } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MobilePanel({
  title,
  children,
  footer,
  onClose,
  className,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/45 px-3 pb-3 pt-16">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-panel-title"
        className={cn(
          "w-full max-w-md rounded-3xl border border-border bg-background shadow-[var(--shadow-elevated)] max-h-[86vh] overflow-hidden flex flex-col",
          className,
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 shrink-0">
          <h2 id="mobile-panel-title" className="text-base font-bold truncate">
            {title}
          </h2>
          <Button type="button" variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </Button>
        </header>
        <div className="overflow-y-auto px-4 py-4 flex-1">{children}</div>
        {footer && <footer className="border-t border-border p-4 shrink-0">{footer}</footer>}
      </section>
    </div>
  );
}