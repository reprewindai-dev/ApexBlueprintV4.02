import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { checkModel } from "../app/api";
import { PROVIDERS, providerInfo, type ModelSettings, type ProviderId } from "../app/settings";

const blank = (provider: ProviderId): ModelSettings => ({
  provider,
  model: "",
  apiKey: "",
  baseUrl: providerInfo(provider).defaultBaseUrl || "",
  rememberKey: false,
});

const onLocalhost = () => ["localhost", "127.0.0.1"].includes(window.location.hostname);

export function SettingsDialog(props: {
  initial: ModelSettings | null;
  reason?: string;
  onSave: (s: ModelSettings) => void;
  onClose: () => void;
}) {
  const [s, setS] = useState<ModelSettings>(props.initial ?? blank("anthropic"));
  const [check, setCheck] = useState<{ state: "idle" | "busy" | "ok" | "fail"; message?: string }>({ state: "idle" });
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
    setCheck({ state: r.ok ? "ok" : "fail", message: r.message });
  };

  const field = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onMouseDown={props.onClose}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 shadow-2xl sm:rounded-2xl sm:p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="settings-title" className="text-lg font-semibold">Which AI should write your plans?</h2>
            <p className="mt-1 text-sm text-muted">{props.reason || "Apex uses your own AI account. Stronger models write better plans."}</p>
          </div>
          <button onClick={props.onClose} className="rounded-md p-1 text-muted hover:bg-raised hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <fieldset className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <legend className="sr-only">Provider</legend>
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              data-autofocus={p.id === s.provider ? "" : undefined}
              onClick={() => pick(p.id)}
              aria-pressed={p.id === s.provider}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                p.id === s.provider ? "border-accent bg-accent/10 text-ink" : "border-line text-muted hover:border-faint hover:text-ink"
              }`}
            >
              {p.name}
            </button>
          ))}
        </fieldset>

        <div className="mt-5 space-y-4">
          {info.needsKey && (
            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-sm font-medium">
                API key
                {info.keyUrl && (
                  <a href={info.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-normal text-accent hover:underline">
                    Get a key <ExternalLink size={12} />
                  </a>
                )}
              </span>
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                className={field}
                placeholder={info.keyHint}
                value={s.apiKey}
                onChange={(e) => update({ apiKey: e.target.value })}
              />
              <span className="mt-2 flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={s.rememberKey} onChange={(e) => update({ rememberKey: e.target.checked })} className="accent-[var(--color-accent)]" />
                Remember on this device (otherwise it is forgotten when you close the tab)
              </span>
            </label>
          )}

          {(s.provider === "ollama" || s.provider === "custom") && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Server address</span>
              <input className={field} spellCheck={false} value={s.baseUrl} onChange={(e) => update({ baseUrl: e.target.value })} />
            </label>
          )}

          {s.provider === "custom" && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">API key <span className="font-normal text-muted">(if the server needs one)</span></span>
              <input type="password" autoComplete="off" className={field} value={s.apiKey} onChange={(e) => update({ apiKey: e.target.value })} />
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              Model {info.defaultModel && <span className="font-normal text-muted">(leave empty for {info.defaultModel})</span>}
            </span>
            <input className={field} spellCheck={false} placeholder={info.defaultModel || "model name"} value={s.model} onChange={(e) => update({ model: e.target.value })} />
          </label>

          {s.provider === "ollama" && (
            <div className="rounded-lg border border-line bg-bg p-3 text-xs leading-relaxed text-muted">
              <p>{info.note}</p>
              <p className="mt-2">
                Install from <a className="text-accent hover:underline" href="https://ollama.com" target="_blank" rel="noreferrer">ollama.com</a>, then run{" "}
                <code className="font-mono text-ink">ollama pull {s.model.trim() || info.defaultModel}</code>.
              </p>
              {!onLocalhost() && (
                <p className="mt-2">
                  So this site can reach it, start Ollama with{" "}
                  <code className="break-all font-mono text-ink">OLLAMA_ORIGINS={window.location.origin} ollama serve</code>
                </p>
              )}
            </div>
          )}
        </div>

        <p className="mt-5 text-xs leading-relaxed text-faint">
          {s.provider === "ollama"
            ? "Your notes stay on your computer and go only to your Ollama."
            : "Your notes and key are sent through Apex's server to the provider you chose, for that request only. Apex does not store them."}
        </p>

        {check.state === "fail" && <p className="mt-3 rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">{check.message}</p>}
        {check.state === "ok" && (
          <p className="mt-3 flex items-center gap-2 text-sm text-good">
            <Check size={16} /> Connected.
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={test}
            disabled={!!missing || check.state === "busy"}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-line px-4 py-2 text-sm text-ink hover:bg-raised disabled:opacity-40"
          >
            {check.state === "busy" && <Loader2 size={15} className="apex-spin" />}
            Test connection
          </button>
          <button
            type="button"
            onClick={() => props.onSave(s)}
            disabled={!!missing}
            title={missing || undefined}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:brightness-110 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
