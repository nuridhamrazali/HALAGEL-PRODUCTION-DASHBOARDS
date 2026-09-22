import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  Copy, 
  Check, 
  X, 
  Maximize2, 
  FileText, 
  Package, 
  Cpu, 
  Hash, 
  Pin
} from 'lucide-react';
import { ProductionEntry } from '../../types';

interface ExcelRemarkPopupProps {
  remark?: string | number | null | unknown;
  type: 'plan' | 'actual';
  entry: Partial<ProductionEntry>;
  align?: 'left' | 'right';
  mode?: 'corner' | 'icon';
  className?: string;
}

export const ExcelRemarkPopup: React.FC<ExcelRemarkPopupProps> = ({
  remark,
  type,
  entry,
  align = 'right',
  mode = 'corner',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Convert remark to string safely regardless of runtime type (string, number, etc.)
  const cleanRemark = remark !== null && remark !== undefined ? String(remark).trim() : '';

  // Handle outside click when pinned or open
  useEffect(() => {
    if (!cleanRemark) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(e.target as Node) &&
        popoverRef.current && 
        !popoverRef.current.contains(e.target as Node)
      ) {
        setIsPinned(false);
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPinned(false);
        setIsOpen(false);
        setIsModalOpen(false);
      }
    };

    if (isOpen || isPinned || isModalOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [cleanRemark, isOpen, isPinned, isModalOpen]);

  // Don't render anything if remark is empty or blank
  if (!cleanRemark) {
    return null;
  }

  const isPlan = type === 'plan';
  const badgeColor = isPlan 
    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800' 
    : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800';

  const fullTypeLabel = isPlan ? 'Planning Remark' : 'Execution / Actual Remark';

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cleanRemark) {
      navigator.clipboard.writeText(cleanRemark);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPinned(!isPinned);
    setIsOpen(!isPinned);
  };

  const showPopover = isOpen || isPinned;

  return (
    <>
      <div 
        ref={containerRef}
        className={mode === 'corner' 
          ? `absolute top-0 right-0 z-20 ${className}` 
          : `relative inline-flex items-center ${className}`
        }
        onMouseEnter={() => !isPinned && setIsOpen(true)}
        onMouseLeave={() => !isPinned && setIsOpen(false)}
      >
        {/* EXCEL MARKER TRIGGER - ONLY A MARK, NO TEXT */}
        {mode === 'corner' ? (
          /* Classic Excel Top-Right Dog-Ear Triangle Marker */
          <button
            type="button"
            onClick={handleTriggerClick}
            className="w-7 h-7 flex items-start justify-end p-0 cursor-pointer group/corner focus:outline-none"
            title={`Excel Note: Click or hover to view ${fullTypeLabel}`}
          >
            {/* The crisp corner triangle */}
            <div 
              className={`w-0 h-0 border-t-[11px] border-l-[11px] border-l-transparent transition-all duration-150 group-hover/corner:scale-125 ${
                isPlan ? 'border-t-indigo-500' : 'border-t-emerald-500'
              }`}
              style={{
                filter: showPopover ? 'drop-shadow(0 0 4px rgba(99,102,241,0.6))' : 'none'
              }}
            />
          </button>
        ) : (
          /* Clean, Compact Icon Marker (e.g. for mobile card views or inline) */
          <button
            type="button"
            onClick={handleTriggerClick}
            className={`p-1 rounded-md transition-all cursor-pointer select-none ${
              showPopover 
                ? `${badgeColor} ring-2 ring-indigo-500/20 shadow-xs` 
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={`Excel Note: Click or hover to view ${fullTypeLabel}`}
          >
            <div className="relative flex items-center justify-center">
              <MessageSquare className={`w-3.5 h-3.5 ${isPlan ? 'text-indigo-500' : 'text-emerald-500'}`} />
              <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${isPlan ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
            </div>
          </button>
        )}

        {/* Floating Excel-Style Note Card (Popover) */}
        {showPopover && (
          <div
            ref={popoverRef}
            className={`absolute mt-1.5 z-[999] w-80 sm:w-96 text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-150 ${
              mode === 'corner' ? 'top-6 right-0' : 'top-full right-0'
            } ${align === 'left' ? '!left-0 !right-auto' : ''}`}
            style={{ filter: 'drop-shadow(0 15px 25px rgba(0,0,0,0.18))' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Excel-Style Note Header */}
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${badgeColor}`}>
                  {fullTypeLabel}
                </span>
                {isPinned && (
                  <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                    <Pin className="w-2.5 h-2.5" /> PINNED
                  </span>
                )}
              </div>

              {/* Action Buttons: Pin, Expand, Copy, Close */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition cursor-pointer"
                  title="Copy full remark"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPinned(true);
                    setIsModalOpen(true);
                  }}
                  className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition cursor-pointer"
                  title="Expand to Full View"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPinned(false);
                    setIsOpen(false);
                  }}
                  className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded transition cursor-pointer"
                  title="Close note"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Context Breadcrumbs / Metadata */}
            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 dark:text-slate-400 mb-3 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
              {entry.productName && (
                <div className="flex items-center gap-1 col-span-2 truncate">
                  <Package className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="font-bold text-slate-700 dark:text-slate-200 truncate">{entry.productName}</span>
                </div>
              )}
              {entry.process && (
                <div className="flex items-center gap-1 truncate">
                  <Cpu className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-600 dark:text-slate-300 truncate">{entry.process}</span>
                </div>
              )}
              {entry.batchNo && (
                <div className="flex items-center gap-1 truncate">
                  <Hash className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="font-mono font-bold text-slate-600 dark:text-slate-300 truncate">{entry.batchNo}</span>
                </div>
              )}
            </div>

            {/* Complete, Uncut Remark Body with Text Highlighting */}
            <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 rounded-lg p-3 max-h-48 overflow-y-auto">
              <div className="text-xs font-medium text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words leading-relaxed select-text font-sans">
                {cleanRemark}
              </div>
            </div>

            {/* Footer with Quantity Reference and Tips */}
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[9px] text-slate-400">
              <div>
                {isPlan ? (
                  <span>Plan: <b className="text-slate-700 dark:text-slate-200 font-mono">{(entry.planQuantity || 0).toLocaleString()} {entry.unit}</b></span>
                ) : (
                  <span>Actual: <b className="text-emerald-600 dark:text-emerald-400 font-mono">{(entry.actualQuantity || 0).toLocaleString()} {entry.unit}</b></span>
                )}
              </div>
              <span className="italic">
                {isPinned ? 'Click outside to close' : 'Click to pin open'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Advanced Full Screen / Modal View for Large Remarks */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[2000] flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-xl p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl border ${badgeColor}`}>
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      {fullTypeLabel}
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${badgeColor}`}>
                      Excel Detail Note
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Complete unconstrained log entry details
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Entry Summary Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs mb-5">
              <div>
                <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Product</span>
                <span className="font-bold text-slate-800 dark:text-white truncate block">{entry.productName || '-'}</span>
              </div>
              <div>
                <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Process</span>
                <span className="font-bold text-slate-800 dark:text-white truncate block">{entry.process || '-'}</span>
              </div>
              <div>
                <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Batch No</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white block">{entry.batchNo || '-'}</span>
              </div>
              <div>
                <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Target / Actual</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white block">
                  {(entry.actualQuantity || 0).toLocaleString()} / {(entry.planQuantity || 0).toLocaleString()} {entry.unit}
                </span>
              </div>
            </div>

            {/* Full Remark Content Box */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Full Remark Text
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied to Clipboard' : 'Copy Text'}
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-900/40 max-h-80 overflow-y-auto">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words leading-relaxed select-text font-sans">
                  {cleanRemark}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider hover:opacity-90 transition shadow-md cursor-pointer"
              >
                Close Note
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/**
 * Excel-style corner marker helper
 */
export const ExcelCellCorner: React.FC<{
  type?: 'plan' | 'actual';
  title?: string;
  onClick?: () => void;
}> = ({ type = 'plan', title = 'Excel Note Attached', onClick }) => {
  const isPlan = type === 'plan';
  return (
    <div
      onClick={onClick}
      title={title}
      className="absolute top-0 right-0 w-0 h-0 border-t-[11px] border-l-[11px] border-l-transparent cursor-pointer z-10 transition-transform hover:scale-125"
      style={{
        borderTopColor: isPlan ? '#6366f1' : '#10b981',
      }}
    />
  );
};
