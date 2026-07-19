import React, { useEffect, useState } from "react";

interface WorkerStatus {
  workerId: string;
  running: boolean;
  activeTaskId: string | null;
  queueDepth: number;
  totals: Record<string, number>;
  lastHeartbeatAt: string | null;
}

interface ApexSpecialistPanelProps {
  blueprint?: Record<string, unknown>;
}

export const ApexSpecialistPanel: React.FC<ApexSpecialistPanelProps> = ({ blueprint }) => {
  const [status, setStatus] = useState<WorkerStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const response = await fetch("/api/apex/worker/status", { cache: "no-store" });
      if (!response.ok) throw new Error(`Worker status HTTP ${response.status}`);
      setStatus(await response.json() as WorkerStatus);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Worker status unavailable.");
    }
  };

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(interval);
  }, []);

  const enqueue = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/apex/worker/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json() as { task?: { id?: string }; error?: string };
      if (!response.ok) throw new Error(data.error || `Task intake HTTP ${response.status}`);
      setMessage(`Task ${data.task?.id || "accepted"} queued for ${status?.workerId || "Apex specialist"}.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Task intake failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-6 border border-cyan-900/60 bg-[#050b10] p-4 font-mono">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-950 pb-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-400">Apex Trust-Spine Specialist</div>
          <div className="mt-1 text-xs text-gray-400">Live task execution, leases, retries, and evidence state</div>
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
          <span className={`h-2 w-2 rounded-full ${status?.running ? "bg-emerald-400" : "bg-amber-400"}`} />
          {status?.running ? "worker running" : "worker not started"}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-gray-400 md:grid-cols-5">
        <div>Queue <span className="text-white">{status?.queueDepth ?? "—"}</span></div>
        <div>Active <span className="text-white">{status?.activeTaskId ? "yes" : "no"}</span></div>
        <div>Success <span className="text-emerald-400">{status?.totals?.succeeded ?? 0}</span></div>
        <div>Failed <span className="text-red-400">{status?.totals?.failed ?? 0}</span></div>
        <div>Heartbeat <span className="text-white">{status?.lastHeartbeatAt ? new Date(status.lastHeartbeatAt).toLocaleTimeString() : "—"}</span></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !blueprint}
          onClick={() => void enqueue({ kind: "blueprint.validate", payload: { blueprint } })}
          className="border border-cyan-700 px-3 py-2 text-[10px] uppercase tracking-wider text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Validate current blueprint
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void enqueue({ kind: "veklom.health", payload: {} })}
          className="border border-emerald-800 px-3 py-2 text-[10px] uppercase tracking-wider text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Run Veklom health sweep
        </button>
      </div>
      {message && <div className="mt-3 text-[10px] text-gray-500">{message}</div>}
    </section>
  );
};

