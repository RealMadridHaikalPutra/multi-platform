import "./globals.css";
import { Poppins } from "next/font/google";
import Sidebar from "@/components/layout/Sidebar";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "Dashboard Multi-Marketplace",
  description: "Monitoring stok, produk, dan pesanan Shopee & TikTok Shop",
};

export default function RootLayout({ children }) {
  const dateLabel = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <html lang="id">
      <body className={`${poppins.className} antialiased`}>
        <div className="app-shell md:flex">
          <Sidebar />
          <main className="w-full p-4 md:p-8">
            <div className="page-wrap space-y-4">
              <div className="soft-panel fade-up flex items-center justify-between rounded-2xl px-4 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Dashboard Operasional</p>
                  <p className="text-sm text-slate-600">Pantau sinkronisasi stok dan performa pesanan harian.</p>
                </div>
                <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{dateLabel}</p>
              </div>
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
