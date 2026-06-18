import { Loader2 } from 'lucide-react';

/** Spinner used for query loading states. `fullscreen` centers it over the viewport. */
export function LoadingState({ fullscreen = false, label = 'Loading…', className = '' }) {
  if (fullscreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50/60">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          {label && <p className="text-sm text-slate-500">{label}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-16 ${className}`}>
      <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />
      {label && <p className="text-sm text-slate-400">{label}</p>}
    </div>
  );
}

export default LoadingState;
