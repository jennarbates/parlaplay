// Desktop spec DS 4.3, steps 1 to 3: whether a key press may be a game shortcut at
// all, before any game looks it up in its own table. Pure: it reads nothing but
// its arguments.
export type KeyLike = {
  key: string; // KeyboardEvent.key
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  targetTag: string; // "INPUT", "TEXTAREA", "BUTTON", "LI", ...
  targetEditable: boolean; // isContentEditable
};

export function mayBeShortcut(k: KeyLike, dialogOpen: boolean): boolean {
  // 1. Browser and system shortcuts. Shift is allowed: ? needs it.
  if (k.ctrlKey || k.metaKey || k.altKey) return false;
  // 2. Typing.
  if (k.targetTag === "INPUT" || k.targetTag === "TEXTAREA" || k.targetTag === "SELECT")
    return false;
  if (k.targetEditable) return false;
  // 3. A dialog has its own keys.
  return !dialogOpen;
}

// Step 4's key: letters match in either case.
export const shortcutKey = (k: KeyLike) => (k.key.length === 1 ? k.key.toLowerCase() : k.key);
