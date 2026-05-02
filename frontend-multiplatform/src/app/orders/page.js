"use client";

import { useEffect, useMemo, useState } from "react";
import { getOrders } from "../../../lib/api";
import Badge from "@/components/ui/Badge";
import LoadingState from "@/components/ui/LoadingState";
import Table from "@/components/ui/Table";

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [marketplaceFilter, setMarketplaceFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await getOrders();
        setOrders(data);
      } catch (err) {
        setOrders([]);
        setError(err?.message || "Gagal memuat data pesanan.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    if (marketplaceFilter === "all") {
      return orders;
    }

    return orders.filter((order) => order.marketplace.toLowerCase() === marketplaceFilter);
  }, [orders, marketplaceFilter]);

  const columns = useMemo(
    () => [
      { key: "id", header: "Nomor Order" },
      {
        key: "marketplace",
        header: "Marketplace",
        render: (row) => <Badge variant={row.marketplace === "Shopee" ? "warning" : "info"}>{row.marketplace}</Badge>,
      },
      { key: "product", header: "Nama Produk" },
      { key: "qty", header: "Jumlah" },
      {
        key: "status",
        header: "Status",
        render: (row) => <Badge variant={row.statusVariant}>{row.status}</Badge>,
      },
      { key: "date", header: "Tanggal" },
    ],
    []
  );

  const normalizeStatusVariant = (status) => {
    const normalized = String(status || "").toUpperCase();
    if (["COMPLETED", "DELIVERED", "DONE"].includes(normalized)) {
      return "success";
    }

    if (["CANCELLED", "REFUNDED", "RETURNED", "FAILED"].includes(normalized)) {
      return "error";
    }

    if (["PENDING", "PAID", "CONFIRMED", "READY TO SHIP", "READY_TO_SHIP", "PROCESSING"].includes(normalized)) {
      return "warning";
    }

    return "info";
  };

  const completedCount = orders.filter((order) => normalizeStatusVariant(order.status) === "success").length;
  const pendingCount = orders.filter((order) => normalizeStatusVariant(order.status) === "warning").length;
  const totalQty = filteredOrders.reduce((sum, order) => sum + order.qty, 0);

  const ordersWithVariant = filteredOrders.map((order) => ({
    ...order,
    statusVariant: order.statusVariant || normalizeStatusVariant(order.status),
  }));

  return (
    <section className="space-y-4">
      <div className="fade-up flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Pesanan Marketplace</h2>
          <p className="text-sm text-slate-600">Riwayat pesanan lintas platform Shopee & TikTok Shop.</p>
        </div>

        <select
          value={marketplaceFilter}
          onChange={(event) => setMarketplaceFilter(event.target.value)}
          className="input-clean w-auto min-w-44"
        >
          <option value="all">Semua Marketplace</option>
          <option value="shopee">Shopee</option>
          <option value="tiktok">TikTok</option>
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Completed</p>
          <p className="mt-1 text-xl font-semibold text-emerald-700">{completedCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Pending</p>
          <p className="mt-1 text-xl font-semibold text-amber-700">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total Qty (Filtered)</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{totalQty}</p>
        </div>
      </div>

      {loading ? (
        <LoadingState text="Memuat data pesanan..." />
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : (
        <Table
          columns={columns}
          data={ordersWithVariant}
          summary={`Filter: ${marketplaceFilter === "all" ? "Semua" : marketplaceFilter}`}
          emptyTitle="Belum ada pesanan"
          emptyMessage="Data pesanan akan muncul setelah sinkronisasi berhasil."
        />
      )}
    </section>
  );
}
