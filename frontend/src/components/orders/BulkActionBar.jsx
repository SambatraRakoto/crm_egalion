import { useState } from "react";
import { Archive, ArchiveRestore, ChevronDown, MessageSquare, X } from "lucide-react";
import { STATUS_CATEGORIES } from "../../lib/mockData";

export default function BulkActionBar({ count, onArchive, onBulkStatus, onBulkNote, onClear, archived = false }) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [note, setNote] = useState("");

  return (
    <>
      <div className="bg-indigo-600 text-white rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold">{count} selected</span>
        <div className="flex items-center gap-2 ml-2 flex-wrap">
          {/* Bulk Status */}
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-medium transition-colors"
            >
              Update Status <ChevronDown size={12} />
            </button>
            {showStatusMenu && (
              <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-xl shadow-xl z-30 w-52 py-1 max-h-72 overflow-y-auto">
                {Object.entries(STATUS_CATEGORIES).map(([cat, statuses]) => (
                  <div key={cat}>
                    <p className="text-xs text-slate-400 font-semibold px-3 py-1.5 uppercase tracking-wider">{cat}</p>
                    {statuses.map((s) => (
                      <button
                        key={s}
                        onClick={() => { onBulkStatus(s); setShowStatusMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bulk Note */}
          <button
            onClick={() => setShowNoteModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-medium transition-colors"
          >
            <MessageSquare size={12} /> Add Note
          </button>

          {/* Archive / Unarchive */}
          <button
            onClick={onArchive}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              archived ? "bg-emerald-500/80 hover:bg-emerald-500" : "bg-rose-500/80 hover:bg-rose-500"
            }`}
          >
            {archived ? <><ArchiveRestore size={12} /> Unarchive</> : <><Archive size={12} /> Archive</>}
          </button>
        </div>

        <button onClick={onClear} className="ml-auto p-1 hover:bg-white/20 rounded-lg transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNoteModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm z-10 p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Add Note to {count} Orders</h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="Enter note or description…"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowNoteModal(false)}
                className="flex-1 px-4 py-2.5 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={() => { onBulkNote(note); setShowNoteModal(false); setNote(""); }}
                className="flex-1 px-4 py-2.5 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors">
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}