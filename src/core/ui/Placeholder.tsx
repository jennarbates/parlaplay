import { Link } from "react-router";

// Stand-in for screens that are built in later sprints.
export function Placeholder({ title }: { title: string }) {
  return (
    <section className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-stone-600">Coming soon.</p>
      <Link to="/" className="inline-flex min-h-11 min-w-11 items-center text-blue-700 underline">
        Home
      </Link>
    </section>
  );
}
