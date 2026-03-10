import { useState, useCallback, useRef } from 'react';

interface DropZoneProps {
  label: string;
  onLoad: (xml: string) => void;
  hasContent: boolean;
  compact?: boolean;
}

function validate(text: string): boolean {
  const t = text.trim();
  return t.includes('<?xml') || t.includes('<definitions') || t.includes('<bpmn:definitions');
}

function readFile(file: File, onLoad: (xml: string) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result as string;
    if (validate(text)) onLoad(text);
    else alert('Invalid BPMN file — must contain valid XML with <definitions>.');
  };
  reader.readAsText(file);
}

export default function DropZone({ label, onLoad, hasContent, compact }: DropZoneProps) {
  const [showModal, setShowModal] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file, onLoad);
    e.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file, onLoad);
  }, [onLoad]);

  const handlePaste = () => {
    const text = textareaRef.current?.value || '';
    if (validate(text)) { onLoad(text); setShowModal(false); }
    else alert('Invalid BPMN XML — must contain <?xml or <definitions>.');
  };

  const hiddenInput = (
    <input ref={fileInputRef} type="file" accept=".bpmn,.xml" className="hidden" onChange={handleFileInput} />
  );

  // ─── Full panel drop zone ───
  if (!compact) {
    return (
      <>
        {hiddenInput}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={openFilePicker}
          className={`
            flex flex-col items-center justify-center h-full cursor-pointer select-none transition-all duration-300
            ${dragOver ? 'bg-blue-500/[0.06]' : ''}
          `}
        >
          <div className={`
            group relative flex flex-col items-center gap-5 p-12 rounded-2xl border-2 border-dashed transition-all duration-300
            ${dragOver
              ? 'border-blue-400/60 bg-blue-500/[0.04] scale-[1.02]'
              : 'border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.01]'
            }
          `}>
            {/* Glow */}
            <div className={`
              absolute inset-0 rounded-2xl transition-opacity duration-500
              bg-gradient-to-b from-blue-500/5 to-transparent
              ${dragOver ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
            `} />

            <div className="relative">
              <div className={`
                w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300
                ${dragOver
                  ? 'bg-blue-500/15 shadow-lg shadow-blue-500/10'
                  : 'bg-white/[0.04] group-hover:bg-white/[0.06]'
                }
              `}>
                <svg className={`w-7 h-7 transition-colors duration-300 ${dragOver ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
            </div>

            <div className="relative text-center">
              <p className="text-sm font-medium text-gray-300">
                Drop your <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent font-semibold">{label}</span> file here
              </p>
              <p className="text-xs text-gray-600 mt-1.5">or click to browse &middot; .bpmn / .xml</p>
            </div>

            <div className="relative flex items-center gap-3 mt-1">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-white/[0.06]" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
                className="text-[11px] text-gray-600 hover:text-blue-400 transition-colors duration-200"
              >
                Paste XML
              </button>
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-white/[0.06]" />
            </div>
          </div>
        </div>

        {showModal && <PasteModal label={label} textareaRef={textareaRef} onPaste={handlePaste} onClose={() => setShowModal(false)} />}
      </>
    );
  }

  // ─── Compact header button ───
  return (
    <>
      {hiddenInput}
      <div className="flex items-center">
        <button
          onClick={openFilePicker}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className={`
            px-3 py-1.5 rounded-l-lg text-[11px] font-semibold transition-all duration-200 border
            ${dragOver
              ? 'border-blue-400/50 bg-blue-500/15 text-blue-300'
              : hasContent
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-white/[0.08] bg-white/[0.03] text-gray-400 hover:bg-white/[0.06] hover:text-gray-300'
            }
          `}
        >
          {hasContent ? (
            <span className="flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {label}
            </span>
          ) : label}
        </button>
        <button
          onClick={() => setShowModal(true)}
          title={`Paste ${label} XML`}
          className="px-1.5 py-1.5 rounded-r-lg text-[11px] border border-l-0 border-white/[0.08] bg-white/[0.03] text-gray-500 hover:bg-white/[0.06] hover:text-gray-400 transition-all duration-200"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
          </svg>
        </button>
      </div>

      {showModal && <PasteModal label={label} textareaRef={textareaRef} onPaste={handlePaste} onClose={() => setShowModal(false)} />}
    </>
  );
}

function PasteModal({ label, textareaRef, onPaste, onClose }: {
  label: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onPaste: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="animate-fade-in bg-surface-overlay/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl p-6 w-[620px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-200">Paste BPMN XML</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">Loading <span className="text-blue-400">{label}</span> diagram</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-gray-500 hover:text-gray-300 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <textarea
          ref={textareaRef}
          className="flex-1 min-h-[280px] bg-black/30 text-gray-300 text-xs font-mono leading-relaxed p-4 rounded-xl border border-white/[0.06] resize-none
            focus:outline-none focus:border-blue-500/30 focus:ring-1 focus:ring-blue-500/10
            placeholder:text-gray-700"
          placeholder='<?xml version="1.0" encoding="UTF-8"?>&#10;<definitions ...>'
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] hover:text-gray-300 transition-all">
            Cancel
          </button>
          <button onClick={onPaste} className="px-5 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-md shadow-blue-500/20 transition-all">
            Load XML
          </button>
        </div>
      </div>
    </div>
  );
}
