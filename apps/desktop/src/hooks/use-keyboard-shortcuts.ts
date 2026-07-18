import { useEffect } from "react";

type ShortcutMap = Record<string, () => void>;

/**
 * Global keyboard shortcuts. Suppressed when user is typing in an input/textarea.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;

      const mod = e.metaKey || e.ctrlKey;
      const key = `${mod ? "Cmd+" : ""}${e.key}`;

      const fn = shortcuts[key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}
