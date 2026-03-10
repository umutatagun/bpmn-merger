import { useState, useRef } from 'react';
import type { DiffEntry, SelectionMap, SubSelectionMap } from '../lib/types';

interface SidebarProps {
  entries: DiffEntry[];
  selections: SelectionMap;
  subSelections: SubSelectionMap;
  onToggle: (id: string) => void;
  onRangeToggle: (fromId: string, toId: string) => void;
  onSubToggle: (key: string) => void;
}

const STATUS_CONFIG: Record<string, { dot: string; badge: string; label: string }> = {
  added:    { dot: 'bg-emerald-400', badge: 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20', label: 'ADD' },
  modified: { dot: 'bg-amber-400',   badge: 'text-amber-400 bg-amber-500/10 ring-amber-500/20',     label: 'MOD' },
  removed:  { dot: 'bg-red-400',     badge: 'text-red-400 bg-red-500/10 ring-red-500/20',           label: 'DEL' },
};

export default function Sidebar({ entries, selections, subSelections, onToggle, onRangeToggle, onSubToggle }: SidebarProps) {
  const changed = entries.filter(e => e.status !== 'unchanged');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const lastClickedRef = useRef<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-border">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-gray-300 uppercase tracking-[0.12em]">Changes</span>
          {changed.length > 0 && (
            <span className="text-[11px] font-bold text-gray-400 bg-white/[0.06] px-2.5 py-0.5 rounded-full">{changed.length}</span>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {changed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-4">
            <div className="w-8 h-8 rounded-lg bg-white/[0.03] flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-xs text-gray-600">Files are identical</p>
          </div>
        ) : (
          changed.map((entry, i) => {
            const included = selections[entry.id] ?? false;
            const cfg = STATUS_CONFIG[entry.status];
            const hasSubChanges = entry.status === 'modified' && entry.subChanges && entry.subChanges.length > 0;
            const isExpanded = expandedIds.has(entry.id);

            return (
              <div key={entry.id} style={{ animationDelay: `${i * 30}ms` }}>
                {/* Main entry row */}
                <div
                  className={`
                    group flex items-start gap-3 mx-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150
                    hover:bg-white/[0.03]
                    ${!included ? 'opacity-30' : ''}
                  `}
                  onClick={(e) => {
                    if (e.shiftKey && lastClickedRef.current && lastClickedRef.current !== entry.id) {
                      onRangeToggle(lastClickedRef.current, entry.id);
                    } else {
                      onToggle(entry.id);
                    }
                    lastClickedRef.current = entry.id;
                  }}
                >
                  {/* Toggle */}
                  <div className="pt-0.5 shrink-0">
                    <div className={`
                      w-[18px] h-[18px] rounded-md flex items-center justify-center transition-all duration-200
                      ${included
                        ? 'bg-blue-500 shadow-sm shadow-blue-500/30'
                        : 'bg-white/[0.04] border border-white/[0.1] group-hover:border-white/[0.2]'
                      }
                    `}>
                      {included && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold px-1.5 py-[1px] rounded ring-1 ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                      <span className="text-[12px] text-gray-300 truncate font-medium leading-tight">{entry.name}</span>
                    </div>
                    <span className="text-[10px] text-gray-600 truncate leading-tight">
                      {entry.tagName} &middot; <span className="font-mono text-gray-700">{entry.id}</span>
                    </span>
                  </div>

                  {/* Expand button for modified elements with sub-changes */}
                  {hasSubChanges && included && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleExpand(entry.id); }}
                      className="shrink-0 mt-0.5 w-6 h-6 rounded-md flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] text-gray-500 hover:text-gray-300 transition-all"
                      title={isExpanded ? 'Collapse details' : 'Expand details'}
                    >
                      <svg
                        className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Sub-changes detail panel */}
                {hasSubChanges && isExpanded && included && (
                  <div className="mx-2 mb-1 ml-8 mr-3">
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg overflow-hidden">
                      {entry.subChanges!.map((sc, si) => {
                        const subKey = sc.kind === 'attr'
                          ? `${entry.id}::attr::${sc.name}`
                          : `${entry.id}::child::${si}`;
                        const useNew = subSelections[subKey] ?? true;

                        return (
                          <div
                            key={subKey}
                            className={`
                              flex items-start gap-2.5 px-3 py-2 cursor-pointer transition-all duration-150
                              hover:bg-white/[0.03]
                              ${si > 0 ? 'border-t border-white/[0.04]' : ''}
                              ${!useNew ? 'opacity-50' : ''}
                            `}
                            onClick={(e) => { e.stopPropagation(); onSubToggle(subKey); }}
                          >
                            {/* Mini toggle */}
                            <div className="pt-px shrink-0">
                              <div className={`
                                w-[14px] h-[14px] rounded flex items-center justify-center transition-all duration-200
                                ${useNew
                                  ? 'bg-amber-500/80 shadow-sm shadow-amber-500/20'
                                  : 'bg-white/[0.04] border border-white/[0.1]'
                                }
                              `}>
                                {useNew && (
                                  <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                  </svg>
                                )}
                              </div>
                            </div>

                            {/* Sub-change content */}
                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                              {sc.kind === 'attr' ? (
                                <>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-[1px] rounded">ATTR</span>
                                    <span className="text-[11px] text-gray-300 font-mono font-medium">{sc.name}</span>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    {sc.baseValue !== null && (
                                      <div className="flex items-center gap-1.5 text-[10px]">
                                        <span className="text-red-400/70 font-mono">-</span>
                                        <span className="text-red-400/60 font-mono truncate">{sc.baseValue}</span>
                                      </div>
                                    )}
                                    {sc.newValue !== null && (
                                      <div className="flex items-center gap-1.5 text-[10px]">
                                        <span className="text-emerald-400/70 font-mono">+</span>
                                        <span className="text-emerald-400/60 font-mono truncate">{sc.newValue}</span>
                                      </div>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-bold text-violet-400 bg-violet-500/10 px-1.5 py-[1px] rounded">CHILD</span>
                                    <span className="text-[11px] text-gray-300 font-medium truncate">{sc.label}</span>
                                  </div>
                                  <span className="text-[9px] text-gray-600 font-mono">&lt;{sc.tag}&gt;</span>
                                </>
                              )}
                              <span className="text-[9px] text-gray-700">
                                {useNew ? 'Using NEW version' : 'Using BASE version'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
