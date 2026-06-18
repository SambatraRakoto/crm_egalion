import { Inbox } from 'lucide-react';

/** Neutral empty-list placeholder. */
export function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-16 text-center ${className}`}>
      <Icon className="w-8 h-8 text-slate-200" />
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {description && <p className="text-xs text-slate-400 max-w-sm">{description}</p>}
      {action}
    </div>
  );
}

export default EmptyState;
