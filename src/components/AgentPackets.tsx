import React, { useState } from "react";
import { Cpu, Copy, CheckCircle2, ChevronRight, FileText, Code2, ShieldAlert } from "lucide-react";
import { ExecutionPacket } from "../types";

interface AgentPacketsProps {
  selectedJurisdiction?: "global" | "canada" | "eu" | "us";
  constitutionVersion?: string;
  constitutionState?: "LOCKED" | "PENDING_REVISION";
  blueprintHash?: string;
  packets?: ExecutionPacket[];
}

export const AgentPackets: React.FC<AgentPacketsProps> = ({
  selectedJurisdiction = "global",
  constitutionVersion = "v4.02.1",
  constitutionState = "LOCKED",
  blueprintHash = "e50c9782ea38d8d3fcd066929cf39be50f81a1a479efcb1d06371f652cb9287a",
  packets: compiledPackets
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const defaultPackets: ExecutionPacket[] = [
    {
      id: "pkt-1",
      title: "Packet 01: Rust Asynchronous Einstein Scheduler",
      targetRole: "Senior Rust Systems Engineer / Async Specialist",
      summary: "Write the async, high-throughput scheduling core that solves priority weights based on latency-telemetry probes.",
      objective: "Build an asynchronous gRPC routing microservice using Tokio and Tonic that allocates incoming agent execution sessions to edge nodes by calculating the real-time Einstein Reputation score.",
      scope: "Rust crate core logic, custom telemetry structs, weight math calculations, and failover routing array handlers.",
      files: [
        "src/scheduler/einstein.rs - Core routing algorithms and weight evaluation",
        "src/scheduler/telemetry.rs - Jitter tracking structures and socket counters",
        "Cargo.toml - Adding dependencies for tokio, tonic, and futures-util"
      ],
      contracts: "Must implement gRPC 'RouterService' and satisfy protobuf interface definitions exactly.",
      dependencies: ["tokio = { version = '1.35', features = ['full'] }", "tonic = '0.10'", "futures-util = '0.3'"],
      tests: [
        "test_weight_calculation() - verify correctness of formula against known benchmarks",
        "test_node_dropout_failover() - assert fallback arrays are invoked on timeout",
        "test_high_concurrency_load() - load test with 50,000 mock routes/sec"
      ],
      migrations: "None required. In-memory thread-safe state maps using dashmap.",
      performanceTargets: "Task routing latency overhead <4ms per dispatch. Peak memory footprint <45MB.",
      securityConstraints: "Enforce TLS 1.3 socket connections. Prevent stack buffer overflows by restricting telemetry buffer queues to 10,000 items.",
      docsToUpdate: ["04_architecture_pack/system_topology.md", "05_contract_pack/interfaces_and_schemas.md"],
      definitionOfDone: [
        "Async server compiles under rustc 1.70+ with zero warnings.",
        "gRPC handshake handles up to 50,000 requests/second under test simulations.",
        "Cargo clippy and cargo test pass fully with 100% test coverage on einstein.rs"
      ],
      rollbackNotes: "If async tasks trigger heap allocation memory leaks, rollback dynamic tokio spawn tasks to a static thread-pool worker channel."
    },
    {
      id: "pkt-2",
      title: "Packet 02: Solidity X402 Escrow Smart Contract",
      targetRole: "Solidity / Smart Contract Auditor",
      summary: "Implement the gas-optimized payment lock, validation challenge, and micro-settlement payouts.",
      objective: "Write and audit the EVM-compatible Solidity smart contract governing the automated collateral lock, verification challenge, and instant payout release for the X402 standard.",
      scope: "Solidity smart contract, reentrancy protections, token deposit escrows, and signed proof arbitrations.",
      files: [
        "contracts/X402Escrow.sol - Lock, challenge, release methods",
        "contracts/interfaces/IX402Escrow.sol - External ABI interface",
        "hardhat.config.js - Compile optimization configuration"
      ],
      contracts: "Adhere to IERC20 token interactions. Support custom verifyAndRelease signature mapping.",
      dependencies: ["@openzeppelin/contracts/security/ReentrancyGuard.sol", "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol"],
      tests: [
        "assert_deposit_locks_collateral() - assert balance is escrowed and cannot be double spent",
        "assert_reentrancy_reverts() - audit reentrancy vectors",
        "assert_release_with_valid_merkle_proof() - verify release with pre-calculated hashes"
      ],
      migrations: "L2 Deploy script utilizing Hardhat/Ignition with state locks.",
      performanceTargets: "Gas consumption per deposit <45,000 gas units. Gas consumption per release <38,000 gas units.",
      securityConstraints: "Must implement CEI (Checks-Effects-Interactions) pattern. Enforce owner-only configurations for emergency fee limits.",
      docsToUpdate: ["06_economics_pack/pricing_and_quotes.md", "05_contract_pack/interfaces_and_schemas.md"],
      definitionOfDone: [
        "Contract compiles with Solidity 0.8.20 and optimization enabled (10,000 runs).",
        "Fully passed Hardhat test coverage (100% of methods verified).",
        "Slither static analyzer outputs zero critical security warnings."
      ],
      rollbackNotes: "If L2 settlement networks experience excessive gas hikes, revert single-release methods to consolidated multi-agent batch withdrawals."
    },
    {
      id: "pkt-3",
      title: "Packet 03: Gnomledger Mint Client",
      targetRole: "Go / Blockchain Backend Developer",
      summary: "Write the Go microservice that aggregates hash receipts and commits Merkle proofs to the ledger.",
      objective: "Build a highly scalable Go microservice client that compiles Merkle trees from local task execution hash receipts and mints Gnomledger Receipt Artifacts (GRAs) to Gnomledger.",
      scope: "Merkle tree generation, sha256 byte packing, Go RPC connections, and Gnomledger state commits.",
      files: [
        "client/gnomledger_mint.go - Merkle block packing and node connections",
        "client/merkle_tree.go - Core cryptographic tree algorithms",
        "go.mod - Manage library dependencies"
      ],
      contracts: "Obey Gnomledger blockchain transaction schemas and payload validation patterns.",
      dependencies: ["github.com/ethereum/go-ethereum/crypto", "github.com/gorilla/websocket", "github.com/sirupsen/logrus"],
      tests: [
        "TestMerkleRootCalculation() - assert math correctness",
        "TestGraOnChainSubmission() - mock node socket and check success receipt",
        "TestConcurrencyMerklePacks() - test with 10,000 parallel threads"
      ],
      migrations: "Genesis block configuration schemas and SQL state tables for caching.",
      performanceTargets: "Merkle root calculation for 5,000 receipts <1.5ms. Go client throughput >20,000 GRAs/sec.",
      securityConstraints: "Enforce SHA-256 state hashing with salt strings. Keep private keys strictly in isolated system memory; never dump to disk logs.",
      docsToUpdate: ["07_evidence_validation_pack/grounding_and_gaps.md", "11_appendix_explorer/glossary_and_ledgers.md"],
      definitionOfDone: [
        "Go microservice compiles cleanly under Go 1.21+.",
        "Zero data races detected under go test -race flag execution.",
        "Docker container image footprint under 18MB compiled."
      ],
      rollbackNotes: "If Gnomledger nodes reject block mints due to network consensus split, buffer hash lists in local BadgerDB key-value pools until recovery."
    },
    {
      id: "pkt-4",
      title: "Packet 04: Biometric Feedback Core",
      targetRole: "TypeScript Full-Stack Engineer / UI Developer",
      summary: "Assemble the responsive telemetry ingestion module that measures cognitive stress inputs.",
      objective: "Develop a Node.js/Express and React telemetry routing module that parses incoming biometric wearable variables and adapts AI scheduling weights.",
      scope: "Express REST receivers, biometric calculation algorithms, React telemetry widgets, and real-time state mappings.",
      files: [
        "src/controllers/biometrics.ts - Express REST ingestion handler",
        "src/utils/stress_metrics.ts - stress calculation formulas",
        "src/components/BiometricsDisplay.tsx - interactive React charts and overlays"
      ],
      contracts: "Matches biometric JSON API exchange formats exactly.",
      dependencies: ["express", "zod", "recharts", "motion"],
      tests: [
        "test_stress_adaptation_formula() - verify algorithm correctness",
        "test_zod_biometric_validation() - assert payload validation rejects bad integers"
      ],
      migrations: "None. Direct React memory state binding and local Express middleware routing.",
      performanceTargets: "Biometric analysis loop resolves in <8ms. Chart renders at stable 60fps.",
      securityConstraints: "Anonymize all patient and client identifiers. Use AES-GCM to encrypt files cached on local disk.",
      docsToUpdate: ["02_product_requirements/prd.md", "03_capability_registry/registry.md"],
      definitionOfDone: [
        "Node server compiles with zero TypeScript errors.",
        "Biometric data widgets render in the browser at stable frame rates.",
        "Zod middleware safely handles bad payload parameters."
      ],
      rollbackNotes: "In case of local network dropout, store biometric telemetry inside IndexedDB and sync in bulk when client is online."
    }
  ];

  const packetsToUse = compiledPackets && compiledPackets.length > 0 ? compiledPackets : defaultPackets;
  const [activePacketId, setActivePacketId] = useState<string | null>(null);
  const selectedPacket = packetsToUse.find(p => p.id === activePacketId) || packetsToUse[0] || defaultPackets[0];

  const handleCopyPrompt = (pkt: ExecutionPacket) => {
    // Determine jurisdiction compliance instruction
    let complianceRule = "Standard cryptographic security controls and auditable public Merkle proofs.";
    if (selectedJurisdiction === "canada") {
      complianceRule = "Strict AWS ca-central-1 region containment. Keep biometric telemetry locally isolated on-device. Encrypt with FIPS 140-3 AES-GCM-256 levels.";
    } else if (selectedJurisdiction === "eu") {
      complianceRule = "EU AI Act Transparency logging enabled. Strict GDPR Article 44 cross-border restrictions. Continuous Einstein scheduler drift checks.";
    } else if (selectedJurisdiction === "us") {
      complianceRule = "NIST AI SP 800-218 Software Assurance guidelines. Micropayments restricted under strict SEC-compliant circuit breakers and daily caps.";
    }

    const promptMarkdown = `### SYSTEM CONSTITUTION & COMPLIANCE ENVELOPE
- **Applied Jurisdiction Profile**: ${selectedJurisdiction.toUpperCase()}
- **Constitution Version**: ${constitutionVersion}
- **Lock Status**: ${constitutionState}
- **Cryptographic Blueprint Hash**: ${blueprintHash}

You are strictly bound by the rules of this Constitution and the selected Jurisdiction. 
No mock integrations or dynamic structural overrides are allowed. Compliance controls must be hardcoded and verified.

### AI AGENT HANDOFF WORK ORDER SPECIFICATION
### ROLE REQUIREMENT: ${pkt.targetRole}

#### 1. OBJECTIVE & FUNCTIONAL MISSION
${pkt.objective}

#### 2. ARCHITECTURAL SCOPE BOUNDARIES
${pkt.scope}

#### 3. WORKSPACE FILES TO CREATE OR UPDATE
${pkt.files.map(f => `- ${f}`).join("\n")}

#### 4. CONTRACT CONSTRAINTS & INTERFACES
${pkt.contracts}

#### 5. ALLOWED SYSTEM DEPENDENCIES
${pkt.dependencies.map(d => `- \`${d}\``).join("\n")}

#### 6. REQUIRED TEST COVERAGE MATRIX
${pkt.tests.map(t => `- ${t}`).join("\n")}

#### 7. SCHEMA MIGRATIONS
${pkt.migrations}

#### 8. PERFORMANCE TARGETS & SLOs
${pkt.performanceTargets}

#### 9. COMPLIANCE & SECURITY CONSTRAINTS
- **Jurisdictional Rule**: ${complianceRule}
- **Base Constraints**: ${pkt.securityConstraints}

#### 10. SYSTEM DOCUMENTS TO UPDATE
${pkt.docsToUpdate.map(doc => `- \`${doc}\``).join("\n")}

#### 11. DEFINITION OF DONE (DoD)
- [ ] Must align with active Constitution version ${constitutionVersion} and selected profile ${selectedJurisdiction.toUpperCase()}.
${pkt.definitionOfDone.map(dod => `- [ ] ${dod}`).join("\n")}

#### 12. DISASTER RECOVERABILITY & ROLLBACK NOTES
${pkt.rollbackNotes}

---
*Lock Hash Verification: ${blueprintHash}*
`;

    navigator.clipboard.writeText(promptMarkdown).then(() => {
      setCopiedId(pkt.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn text-[#E0E0E0]">
      {/* Header */}
      <div className="border-b border-[#222] pb-4">
        <div className="flex items-center gap-2">
          <Cpu className="text-[#00F0FF]" size={18} />
          <h3 className="text-xl font-black text-white uppercase tracking-tight">Agent Execution Packets</h3>
        </div>
        <p className="text-xs font-mono text-[#666] uppercase mt-1">
          Deterministic work orders designed to hand off directly to coding agents (Cursor, Windsurf, Anti-Gravity)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Selector list */}
        <div className="lg:col-span-4 space-y-2.5 font-mono">
          <span className="text-[9px] text-[#555] font-black tracking-widest uppercase block mb-1">Select Active Work Order</span>
          {packetsToUse.map((pkt) => {
            const isSel = selectedPacket.id === pkt.id;
            return (
              <button
                key={pkt.id}
                onClick={() => setActivePacketId(pkt.id)}
                className={`w-full p-4 border-2 text-left uppercase transition-all rounded-none block ${
                  isSel
                    ? "bg-[#0A0A0A] border-[#00F0FF] text-[#00F0FF] font-black"
                    : "bg-[#050505] border-[#222] text-[#888] hover:text-white hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black tracking-tight truncate block max-w-[200px]">{pkt.title}</span>
                  <ChevronRight size={12} className={isSel ? "text-[#00F0FF]" : "text-gray-600"} />
                </div>
                <p className="text-[9px] text-gray-500 normal-case line-clamp-2 mt-1 leading-relaxed">
                  {pkt.summary}
                </p>
              </button>
            );
          })}
        </div>

        {/* Right Column: Detailed work order display */}
        <div className="lg:col-span-8 bg-[#050505] border-2 border-[#222] p-6 space-y-6 font-mono text-xs uppercase relative rounded-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#00F0FF]/1 rounded-full blur-3xl pointer-events-none" />

          {/* Selector header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#222] pb-4">
            <div>
              <span className="text-[9px] text-[#00F0FF] font-black tracking-widest uppercase block">[ WORK ORDER DIRECTIVE ]</span>
              <h4 className="text-base font-black text-white tracking-tight">{selectedPacket.title}</h4>
              <p className="text-[10px] text-gray-500 normal-case mt-1">Role: <span className="text-gray-300 font-bold">{selectedPacket.targetRole}</span></p>
            </div>

            <button
              onClick={() => handleCopyPrompt(selectedPacket)}
              className="px-4 py-2 bg-[#00F0FF] hover:bg-white text-black text-[10px] font-black tracking-widest uppercase transition-colors rounded-none flex items-center gap-2"
            >
              {copiedId === selectedPacket.id ? (
                <>
                  <CheckCircle2 size={12} className="text-black" />
                  <span>Prompt Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy Prompt</span>
                </>
              )}
            </button>
          </div>

          {/* Details list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[11px] leading-relaxed">
            
            {/* Objective */}
            <div className="space-y-1.5 p-4 border border-[#111] bg-[#0A0A0A] md:col-span-2">
              <span className="text-white font-black flex items-center gap-1">
                <FileText size={12} className="text-[#00F0FF]" />
                <span>1. Objective & Functional Mission</span>
              </span>
              <p className="text-gray-400 normal-case text-[10.5px] leading-relaxed">{selectedPacket.objective}</p>
            </div>

            {/* Scope */}
            <div className="space-y-1.5 p-4 border border-[#111] bg-[#0A0A0A]">
              <span className="text-white font-black flex items-center gap-1">
                <Code2 size={12} className="text-[#00F0FF]" />
                <span>2. Architectural Scope</span>
              </span>
              <p className="text-gray-400 normal-case text-[10.5px] leading-relaxed">{selectedPacket.scope}</p>
            </div>

            {/* Contracts */}
            <div className="space-y-1.5 p-4 border border-[#111] bg-[#0A0A0A]">
              <span className="text-white font-black flex items-center gap-1">
                <ShieldAlert size={12} className="text-[#00F0FF]" />
                <span>3. Contracts & Interfaces</span>
              </span>
              <p className="text-gray-400 normal-case text-[10.5px] leading-relaxed">{selectedPacket.contracts}</p>
            </div>

            {/* Files to Create */}
            <div className="space-y-1.5 p-4 border border-[#111] bg-[#0A0A0A]">
              <span className="text-white font-black">4. Files to Create/Update</span>
              <div className="space-y-1 text-gray-400 font-bold text-[10px]">
                {selectedPacket.files.map((f, i) => (
                  <div key={i} className="truncate block">- {f}</div>
                ))}
              </div>
            </div>

            {/* Dependencies */}
            <div className="space-y-1.5 p-4 border border-[#111] bg-[#0A0A0A]">
              <span className="text-white font-black">5. Allowed Dependencies</span>
              <div className="space-y-1 text-gray-500 font-black text-[10px]">
                {selectedPacket.dependencies.map((d, i) => (
                  <div key={i} className="normal-case font-mono block">- {d}</div>
                ))}
              </div>
            </div>

            {/* Tests to Write */}
            <div className="space-y-1.5 p-4 border border-[#111] bg-[#0A0A0A]">
              <span className="text-white font-black">6. Required Tests</span>
              <div className="space-y-1 text-gray-400 text-[10px]">
                {selectedPacket.tests.map((t, i) => (
                  <div key={i} className="normal-case font-mono block">- {t}</div>
                ))}
              </div>
            </div>

            {/* Performance Targets */}
            <div className="space-y-1.5 p-4 border border-[#111] bg-[#0A0A0A]">
              <span className="text-white font-black">7. SLOs & Performance Targets</span>
              <p className="text-[#00F0FF] font-black text-[10px]">{selectedPacket.performanceTargets}</p>
            </div>

            {/* Security Constraints */}
            <div className="space-y-1.5 p-4 border border-[#111] bg-[#0A0A0A] md:col-span-2">
              <span className="text-red-400 font-black">8. Security & Data Boundaries</span>
              <p className="text-gray-400 normal-case text-[10.5px] leading-relaxed">{selectedPacket.securityConstraints}</p>
            </div>

            {/* Definition of Done */}
            <div className="space-y-1.5 p-4 border border-[#111] bg-[#0A0A0A] md:col-span-2">
              <span className="text-emerald-400 font-black">9. Definition of Done (DoD)</span>
              <div className="space-y-1.5 text-gray-400 normal-case text-[10.5px] leading-relaxed">
                {selectedPacket.definitionOfDone.map((dod, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold shrink-0">[✓]</span>
                    <span>{dod}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rollback Notes */}
            <div className="space-y-1.5 p-4 border border-red-500/20 bg-[#1C0F0F] md:col-span-2 text-red-300">
              <span className="font-black text-red-400 block mb-0.5">10. Disaster Rollback Notes</span>
              <p className="normal-case leading-relaxed text-[10.5px]">{selectedPacket.rollbackNotes}</p>
            </div>

            {/* Section 11: Unified Constitutional Enforcement References */}
            <div className="space-y-2 p-4 border-2 border-[#00F0FF]/30 bg-[#0A1A24]/30 md:col-span-2 text-[#00F0FF] font-mono">
              <span className="font-black text-white uppercase block mb-1">
                🛡️ 11. Unified Constitutional Enforcement References
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px] uppercase leading-normal pt-1 border-t border-[#00F0FF]/20">
                <div className="space-y-1">
                  <span className="text-[#666] font-bold block">Sovereign Reference ID:</span>
                  <span className="text-white font-black block">govern-agent-session ({constitutionVersion})</span>
                  <span className="text-gray-400 block lowercase normal-case">Enforces the active {selectedJurisdiction.toUpperCase()} Core Policy overlays.</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[#666] font-bold block">Exported Governance Artifacts:</span>
                  <div className="text-gray-300 space-y-0.5">
                    <div>• <span className="font-bold text-[#00F0FF]">Lineage Manifest:</span> <span className="select-all">00_workspace_manifest/governance_export_lineage.json</span></div>
                    <div>• <span className="font-bold text-[#00F0FF]">Approval Manifest:</span> <span className="select-all">00_workspace_manifest/governance_export_ownership_approval.json</span></div>
                    <div>• <span className="font-bold text-[#00F0FF]">Promotion Scheme:</span> <span className="select-all">00_workspace_manifest/governance_export_promotion_rules.json</span></div>
                    <div>• <span className="font-bold text-[#00F0FF]">Jurisdiction Table:</span> <span className="select-all">00_workspace_manifest/governance_export_jurisdiction_overrides.json</span></div>
                  </div>
                </div>
              </div>
              <div className="mt-2 p-2 bg-[#050505] border border-[#00F0FF]/10 text-[9px] text-gray-400 lowercase leading-relaxed">
                *the coding agent compiling this block must reference these JSON/YAML manifest files by ID and version to verify that target methods (e.g. <code>POST /api/v1/sessions/govern</code>) and enclaves remain 100% compliant with the signed constitution.
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
