import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Github, Settings2, Trash2, X } from "lucide-react";
import type { PlanRecord } from "./plan/plan";
import { requestPlan, type PlanRequest } from "./app/api";
import { deletePlan, loadPlans, savePlan } from "./app/history";
import { isReady, loadSettings, saveSettings, settingsLabel, type ModelSettings } from "./app/settings";
import { OllamaConnectionError } from "./app/ollama";
import { EXAMPLES, PROJECT_TYPES } from "./ui/examples";
import { OllamaHelp } from "./ui/OllamaHelp";
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
  const [ollamaBlocked, setOllamaBlocked] = useState(false);
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
        setOllamaBlocked(err instanceof OllamaConnectionError);
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
      <header className="no-print sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <button onClick={goCompose} className="flex items-center gap-3" aria-label="Apex home">
            <span className="text-[15px] font-black uppercase tracking-tight">
              Apex<span className="text-accent glow"> Blueprint</span>
            </span>
            <span className="tag hidden border border-line px-1.5 py-0.5 text-faint sm:inline">by Veklom</span>
          </button>
          <button
            onClick={() => setSettingsOpen({})}
            className="tag inline-flex max-w-[62%] items-center gap-2 border border-line bg-surface px-3 py-2 text-muted hover:border-accent/60 hover:text-ink"
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isReady(settings) ? "dot bg-accent" : "bg-faint"}`} />
            <span className="hidden sm:inline text-faint">Engine:</span>
            <span className="truncate">{isReady(settings) ? settingsLabel(settings) : "Not set"}</span>
            <Settings2 size={13} className="shrink-0" />
          </button>
        </div>
      </header>

      {view.kind === "working" && (
        <main className="mx-auto flex min-h-[78vh] max-w-xl flex-col items-center justify-center px-6 text-center">
          <p className="tag text-accent">
            <span className="apex-pulse">●</span> Status: compiling
          </p>
          <h1 className="mt-5 text-4xl font-black uppercase tracking-tight sm:text-5xl">
            Writing your <span className="text-accent glow">plan</span>
          </h1>
          <p className="mt-4 text-muted">
            {settings ? settingsLabel(settings) : "The model"} is reading your notes and planning features, architecture and build steps.
          </p>
          <p className="mt-8 font-mono text-5xl font-semibold tabular-nums text-accent glow">{elapsed(now - view.startedAt)}</p>
          <div className="relative mt-6 h-px w-64 overflow-hidden bg-line">
            <div className="apex-scan absolute inset-y-0 w-1/4 bg-accent" />
          </div>
          <p className="tag mt-6 text-faint">
            Usually under two minutes{settings?.provider === "ollama" ? " · local models take longer" : ""}
          </p>
          <button onClick={cancel} className="tag mt-10 border border-line px-4 py-2 text-muted hover:border-bad/60 hover:text-bad">
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
        <main className="mx-auto max-w-4xl px-4 pb-24 pt-14 sm:px-6 sm:pt-20">
          <p className="tag text-center text-accent">[ Messy notes → build-ready plan ]</p>
          <h1 className="mt-5 text-center text-[2.6rem] font-black uppercase leading-[0.95] tracking-tight sm:text-7xl">
            Turn messy notes into
            <span className="mt-1 block text-accent glow">build-ready plans</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-center text-base text-muted sm:text-lg">
            Paste anything: bullet points, a voice-memo transcript, half an idea. Get the features, architecture and build steps, plus the decisions you still
            need to make.
          </p>

          <div className="mt-10 border border-line bg-surface/90 focus-within:border-accent/50 focus-within:glow-box">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <label htmlFor="notes" className="tag text-ink">
                [ Your notes ]
              </label>
              <span className="tag text-faint">{notes.length.toLocaleString()} chars</span>
            </div>
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
              className="block min-h-[260px] w-full resize-y bg-transparent p-4 font-mono text-[15px] leading-relaxed text-ink placeholder:text-faint focus:outline-none"
            />
            {showContext && (
              <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2">
                <label className="block">
                  <span className="tag mb-2 block text-muted">What are you building?</span>
                  <select
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                    className="w-full border border-line bg-bg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  >
                    {PROJECT_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="tag mb-2 flex items-center gap-1.5 text-muted">
                    <Github size={13} /> Existing code (public repo)
                  </span>
                  <input
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="github.com/you/project"
                    spellCheck={false}
                    className="w-full border border-line bg-bg px-3 py-2 font-mono text-sm placeholder:text-faint focus:border-accent focus:outline-none"
                  />
                </label>
              </div>
            )}
            <div className="flex flex-col gap-3 border-t border-line p-3 sm:flex-row sm:items-center sm:justify-between">
              <button onClick={() => setShowContext((v) => !v)} className="tag inline-flex items-center gap-1.5 px-2 py-1 text-muted hover:text-ink" aria-expanded={showContext}>
                {showContext ? <X size={13} /> : <ChevronDown size={13} />}
                {showContext ? "Hide details" : "Add details (optional)"}
              </button>
              <button
                onClick={() => generate()}
                className="glow-btn inline-flex items-center justify-center gap-2 bg-accent px-6 py-3 font-mono text-sm font-bold uppercase tracking-[0.14em] text-accent-ink transition hover:brightness-110"
              >
                Write my plan <ArrowRight size={17} />
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="mt-4 border border-bad/50 bg-bad/10 p-4 text-sm text-bad">
              <p className="tag mb-1">[ Error ]</p>
              <p>{error}</p>
              <button onClick={() => setSettingsOpen({})} className="tag mt-3 text-ink underline-offset-4 hover:underline">
                Check engine settings
              </button>
              {ollamaBlocked && (
                <div className="mt-4">
                  <OllamaHelp />
                </div>
              )}
            </div>
          )}

          {!notes.trim() && (
            <div className="mt-10">
              <p className="tag text-faint">/ Or start from an example</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    onClick={() => setNotes(ex.notes)}
                    className="group border border-line bg-surface/80 p-4 text-left transition hover:border-accent/60"
                  >
                    <p className="text-sm font-bold uppercase tracking-tight group-hover:text-accent">{ex.label}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted">{ex.blurb}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {plans.length > 0 && (
            <section className="mt-16">
              <div className="flex items-baseline justify-between">
                <h2 className="tag text-ink">[ Your plans ]</h2>
                <p className="tag text-faint">Saved in this browser</p>
              </div>
              <ul className="mt-3 divide-y divide-line border border-line bg-surface/80">
                {plans.map((p) => (
                  <li key={p.id} className="group flex items-center gap-3">
                    <button onClick={() => openPlan(p.id)} className="min-w-0 flex-1 px-4 py-3 text-left hover:bg-raised">
                      <p className="truncate font-bold uppercase tracking-tight group-hover:text-accent">{p.plan.title || "Untitled plan"}</p>
                      <p className="tag mt-1 truncate text-faint">
                        {new Date(p.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })} · {p.model}
                      </p>
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete "${p.plan.title || "Untitled plan"}"?`)) setPlans(deletePlan(p.id));
                      }}
                      className="mr-3 p-2 text-faint hover:text-bad"
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
