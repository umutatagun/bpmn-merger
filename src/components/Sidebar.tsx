import type { DiffEntry, SelectionMap } from '../lib/types';

interface SidebarProps {
  entries: DiffEntry[];
  selections: SelectionMap;
  onToggle: (id: string) => void;
}

const STATUS_CONFIG: Record<string, { dot: string; badge: string; label: string }> = {
  added:    { dot: 'bg-emerald-400', badge: 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20', label: 'ADD' },
  modified: { dot: 'bg-amber-400',   badge: 'text-amber-400 bg-amber-500/10 ring-amber-500/20',     label: 'MOD' },
  removed:  { dot: 'bg-red-400',     badge: 'text-red-400 bg-red-500/10 ring-red-500/20',           label: 'DEL' },
};

export default function Sidebar({ entries, selections, onToggle }: SidebarProps) {
  const changed = entries.filter(e => e.status !== 'unchanged');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-border">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.15em]">Changes</span>
          {changed.length > 0 && (
            <span className="text-[10px] font-medium text-gray-600 bg-white/[0.04] px-2 py-0.5 rounded-full">{changed.length}</span>
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
            const included = selections[entry.id] ?? true;
            const cfg = STATUS_CONFIG[entry.status];
            return (
              <div
                key={entry.id}
                className={`
                  group flex items-start gap-3 mx-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150
                  hover:bg-white/[0.03]
                  ${!included ? 'opacity-30' : ''}
                `}
                style={{ animationDelay: `${i * 30}ms` }}
                onClick={() => onToggle(entry.id)}
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
