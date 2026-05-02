"use client";

import { useEffect, useMemo, useState } from "react";
import { getDashboard, getStocks } from "../../lib/api";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import LoadingState from "@/components/ui/LoadingState";
import Table from "@/components/ui/Table";

const weeklyOrders = [12, 18, 10, 22, 30, 28, 35];

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");

      try {
        const [dashboardData, stockData] = await Promise.all([getDashboard(), getStocks()]);
        setDashboard(dashboardData);
        setStocks(stockData);
      } catch (err) {
        setDashboard(null);
        setStocks([]);
        setError(err?.message || "Gagal memuat dashboard.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const stockColumns = useMemo(
    () => [
      { key: "sku", header: "SKU" },
      { key: "name", header: "Nama Produk" },
      { key: "shopee", header: "Stok Shopee" },
      { key: "tiktok", header: "Stok TikTok" },
      { key: "system", header: "Stok Sistem" },
      {
        key: "status",
        header: "Status",
        render: (row) => <Badge variant={row.status === "Synced" ? "success" : "warning"}>{row.status}</Badge>,
      },
    ],
    []
  );

  const syncVariant = dashboard?.syncStatus === "Healthy" ? "success" : "error";
  const syncLabel = dashboard?.syncStatus === "Healthy" ? "Success" : "Error";
  const mismatchCount = stocks.filter((item) => item.status !== "Synced").length;
  const syncedCount = stocks.length - mismatchCount;

  if (loading) {
    return <LoadingState text="Mengambil metrik dashboard..." />;
  }

  if (error || !dashboard) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error || "Gagal memuat data dashboard."}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="fade-up">
        <h2 className="text-2xl font-bold text-slate-900">Dashboard Manajemen</h2>
        <p className="text-sm text-slate-600">Monitoring real-time stok, pesanan, dan sinkronisasi antar marketplace.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Total Produk" value={dashboard.totalProducts} subtitle="Semua marketplace" trend="Naik 4% dari kemarin" />
        <Card title="Total Stok" value={dashboard.totalStock} subtitle="Data sistem pusat" trend="Stabil 24 jam terakhir" />
        <Card title="Pesanan Hari Ini" value={dashboard.totalOrders} subtitle="Shopee + TikTok" trend="Puncak jam 10.00 - 13.00" />
        <Card
          title="Status Sinkronisasi"
          value={syncLabel}
          subtitle={`${syncedCount} sinkron, ${mismatchCount} perlu cek`}
          right={<Badge variant={syncVariant}>{dashboard.syncStatus}</Badge>}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">Perbandingan Stok</h3>
            <Badge variant="info">Realtime Snapshot</Badge>
          </div>
          <Table
            keyField="sku"
            columns={stockColumns}
            data={stocks}
            summary={`Mismatch: ${mismatchCount}`}
            emptyTitle="Belum ada data stok"
            emptyMessage="Data stok dari marketplace belum tersedia."
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 card-shadow">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Kesehatan Sinkronisasi</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={mismatchCount > 0 ? "warning" : "success"}>
                {mismatchCount > 0 ? "Perlu Tindakan" : "Aman"}
              </Badge>
              <p className="text-sm text-slate-600">
                {mismatchCount > 0
                  ? `${mismatchCount} produk tidak sinkron, cek ulang mapping SKU.`
                  : "Semua produk sinkron antar platform."}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 card-shadow">
          <h3 className="text-lg font-semibold text-slate-800">Tren Pesanan Mingguan</h3>
          <p className="mt-1 text-xs text-slate-500">Data dummy untuk preview grafik.</p>

          <div className="mt-6 flex h-44 items-end gap-2">
            {weeklyOrders.map((value, index) => (
              <div key={`${value}-${index}`} className="flex-1">
                <div
                  className="rounded-t-md bg-gradient-to-b from-blue-500 to-blue-700 transition-all duration-500"
                  style={{ height: `${value * 4}px` }}
                />
                <p className="mt-2 text-center text-xs font-medium text-slate-500">D{index + 1}</p>
              </div>
            ))}
          </div>
          </div>
        </div>
      </div>
    </section>
  );
}
