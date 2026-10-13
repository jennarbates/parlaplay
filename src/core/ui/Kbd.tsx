// Desktop spec DS 6.2: a button's shortcut key, shown on its right at lg. Screen
// readers get it from the button's aria-keyshortcuts instead.
export function Kbd({ children }: { children: string }) {
  return (
    <kbd
      aria-hidden="true"
      className="ml-2 rounded border border-current/30 px-1.5 py-0.5 font-sans text-xs font-medium opacity-70"
    >
      {children}
    </kbd>
  );
}
