/**
 * Milestone 1 placeholder — deliberately throwaway.
 *
 * The real landing page is milestone 10 (§11). This exists so that one glance at a
 * preview URL proves the whole toolchain worked: React mounted, Tailwind compiled,
 * the build deployed. It gets replaced wholesale, not extended.
 */
export function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className="w-full max-w-xl rounded-2xl bg-slate-900 p-8 shadow-2xl ring-1 ring-slate-800">
        <p className="text-xs font-semibold tracking-[0.2em] text-emerald-400 uppercase">
          Milestone 1 · Scaffold
        </p>

        <h1 className="mt-3 text-3xl font-bold text-balance">
          Code Concept Visualizer
        </h1>

        <p className="mt-3 text-slate-400">
          Write Python, watch it run — step by step, as an animation you
          control.
        </p>

        <p className="mt-6 border-t border-slate-800 pt-6 text-sm text-slate-500">
          If this box is dark, rounded, and centred, then React rendered and
          Tailwind compiled. The real landing page arrives in milestone 10.
        </p>
      </div>
    </main>
  );
}
