export default function Loading() {
  return (
    <div className="fade-up rounded-2xl border border-slate-200 bg-white p-8 text-center card-shadow">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      <p className="mt-4 text-sm text-slate-600">Memuat data dashboard...</p>
    </div>
  );
}
