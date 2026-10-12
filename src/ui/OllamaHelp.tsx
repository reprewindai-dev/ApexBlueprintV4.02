import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { ollamaSetupSteps } from "../app/ollama";

function defaultOs() {
  const p = `${navigator.platform} ${navigator.userAgent}`.toLowerCase();
  if (p.includes("win")) return "windows";
  if (p.includes("mac")) return "mac";
  return "linux";
}

function CopyLine({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex items-stretch border border-line bg-bg">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap px-3 py-2 font-mono text-xs text-accent">{command}</code>
      <button
        type="button"
        onClick={() =>
          navigator.clipboard?.writeText(command).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
        }
        className="tag shrink-0 border-l border-line px-3 text-muted hover:text-accent"
        aria-label="Copy command"
      >
        {copied ? <Check size={14} className="text-good" /> : <Copy size={14} />}
      </button>
    </div>
  );
}

export function OllamaHelp({ title = "Let this site use your Ollama (one time)" }: { title?: string }) {
  const all = ollamaSetupSteps();
  const [os, setOs] = useState(defaultOs);
  const current = all.find((o) => o.id === os) ?? all[0];
  return (
    <div className="border border-line bg-bg/60 p-4">
      <p className="tag text-ink">{title}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Browsers only let a website talk to a program on your computer when that program allows it. This tells Ollama to allow Apex, and nothing else.
      </p>
      <div className="mt-3 flex flex-wrap gap-1" role="tablist">
        {all.map((o) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={o.id === os}
            onClick={() => setOs(o.id)}
            className={`tag border px-2.5 py-1 ${o.id === os ? "border-accent text-accent" : "border-line text-faint hover:text-ink"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <ol className="mt-3 space-y-3 text-sm">
        {current.steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="tag mt-0.5 text-accent">0{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="text-ink">{s.text}</p>
              {s.command && <CopyLine command={s.command} />}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-faint">
        Or skip this: run Apex on your own computer (see the README), and it talks to Ollama directly.
      </p>
    </div>
  );
}
