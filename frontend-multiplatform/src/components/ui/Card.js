export default function Card({ title, value, subtitle, right, trend }) {
  return (
    <div className="fade-up rounded-2xl border border-slate-200 bg-white p-5 card-shadow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
          {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
          {trend ? <p className="mt-2 text-xs font-semibold text-blue-600">{trend}</p> : null}
        </div>
        {right ? <div>{right}</div> : null}
      </div>
    </div>
  );
}
