import { useState, useCallback, useEffect, useRef } from 'react';
import DropZone from './components/DropZone';
import BpmnViewer from './components/BpmnViewer';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import { diffBpmn } from './lib/parser';
import { buildMergedXml } from './lib/merger';
import type { DiffEntry, SelectionMap } from './lib/types';

export default function App() {
  const [baseXml, setBaseXml] = useState<string | null>(null);
  const [newXml, setNewXml] = useState<string | null>(null);
  const [entries, setEntries] = useState<DiffEntry[]>([]);
  const [selections, setSelections] = useState<SelectionMap>({});
  const [loading, setLoading] = useState(false);
  const [compared, setCompared] = useState(false);

  const baseRef = useRef(baseXml);
  const newRef = useRef(newXml);
  baseRef.current = baseXml;
  newRef.current = newXml;

  const runCompare = useCallback((base: string, neu: string) => {
    try {
      const result = diffBpmn(base, neu);
      setEntries(result);
      const sel: SelectionMap = {};
      for (const e of result) {
        if (e.status !== 'unchanged') sel[e.id] = true;
      }
      setSelections(sel);
      setCompared(true);
    } catch (err) {
      alert('Diff failed: ' + (err as Error).message);
    }
  }, []);

  const handleBaseLoad = useCallback((xml: string) => {
    setBaseXml(xml);
    if (newRef.current) runCompare(xml, newRef.current);
  }, [runCompare]);

  const handleNewLoad = useCallback((xml: string) => {
    setNewXml(xml);
    if (baseRef.current) runCompare(baseRef.current, xml);
  }, [runCompare]);

  // Also re-compare if either file is replaced after initial compare
  useEffect(() => {
    if (baseXml && newXml) runCompare(baseXml, newXml);
  }, [baseXml, newXml, runCompare]);

  const toggleSelection = useCallback((id: string) => {
    const entry = entries.find(e => e.id === id);
    if (!entry || entry.status === 'unchanged') return;
    setSelections(prev => ({ ...prev, [id]: !(prev[id] ?? true) }));
  }, [entries]);

  const handleDownload = useCallback(() => {
    if (!baseXml || !newXml) return;
    try {
      const merged = buildMergedXml(baseXml, newXml, entries, selections);
      const blob = new Blob([merged], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'merged.bpmn';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Merge failed: ' + (err as Error).message);
    }
  }, [baseXml, newXml, entries, selections]);

  const changedCount = entries.filter(e => e.status !== 'unchanged').length;

  return (
    <div className="h-screen flex flex-col bg-surface text-white overflow-hidden">
      {/* ─── Header ─── */}
      <header className="relative z-20 flex items-center gap-5 px-5 h-12 shrink-0 border-b border-border bg-surface-raised/80 backdrop-blur-xl">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          </div>
          <span className="text-[13px] font-semibold bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent tracking-tight">
            BPMN Visual Merge
          </span>
        </div>

        <div className="w-px h-5 bg-border" />

        {/* File controls */}
        <div className="flex items-center gap-2">
          <DropZone label="BASE" onLoad={handleBaseLoad} hasContent={!!baseXml} compact />
          <DropZone label="NEW" onLoad={handleNewLoad} hasContent={!!newXml} compact />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4 ml-auto">
          {compared && (
            <div className="flex items-center gap-3 text-[11px] text-gray-500 animate-fade-in">
              <Legend color="emerald" label="Added" />
              <Legend color="amber" label="Modified" />
              <Legend color="red" label="Removed" dashed />
            </div>
          )}
          {compared && (
            <button
              onClick={handleDownload}
              className="animate-fade-in flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-xl
                bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400
                text-white
                shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50
                hover:scale-[1.03] active:scale-[0.98]
                transition-all duration-200 ease-out"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12M12 16.5V3" />
              </svg>
              Export Merged BPMN
            </button>
          )}
        </div>
      </header>

      {/* ─── Main ─── */}
      <div className="flex flex-1 min-h-0">
        {/* BASE panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <PanelToolbar label="Base" color="violet" icon={
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          } />
          <div className="flex-1 relative min-h-0">
            {compared && baseXml ? (
              <BpmnViewer xml={baseXml} entries={entries} selections={selections} side="base" onLoading={setLoading} />
            ) : (
              <DropZone label="BASE" onLoad={handleBaseLoad} hasContent={false} />
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-border relative z-10" />

        {/* NEW panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <PanelToolbar label="New" color="blue" icon={
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          } interactive={compared} />
          <div className="flex-1 relative min-h-0">
            {compared && newXml ? (
              <BpmnViewer xml={newXml} entries={entries} selections={selections} side="new" onElementClick={toggleSelection} onLoading={setLoading} />
            ) : (
              <DropZone label="NEW" onLoad={handleNewLoad} hasContent={false} />
            )}
          </div>
        </div>

        {/* Sidebar */}
        {compared && (
          <div className="w-[260px] border-l border-border bg-surface-raised/50 backdrop-blur-xl shrink-0 animate-slide-in">
            <Sidebar entries={entries} selections={selections} onToggle={toggleSelection} />
          </div>
        )}
      </div>

      {/* ─── Status ─── */}
      {compared && <StatusBar entries={entries} selections={selections} />}

      {/* ─── Loading ─── */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md">
          <div className="flex items-center gap-4 bg-surface-overlay/90 backdrop-blur-xl px-7 py-5 rounded-2xl border border-border shadow-2xl">
            <div className="relative">
              <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
              <div className="absolute inset-0 w-8 h-8 rounded-full border-2 border-blue-400/10 animate-pulse-ring" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-200">Rendering diagram</p>
              <p className="text-xs text-gray-500 mt-0.5">{changedCount > 0 ? `${changedCount} changes detected` : 'Parsing XML...'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PanelToolbar({ label, color, icon, interactive }: { label: string; color: 'violet' | 'blue'; icon: React.ReactNode; interactive?: boolean }) {
  const accent = color === 'violet'
    ? { dot: 'bg-violet-400', text: 'text-violet-300', bg: 'bg-violet-500/8', border: 'border-violet-500/15' }
    : { dot: 'bg-blue-400', text: 'text-blue-300', bg: 'bg-blue-500/8', border: 'border-blue-500/15' };

  return (
    <div className="flex items-center h-8 px-3 bg-surface-raised/40 border-b border-border shrink-0">
      <div className={`flex items-center gap-2 px-2 py-0.5 rounded-full ${accent.bg} border ${accent.border}`}>
        <span className={`${accent.text} opacity-70`}>{icon}</span>
        <span className={`text-[11px] font-semibold ${accent.text} tracking-wide`}>{label}</span>
      </div>
      {interactive && (
        <span className="ml-2 text-[10px] text-gray-600 flex items-center gap-1">
          <span className="inline-block w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
          click elements to toggle
        </span>
      )}
    </div>
  );
}


function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-500/20 border-emerald-500',
    amber: 'bg-amber-500/20 border-amber-500',
    red: 'bg-red-500/15 border-red-500',
  };
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-[3px] border ${colorMap[color]} ${dashed ? 'border-dashed' : ''} inline-block`} />
      {label}
    </span>
  );
}
