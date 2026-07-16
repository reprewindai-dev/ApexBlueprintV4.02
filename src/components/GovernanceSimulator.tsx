import React, { useState } from "react";
import { Capability } from "../types";
import { ShieldCheck, AlertTriangle, Play, RefreshCw } from "lucide-react";

interface GovernanceSimulatorProps {
  capabilities: Capability[];
}

export default function GovernanceSimulator({ capabilities }: GovernanceSimulatorProps) {
  const [killedCaps, setKilledCaps] = useState<Record<string, boolean>>({});
  const [logs, setLogs] = useState<string[]>([
    "SYS_INIT: Governance policies successfully loaded.",
    "SYS_INIT: Active SLA latency safety limits set to < 15ms.",
    "SYS_STATUS: Node compliance rating: 100%. Gnomledger network connection verified."
  ]);

  const handleToggleKillSwitch = (capId: string, capName: string) => {
    const isCurrentlyKilled = !!killedCaps[capId];
    const nextKilledState = !isCurrentlyKilled;

    setKilledCaps(prev => ({
      ...prev,
      [capId]: nextKilledState
    }));

    // Generate rich terminal console logs
    const timestamp = new Date().toISOString().split("T")[1].substring(0, 8);
    let logMessage = "";
    
    if (nextKilledState) {
      logMessage = `[${timestamp}] 🔴 [GOVERNANCE SHIELD] TRIPPED kill-switch on capability [${capId}]. Active leases halted immediately! Dependent nodes ejected from routing arrays. Gaps generated!`;
    } else {
      logMessage = `[${timestamp}] 🟢 [GOVERNANCE SHIELD] RESTORED capability [${capId}]. Boundary claims validated successfully. Running SLA health checks... node re-entry approved.`;
    }

    setLogs(prev => [logMessage, ...prev]);
  };

  const handleResetGovernance = () => {
    setKilledCaps({});
    setLogs([
      `[${new Date().toISOString().split("T")[1].substring(0, 8)}] 🔄 [GOVERNANCE RESET] All kill-switches reset. Restored complete network compliance state.`,
      "SYS_STATUS: Node compliance rating: 100%. Gnomledger network connection verified."
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-[#222] pb-3">
        <ShieldCheck size={18} className="text-[#00F0FF]" />
        <h3 className="text-xl font-black text-white uppercase tracking-tight">Active Governance & Kill-Switch Simulator</h3>
      </div>
      <p className="text-xs font-mono text-[#666] uppercase leading-relaxed max-w-4xl">
        Manage sovereign boundary limits. Toggle kill-switches on individual capabilities to simulate real-time escrow shutdowns and review automated system logs in the terminal below.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Capability Kill Switch Board */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono font-black text-white uppercase tracking-wider block">CAPABILITY KILL-SWITCH BOARD</span>
            <button
              onClick={handleResetGovernance}
              className="flex items-center gap-1.5 px-2 py-1 bg-[#111] hover:bg-white text-gray-400 hover:text-black border border-[#222] text-[8px] font-bold tracking-widest uppercase transition-colors rounded-none"
            >
              <RefreshCw size={9} />
              <span>Reset Compliance</span>
            </button>
          </div>

          <div className="space-y-3">
            {capabilities.map((cap) => {
              const isKilled = !!killedCaps[cap.id];
              return (
                <div
                  key={cap.id}
                  className={`p-4 border-2 rounded-none transition-all duration-150 flex items-center justify-between ${
                    isKilled
                      ? "bg-red-950/10 border-red-500/50"
                      : "bg-[#0A0A0A] border-[#222]"
                  }`}
                >
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black uppercase tracking-tight ${isKilled ? "text-red-500" : "text-white"}`}>
                        {cap.name}
                      </span>
                      {isKilled && (
                        <span className="text-[7.5px] px-1 bg-red-500/20 border border-red-500/30 text-red-400 font-black uppercase tracking-widest animate-pulse">
                          HALTED
                        </span>
                      )}
                    </div>
                    <p className="text-[9.5px] font-mono text-[#666] leading-relaxed uppercase">{cap.governance.budgetRules}</p>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={() => handleToggleKillSwitch(cap.id, cap.name)}
                    className={`w-12 h-6 border-2 flex items-center p-0.5 cursor-pointer rounded-none transition-colors duration-200 ${
                      isKilled ? "bg-red-500/20 border-red-500" : "bg-[#111] border-[#333]"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 transition-transform duration-200 rounded-none ${
                        isKilled ? "transform translate-x-6 bg-red-500" : "bg-gray-500"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Simulated System Status Terminal */}
        <div className="lg:col-span-6 flex flex-col justify-between border-2 border-[#222] bg-[#050505] p-5 rounded-none min-h-[380px]">
          <div className="space-y-4 flex-1 flex flex-col">
            <div className="border-b border-[#222] pb-3 flex justify-between items-center shrink-0">
              <span className="text-[10px] font-mono font-black text-[#666] uppercase tracking-widest flex items-center gap-1.5">
                <AlertTriangle size={12} className="text-[#00F0FF]" />
                <span>SOVEREIGN ENDPOINT DISPATCH LOGS</span>
              </span>
              <span className="w-2.5 h-2.5 bg-emerald-500 block rounded-full animate-ping" />
            </div>

            {/* Scrolling Console Terminal */}
            <div className="flex-1 bg-[#0A0A0A] border border-[#222] p-4 font-mono text-[10px] leading-relaxed text-emerald-400 overflow-y-auto space-y-2 max-h-[220px]">
              {logs.map((log, index) => {
                const isErr = log.includes("🔴") || log.includes("TRIPPED");
                return (
                  <div key={index} className={isErr ? "text-red-400 font-bold" : "text-emerald-400/80"}>
                    {log}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Stats Panel Footer */}
          <div className="pt-4 border-t border-[#1C1C1C] mt-4 flex justify-between items-center text-[9px] font-mono uppercase text-[#444] tracking-wider shrink-0">
            <span>ACTIVE SECURITY POLICIES: 4 BOUND</span>
            <span>SHIELD STATUS: {Object.values(killedCaps).some(Boolean) ? "COMPROMISED" : "SECURE"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
