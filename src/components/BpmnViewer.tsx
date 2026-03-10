import { useEffect, useRef, useCallback } from 'react';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import type { DiffEntry } from '../lib/types';

import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';

const MARKER_CSS = `
/* ── Added (green) ── */
.dm-added .djs-visual rect, .dm-added .djs-visual circle,
.dm-added .djs-visual ellipse, .dm-added .djs-visual polygon,
.dm-added .djs-visual path, .dm-added .djs-visual polyline {
  fill: rgba(34,197,94,0.35) !important; stroke: #16a34a !important; stroke-width: 3px !important;
}
.dm-added .djs-visual text { fill: #15803d !important; font-weight: 700 !important; }
.dm-added .djs-outline { visibility: visible !important; stroke: #22c55e !important; stroke-width: 2px !important; opacity: 0.5 !important; }

/* ── Modified (amber) ── */
.dm-modified .djs-visual rect, .dm-modified .djs-visual circle,
.dm-modified .djs-visual ellipse, .dm-modified .djs-visual polygon,
.dm-modified .djs-visual path, .dm-modified .djs-visual polyline {
  fill: rgba(245,158,11,0.35) !important; stroke: #d97706 !important; stroke-width: 3px !important;
}
.dm-modified .djs-visual text { fill: #92400e !important; font-weight: 700 !important; }
.dm-modified .djs-outline { visibility: visible !important; stroke: #f59e0b !important; stroke-width: 2px !important; opacity: 0.5 !important; }

/* ── Removed (red) ── */
.dm-removed .djs-visual rect, .dm-removed .djs-visual circle,
.dm-removed .djs-visual ellipse, .dm-removed .djs-visual polygon,
.dm-removed .djs-visual path, .dm-removed .djs-visual polyline {
  fill: rgba(239,68,68,0.3) !important; stroke: #dc2626 !important; stroke-width: 3px !important; stroke-dasharray: 8 4 !important;
}
.dm-removed .djs-visual text { fill: #991b1b !important; text-decoration: line-through !important; }
.dm-removed .djs-outline { visibility: visible !important; stroke: #ef4444 !important; stroke-width: 2px !important; opacity: 0.5 !important; }

/* ── Excluded (dimmed) ── */
.dm-excluded .djs-visual rect, .dm-excluded .djs-visual circle,
.dm-excluded .djs-visual ellipse, .dm-excluded .djs-visual polygon,
.dm-excluded .djs-visual path, .dm-excluded .djs-visual polyline {
  opacity: 0.2 !important; stroke: #999 !important; stroke-dasharray: 5 3 !important; fill: rgba(0,0,0,0.03) !important;
}
.dm-excluded .djs-visual text { opacity: 0.25 !important; }
`;

interface BpmnViewerProps {
  xml: string | null;
  entries: DiffEntry[];
  selections: Record<string, boolean>;
  side: 'base' | 'new';
  onElementClick?: (id: string) => void;
  onLoading?: (loading: boolean) => void;
}

export default function BpmnViewer({ xml, entries, selections, side, onElementClick, onLoading }: BpmnViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<NavigatedViewer | null>(null);

  const applyMarkers = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const canvas = viewer.get('canvas') as any;
    const elementRegistry = viewer.get('elementRegistry') as any;

    for (const el of elementRegistry.getAll()) {
      try {
        canvas.removeMarker(el.id, 'dm-added');
        canvas.removeMarker(el.id, 'dm-modified');
        canvas.removeMarker(el.id, 'dm-removed');
        canvas.removeMarker(el.id, 'dm-excluded');
      } catch { /* skip */ }
    }

    for (const entry of entries) {
      if (entry.status === 'unchanged') continue;
      try {
        if (!elementRegistry.get(entry.id)) continue;
        if (side === 'new') {
          const included = selections[entry.id] ?? true;
          if (!included) canvas.addMarker(entry.id, 'dm-excluded');
          else if (entry.status === 'added') canvas.addMarker(entry.id, 'dm-added');
          else if (entry.status === 'modified') canvas.addMarker(entry.id, 'dm-modified');
        } else {
          if (entry.status === 'removed') canvas.addMarker(entry.id, 'dm-removed');
          else if (entry.status === 'modified') canvas.addMarker(entry.id, 'dm-modified');
        }
      } catch { /* skip */ }
    }
  }, [entries, selections, side]);

  useEffect(() => {
    if (!containerRef.current || !xml) return;

    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }

    const container = containerRef.current;

    if (!container.querySelector('style[data-markers]')) {
      const style = document.createElement('style');
      style.setAttribute('data-markers', '');
      style.textContent = MARKER_CSS;
      container.appendChild(style);
    }

    const viewer = new NavigatedViewer({ container });
    viewerRef.current = viewer;

    onLoading?.(true);
    viewer.importXML(xml).then(() => {
      const canvas = viewer.get('canvas') as any;
      canvas.zoom('fit-viewport');
      applyMarkers();

      if (side === 'new' && onElementClick) {
        const eventBus = viewer.get('eventBus') as any;
        eventBus.on('element.click', (event: any) => {
          const id = event.element?.id;
          if (id) onElementClick(id);
        });
      }
      onLoading?.(false);
    }).catch((err: Error) => {
      console.error('Failed to import BPMN XML:', err);
      onLoading?.(false);
    });

    return () => { viewer.destroy(); viewerRef.current = null; };
  }, [xml]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { applyMarkers(); }, [applyMarkers]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-[#fafbfc] rounded-sm"
    />
  );
}
