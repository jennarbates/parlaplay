import { useRef, type PointerEvent } from "react";

// A long press opens something; a short tap still clicks. After a long press the
// click that follows is swallowed, so it does not also flip the card. Right-click
// and the keyboard's context menu key open it too (desktop spec DS 7.3).
export function useLongPress(onLongPress: () => void, ms = 450) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | undefined>(undefined);
  const fired = useRef(false);
  const pressing = useRef(false);

  const cancel = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    pressing.current = false;
  };

  return {
    onPointerDown(e: PointerEvent) {
      // Only the main button presses; a right-click is handled by onContextMenu.
      if (e.button !== 0) return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      cancel();
      pressing.current = true;
      timer.current = setTimeout(() => {
        fired.current = true;
        onLongPress();
      }, ms);
    },
    onPointerMove(e: PointerEvent) {
      // A scroll or drag is not a press.
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu(e: { preventDefault: () => void }) {
      e.preventDefault();
      // A touch long-press can also raise contextmenu: open once, not twice.
      if (fired.current && pressing.current) return;
      if (pressing.current) {
        // Mid-press (touch): this is the long press, so swallow the click after it.
        clearTimeout(timer.current);
        fired.current = true;
      }
      onLongPress();
    },
    // Call at the top of onClick: true means this click ends a long press.
    consumeLongPress(): boolean {
      const was = fired.current;
      fired.current = false;
      return was;
    },
  };
}
