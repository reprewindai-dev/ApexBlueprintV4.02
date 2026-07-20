import React, { useState, useMemo } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Info, FileCode, CheckCircle2, ShieldCheck, Database, Layout } from "lucide-react";

interface VirtualFile {
  path: string;
  content: string;
}

interface BlueprintFileChartProps {
  files: VirtualFile[];
}

export const BlueprintFileChart: React.FC<BlueprintFileChartProps> = ({ files = [] }) => {
  const [metric, setMetric] = useState<"count" | "size">("count");
  const [chartType, setChartType] = useState<"pie" | "bar">("pie");

  // Process files to compute type distributions
  const distributionData = useMemo(() => {
    if (!files || files.length === 0) {
      return [];
    }

    let jsonCount = 0;
    let jsonSize = 0;
    let mdCount = 0;
    let mdSize = 0;
    let cryptoCount = 0;
    let cryptoSize = 0;
    let codeCount = 0;
    let codeSize = 0;
    let otherCount = 0;
    let otherSize = 0;

    files.forEach((file) => {
      const pathLower = file.path.toLowerCase();
      const contentSize = file.content ? file.content.length : 0;

      if (pathLower.endsWith(".json")) {
        jsonCount++;
        jsonSize += contentSize;
      } else if (pathLower.endsWith(".md") || pathLower.endsWith(".txt")) {
        mdCount++;
        mdSize += contentSize;
      } else if (
        pathLower.endsWith(".sig") ||
        pathLower.endsWith(".sha256") ||
        pathLower.endsWith(".signature")
      ) {
        cryptoCount++;
        cryptoSize += contentSize;
      } else if (
        pathLower.endsWith(".ts") ||
        pathLower.endsWith(".tsx") ||
        pathLower.endsWith(".rs") ||
        pathLower.endsWith(".sol") ||
        pathLower.endsWith(".js") ||
        pathLower.endsWith(".py") ||
        pathLower.includes("packet-")
      ) {
        codeCount++;
        codeSize += contentSize;
      } else {
        otherCount++;
        otherSize += contentSize;
      }
    });

    return [
      {
        name: "JSON Configs & Schemas",
        count: jsonCount,
        size: jsonSize,
        color: "#00F0FF",
        icon: Database,
        description: "Machine-readable blueprints, API schemas, and workspace manifests.",
      },
      {
        name: "Sovereign Documentation",
        count: mdCount,
        size: mdSize,
        color: "#A855F7",
        icon: Info,
        description: "Human-readable sovereign specifications and agent action descriptions.",
      },
      {
        name: "Cryptographic Proofs",
        count: cryptoCount,
        size: cryptoSize,
        color: "#10B981",
        icon: ShieldCheck,
        description: "SHA-256 integrity logs, Merkle root verification, and signer signatures.",
      },
      {
        name: "Agent & Ledger Code",
        count: codeCount,
        size: codeSize,
        color: "#F59E0B",
        icon: FileCode,
        description: "Solidity Escrow contracts, Rust Einstein Schedulers, and execution packets.",
      },
      {
        name: "System Metadata",
        count: otherCount,
        size: otherSize,
        color: "#6B7280",
        icon: Layout,
        description: "Repository maps, system dependencies, and deployment overrides.",
      },
    ].filter((item) => (metric === "count" ? item.count > 0 : item.size > 0));
  }, [files, metric]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalCount = files.length;
    let totalSize = files.reduce((acc, f) => acc + (f.content ? f.content.length : 0), 0);
    return { totalCount, totalSize };
  }, [files]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const chartData = useMemo(() => {
    return distributionData.map((item) => ({
      name: item.name,
      value: metric === "count" ? item.count : item.size,
      color: item.color,
    }));
  }, [distributionData, metric]);

  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const originalItem = distributionData.find((d) => d.name === data.name);
      return (
        <div className="bg-[#0A0A0A] border border-[#222] p-3 text-xs font-mono rounded-none">
          <p className="font-black uppercase tracking-wider text-white border-b border-[#222] pb-1.5 mb-1.5">
            {data.name}
          </p>
          <div className="space-y-1">
            <p className="text-gray-400">
              Files: <span className="text-white font-bold">{originalItem?.count}</span>
            </p>
            <p className="text-gray-400">
              Total Volume: <span className="text-[#00F0FF] font-bold">{formatSize(originalItem?.size || 0)}</span>
            </p>
            {originalItem?.description && (
              <p className="text-[10px] text-[#555] italic leading-snug pt-1 border-t border-[#111] mt-1">
                {originalItem.description}
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-5 border-2 border-[#222] bg-[#0A0A0A] space-y-5 rounded-none">
      <div className="flex flex-wrap items-center justify-between border-b border-[#222] pb-3 gap-3">
        <div className="space-y-1">
          <span className="text-[10px] font-mono font-black text-[#666] uppercase block">ARCHITECTURAL METRIC SYSTEM</span>
          <h4 className="text-sm font-black text-white font-mono uppercase tracking-wider flex items-center gap-1.5">
            <FileCode size={16} className="text-[#00F0FF]" />
            <span>Blueprint Specification Breakdown</span>
          </h4>
        </div>

        {/* Filters and Metric Switchers */}
        <div className="flex items-center gap-4">
          {/* Chart Type Toggle */}
          <div className="flex items-center bg-[#111] border border-[#222] p-0.5">
            <button
              onClick={() => setChartType("pie")}
              className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider transition-colors ${
                chartType === "pie" ? "bg-[#00F0FF] text-black" : "text-gray-500 hover:text-white"
              }`}
            >
              Pie
            </button>
            <button
              onClick={() => setChartType("bar")}
              className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider transition-colors ${
                chartType === "bar" ? "bg-[#00F0FF] text-black" : "text-gray-500 hover:text-white"
              }`}
            >
              Bar
            </button>
          </div>

          {/* Metric Selector Toggle */}
          <div className="flex items-center bg-[#111] border border-[#222] p-0.5">
            <button
              onClick={() => setMetric("count")}
              className={`px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider transition-colors ${
                metric === "count" ? "bg-[#00F0FF] text-black" : "text-gray-500 hover:text-white"
              }`}
            >
              File Count ({stats.totalCount})
            </button>
            <button
              onClick={() => setMetric("size")}
              className={`px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider transition-colors ${
                metric === "size" ? "bg-[#00F0FF] text-black" : "text-gray-500 hover:text-white"
              }`}
            >
              Volume ({formatSize(stats.totalSize)})
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Recharts Area (left column in LG) */}
        <div className="lg:col-span-6 h-[220px] flex items-center justify-center bg-[#050505]/60 border border-[#111] p-2 relative">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "pie" ? (
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#050505" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip content={customTooltip} />
              </PieChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#111" />
                <XAxis dataKey="name" tick={{ fill: "#444", fontSize: 8 }} axisLine={{ stroke: "#222" }} tickLine={{ stroke: "#222" }} />
                <YAxis tick={{ fill: "#444", fontSize: 8 }} axisLine={{ stroke: "#222" }} tickLine={{ stroke: "#222" }} />
                <Tooltip content={customTooltip} cursor={{ fill: "#111", opacity: 0.2 }} />
                <Bar dataKey="value" fill="#00F0FF">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>

          {/* Central Label for Pie Chart */}
          {chartType === "pie" && (
            <div className="absolute text-center select-none pointer-events-none">
              <span className="text-[10px] font-mono font-black text-[#555] block uppercase tracking-wider">
                {metric === "count" ? "Total Files" : "Total Size"}
              </span>
              <span className="text-white font-black font-mono text-sm block mt-0.5">
                {metric === "count" ? stats.totalCount : formatSize(stats.totalSize)}
              </span>
            </div>
          )}
        </div>

        {/* Legend / Detailed List (right column in LG) */}
        <div className="lg:col-span-6 space-y-3">
          <div className="space-y-2">
            {distributionData.map((item, index) => {
              const Icon = item.icon;
              const valueLabel = metric === "count" ? `${item.count} files` : formatSize(item.size);
              const percent = metric === "count"
                ? ((item.count / stats.totalCount) * 100).toFixed(1)
                : (((item.size || 0) / (stats.totalSize || 1)) * 100).toFixed(1);

              return (
                <div
                  key={index}
                  className="flex items-start gap-3 p-2 bg-[#111]/40 border border-[#1C1C1C] hover:border-[#222] transition-colors rounded-none font-mono text-[11px]"
                >
                  <div
                    className="p-1.5 shrink-0"
                    style={{ backgroundColor: `${item.color}15`, border: `1px solid ${item.color}30` }}
                  >
                    <Icon size={14} style={{ color: item.color }} />
                  </div>
                  
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-gray-300 truncate">{item.name}</span>
                      <span className="font-black text-white shrink-0" style={{ color: item.color }}>
                        {valueLabel} ({percent}%)
                      </span>
                    </div>
                    
                    <div className="w-full bg-[#1c1c1c] h-1 rounded-none overflow-hidden">
                      <div
                        className="h-full transition-all duration-500"
                        style={{ width: `${percent}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="text-[9.5px] font-mono text-[#555] uppercase flex justify-between items-center pt-2.5 border-t border-[#161616]">
        <span>Blueprint Schema: CanonicalBlueprintV1</span>
        <span className="flex items-center gap-1">
          <CheckCircle2 size={10} className="text-emerald-400" /> Fully Indexed
        </span>
      </div>
    </div>
  );
};
