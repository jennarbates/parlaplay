import type { KeyboardEvent, MouseEvent } from "react";

// Desktop spec DS 9.6: every dialog closes on a click on its backdrop. A click on
// the backdrop targets the <dialog> itself but lands outside its box; a click on
// the dialog's own padding is inside the box and is not a backdrop click.
export function onBackdropClick(close: () => void) {
  return (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    const inside =
      e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) close();
  };
}

// For a button that takes focus on its own (a dialog's default, the round end's
// Play again): a key still held from the screen before must not press it. Enter
// presses a button on every keydown, repeats included, so one long press on a card
// while guessing would also confirm the guess and start the next round.
export function ignoreHeldEnter(e: KeyboardEvent) {
  if (e.repeat && e.key === "Enter") e.preventDefault();
}
