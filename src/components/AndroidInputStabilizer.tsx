import { useEffect } from "react";

const editableSelector =
  'input:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), select:not([disabled])';

function isEditableElement(element: Element | null) {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  );
}

function isTextEntryElement(element: Element) {
  if (element instanceof HTMLTextAreaElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return ["", "text", "email", "password", "search", "tel", "url", "number"].includes(
    element.type,
  );
}

export function AndroidInputStabilizer() {
  useEffect(() => {
    let active = true;
    const cleanups: Array<() => void> = [];

    const setup = async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!active || !Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;

      document.documentElement.classList.add("native-android-webview");

      const showKeyboard = async (target: Element) => {
        if (!isTextEntryElement(target)) return;
        const { Keyboard } = await import("@capacitor/keyboard");
        await Keyboard.show().catch(() => undefined);
      };

      const focusEditable = (target: Element) => {
        if (!isEditableElement(target)) return;
        requestAnimationFrame(() => {
          if (document.activeElement !== target) {
            target.focus({ preventScroll: false });
          }
          if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            try {
              const end = target.value.length;
              target.setSelectionRange(end, end);
            } catch {
              // Tipos nativos como date não aceitam seleção programática.
            }
          }
          window.setTimeout(() => target.scrollIntoView({ block: "center", inline: "nearest" }), 180);
          showKeyboard(target).catch(() => undefined);
        });
      };

      const pickEditable = (event: Event) => {
        const target = event.target instanceof Element ? event.target.closest(editableSelector) : null;
        if (target) focusEditable(target);
      };

      const onFocusIn = (event: FocusEvent) => {
        if (event.target instanceof Element && event.target.matches(editableSelector)) {
          window.setTimeout(() => focusEditable(event.target as Element), 80);
        }
      };

      document.addEventListener("pointerdown", pickEditable, true);
      document.addEventListener("touchend", pickEditable, true);
      document.addEventListener("focusin", onFocusIn, true);

      cleanups.push(() => document.removeEventListener("pointerdown", pickEditable, true));
      cleanups.push(() => document.removeEventListener("touchend", pickEditable, true));
      cleanups.push(() => document.removeEventListener("focusin", onFocusIn, true));
    };

    setup().catch(() => undefined);

    return () => {
      active = false;
      cleanups.forEach((cleanup) => cleanup());
      document.documentElement.classList.remove("native-android-webview");
    };
  }, []);

  return null;
}