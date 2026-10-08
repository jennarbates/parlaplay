// While / waits for the last language (platform spec 4.3 rule 0), and while a
// language's module loads on a first visit (8.2).
export function Skeleton() {
  return <div aria-busy="true" className="flex-1" />;
}
