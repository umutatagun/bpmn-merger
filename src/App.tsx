import { useState, useCallback, useEffect, useRef } from 'react';
import DropZone from './components/DropZone';
import BpmnViewer from './components/BpmnViewer';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import { diffBpmn } from './lib/parser';
import { buildMergedXml } from './lib/merger';
import type { DiffEntry, SelectionMap, SubSelectionMap } from './lib/types';

export default function App() {
  const [baseXml, setBaseXml] = useState<string | null>(null);
  const [newXml, setNewXml] = useState<string | null>(null);
  const [entries, setEntries] = useState<DiffEntry[]>([]);
  const [selections, setSelections] = useState<SelectionMap>({});
  const [subSelections, setSubSelections] = useState<SubSelectionMap>({});
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
        if (e.status !== 'unchanged') sel[e.id] = false;
      }
      setSelections(sel);
      setSubSelections({});
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
    setSelections(prev => ({ ...prev, [id]: !(prev[id] ?? false) }));
  }, [entries]);

  const rangeToggle = useCallback((fromId: string, toId: string) => {
    const changed = entries.filter(e => e.status !== 'unchanged');
    const fromIdx = changed.findIndex(e => e.id === fromId);
    const toIdx = changed.findIndex(e => e.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const lo = Math.min(fromIdx, toIdx);
    const hi = Math.max(fromIdx, toIdx);
    // Use the target item's new state as the value for the whole range
    setSelections(prev => {
      const targetState = !(prev[toId] ?? false);
      const next = { ...prev };
      for (let i = lo; i <= hi; i++) {
        next[changed[i].id] = targetState;
      }
      return next;
    });
  }, [entries]);

  const toggleSubSelection = useCallback((key: string) => {
    setSubSelections(prev => ({ ...prev, [key]: !(prev[key] ?? true) }));
  }, []);

  const handleDownload = useCallback(() => {
    if (!baseXml || !newXml) return;
    try {
      const merged = buildMergedXml(baseXml, newXml, entries, selections, subSelections);
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
  }, [baseXml, newXml, entries, selections, subSelections]);

  const changedCount = entries.filter(e => e.status !== 'unchanged').length;

  return (
    <div className="h-screen flex flex-col bg-surface text-white overflow-hidden">
      {/* ─── Header ─── */}
      <header className="relative z-20 flex items-center gap-5 px-5 h-13 shrink-0 border-b border-border bg-surface-raised/80 backdrop-blur-xl">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          </div>
          <span className="text-[14px] font-bold bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent tracking-tight">
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

          {/* LinkedIn - always visible */}
          <a
            href="https://www.linkedin.com/in/umutatagun"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-[#0a66c2]/10 hover:border-[#0a66c2]/30 text-gray-400 hover:text-[#0a66c2] transition-all duration-200"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            <span className="text-[12px] font-semibold">Umut Atagun</span>
          </a>

          {compared && (
            <button
              onClick={handleDownload}
              className="animate-fade-in group relative flex items-center gap-2.5 px-5 py-2.5 text-[13px] font-bold rounded-xl
                bg-gradient-to-r from-emerald-600 to-teal-500
                text-white
                shadow-lg shadow-emerald-500/25
                hover:shadow-xl hover:shadow-emerald-500/40
                hover:from-emerald-500 hover:to-teal-400
                active:scale-[0.97]
                transition-all duration-200 ease-out
                overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <svg className="w-4 h-4 relative" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12M12 16.5V3" />
              </svg>
              <span className="relative">Export Merged</span>
            </button>
          )}
        </div>
      </header>

      {/* ─── Main ─── */}
      <div className="flex flex-1 min-h-0">
        {/* BASE panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <PanelToolbar label="BASE" variant="base" />
          <div className="flex-1 relative min-h-0">
            {compared && baseXml ? (
              <BpmnViewer xml={baseXml} entries={entries} selections={selections} side="base" onLoading={setLoading} />
            ) : baseXml ? (
              <BpmnViewer xml={baseXml} entries={[]} selections={{}} side="base" onLoading={setLoading} />
            ) : (
              <DropZone label="BASE" onLoad={handleBaseLoad} hasContent={false} />
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-border relative z-10" />

        {/* NEW panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <PanelToolbar label="NEW" variant="new" interactive={compared} />
          <div className="flex-1 relative min-h-0">
            {compared && newXml ? (
              <BpmnViewer xml={newXml} entries={entries} selections={selections} side="new" onElementClick={toggleSelection} onLoading={setLoading} />
            ) : newXml ? (
              <BpmnViewer xml={newXml} entries={[]} selections={{}} side="new" onLoading={setLoading} />
            ) : (
              <DropZone label="NEW" onLoad={handleNewLoad} hasContent={false} />
            )}
          </div>
        </div>

        {/* Sidebar */}
        {compared && (
          <div className="w-[340px] border-l border-border bg-surface-raised/50 backdrop-blur-xl shrink-0 animate-slide-in">
            <Sidebar
              entries={entries}
              selections={selections}
              subSelections={subSelections}
              onToggle={toggleSelection}
              onRangeToggle={rangeToggle}
              onSubToggle={toggleSubSelection}
            />
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

function PanelToolbar({ label, variant, interactive }: { label: string; variant: 'base' | 'new'; interactive?: boolean }) {
  const isBase = variant === 'base';

  return (
    <div className="flex items-center h-9 px-3 bg-surface-raised/60 border-b border-border shrink-0">
      <div className={`
        flex items-center gap-2 px-3 py-1 rounded-lg
        ${isBase
          ? 'bg-violet-500/10 border border-violet-500/20'
          : 'bg-blue-500/10 border border-blue-500/20'
        }
      `}>
        <div className={`w-2 h-2 rounded-full ${isBase ? 'bg-violet-400' : 'bg-blue-400'}`} />
        <span className={`text-[11px] font-bold tracking-widest ${isBase ? 'text-violet-300' : 'text-blue-300'}`}>
          {label}
        </span>
      </div>
      {interactive && (
        <span className="ml-3 text-[10px] text-gray-600 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
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
