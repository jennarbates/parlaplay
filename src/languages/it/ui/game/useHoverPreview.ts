import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { previewSpot, type PreviewSpot } from "./boardLayout.ts";

const delay = 350; // ms the pointer rests on a card before the preview shows
const swapWindow = 150; // ms after one preview hides in which the next shows at once

// Desktop spec DS 7.2: which card's preview shows, and where. It shows after the
// mouse rests on a card, hides when it leaves, and swaps at once when it moves
// straight to the next card. Any click, key or right-click hides it, so it is
// gone before a dialog opens; it never shows while a dialog is open.
export function useHoverPreview(enabled: boolean, area: RefObject<HTMLElement | null>) {
  const [preview, setPreview] = useState<{ id: string; spot: PreviewSpot }>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const open = useRef(false);
  const hiddenAt = useRef(-Infinity);
  const allowed = useRef(enabled);
  useEffect(() => {
    allowed.current = enabled;
    if (!enabled) clearTimeout(timer.current);
  }, [enabled]);

  const show = (id: string, card: Element) => {
    const board = area.current;
    if (!allowed.current || !board || document.querySelector("dialog[open]")) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    open.current = true;
    setPreview({
      id,
      spot: previewSpot(card.getBoundingClientRect(), board.getBoundingClientRect(), rem),
    });
  };

  const hide = () => {
    clearTimeout(timer.current);
    if (open.current) hiddenAt.current = performance.now();
    open.current = false;
    setPreview(undefined);
  };

  // While it is open, anything the learner does hides it.
  useEffect(() => {
    if (!preview) return;
    const events = ["pointerdown", "keydown", "contextmenu"] as const;
    for (const e of events) document.addEventListener(e, hide, true);
    return () => {
      for (const e of events) document.removeEventListener(e, hide, true);
    };
  }, [preview]);

  return {
    // Hidden, not just unrendered, the moment it stops being allowed.
    preview: enabled ? preview : undefined,
    handlers: (id: string) => ({
      onPointerEnter(e: PointerEvent<HTMLElement>) {
        if (!allowed.current || e.pointerType !== "mouse") return;
        const card = e.currentTarget;
        clearTimeout(timer.current);
        if (performance.now() - hiddenAt.current < swapWindow) show(id, card);
        else timer.current = setTimeout(() => show(id, card), delay);
      },
      onPointerLeave: hide,
    }),
  };
}
