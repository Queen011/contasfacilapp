import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { ArrowLeft, Copy, Trash2, Keyboard as KeyboardIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/diagnostico")({
  component: DiagnosticoPage,
  head: () => ({
    meta: [
      { title: "Diagnóstico de Teclado — Contas Fácil" },
      { name: "description", content: "Ferramenta interna para diagnosticar problemas de foco e teclado no app." },
    ],
  }),
});

type LogEntry = { t: string; tag: string; msg: string };

const MAX_LOGS = 300;

function DiagnosticoPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeEl, setActiveEl] = useState<string>("—");
  const [viewport, setViewport] = useState({ w: 0, h: 0, vvW: 0, vvH: 0, vvOff: 0 });
  const [kbVisible, setKbVisible] = useState<boolean | null>(null);
  const [kbHeight, setKbHeight] = useState(0);
  const [nativeKeyboardBridge, setNativeKeyboardBridge] = useState(false);
  const [platformInfo, setPlatformInfo] = useState({ platform: "—", native: false, ua: "—" });

  useEffect(() => {
    setPlatformInfo({
      platform: Capacitor.getPlatform(),
      native: Capacitor.isNativePlatform(),
      ua: navigator.userAgent,
    });
    setNativeKeyboardBridge(
      Boolean((window as unknown as { ContasFacilKeyboard?: unknown }).ContasFacilKeyboard),
    );
  }, []);

  const log = useCallback((tag: string, msg: string) => {
    const t = new Date().toISOString().slice(11, 23);
    setLogs((prev) => {
      const next = [...prev, { t, tag, msg }];
      if (next.length > MAX_LOGS) next.splice(0, next.length - MAX_LOGS);
      return next;
    });
    // also surface to console for adb logcat / chrome inspect
    // eslint-disable-next-line no-console
    console.log(`[diag][${tag}] ${msg}`);
  }, []);

  // Track active element and viewport on tick
  useEffect(() => {
    const updateViewport = () => {
      const vv = window.visualViewport;
      setViewport({
        w: window.innerWidth,
        h: window.innerHeight,
        vvW: vv?.width ?? 0,
        vvH: vv?.height ?? 0,
        vvOff: vv?.offsetTop ?? 0,
      });
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);

    const interval = setInterval(() => {
      const el = document.activeElement;
      if (!el || el === document.body) setActiveEl("—");
      else {
        const tag = el.tagName.toLowerCase();
        const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : "";
        const name = el.getAttribute("name");
        setActiveEl(`${tag}${id}${name ? `[name=${name}]` : ""}`);
      }
    }, 400);

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
      clearInterval(interval);
    };
  }, []);

  // Subscribe to Capacitor Keyboard plugin events on native
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const { Keyboard } = await import("@capacitor/keyboard");
        const l1 = await Keyboard.addListener("keyboardWillShow", (info) => {
          setKbVisible(true);
          setKbHeight(info.keyboardHeight);
          log("kb", `willShow h=${info.keyboardHeight}`);
        });
        const l2 = await Keyboard.addListener("keyboardDidShow", (info) => {
          setKbVisible(true);
          setKbHeight(info.keyboardHeight);
          log("kb", `didShow h=${info.keyboardHeight}`);
        });
        const l3 = await Keyboard.addListener("keyboardWillHide", () => {
          log("kb", "willHide");
        });
        const l4 = await Keyboard.addListener("keyboardDidHide", () => {
          setKbVisible(false);
          setKbHeight(0);
          log("kb", "didHide");
        });
        cleanup = () => {
          l1.remove(); l2.remove(); l3.remove(); l4.remove();
        };
      } catch (err) {
        log("kb", `plugin error: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
    return () => cleanup?.();
  }, [log]);

  const attachInputProbe = useCallback(
    (label: string) =>
      ({
        onFocus: () => log("focus", `${label} focus`),
        onBlur: () => log("focus", `${label} blur`),
        onBeforeInput: (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          const native = e.nativeEvent as InputEvent;
          log("beforeInput", `${label} type=${native.inputType} data=${JSON.stringify(native.data)}`);
        },
        onInput: (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          const v = (e.target as HTMLInputElement).value;
          log("input", `${label} value="${v}"`);
        },
        onKeyDown: (e: React.KeyboardEvent) => {
          log("keydown", `${label} key="${e.key}" code=${e.code}`);
        },
        onCompositionStart: () => log("compose", `${label} start`),
        onCompositionEnd: (e: React.CompositionEvent) =>
          log("compose", `${label} end data="${e.data}"`),
      }) as const,
    [log],
  );

  const copyLogs = async () => {
    const header = [
      `Platform: ${platformInfo.platform} (native=${platformInfo.native})`,
      `UA: ${platformInfo.ua}`,
      `Viewport: ${viewport.w}x${viewport.h} | VV ${viewport.vvW}x${viewport.vvH} off=${viewport.vvOff}`,
      `Keyboard: visible=${kbVisible} height=${kbHeight}`,
      `Native keyboard bridge: ${nativeKeyboardBridge}`,
      "---",
    ].join("\n");
    const body = logs.map((l) => `${l.t} [${l.tag}] ${l.msg}`).join("\n");
    const text = `${header}\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Logs copiados");
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      toast.success("Logs copiados");
    }
  };

  const clearLogs = () => setLogs([]);

  const refUncontrolled = useRef<HTMLInputElement>(null);

  return (
    <div className="px-4 pt-6 pb-10">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/" className="grid place-items-center size-9 rounded-xl bg-secondary text-foreground">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Diagnóstico de teclado</h1>
          <p className="text-xs text-muted-foreground">Use para reproduzir problemas de foco/input.</p>
        </div>
      </div>

      {/* Status */}
      <section className="rounded-2xl border border-border bg-card p-4 mb-4 text-xs space-y-1">
        <div suppressHydrationWarning><b>Plataforma:</b> {platformInfo.platform} {platformInfo.native ? "(native)" : "(web)"}</div>
        <div><b>Ponte nativa do teclado:</b> {nativeKeyboardBridge ? "disponível" : "não detectada"}</div>
        <div className="break-words" suppressHydrationWarning><b>UA:</b> {platformInfo.ua}</div>
        <div><b>Viewport:</b> {viewport.w}×{viewport.h} | <b>VisualViewport:</b> {Math.round(viewport.vvW)}×{Math.round(viewport.vvH)} off={Math.round(viewport.vvOff)}</div>
        <div className="flex items-center gap-2">
          <KeyboardIcon size={14} className="text-primary" />
          <span><b>Teclado:</b> {kbVisible === null ? "—" : kbVisible ? `visível (h=${kbHeight})` : "oculto"}</span>
        </div>
        <div><b>Elemento focado:</b> <code className="bg-muted px-1 rounded">{activeEl}</code></div>
      </section>

      {/* Campos de teste */}
      <section className="rounded-2xl border border-border bg-card p-4 mb-4 space-y-3">
        <h2 className="text-sm font-bold">Campos de teste</h2>

        <label className="block">
          <span className="text-xs text-muted-foreground">1. Input shadcn (controlado)</span>
          <Input id="diag-shadcn" name="diag-shadcn" placeholder="Digite aqui…" {...attachInputProbe("shadcn")} />
        </label>

        <label className="block">
          <span className="text-xs text-muted-foreground">2. Input HTML nativo (não controlado)</span>
          <input
            ref={refUncontrolled}
            id="diag-native"
            name="diag-native"
            type="text"
            placeholder="Digite aqui…"
            autoCorrect="off"
            spellCheck={false}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            {...attachInputProbe("native")}
          />
        </label>

        <label className="block">
          <span className="text-xs text-muted-foreground">3. Numérico (inputmode=decimal)</span>
          <input
            id="diag-num"
            name="diag-num"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            {...attachInputProbe("numeric")}
          />
        </label>

        <label className="block">
          <span className="text-xs text-muted-foreground">4. Email</span>
          <input
            id="diag-email"
            name="diag-email"
            type="email"
            placeholder="voce@email.com"
            autoCapitalize="none"
            autoCorrect="off"
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            {...attachInputProbe("email")}
          />
        </label>

        <label className="block">
          <span className="text-xs text-muted-foreground">5. Senha</span>
          <input
            id="diag-pwd"
            name="diag-pwd"
            type="password"
            placeholder="••••••"
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            {...attachInputProbe("password")}
          />
        </label>

        <label className="block">
          <span className="text-xs text-muted-foreground">6. Textarea</span>
          <Textarea id="diag-ta" name="diag-ta" placeholder="Linhas de texto…" {...attachInputProbe("textarea")} />
        </label>

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => refUncontrolled.current?.focus()}
          >
            Forçar foco no #2
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => (document.activeElement as HTMLElement | null)?.blur()}
          >
            Tirar foco
          </Button>
        </div>
      </section>

      {/* Logs */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold">Logs ({logs.length})</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={copyLogs}>
              <Copy size={14} className="mr-1" /> Copiar
            </Button>
            <Button size="sm" variant="outline" onClick={clearLogs}>
              <Trash2 size={14} className="mr-1" /> Limpar
            </Button>
          </div>
        </div>
        <div className="font-mono text-[11px] leading-snug max-h-80 overflow-y-auto bg-muted/40 rounded-lg p-2 border border-border">
          {logs.length === 0 ? (
            <div className="text-muted-foreground p-2">
              Interaja com os campos acima para gerar eventos.
            </div>
          ) : (
            logs.slice().reverse().map((l, i) => (
              <div key={`${l.t}-${i}`} className="whitespace-pre-wrap break-words">
                <span className="text-muted-foreground">{l.t}</span>{" "}
                <span className="text-primary">[{l.tag}]</span> {l.msg}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
