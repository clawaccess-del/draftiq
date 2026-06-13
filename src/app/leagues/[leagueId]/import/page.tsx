"use client";

import { useState, use, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Upload, ArrowLeft, Loader2, Check, AlertTriangle, FileSpreadsheet, Eye } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ leagueId: string }>;
}

export default function ImportRankingsPage({ params }: PageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draftId") || "";

  // Unwrap the params promise using React.use()
  const { leagueId } = use(params);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const requiredColumns = ["player_name", "position", "nfl_team", "bye_week", "projected_points", "adp", "tier", "risk_score"];

  const missingColumns = useMemo(() => {
    if (headers.length === 0) return [];
    return requiredColumns.filter((col) => !headers.includes(col));
  }, [headers]);

  // A basic CSV parser that handles double quotes and commas
  const parseCSVText = (text: string): { headers: string[]; rows: any[] } => {
    const lines: string[] = [];
    let currentLine = "";
    let inQuotes = false;

    // Split lines respecting quoted newlines
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      }
      if ((char === "\n" || char === "\r") && !inQuotes) {
        if (currentLine.trim()) {
          lines.push(currentLine);
        }
        currentLine = "";
      } else {
        currentLine += char;
      }
    }
    if (currentLine.trim()) {
      lines.push(currentLine);
    }

    if (lines.length === 0) return { headers: [], rows: [] };

    // Helper to parse CSV fields
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let currentField = "";
      let insideQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === "," && !insideQuotes) {
          result.push(currentField.trim());
          currentField = "";
        } else {
          currentField += char;
        }
      }
      result.push(currentField.trim());
      return result;
    };

    const rawHeaders = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/["'\s]/g, "_"));
    const rows = lines.slice(1).map((line) => {
      const values = parseCSVLine(line);
      const rowObj: any = {};
      rawHeaders.forEach((header, idx) => {
        rowObj[header] = values[idx] || "";
      });
      return rowObj;
    });

    return { headers: rawHeaders, rows };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    setError("");
    setSuccessMsg("");
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      setError("Please upload a valid CSV file.");
      return;
    }

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const { headers: csvHeaders, rows } = parseCSVText(text);

        if (rows.length === 0) {
          setError("The CSV file appears to be empty.");
          return;
        }

        setHeaders(csvHeaders);
        setParsedData(rows);
      } catch (err) {
        setError("Failed to parse CSV file. Ensure it is formatted correctly.");
      }
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = async () => {
    if (missingColumns.length > 0) {
      setError("Please fix missing columns before importing.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/leagues/${leagueId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players: parsedData }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to import rankings");

      // Save rankings in localStorage if we're in offline/mock mode
      if (data.offline) {
        const offlineLeagues = JSON.parse(localStorage.getItem("offline_leagues") || "[]");
        const idx = offlineLeagues.findIndex((l: any) => l.id === leagueId);
        if (idx !== -1) {
          offlineLeagues[idx].players = parsedData.map((p, pIdx) => ({
            id: `mock-player-${pIdx + 1}`,
            name: p.player_name,
            position: p.position.toUpperCase(),
            nflTeam: (p.nfl_team || "FA").toUpperCase(),
            byeWeek: parseInt(p.bye_week, 10) || 0,
            injuryStatus: p.injury_status || null,
            rankings: [
              {
                overallRank: parseInt(p.overall_rank || p.rank, 10) || (pIdx + 1),
                positionRank: parseInt(p.position_rank || p.pos_rank, 10) || 1,
                projectedPoints: parseFloat(p.projected_points || p.projection) || 0.0,
                adp: parseFloat(p.adp) || 200.0,
                tier: parseInt(p.tier, 10) || 99,
                riskScore: parseFloat(p.risk_score || p.risk) || 5.0,
                ceilingProjection: p.ceiling_projection ? parseFloat(p.ceiling_projection) : null,
                floorProjection: p.floor_projection ? parseFloat(p.floor_projection) : null,
                notes: p.notes || "",
              },
            ],
          }));
          localStorage.setItem("offline_leagues", JSON.stringify(offlineLeagues));
        }
      }

      setSuccessMsg(`Successfully imported ${parsedData.length} players!`);
      setTimeout(() => {
        router.push(`/drafts/${draftId}`);
      }, 1500);
    } catch (err: any) {
      setError(err?.message || "Something went wrong during import.");
    } finally {
      setLoading(false);
    }
  };

  const triggerDownloadTemplate = () => {
    const csvContent =
      "player_name,position,nfl_team,bye_week,projected_points,adp,tier,risk_score,injury_status,ceiling_projection,floor_projection,notes\n" +
      'Christian McCaffrey,RB,SF,9,324.5,1.2,1,1.5,Healthy,360,280,Clear overall #1 overall value\n' +
      'CeeDee Lamb,WR,DAL,7,310.2,2.4,1,2.0,Healthy,340,270,Top targeted wideout in Dallas\n' +
      'Patrick Mahomes,QB,KC,6,380.5,34.2,2,1.2,Healthy,420,330,High floor safe starting quarterback\n' +
      'Travis Kelce,TE,KC,6,220.4,38.5,1,3.2,Healthy,250,180,Elite tight end tier leader\n';

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "draftiq_rankings_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 min-h-screen">
      {/* Top Navbar */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <span className="text-sm font-bold text-slate-400">Step 2 of 3: Import Player Projections</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Upload Player Rankings</h1>
          <p className="text-slate-400 text-sm mt-1">
            Provide player ADP, tiers, and fantasy point projections via a CSV file to feed the recommendation engine.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-950/40 border border-red-900/60 text-red-200 text-sm rounded-xl text-center">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-950/40 border border-emerald-900/60 text-emerald-200 text-sm rounded-xl text-center flex items-center justify-center gap-2 font-bold animate-pulse">
            <Check className="h-5 w-5 text-emerald-400 stroke-[3]" />
            {successMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Columns - Uploader */}
          <div className="md:col-span-2 space-y-6">
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-3xl p-10 text-center flex flex-col items-center justify-center transition-all ${
                dragActive
                  ? "border-emerald-500 bg-emerald-950/10"
                  : csvFile
                  ? "border-emerald-500/40 bg-slate-900/20"
                  : "border-slate-800 bg-slate-900/10 hover:border-slate-700"
              }`}
            >
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 mb-4 text-emerald-400 shadow-md">
                <Upload className="h-8 w-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-200">
                {csvFile ? csvFile.name : "Drag & drop your player rankings CSV file"}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                File size up to 2MB. Make sure the headers correspond to target column names.
              </p>

              <div className="mt-6">
                <label className="inline-flex items-center justify-center py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold rounded-xl text-xs transition-all border border-slate-800 cursor-pointer">
                  Browse Files
                  <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                </label>
              </div>
            </div>

            {/* CSV Data Preview */}
            {parsedData.length > 0 && (
              <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                  <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Eye className="h-4 w-4 text-emerald-400" />
                    CSV Preview ({parsedData.length} total rows)
                  </h4>
                  <span className="text-2xs font-semibold bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-400">
                    First 5 rows displayed
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-900 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Player Name</th>
                        <th className="py-2.5 px-3">Position</th>
                        <th className="py-2.5 px-3">Team</th>
                        <th className="py-2.5 px-3">Bye</th>
                        <th className="py-2.5 px-3 text-right">Proj Pts</th>
                        <th className="py-2.5 px-3 text-right">ADP</th>
                        <th className="py-2.5 px-3 text-center">Tier</th>
                        <th className="py-2.5 px-3 text-center">Risk</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/60 text-slate-300 font-medium">
                      {parsedData.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/20">
                          <td className="py-2.5 px-3 font-semibold text-white">{row.player_name || "-"}</td>
                          <td className="py-2.5 px-3 text-emerald-400">{row.position || "-"}</td>
                          <td className="py-2.5 px-3">{row.nfl_team || "-"}</td>
                          <td className="py-2.5 px-3">{row.bye_week || "-"}</td>
                          <td className="py-2.5 px-3 text-right">{row.projected_points || "-"}</td>
                          <td className="py-2.5 px-3 text-right">{row.adp || "-"}</td>
                          <td className="py-2.5 px-3 text-center font-extrabold">{row.tier || "-"}</td>
                          <td className="py-2.5 px-3 text-center">{row.risk_score || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Instructions & Validation */}
          <div className="space-y-6">
            <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 space-y-4">
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                Template Specifications
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                For best results, download our CSV template, edit the player rows, and upload it back.
              </p>

              <button
                type="button"
                onClick={triggerDownloadTemplate}
                className="w-full flex items-center justify-center py-2.5 px-4 bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/20 hover:border-emerald-500 text-emerald-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Download CSV Template
              </button>
            </div>

            {/* Validation Panel */}
            {headers.length > 0 && (
              <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 space-y-4">
                <h4 className="text-sm font-bold text-slate-200">CSV Column Validation</h4>

                <div className="space-y-2">
                  <p className="text-2xs font-bold text-slate-500 uppercase tracking-wider">Required Columns</p>
                  <div className="space-y-1.5">
                    {requiredColumns.map((col) => {
                      const present = headers.includes(col);
                      return (
                        <div key={col} className="flex items-center justify-between text-xs">
                          <code className="text-slate-300 font-mono">{col}</code>
                          {present ? (
                            <span className="text-emerald-400 flex items-center gap-1 font-bold text-2xs">
                              <Check className="h-3 w-3 stroke-[3]" /> Match
                            </span>
                          ) : (
                            <span className="text-red-400 flex items-center gap-1 font-bold text-2xs">
                              <AlertTriangle className="h-3 w-3" /> Missing
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {missingColumns.length > 0 && (
                  <div className="p-3 bg-red-950/40 border border-red-900/40 rounded-xl text-2xs text-red-200">
                    <p className="font-bold flex items-center gap-1 mb-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                      Missing Columns Detected
                    </p>
                    Your CSV is missing columns: {missingColumns.join(", ")}. Please align the headers to perform import.
                  </div>
                )}

                {missingColumns.length === 0 && (
                  <div className="p-3 bg-emerald-950/30 border border-emerald-900/30 rounded-xl text-2xs text-emerald-300">
                    <p className="font-bold flex items-center gap-1 mb-1">
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      Validation Succeeded
                    </p>
                    All required columns match! Ready to save to the database.
                  </div>
                )}
              </div>
            )}

            {parsedData.length > 0 && missingColumns.length === 0 && (
              <button
                type="button"
                onClick={handleImport}
                disabled={loading}
                className="w-full flex items-center justify-center py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-emerald-500/10 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-slate-950" />
                ) : (
                  "Import Rankings & Launch Draft"
                )}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
