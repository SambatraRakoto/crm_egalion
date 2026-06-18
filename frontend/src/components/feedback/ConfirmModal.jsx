import { useEffect } from "react";
import { AlertTriangle, Info } from "lucide-react";

/**
 * FR : Remplaçant in-app de window.confirm / window.alert. Rendu par le hook
 *      `useConfirm`. `mode="alert"` n'affiche qu'un bouton OK.
 * EN : In-app replacement for window.confirm / window.alert. Rendered by the
 *      `useConfirm` hook. `mode="alert"` shows a single OK button.
 */
export default function ConfirmModal({
  mode = "confirm",
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}) {
  const danger = variant === "danger";
  const Icon = danger ? AlertTriangle : Info;

  // Esc cancels, Enter confirms.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
      else if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onConfirm, onCancel]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm z-10">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${danger ? "bg-rose-50" : "bg-indigo-50"}`}>
              <Icon size={20} className={danger ? "text-rose-500" : "text-indigo-500"} />
            </div>
            <div className="flex-1 min-w-0">
              {title && <h3 className="text-sm font-bold text-slate-900">{title}</h3>}
              {message && <p className="text-sm text-slate-500 mt-1 break-words">{message}</p>}
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            {mode === "confirm" && (
              <button onClick={onCancel}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                {cancelLabel}
              </button>
            )}
            <button onClick={onConfirm} autoFocus
              className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl shadow-sm transition-colors ${
                danger ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700"
              }`}>
              {confirmLabel || (mode === "alert" ? "OK" : "Confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
