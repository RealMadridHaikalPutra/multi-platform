"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/products", label: "Produk & Stok" },
  { href: "/orders", label: "Pesanan" },
  { href: "/settings", label: "Integrasi" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 z-20 w-full border-b border-slate-200 bg-white/90 p-4 backdrop-blur md:h-screen md:w-72 md:border-b-0 md:border-r md:p-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Multi Marketplace</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">Control Dashboard</h1>
        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Semua layanan online
        </div>
      </div>

      <p className="mb-2 hidden text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 md:block">Menu Utama</p>

      <nav className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                active
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-100"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 hidden rounded-xl border border-blue-100 bg-blue-50 p-4 md:block">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Status Integrasi</p>
        <p className="mt-1 text-sm text-slate-700">Shopee & TikTok Shop terhubung.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white p-2 text-center">
            <p className="text-xs text-slate-500">Platform</p>
            <p className="text-sm font-semibold text-slate-800">2</p>
          </div>
          <div className="rounded-lg bg-white p-2 text-center">
            <p className="text-xs text-slate-500">Sinkron</p>
            <p className="text-sm font-semibold text-emerald-600">99%</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
