import { useEffect, useState, type ReactNode } from "react";
import { Bot, Check, ChevronDown, Copy, Download, FileText, Pencil, Printer, RotateCcw } from "lucide-react";
import type { Level, Plan, PlanRecord, Priority } from "../plan/plan";
import { fileSlug, planToAgentBrief, planToMarkdown } from "../plan/export";

const PRIORITY: Record<Priority, { label: string; cls: string }> = {
  must: { label: "Must have", cls: "border-accent/40 bg-accent/10 text-accent" },
  should: { label: "Should have", cls: "border-line bg-raised text-ink" },
  later: { label: "Later", cls: "border-line text-muted" },
};
const IMPACT: Record<Level, string> = {
  high: "border-bad/40 bg-bad/10 text-bad",
  medium: "border-warn/40 bg-warn/10 text-warn",
  low: "border-line text-muted",
};

function download(name: string, text: string, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function useCopied(): [string | null, (key: string, text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(key);
        setTimeout(() => setCopied(null), 1800);
      },
      () => download(`${key}.md`, text),
    );
  };
  return [copied, copy];
}

function Section(props: { id: string; title: string; children: ReactNode; hidden?: boolean }) {
  if (props.hidden) return null;
  return (
    <section id={props.id} className="scroll-mt-24 border-t border-line py-8 first:border-t-0 first:pt-0">
      <h2 className="mb-4 text-lg font-semibold tracking-tight">{props.title}</h2>
      {props.children}
    </section>
  );
}

const Chip = ({ children, cls }: { children: ReactNode; cls: string }) => (
  <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>
);

function sections(p: Plan) {
  return [
    { id: "overview", title: "Overview", show: !!(p.summary.problem || p.summary.solution || p.users.length) },
    { id: "features", title: "Features", show: p.features.length > 0 },
    { id: "flows", title: "User flows", show: p.userFlows.length > 0 },
    { id: "architecture", title: "Architecture", show: !!p.architecture.overview || p.architecture.components.length > 0 },
    { id: "data", title: "Data model", show: p.dataModel.length > 0 },
    { id: "api", title: "API", show: p.api.length > 0 },
    { id: "build", title: "Build plan", show: p.milestones.length > 0 },
    { id: "risks", title: "Risks", show: p.risks.length > 0 },
    { id: "business", title: "Business", show: !!(p.business.pricing || p.business.goToMarket || p.business.successMetrics.length) },
    { id: "assumptions", title: "Assumptions", show: p.assumptions.length > 0 },
  ].filter((s) => s.show);
}

