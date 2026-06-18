import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Standard error panel for failed queries.
 * @param {{ error?: any, onRetry?: () => void, title?: string, className?: string }} props
 */
export function ErrorState({ error, onRetry, title = 'Something went wrong', className = '' }) {
  const message =
    error?.message || (typeof error === 'string' ? error : 'Unable to load data. Please try again.');

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-16 text-center ${className}`}
      role="alert"
    >
      <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 text-rose-500" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
        >
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}

export default ErrorState;
