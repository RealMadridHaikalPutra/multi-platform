export default function LoadingState({ text = "Memuat data..." }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center card-shadow">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      <p className="mt-3 text-sm font-medium text-slate-700">{text}</p>
      <p className="mt-1 text-xs text-slate-500">Harap tunggu sebentar...</p>
    </div>
  );
}
