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
  const included = entries.filter(e => e.status !== 'unchanged' && (selections[e.id] ?? true)).length;
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

      <a
        href="https://www.linkedin.com/in/umutatagun"
        target="_blank"
        rel="noopener noreferrer"
        className="ml-auto flex items-center gap-1.5 text-gray-500 hover:text-[#0a66c2] transition-colors duration-200"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
        <span className="text-[10px] font-medium">Umut Atagun</span>
      </a>
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
