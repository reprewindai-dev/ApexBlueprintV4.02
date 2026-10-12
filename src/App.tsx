import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Github, Loader2, Settings2, Trash2, X } from "lucide-react";
import type { PlanRecord } from "./plan/plan";
import { requestPlan, type PlanRequest } from "./app/api";
import { deletePlan, loadPlans, savePlan } from "./app/history";
import { isReady, loadSettings, saveSettings, settingsLabel, type ModelSettings } from "./app/settings";
import { EXAMPLES, PROJECT_TYPES } from "./ui/examples";
import { PlanView } from "./ui/PlanView";
import { SettingsDialog } from "./ui/SettingsDialog";

type View = { kind: "compose" } | { kind: "working"; startedAt: number } | { kind: "plan"; id: string };

const planIdFromHash = () => (window.location.hash.match(/^#plan=([\w-]+)$/) || [])[1];

function elapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function App() {
  const [settings, setSettings] = useState<ModelSettings | null>(loadSettings);
  const [plans, setPlans] = useState<PlanRecord[]>(loadPlans);
  const [view, setView] = useState<View>(() => {
    const id = planIdFromHash();
    return id && loadPlans().some((p) => p.id === id) ? { kind: "plan", id } : { kind: "compose" };
  });
  const [notes, setNotes] = useState("");
  const [projectType, setProjectType] = useState(PROJECT_TYPES[0]);
  const [repoUrl, setRepoUrl] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState<{ reason?: string; then?: (s: ModelSettings) => void } | null>(null);
  const [now, setNow] = useState(Date.now());
  const runId = useRef(0);

  // Browser back/forward between the composer and a plan.
  useEffect(() => {
    const onHash = () => {
      const id = planIdFromHash();
      setView((v) => (v.kind === "working" ? v : id && loadPlans().some((p) => p.id === id) ? { kind: "plan", id } : { kind: "compose" }));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (view.kind !== "working") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [view.kind]);

  const openPlan = (id: string) => {
    window.location.hash = `plan=${id}`;
    setView({ kind: "plan", id });
    window.scrollTo(0, 0);
  };
  const goCompose = () => {
    history.pushState(null, "", window.location.pathname);
    setView({ kind: "compose" });
    window.scrollTo(0, 0);
  };

  const run = useCallback(
    async (req: PlanRequest, s: ModelSettings) => {
      const id = ++runId.current;
      setError(null);
      setView({ kind: "working", startedAt: Date.now() });
      setNow(Date.now());
      window.scrollTo(0, 0);
      try {
        const record = await requestPlan(req, s);
        if (id !== runId.current) return;
        setPlans(savePlan(record));
        openPlan(record.id);
      } catch (err) {
        if (id !== runId.current) return;
        setError((err as Error).message);
        setView({ kind: "compose" });
      }
    },
    [],
  );

  const generate = (req: PlanRequest = { notes, projectType: projectType === PROJECT_TYPES[0] ? undefined : projectType, repoUrl }) => {
    if (!req.notes.trim()) {
      setError("Add some notes first.");
      return;
    }
    if (!isReady(settings)) {
      setSettingsOpen({
        reason: "Choose the AI that will write your plan. You only need to do this once.",
        then: (saved) => run(req, saved),
      });
      return;
    }
    run(req, settings);
  };

  const cancel = () => {
    runId.current++;
    setView({ kind: "compose" });
  };

  const current = view.kind === "plan" ? plans.find((p) => p.id === view.id) : undefined;

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <button onClick={goCompose} className="flex items-center gap-2 font-semibold tracking-tight" aria-label="Apex home">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm font-bold text-accent-ink">A</span>
            Apex
          </button>
          <button
            onClick={() => setSettingsOpen({})}
            className="inline-flex max-w-[60%] items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:bg-raised hover:text-ink"
          >
            <Settings2 size={15} className="shrink-0" />
            <span className="truncate">{isReady(settings) ? settingsLabel(settings) : "Choose a model"}</span>
          </button>
        </div>
      </header>

      {view.kind === "working" && (
        <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
          <Loader2 size={28} className="apex-spin text-accent" />
          <h1 className="mt-6 text-xl font-semibold">Writing your plan</h1>
          <p className="mt-2 text-muted">
            {settings ? settingsLabel(settings) : "The model"} is reading your notes and planning features, architecture and build steps.
          </p>
          <p className="mt-6 font-mono text-2xl tabular-nums">{elapsed(now - view.startedAt)}</p>
          <p className="mt-2 text-sm text-faint">
            Usually under two minutes{settings?.provider === "ollama" ? "; local models can take much longer" : ""}.
          </p>
          <button onClick={cancel} className="mt-8 text-sm text-muted hover:text-ink">
            Cancel
          </button>
        </main>
      )}

      {view.kind === "plan" && current && (
        <PlanView
          record={current}
          onEdit={() => {
            setNotes(current.notes);
            goCompose();
          }}
          onRegenerate={() => generate({ notes: current.notes })}
          onNew={() => {
            setNotes("");
            goCompose();
          }}
        />
      )}

      {(view.kind === "compose" || (view.kind === "plan" && !current)) && (
        <main className="mx-auto max-w-3xl px-4 pb-24 pt-12 sm:px-6 sm:pt-20">
          <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl">Turn messy notes into a plan you can build.</h1>
          <p className="mt-4 max-w-2xl text-pretty text-lg text-muted">
            Paste anything: bullet points, a voice-memo transcript, half an idea. Apex writes the features, architecture and build steps, and tells you what you
            still need to decide.
          </p>

          <div className="mt-8 rounded-2xl border border-line bg-surface focus-within:border-faint">
            <label htmlFor="notes" className="sr-only">
              Your notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
              }}
              placeholder="e.g. app for dog walkers. owners book walks, pay by card, walkers get rated. start in Austin. me + 1 dev, 2 months…"
              className="block min-h-[260px] w-full resize-y rounded-t-2xl bg-transparent p-5 text-base leading-relaxed text-ink placeholder:text-faint focus:outline-none"
            />
            {showContext && (
              <div className="grid gap-4 border-t border-line p-5 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium">What are you building?</span>
                  <select
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                    className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  >
                    {PROJECT_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 flex items-center gap-1.5 font-medium">
                    <Github size={14} /> Existing code <span className="font-normal text-muted">(public repo)</span>
                  </span>
                  <input
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="github.com/you/project"
                    spellCheck={false}
                    className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm placeholder:text-faint focus:border-accent focus:outline-none"
                  />
                </label>
              </div>
            )}
            <div className="flex flex-col gap-3 border-t border-line p-3 sm:flex-row sm:items-center sm:justify-between">
              <button onClick={() => setShowContext((v) => !v)} className="inline-flex items-center gap-1.5 px-2 text-sm text-muted hover:text-ink" aria-expanded={showContext}>
                {showContext ? <X size={14} /> : <ChevronDown size={14} />}
                {showContext ? "Hide details" : "Add details (optional)"}
              </button>
              <button
                onClick={() => generate()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink hover:brightness-110"
              >
                Write my plan <ArrowRight size={17} />
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="mt-4 rounded-xl border border-bad/40 bg-bad/10 p-4 text-sm text-bad">
              <p>{error}</p>
              <button onClick={() => setSettingsOpen({})} className="mt-2 text-ink underline-offset-2 hover:underline">
                Check model settings
              </button>
            </div>
          )}

          {!notes.trim() && (
            <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-faint">Try an example:</span>
              {EXAMPLES.map((ex) => (
                <button key={ex.label} onClick={() => setNotes(ex.notes)} className="rounded-full border border-line px-3 py-1 text-muted hover:border-faint hover:text-ink">
                  {ex.label}
                </button>
              ))}
            </div>
          )}

          {plans.length > 0 && (
            <section className="mt-16">
              <h2 className="text-sm font-semibold text-muted">Your plans</h2>
              <p className="mt-1 text-xs text-faint">Saved in this browser only.</p>
              <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
                {plans.map((p) => (
                  <li key={p.id} className="group flex items-center gap-3">
                    <button onClick={() => openPlan(p.id)} className="min-w-0 flex-1 px-4 py-3 text-left hover:bg-surface">
                      <p className="truncate font-medium">{p.plan.title || "Untitled plan"}</p>
                      <p className="truncate text-xs text-faint">
                        {new Date(p.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })} · {p.model}
                      </p>
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete "${p.plan.title || "Untitled plan"}"?`)) setPlans(deletePlan(p.id));
                      }}
                      className="mr-3 rounded-md p-2 text-faint hover:bg-raised hover:text-bad"
                      aria-label={`Delete ${p.plan.title || "plan"}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>
      )}

      {settingsOpen && (
        <SettingsDialog
          initial={settings}
          reason={settingsOpen.reason}
          onClose={() => setSettingsOpen(null)}
          onSave={(s) => {
            saveSettings(s);
            setSettings(s);
            const then = settingsOpen.then;
            setSettingsOpen(null);
            then?.(s);
          }}
        />
      )}
    </div>
  );
}
