import React, { useState } from "react";
import { Capability } from "../types";
import { Code, Copy, Check } from "lucide-react";

interface InterfacesInventoryProps {
  capabilities: Capability[];
}

export default function InterfacesInventory({ capabilities }: InterfacesInventoryProps) {
  const [selectedCapId, setSelectedCapId] = useState<string>("govern-agent-session");
  const [interfaceFilter, setInterfaceFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const matchedCap = capabilities.find(c => c.id === selectedCapId) || capabilities[0] || null;

  // Map filters to standard key matching
  const filterList = [
    { value: "all", label: "All Interfaces" },
    { value: "rest", label: "REST Endpoints" },
    { value: "mcp", label: "MCP Tools" },
    { value: "sdk", label: "SDK Methods" },
    { value: "cli", label: "CLI Actions" },
    { value: "webhook", label: "Webhooks & Events" }
  ];

  // Helper code blocks for realistic displays in JetBrains Mono!
  const getInterfaceCodeSnippet = (capId: string, filter: string) => {
    switch (capId) {
      case "govern-agent-session":
        if (filter === "mcp") {
          return `{\n  "name": "govern_agent_session",\n  "description": "Lease boundary claims and allocate compute cycles for an autonomous agent session.",\n  "inputSchema": {\n    "type": "object",\n    "properties": {\n      "agent_id": { "type": "string" },\n      "lease_duration_sec": { "type": "integer", "default": 3600 },\n      "max_escrow_micropay": { "type": "number", "default": 10.0 }\n    },\n    "required": ["agent_id"]\n  }\n}`;
        } else if (filter === "rest") {
          return `POST /api/v1/sessions/govern\\nContent-Type: application/json\\nAuthorization: Bearer <X402_TOKEN>\\n\\n{\\n  "agentId": "agent-scooter-901",\\n  "slaClass": "Sovereign",\\n  "fundingLimitUSD": 5.00\\n}\\n\\n--> Response 201 Created\\n{\\n  "leaseId": "lease_7a8d81bc8",\\n  "expiresAt": "2026-07-15T15:12:10Z",\\n  "escrowLocked": true\\n}`;
        } else {
          return `import { VeklomCore } from "@veklom/sdk";\n\nconst core = new VeklomCore({ apiKey: process.env.VEKLOM_KEY });\nconst session = await core.sessions.govern({\n  agentId: "agent-scooter-901",\n  slaClass: "Sovereign"\n});\nconsole.log(\`Session lease minted: \${session.leaseId}\`);`;
        }
      case "score-api-eligibility":
        if (filter === "rest") {
          return `GET /api/v1/router/score-eligibility?nodeId=node-tokyo-03\\n--> Response 200 OK\\n{\\n  "nodeId": "node-tokyo-03",\\n  "uptimeScore": 0.9998,\\n  "slaSuccessRate": 0.9995,\\n  "jitterVarianceMs": 1.25,\\n  "einsteinPriorityIndex": 97.45,\\n  "routeEligible": true\\n}`;
        } else if (filter === "cli") {
          return `$ veklom router score-eligibility --node node-tokyo-03\\n\\n[+] NODE REPUTATION AUDIT:\\n    Uptime Score:  99.98%\\n    SLA Success:   99.95%\\n    Jitter Var:    1.25ms\\n    ---------------------\\n    EINSTEIN WEIGHT INDEX: 97.45 (HIGH ELIGIBILITY)`;
        } else {
          return `// Einstein Jitter scoring formula in TypeScript\\nfunction getEinsteinIndex(uptime: number, sla: number, jitterVar: number): number {\\n  return (uptime * 40) + (sla * 40) - (jitterVar * 20);\\n}`;
        }
      case "verify-provider-ownership":
        if (filter === "webhook") {
          return `// Webhook payload: DNS validation challenge matched\\n{\\n  "event": "provider.dns_challenge_succeeded",\\n  "timestamp": "2026-07-15T13:45:12Z",\\n  "providerId": "prov_edge_seattle_09",\\n  "dnsRecordMatched": "veklom-challenge=e50c9782ea38d8d3fcd0...\\n}`;
        } else {
          return `POST /api/v1/provider/verify-dns\\n{\\n  "providerId": "prov_edge_seattle_09",\\n  "dnsTarget": "edge-09.seattle.nodes.io"\\n}\\n--> Response 200 OK\\n{\\n  "challengePassed": true,\\n  "dnsVerifiedBadge": "badge_9a12c8b81"\\n}`;
        }
      case "mint-settlement-evidence":
        if (filter === "mcp") {
          return `{\n  "name": "mint_settlement_evidence",\n  "description": "Mint cryptographic execution hash evidence directly onto the Gnomledger registry.",\n  "inputSchema": {\n    "type": "object",\n    "properties": {\n      "task_execution_hash": { "type": "string" },\n      "claimed_fee_usd": { "type": "number" }\n    },\n    "required": ["task_execution_hash"]\n  }\n}`;
        } else {
          return `POST /api/v1/evidence/mint\\n{\\n  "executionHash": "sha256_d8b3c9a105...",\\n  "claimSLA": "Sovereign"\\n}\\n--> Response 201 Minted\\n{\\n  "evidenceId": "evid_e2b109c4d",\\n  "gnomledgerBlock": 1822831,\\n  "merkleRoot": "mr_901c82b81093da"\\n}`;
        }
      default:
        return `// Interface details for ${capId}`;
    }
  };

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-[#222] pb-3">
        <Code size={18} className="text-[#00F0FF]" />
        <h3 className="text-xl font-black text-white uppercase tracking-tight">Capability Interface Inventory</h3>
      </div>
      <p className="text-xs font-mono text-[#666] uppercase leading-relaxed max-w-4xl">
        Filter interface points by structural types (REST, SDK, MCP, CLI). Select a capability to inspect mock input contracts and copy production-ready code declarations.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Capability List */}
        <div className="lg:col-span-4 space-y-2 max-h-[380px] overflow-y-auto pr-2 border-r-2 border-[#111]">
          <span className="text-[10px] font-mono font-black text-[#555] uppercase tracking-wider block mb-2">CAPABILITY ROSTER</span>
          {capabilities.map((cap) => (
            <button
              key={cap.id}
              onClick={() => setSelectedCapId(cap.id)}
              className={`w-full text-left p-3.5 border transition-all rounded-none uppercase font-mono text-xs ${
                selectedCapId === cap.id
                  ? "bg-[#0A0A0A] border-[#00F0FF] text-white"
                  : "bg-transparent border-[#222] text-[#888] hover:border-gray-500 hover:text-white"
              }`}
            >
              <div className="font-bold tracking-tight">{cap.name}</div>
              <div className="text-[9px] text-[#444] mt-1 tracking-wider">ID: {cap.id}</div>
            </button>
          ))}
        </div>

        {/* Right: Code Details Panel */}
        <div className="lg:col-span-8 space-y-4">
          {/* Interface Type Pills */}
          <div className="flex flex-wrap gap-2 border-b border-[#222] pb-3">
            {filterList.map((f) => (
              <button
                key={f.value}
                onClick={() => setInterfaceFilter(f.value)}
                className={`px-3 py-1.5 border font-mono text-[9px] font-bold uppercase tracking-widest transition-all rounded-none ${
                  interfaceFilter === f.value
                    ? "bg-[#00F0FF] text-black border-[#00F0FF]"
                    : "bg-[#0A0A0A] border-[#222] text-[#666] hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Code Viewer Card */}
          {matchedCap && (
            <div className="border-2 border-[#222] bg-[#050505] p-5 space-y-4 rounded-none">
              <div className="flex justify-between items-start border-b border-[#222] pb-3">
                <div>
                  <h4 className="text-xs font-mono font-black text-[#00F0FF] uppercase tracking-wider">{matchedCap.name} Contracts</h4>
                  <p className="text-[10px] text-[#888] font-mono leading-relaxed uppercase mt-1">{matchedCap.purpose}</p>
                </div>
                <button
                  onClick={() => handleCopyCode(getInterfaceCodeSnippet(matchedCap.id, interfaceFilter), matchedCap.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 border border-[#333] hover:border-[#00F0FF] bg-[#111] hover:bg-[#0A0A0A] text-[#888] hover:text-[#00F0FF] font-mono text-[9px] font-black uppercase tracking-widest transition-colors rounded-none"
                >
                  {copiedId === matchedCap.id ? (
                    <>
                      <Check size={11} className="stroke-[3]" />
                      <span>COPIED!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={11} />
                      <span>COPY INTERFACE</span>
                    </>
                  )}
                </button>
              </div>

              {/* Snippet Block */}
              <div className="bg-[#0A0A0A] border border-[#222] p-4 font-mono text-[11px] leading-relaxed text-gray-300 overflow-x-auto whitespace-pre-wrap max-h-[220px]">
                {getInterfaceCodeSnippet(matchedCap.id, interfaceFilter)}
              </div>

              <div className="flex justify-between items-center text-[9px] font-mono text-[#444] uppercase tracking-widest">
                <span>Verified: Merkle Node SLA compliance</span>
                <span>Type: {interfaceFilter === "all" ? "REST/SDK Default" : interfaceFilter.toUpperCase()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
