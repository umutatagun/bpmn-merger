import type { DiffEntry, SelectionMap } from '../lib/types';

interface StatusBarProps {
  entries: DiffEntry[];
  selections: SelectionMap;
}

export default function StatusBar({ entries, selections }: StatusBarProps) {
  const total = entries.length;
  const added = entries.filter(e => e.status === 'added').length;
  const modified = entries.filter(e => e.status === 'modified').length;
  const removed = entries.filter(e => e.status === 'removed').length;
  const included = entries.filter(e => e.status !== 'unchanged' && (selections[e.id] ?? false)).length;
  const changed = added + modified + removed;

  return (
    <div className="flex items-center h-7 px-5 bg-surface-raised/60 border-t border-border text-[11px] text-gray-600 shrink-0 gap-1">
      <Stat label="Elements" value={total} />
      <Sep />
      <Stat label="Changed" value={changed} className="text-gray-400" />
      <span className="text-gray-700 mx-0.5">(</span>
      <Stat value={added} className="text-emerald-500" />
      <span className="text-gray-700">/</span>
      <Stat value={modified} className="text-amber-500" />
      <span className="text-gray-700">/</span>
      <Stat value={removed} className="text-red-500" />
      <span className="text-gray-700">)</span>
      <Sep />
      <Stat label="In merge" value={included} className="text-blue-400" />
    </div>
  );
}

function Stat({ label, value, className = '' }: { label?: string; value: number; className?: string }) {
  return (
    <span className="flex items-center gap-1">
      {label && <span>{label}</span>}
      <span className={`font-semibold tabular-nums ${className}`}>{value}</span>
    </span>
  );
}

function Sep() {
  return <span className="w-px h-3 bg-white/[0.06] mx-2" />;
}
