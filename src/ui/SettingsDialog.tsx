import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { checkModel } from "../app/api";
import { OllamaConnectionError } from "../app/ollama";
import { PROVIDERS, providerInfo, type ModelSettings, type ProviderId } from "../app/settings";
import { OllamaHelp } from "./OllamaHelp";

const blank = (provider: ProviderId): ModelSettings => ({
  provider,
  model: "",
  apiKey: "",
  baseUrl: providerInfo(provider).defaultBaseUrl || "",
  rememberKey: false,
});

const onLocalhost = () => ["localhost", "127.0.0.1"].includes(window.location.hostname);

type CheckState = { state: "idle" | "busy" | "ok" | "fail"; message?: string; ollama?: "blocked" | "unreachable" };

export function SettingsDialog(props: {
  initial: ModelSettings | null;
  reason?: string;
  onSave: (s: ModelSettings) => void;
  onClose: () => void;
}) {
  const [s, setS] = useState<ModelSettings>(props.initial ?? blank("anthropic"));
  const [check, setCheck] = useState<CheckState>({ state: "idle" });
  const dialog = useRef<HTMLDivElement>(null);
  const info = providerInfo(s.provider);

  const onClose = useRef(props.onClose);
  onClose.current = props.onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose.current();
    window.addEventListener("keydown", onKey);
    dialog.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pick = (id: ProviderId) => {
    setCheck({ state: "idle" });
    setS(id === s.provider ? s : { ...blank(id), rememberKey: s.rememberKey });
  };
  const update = (patch: Partial<ModelSettings>) => {
    setCheck({ state: "idle" });
    setS({ ...s, ...patch });
  };

  const missing =
    (info.needsKey && !s.apiKey.trim() && "Add your API key.") ||
    ((s.provider === "ollama" || s.provider === "custom") && !s.baseUrl.trim() && "Add the server address.") ||
    (s.provider === "custom" && !s.model.trim() && "Add the model name.") ||
    "";

  const test = async () => {
    setCheck({ state: "busy" });
    const r = await checkModel(s);
    setCheck({
      state: r.ok ? "ok" : "fail",
      message: r.message,
      ollama: r.error instanceof OllamaConnectionError ? r.error.state : undefined,
    });
  };

  const field = "w-full border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none";
  const showOllamaHelp = s.provider === "ollama" && !onLocalhost();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={props.onClose}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="glow-box max-h-[92vh] w-full max-w-xl overflow-y-auto border border-accent/40 bg-surface p-5 sm:p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="tag text-accent">[ Engine ]</p>
            <h2 id="settings-title" className="mt-2 text-2xl font-black uppercase tracking-tight">
              Choose your model
            </h2>
            <p className="mt-1 text-sm text-muted">{props.reason || "Apex uses your own AI account. Stronger models write better plans."}</p>
          </div>
          <button onClick={props.onClose} className="p-1 text-muted hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <fieldset className="mt-5 grid grid-cols-2 gap-2">
          <legend className="sr-only">Provider</legend>
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              data-autofocus={p.id === s.provider ? "" : undefined}
              onClick={() => pick(p.id)}
              aria-pressed={p.id === s.provider}
              className={`border px-3 py-2.5 text-left text-sm font-semibold transition ${
                p.id === s.provider ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:border-faint hover:text-ink"
              }`}
            >
              {p.name}
            </button>
          ))}
        </fieldset>

        <div className="mt-5 space-y-4">
          {info.needsKey && (
            <label className="block">
              <span className="mb-2 flex items-center justify-between">
                <span className="tag text-muted">API key</span>
                {info.keyUrl && (
                  <a href={info.keyUrl} target="_blank" rel="noreferrer" className="tag inline-flex items-center gap-1 text-accent hover:underline">
                    Get a key <ExternalLink size={11} />
                  </a>
                )}
              </span>
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                className={`${field} font-mono`}
                placeholder={info.keyHint}
                value={s.apiKey}
                onChange={(e) => update({ apiKey: e.target.value })}
              />
              <span className="mt-2 flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={s.rememberKey} onChange={(e) => update({ rememberKey: e.target.checked })} className="accent-[var(--color-accent)]" />
                Remember on this device (otherwise forgotten when you close the tab)
              </span>
            </label>
          )}

          {(s.provider === "ollama" || s.provider === "custom") && (
            <label className="block">
              <span className="tag mb-2 block text-muted">Server address</span>
              <input className={`${field} font-mono`} spellCheck={false} value={s.baseUrl} onChange={(e) => update({ baseUrl: e.target.value })} />
            </label>
          )}

          {s.provider === "custom" && (
            <label className="block">
              <span className="tag mb-2 block text-muted">API key (if the server needs one)</span>
              <input type="password" autoComplete="off" className={`${field} font-mono`} value={s.apiKey} onChange={(e) => update({ apiKey: e.target.value })} />
            </label>
          )}

          <label className="block">
            <span className="tag mb-2 block text-muted">Model {info.defaultModel && <span className="text-faint">· empty = {info.defaultModel}</span>}</span>
            <input className={`${field} font-mono`} spellCheck={false} placeholder={info.defaultModel || "model name"} value={s.model} onChange={(e) => update({ model: e.target.value })} />
          </label>

          {s.provider === "ollama" && (
            <p className="text-xs leading-relaxed text-muted">
              {info.note} Install from{" "}
              <a className="text-accent hover:underline" href="https://ollama.com" target="_blank" rel="noreferrer">
                ollama.com
              </a>
              , then run <code className="font-mono text-ink">ollama pull {s.model.trim() || info.defaultModel}</code>.
            </p>
          )}

          {showOllamaHelp && <OllamaHelp />}
        </div>

        {check.state === "fail" && (
          <div className="mt-4 border border-bad/50 bg-bad/10 p-3 text-sm text-bad">
            <p className="tag mb-1">[ Not connected ]</p>
            <p>{check.message}</p>
          </div>
        )}
        {check.state === "ok" && (
          <p className="tag mt-4 flex items-center gap-2 text-good">
            <Check size={15} /> Connected
          </p>
        )}

        <p className="mt-5 text-xs leading-relaxed text-faint">
          {s.provider === "ollama"
            ? "Your notes stay on your computer and go only to your Ollama."
            : "Your notes and key go through Apex's server to the provider you chose, for that request only. Apex does not store them."}
        </p>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={test}
            disabled={!!missing || check.state === "busy"}
            className="tag inline-flex items-center justify-center gap-2 border border-line px-4 py-3 text-ink hover:border-accent/60 disabled:opacity-40"
          >
            {check.state === "busy" && <Loader2 size={14} className="apex-spin" />}
            Test connection
          </button>
          <button
            type="button"
            onClick={() => props.onSave(s)}
            disabled={!!missing}
            title={missing || undefined}
            className="glow-btn bg-accent px-6 py-3 font-mono text-sm font-bold uppercase tracking-[0.14em] text-accent-ink hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
