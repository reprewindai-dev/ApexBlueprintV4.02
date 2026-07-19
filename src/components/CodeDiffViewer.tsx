import React, { useState, useMemo } from "react";
import { Split, Columns, Plus, Minus, Info, Clipboard, Check } from "lucide-react";

interface CodeDiffViewerProps {
  filePath: string;
  currentContent: string;
  defaultContent: string;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  text: string;
  oldLineNum?: number;
  newLineNum?: number;
}

export const CodeDiffViewer: React.FC<CodeDiffViewerProps> = ({
  filePath,
  currentContent = "",
  defaultContent = "",
}) => {
  const [viewMode, setViewMode] = useState<"split" | "unified">("split");
  const [copied, setCopied] = useState(false);

  // Parse lines and compute line-by-line LCS Diff
  const diffLines = useMemo(() => {
    const oldLines = defaultContent ? defaultContent.split(/\r?\n/) : [];
    const newLines = currentContent ? currentContent.split(/\r?\n/) : [];

    const M = oldLines.length;
    const N = newLines.length;

    // Fast-path: If one of them is empty, treat everything as additions or deletions
    if (M === 0) {
      return newLines.map((line, idx) => ({
        type: "added" as const,
        text: line,
        newLineNum: idx + 1,
      }));
    }
    if (N === 0) {
      return oldLines.map((line, idx) => ({
        type: "removed" as const,
        text: line,
        oldLineNum: idx + 1,
      }));
    }

    // Defensive safeguard for memory/performance:
    // If matrix size M * N is extremely large (> 1,000,000 entries), use a simple line-matching heuristic
    if (M * N > 1000000) {
      const result: DiffLine[] = [];
      const maxLength = Math.max(M, N);
      for (let i = 0; i < maxLength; i++) {
        if (i < M && i < N) {
          if (oldLines[i] === newLines[i]) {
            result.push({ type: "unchanged", text: oldLines[i], oldLineNum: i + 1, newLineNum: i + 1 });
          } else {
            result.push({ type: "removed", text: oldLines[i], oldLineNum: i + 1 });
            result.push({ type: "added", text: newLines[i], newLineNum: i + 1 });
          }
        } else if (i < M) {
          result.push({ type: "removed", text: oldLines[i], oldLineNum: i + 1 });
        } else if (i < N) {
          result.push({ type: "added", text: newLines[i], newLineNum: i + 1 });
        }
      }
      return result;
    }

    // Standard LCS dynamic programming table
    const dp: number[][] = Array.from({ length: M + 1 }, () => new Int32Array(N + 1) as any);

    for (let i = 1; i <= M; i++) {
      for (let j = 1; j <= N; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    const lines: DiffLine[] = [];
    let i = M;
    let j = N;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
        lines.unshift({
          type: "unchanged",
          text: oldLines[i - 1],
          oldLineNum: i,
          newLineNum: j,
        });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        lines.unshift({
          type: "added",
          text: newLines[j - 1],
          newLineNum: j,
        });
        j--;
      } else {
        lines.unshift({
          type: "removed",
          text: oldLines[i - 1],
          oldLineNum: i,
        });
        i--;
      }
    }

    return lines;
  }, [currentContent, defaultContent]);

  // Compute summary stats
  const stats = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    diffLines.forEach((line) => {
      if (line.type === "added") additions++;
      if (line.type === "removed") deletions++;
    });
    return { additions, deletions };
  }, [diffLines]);

  const handleCopyCurrent = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isIdentical = stats.additions === 0 && stats.deletions === 0;

  return (
    <div className="flex flex-col h-full bg-[#050505] border border-[#222] font-mono text-sm">
      {/* Diff Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-[#0A0A0A] border-b border-[#222]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[#111] px-2.5 py-1 border border-[#222] text-[11px] font-black uppercase text-gray-400">
            <span className="text-[#00F0FF]">{filePath.split("/").pop()}</span>
          </div>
          
          {!isIdentical && (
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-0.5 text-emerald-400 font-bold bg-emerald-950/50 px-1.5 py-0.5 border border-emerald-900/30">
                <Plus size={12} /> {stats.additions}
              </span>
              <span className="flex items-center gap-0.5 text-rose-400 font-bold bg-rose-950/50 px-1.5 py-0.5 border border-rose-900/30">
                <Minus size={12} /> {stats.deletions}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggles */}
          <div className="flex items-center bg-[#111] border border-[#222] p-0.5">
            <button
              onClick={() => setViewMode("split")}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-colors ${
                viewMode === "split"
                  ? "bg-[#00F0FF] text-black"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Split size={12} />
              <span>Split</span>
            </button>
            <button
              onClick={() => setViewMode("unified")}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-colors ${
                viewMode === "unified"
                  ? "bg-[#00F0FF] text-black"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Columns size={12} />
              <span>Unified</span>
            </button>
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopyCurrent}
            className="flex items-center gap-1 px-2.5 py-1 border border-[#222] hover:border-gray-500 bg-[#111] hover:bg-[#181818] text-[10px] font-black uppercase tracking-wider text-gray-400 hover:text-white transition-colors"
          >
            {copied ? (
              <>
                <Check size={12} className="text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Clipboard size={12} />
                <span>Copy Current</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Diff Content Body */}
      <div className="flex-1 overflow-auto max-h-[550px] bg-[#050505] scrollbar-thin scrollbar-thumb-[#222] scrollbar-track-transparent">
        {isIdentical ? (
          <div className="p-8 flex flex-col items-center justify-center text-center text-gray-500">
            <Info size={28} className="text-[#00F0FF] mb-3 opacity-60 animate-pulse" />
            <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Files are Identical</p>
            <p className="text-[11px] text-gray-600 max-w-sm">
              The currently compiled specification exactly matches the original, canonical default blueprint template. No modifications were introduced by the HRM pipeline.
            </p>
          </div>
        ) : viewMode === "split" ? (
          /* SPLIT VIEW (Side-by-Side) */
          <div className="min-w-[800px] border-collapse text-xs select-text">
            <div className="grid grid-cols-2 bg-[#0C0C0C] text-[11px] font-black text-[#555] border-b border-[#1A1A1A] py-1 px-2 uppercase tracking-wider">
              <div className="border-r border-[#1A1A1A] pr-4">Default Blueprint Template (Original)</div>
              <div className="pl-4">Currently Compiled Specification (HRM Ingest)</div>
            </div>

            <div className="flex flex-col">
              {diffLines.map((line, idx) => {
                const isAdded = line.type === "added";
                const isRemoved = line.type === "removed";
                const isUnchanged = line.type === "unchanged";

                return (
                  <div key={idx} className="grid grid-cols-2 border-b border-[#0F0F0F] hover:bg-[#0A0A0A]/30 transition-colors">
                    {/* Left side (Original / Deleted) */}
                    <div
                      className={`flex border-r border-[#1C1C1C] pr-2 ${
                        isRemoved
                          ? "bg-rose-950/20 text-rose-400/90"
                          : isAdded
                          ? "bg-transparent opacity-20"
                          : "text-gray-400"
                      }`}
                    >
                      {/* Left Line Number */}
                      <div className="w-10 text-right pr-2 py-0.5 text-[#333] select-none border-r border-[#161616] bg-[#080808]/40">
                        {isRemoved || isUnchanged ? line.oldLineNum : ""}
                      </div>
                      {/* Left Sign indicator */}
                      <div className="w-6 text-center py-0.5 text-rose-500/60 font-black select-none">
                        {isRemoved ? "-" : ""}
                      </div>
                      {/* Left text */}
                      <div className="flex-1 pl-1 py-0.5 whitespace-pre overflow-x-auto select-text font-mono text-[11px] leading-relaxed">
                        {!isAdded ? line.text : ""}
                      </div>
                    </div>

                    {/* Right side (Compiled / Added) */}
                    <div
                      className={`flex pl-2 ${
                        isAdded
                          ? "bg-emerald-950/20 text-emerald-400"
                          : isRemoved
                          ? "bg-transparent opacity-20"
                          : "text-gray-400"
                      }`}
                    >
                      {/* Right Line Number */}
                      <div className="w-10 text-right pr-2 py-0.5 text-[#333] select-none border-r border-[#161616] bg-[#080808]/40">
                        {isAdded || isUnchanged ? line.newLineNum : ""}
                      </div>
                      {/* Right Sign indicator */}
                      <div className="w-6 text-center py-0.5 text-emerald-400/60 font-black select-none">
                        {isAdded ? "+" : ""}
                      </div>
                      {/* Right text */}
                      <div className="flex-1 pl-1 py-0.5 whitespace-pre overflow-x-auto select-text font-mono text-[11px] leading-relaxed">
                        {!isRemoved ? line.text : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* UNIFIED VIEW (Inline) */
          <div className="flex flex-col text-xs font-mono select-text divide-y divide-[#0F0F0F]">
            {diffLines.map((line, idx) => {
              const isAdded = line.type === "added";
              const isRemoved = line.type === "removed";

              let lineBg = "bg-transparent";
              let lineTextColor = "text-gray-400";
              let sign = " ";
              let signColor = "text-[#333]";

              if (isAdded) {
                lineBg = "bg-emerald-950/15";
                lineTextColor = "text-emerald-400";
                sign = "+";
                signColor = "text-emerald-500/60 font-bold";
              } else if (isRemoved) {
                lineBg = "bg-rose-950/15";
                lineTextColor = "text-rose-400";
                sign = "-";
                signColor = "text-rose-500/60 font-bold";
              }

              return (
                <div key={idx} className={`flex hover:bg-[#0A0A0A]/40 transition-colors ${lineBg}`}>
                  {/* Line numbers column */}
                  <div className="w-20 flex text-right text-[#333] select-none border-r border-[#1C1C1C] bg-[#080808]/30 font-mono text-[10px] shrink-0">
                    <div className="w-10 pr-1 py-0.5 border-r border-[#0F0F0F]/50">
                      {line.oldLineNum || ""}
                    </div>
                    <div className="w-10 pr-1 py-0.5">
                      {line.newLineNum || ""}
                    </div>
                  </div>

                  {/* Sign indicator */}
                  <div className={`w-6 text-center py-0.5 select-none shrink-0 ${signColor}`}>
                    {sign}
                  </div>

                  {/* Line content */}
                  <div className={`flex-1 pl-2 py-0.5 whitespace-pre overflow-x-auto select-text text-[11px] leading-relaxed ${lineTextColor}`}>
                    {line.text}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
