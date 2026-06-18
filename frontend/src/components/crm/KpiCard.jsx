export default function KpiCard({ title, value, sub, icon: Icon, accent = "indigo", trend, trendLabel }) {
  const ACCENTS = {
    indigo: { border: "border-indigo-500", bg: "bg-indigo-50", text: "text-indigo-600" },
    emerald: { border: "border-emerald-500", bg: "bg-emerald-50", text: "text-emerald-600" },
    rose: { border: "border-rose-500", bg: "bg-rose-50", text: "text-rose-600" },
    amber: { border: "border-amber-500", bg: "bg-amber-50", text: "text-amber-600" },
    violet: { border: "border-violet-500", bg: "bg-violet-50", text: "text-violet-600" },
    sky: { border: "border-sky-500", bg: "bg-sky-50", text: "text-sky-600" },
  };
  const a = ACCENTS[accent] || ACCENTS.indigo;

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-4 border-l-4 ${a.border}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg ${a.bg} flex items-center justify-center flex-shrink-0`}>
          <Icon size={14} className={a.text} />
        </div>
        <p className="text-xs text-slate-500 font-medium leading-tight">{title}</p>
      </div>
      <p className="text-xl font-bold text-slate-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5 leading-snug">{sub}</p>}
      {trend !== undefined && (
        <div className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
          trend >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
        }`}>
          <span>{trend >= 0 ? "▲" : "▼"}</span>
          <span>{Math.abs(trend)}%</span>
          {trendLabel && <span className="font-normal text-slate-400 ml-1">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}