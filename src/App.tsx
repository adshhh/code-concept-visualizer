import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router-dom";
import { Landing } from "./routes/Landing";

/** §11: real routing (React Router, m10) — `/` is the landing page, `/lesson/:id` is a
 * specific lesson. `Workspace` is lazy-loaded so its own bundle (CodeMirror, Comlink, the
 * engine) never has to download or parse before the landing page's first paint — AC-2.2
 * needs this to be a bundle-splitting fact, not just "nothing on `/` calls run()". */
const Workspace = lazy(() =>
  import("./Workspace").then((module) => ({ default: module.Workspace })),
);

/** React Router reuses one mounted `/lesson/:id` element across param changes rather than
 * remounting it (a well-known gotcha) — without this, navigating from one lesson straight to
 * another (nothing does that yet, but nothing should have to know not to) would keep the
 * previous lesson's `source`/`result`/`inputValues`/engine-check state mounted, showing stale
 * code under the new lesson's title. Found by code review. `key={id}` forces a clean remount
 * per lesson, so `Workspace` itself doesn't need to hand-reset a dozen pieces of state. */
function LessonRoute() {
  const { id } = useParams<{ id: string }>();
  return <Workspace key={id} />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/lesson/:id"
          element={
            <Suspense
              fallback={
                <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
                  Loading…
                </div>
              }
            >
              <LessonRoute />
            </Suspense>
          }
        />
        {/* Found by code review: with no catch-all, an unmatched path (a stale bookmark, a
            typo like /lessons/... ) rendered nothing — a blank page with no way to recover
            short of manually editing the URL. Sends anyone lost back to the one page that
            always works. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