export function PlanView(props: { record: PlanRecord; onEdit: () => void; onRegenerate: () => void; onNew: () => void }) {
  const { record } = props;
  const p = record.plan;
  const [copied, copy] = useCopied();
  const [briefOpen, setBriefOpen] = useState(false);
  const nav = sections(p);
  const [active, setActive] = useState(nav[0]?.id);
  const slug = fileSlug(p);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" },
    );
    nav.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [record.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const btn = "inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink hover:bg-raised";
  const must = p.features.filter((f) => f.priority === "must").length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6">
      <header className="print-plain">
        <p className="no-print text-xs text-faint">
          Written by {record.model} · {new Date(record.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{p.title || "Untitled plan"}</h1>
        {p.oneLiner && <p className="mt-3 max-w-3xl text-lg text-muted">{p.oneLiner}</p>}
        {p.features.length > 0 && (
          <p className="mt-4 text-sm text-faint">
            {p.features.length} features ({must} for the first version) · {p.milestones.length} milestones · {p.openQuestions.length} open questions
          </p>
        )}

        <div className="no-print mt-6 flex flex-wrap gap-2">
          <div className="relative">
            <button className={`${btn} border-accent/50 bg-accent/10`} onClick={() => setBriefOpen((v) => !v)} aria-expanded={briefOpen}>
              <Bot size={16} /> Hand to a coding agent <ChevronDown size={14} />
            </button>
            {briefOpen && (
              <div className="absolute left-0 z-20 mt-2 w-72 rounded-xl border border-line bg-surface p-2 shadow-xl">
                <p className="px-2 pb-2 pt-1 text-xs text-muted">A brief for Claude Code, Cursor or Codex: build milestone 1, with tests for every acceptance criterion.</p>
                <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-raised" onClick={() => copy("brief", planToAgentBrief(record))}>
                  {copied === "brief" ? <Check size={15} className="text-good" /> : <Copy size={15} />} {copied === "brief" ? "Copied" : "Copy brief"}
                </button>
                <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-raised" onClick={() => download(`${slug}-agent-brief.md`, planToAgentBrief(record))}>
                  <Download size={15} /> Download brief (.md)
                </button>
              </div>
            )}
          </div>
          <button className={btn} onClick={() => copy("plan", planToMarkdown(record))}>
            {copied === "plan" ? <Check size={16} className="text-good" /> : <Copy size={16} />} {copied === "plan" ? "Copied" : "Copy"}
          </button>
          <button className={btn} onClick={() => download(`${slug}.md`, planToMarkdown(record))}>
            <FileText size={16} /> Download
          </button>
          <button className={btn} onClick={() => window.print()}>
            <Printer size={16} /> Print / PDF
          </button>
          <button className={btn} onClick={props.onEdit}>
            <Pencil size={16} /> Edit notes
          </button>
        </div>
      </header>

      {record.missing.length > 0 && (
        <div className="no-print mt-6 flex flex-col gap-3 rounded-xl border border-warn/40 bg-warn/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-warn">
            The model left out: {record.missing.join(", ")}. Try again, or choose a stronger model.
          </p>
          <button className={`${btn} shrink-0`} onClick={props.onRegenerate}>
            <RotateCcw size={15} /> Try again
          </button>
        </div>
      )}

      {p.openQuestions.length > 0 && (
        <div className="print-plain mt-8 rounded-2xl border border-accent/30 bg-accent/[0.06] p-5 sm:p-6">
          <h2 className="text-base font-semibold">Decide these first</h2>
          <p className="mt-1 text-sm text-muted">Your notes don't settle these, and each one changes the plan.</p>
          <ol className="mt-4 space-y-3">
            {p.openQuestions.map((q, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">{i + 1}</span>
                <div>
                  <p className="font-medium">{q.question}</p>
                  {q.whyItMatters && <p className="mt-0.5 text-sm text-muted">{q.whyItMatters}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[180px_1fr]">
        <nav className="no-print hidden lg:block" aria-label="Plan sections">
          <ul className="sticky top-24 space-y-1 text-sm">
            {nav.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className={`block rounded-md px-3 py-1.5 ${active === s.id ? "bg-raised text-ink" : "text-muted hover:text-ink"}`}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="print-plain min-w-0 max-w-3xl">
          <Section id="overview" title="Overview" hidden={!nav.some((s) => s.id === "overview")}>
            <dl className="space-y-4">
              {[["The problem", p.summary.problem], ["The product", p.summary.solution], ["Who it's for", p.summary.audience]].map(
                ([k, v]) =>
                  v && (
                    <div key={k}>
                      <dt className="text-xs font-medium uppercase tracking-wide text-faint">{k}</dt>
                      <dd className="mt-1 leading-relaxed">{v}</dd>
                    </div>
                  ),
              )}
            </dl>
            {p.users.length > 0 && (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {p.users.map((u, i) => (
                  <div key={i} className="rounded-xl border border-line bg-surface p-4">
                    <p className="font-medium">{u.name}</p>
                    {u.goal && <p className="mt-2 text-sm"><span className="text-faint">Wants: </span>{u.goal}</p>}
                    {u.pain && <p className="mt-1 text-sm"><span className="text-faint">Today: </span>{u.pain}</p>}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section id="features" title="Features" hidden={!p.features.length}>
            <div className="space-y-3">
              {(["must", "should", "later"] as const).flatMap((prio) =>
                p.features
                  .filter((f) => f.priority === prio)
                  .map((f, i) => (
                    <details key={`${prio}-${i}`} className="group rounded-xl border border-line bg-surface" open={prio === "must"}>
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4">
                        <div>
                          <p className="font-medium">{f.name}</p>
                          <p className="mt-1 text-sm text-muted">{f.description}</p>
                        </div>
                        <Chip cls={PRIORITY[f.priority].cls}>{PRIORITY[f.priority].label}</Chip>
                      </summary>
                      {f.acceptanceCriteria.length > 0 && (
                        <div className="border-t border-line px-4 pb-4 pt-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-faint">Done when</p>
                          <ul className="mt-2 space-y-1.5 text-sm">
                            {f.acceptanceCriteria.map((c, j) => (
                              <li key={j} className="flex gap-2">
                                <Check size={15} className="mt-0.5 shrink-0 text-faint" />
                                {c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </details>
                  )),
              )}
            </div>
          </Section>

          <Section id="flows" title="User flows" hidden={!p.userFlows.length}>
            <div className="grid gap-4 sm:grid-cols-2">
              {p.userFlows.map((f, i) => (
                <div key={i} className="rounded-xl border border-line bg-surface p-4">
                  <p className="font-medium">{f.name}</p>
                  <ol className="mt-3 space-y-2 text-sm">
                    {f.steps.map((s, j) => (
                      <li key={j} className="flex gap-3">
                        <span className="w-4 shrink-0 text-right font-mono text-xs leading-5 text-faint">{j + 1}</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </Section>

          <Section id="architecture" title="Architecture" hidden={!nav.some((s) => s.id === "architecture")}>
            {p.architecture.overview && <p className="leading-relaxed">{p.architecture.overview}</p>}
            {p.architecture.components.length > 0 && (
              <div className="mt-5 divide-y divide-line rounded-xl border border-line bg-surface">
                {p.architecture.components.map((c, i) => (
                  <div key={i} className="grid gap-1 p-4 sm:grid-cols-[1fr_auto] sm:gap-4">
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="mt-1 text-sm text-muted">{c.responsibility}</p>
                    </div>
                    {c.tech && <p className="font-mono text-xs text-accent sm:text-right">{c.tech}</p>}
                  </div>
                ))}
              </div>
            )}
            {p.architecture.integrations.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-semibold">Third-party services</h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {p.architecture.integrations.map((it, i) => (
                    <li key={i}>
                      <span className="font-medium">{it.name}</span> <span className="text-muted">· {it.purpose}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          <Section id="data" title="Data model" hidden={!p.dataModel.length}>
            <div className="grid gap-3 sm:grid-cols-2">
              {p.dataModel.map((d, i) => (
                <div key={i} className="rounded-xl border border-line bg-surface p-4">
                  <p className="font-medium">{d.entity}</p>
                  <ul className="mt-2 space-y-0.5 font-mono text-xs text-muted">
                    {d.fields.map((f, j) => (
                      <li key={j}>{f}</li>
                    ))}
                  </ul>
                  {d.notes && <p className="mt-3 text-sm text-muted">{d.notes}</p>}
                </div>
              ))}
            </div>
          </Section>

          <Section id="api" title="API" hidden={!p.api.length}>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-line">
                  {p.api.map((a, i) => (
                    <tr key={i} className="bg-surface">
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-semibold text-accent">{a.method}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">{a.path}</td>
                      <td className="px-4 py-2.5 text-muted">{a.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="build" title="Build plan" hidden={!p.milestones.length}>
            <ol className="relative space-y-6 border-l border-line pl-6">
              {p.milestones.map((m, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[33px] flex h-4 w-4 items-center justify-center rounded-full border border-accent bg-bg">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  </span>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">
                      {i + 1}. {m.name}
                    </p>
                    {m.estimate && <span className="text-xs text-faint">{m.estimate}</span>}
                  </div>
                  {m.goal && <p className="mt-1 text-sm text-muted">{m.goal}</p>}
                  {m.deliverables.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {m.deliverables.map((d, j) => (
                        <li key={j}>{d}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </Section>

          <Section id="risks" title="Risks" hidden={!p.risks.length}>
            <div className="space-y-3">
              {p.risks.map((r, i) => (
                <div key={i} className="rounded-xl border border-line bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{r.risk}</p>
                    <Chip cls={IMPACT[r.impact]}>{r.impact} impact</Chip>
                  </div>
                  {r.mitigation && <p className="mt-2 text-sm text-muted">{r.mitigation}</p>}
                </div>
              ))}
            </div>
          </Section>

          <Section id="business" title="Business" hidden={!nav.some((s) => s.id === "business")}>
            <dl className="space-y-4">
              {[["Pricing", p.business.pricing], ["Getting the first customers", p.business.goToMarket]].map(
                ([k, v]) =>
                  v && (
                    <div key={k}>
                      <dt className="text-xs font-medium uppercase tracking-wide text-faint">{k}</dt>
                      <dd className="mt-1 leading-relaxed">{v}</dd>
                    </div>
                  ),
              )}
            </dl>
            {p.business.successMetrics.length > 0 && (
              <>
                <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-faint">How you'll know it's working</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {p.business.successMetrics.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          <Section id="assumptions" title="Assumptions" hidden={!p.assumptions.length}>
            <p className="mb-3 text-sm text-muted">Apex decided these because your notes didn't say. Change any that are wrong and regenerate.</p>
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              {p.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Section>

          <details className="no-print mt-4 rounded-xl border border-line">
            <summary className="cursor-pointer px-4 py-3 text-sm text-muted">Your notes</summary>
            <pre className="whitespace-pre-wrap border-t border-line px-4 py-3 font-sans text-sm text-muted">{record.notes}</pre>
          </details>

          <p className="mt-8 text-xs text-faint">AI-generated. Check it before you build on it.</p>
          <button className="no-print mt-6 text-sm text-accent hover:underline" onClick={props.onNew}>
            Start a new plan
          </button>
        </div>
      </div>
    </div>
  );
}
