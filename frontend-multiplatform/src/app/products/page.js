"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createProduct,
  deleteInventory,
  deleteProduct,
  getProducts,
  getStocks,
  setInventoryQuantity,
  updateProduct,
} from "../../../lib/api";
import Badge from "@/components/ui/Badge";
import LoadingState from "@/components/ui/LoadingState";
import Table from "@/components/ui/Table";

const pageSize = 5;

const initialForm = {
  name: "",
  sku: "",
  price: "",
  stock: "",
};

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState(null);
  const [editOriginalSku, setEditOriginalSku] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [formError, setFormError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const [productData, stockData] = await Promise.all([getProducts(), getStocks()]);
        setProducts(productData);
        setStocks(stockData);
      } catch (err) {
        setProducts([]);
        setStocks([]);
        setLoadError(err?.message || "Gagal memuat data produk dan stok.");
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  const mergedRows = useMemo(() => {
    const stockMap = new Map(stocks.map((item) => [item.sku, item]));

    return products.map((product) => {
      const stockData = stockMap.get(product.sku);
      const shopee = stockData?.shopee ?? product.stock;
      const tiktok = stockData?.tiktok ?? product.stock;
      const system = stockData?.system ?? product.stock;
      const status = stockData?.status ?? "Synced";

      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        stock: product.stock,
        shopee,
        tiktok,
        system,
        status,
      };
    });
  }, [products, stocks]);

  const filteredRows = useMemo(() => {
    const lowerQuery = query.toLowerCase();

    return mergedRows.filter((row) => {
      const matchQuery = row.name.toLowerCase().includes(lowerQuery) || row.sku.toLowerCase().includes(lowerQuery);
      const matchStatus = statusFilter === "all" || row.status.toLowerCase() === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [mergedRows, query, statusFilter]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const totalStock = filteredRows.reduce((sum, item) => sum + item.system, 0);
  const syncedCount = mergedRows.filter((item) => item.status === "Synced").length;
  const mismatchCount = mergedRows.filter((item) => item.status === "Mismatch").length;

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    if (formError) {
      setFormError("");
    }
  };

  const validateForm = () => {
    if (!form.name || !form.sku || !form.price || !form.stock) {
      setFormError("Semua field wajib diisi sebelum menyimpan produk.");
      return false;
    }

    if (Number(form.price) < 0 || Number(form.stock) < 0) {
      setFormError("Harga dan stok tidak boleh negatif.");
      return false;
    }

    return true;
  };

  const handleCreateSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setFormError("");

    try {
      const created = await createProduct({
        sku: form.sku,
        name: form.name,
        price: Number(form.price),
        isActive: true,
      });

      await setInventoryQuantity(form.sku, Number(form.stock));

      setProducts((prev) => [
        ...prev,
        {
          id: created.id,
          name: created.name,
          sku: created.sku,
          price: created.price,
          stock: Number(form.stock),
        },
      ]);

      setStocks((prev) => [
        ...prev,
        {
          sku: form.sku,
          name: form.name,
          shopee: Number(form.stock),
          tiktok: Number(form.stock),
          system: Number(form.stock),
          status: "Synced",
        },
      ]);

      setForm(initialForm);
      setIsCreateModalOpen(false);
    } catch (err) {
      setFormError(err?.message || "Gagal menambah produk.");
    }
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm() || !editId) {
      return;
    }

    setFormError("");

    try {
      const updated = await updateProduct(editId, {
        name: form.name,
        sku: form.sku,
        price: Number(form.price),
      });

      if (editOriginalSku && editOriginalSku !== form.sku) {
        await deleteInventory(editOriginalSku).catch(() => null);
      }

      await setInventoryQuantity(form.sku, Number(form.stock));

      setProducts((prev) =>
        prev.map((product) =>
          product.id === editId
            ? {
                ...product,
                name: updated.name,
                sku: updated.sku,
                price: updated.price,
                stock: Number(form.stock),
              }
            : product
        )
      );

      setStocks((prev) => {
        const next = prev.filter((item) => item.sku !== editOriginalSku);
        const existing = next.find((item) => item.sku === form.sku);
        const updatedStock = {
          sku: form.sku,
          name: form.name,
          shopee: existing?.shopee ?? Number(form.stock),
          tiktok: existing?.tiktok ?? Number(form.stock),
          system: Number(form.stock),
          status: "Synced",
        };

        return [...next.filter((item) => item.sku !== form.sku), updatedStock];
      });

      setForm(initialForm);
      setEditId(null);
      setEditOriginalSku("");
      setIsEditModalOpen(false);
    } catch (err) {
      setFormError(err?.message || "Gagal memperbarui produk.");
    }
  };

  const closeEditModal = () => {
    setEditId(null);
    setEditOriginalSku("");
    setForm(initialForm);
    setFormError("");
    setIsEditModalOpen(false);
  };

  const closeCreateModal = () => {
    setEditId(null);
    setEditOriginalSku("");
    setForm(initialForm);
    setFormError("");
    setIsCreateModalOpen(false);
  };

  const handleEdit = (row) => {
    setEditId(row.id);
    setEditOriginalSku(row.sku);
    setIsCreateModalOpen(false);
    setIsEditModalOpen(true);
    setForm({
      name: row.name,
      sku: row.sku,
      price: String(row.price),
      stock: String(row.stock),
    });
  };

  const openDeleteModal = (id) => {
    setDeleteTargetId(id);
    setDeleteConfirmText("");
    setDeleteError("");
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteTargetId(null);
    setDeleteConfirmText("");
    setDeleteError("");
    setIsDeleteModalOpen(false);
  };

  const confirmDelete = async () => {
    if (deleteConfirmText !== "CONFIRM") {
      setDeleteError('Ketik CONFIRM dengan huruf besar untuk melanjutkan.');
      return;
    }

    if (!deleteTargetId) {
      setDeleteError("Produk yang dipilih tidak ditemukan.");
      return;
    }

    const targetProduct = products.find((product) => product.id === deleteTargetId);

    try {
      await deleteProduct(deleteTargetId);
      if (targetProduct?.sku) {
        await deleteInventory(targetProduct.sku).catch(() => null);
      }

      setProducts((prev) => prev.filter((product) => product.id !== deleteTargetId));
      if (targetProduct) {
        setStocks((prev) => prev.filter((item) => item.sku !== targetProduct.sku));
      }

      closeDeleteModal();
    } catch (err) {
      setDeleteError(err?.message || "Gagal menghapus produk.");
    }
  };

  const columns = [
    { key: "name", header: "Nama Produk" },
    { key: "sku", header: "SKU" },
    {
      key: "price",
      header: "Harga",
      render: (row) => `Rp ${row.price.toLocaleString("id-ID")}`,
    },
    { key: "shopee", header: "Shopee" },
    { key: "tiktok", header: "TikTok" },
    { key: "system", header: "Sistem" },
    {
      key: "status",
      header: "Sync",
      render: (row) => <Badge variant={row.status === "Synced" ? "success" : "warning"}>{row.status}</Badge>,
    },
    {
      key: "actions",
      header: "Aksi",
      render: (row) => (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleEdit(row)}
            className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-200"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => openDeleteModal(row.id)}
            className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-200"
          >
            Hapus
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-5">
      <div className="fade-up">
        <h2 className="text-2xl font-bold text-slate-900">Produk + Stok Marketplace</h2>
        <p className="text-sm text-slate-600">Satu layar untuk monitor stok Shopee, TikTok, Sistem, dan mismatch.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total Produk</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{filteredRows.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total Stok Sistem</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{totalStock}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Synced</p>
          <p className="mt-1 text-xl font-semibold text-emerald-700">{syncedCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Mismatch</p>
          <p className="mt-1 text-xl font-semibold text-amber-700">{mismatchCount}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-1">
        <div className="space-y-3 xl:col-span-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Cari nama produk atau SKU"
                className="input-clean sm:max-w-sm"
              />

              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                className="input-clean w-auto min-w-44"
              >
                <option value="all">Semua Status</option>
                <option value="synced">Synced</option>
                <option value="mismatch">Mismatch</option>
              </select>

              {query || statusFilter !== "all" ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setStatusFilter("all");
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600"
                >
                  Reset Filter
                </button>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => {
                setEditId(null);
                setEditOriginalSku("");
                setForm(initialForm);
                setFormError("");
                setIsEditModalOpen(false);
                setIsCreateModalOpen(true);
              }}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Tambah Produk
            </button>
          </div>

          {loading ? (
            <LoadingState text="Memuat data produk dan stok..." />
          ) : loadError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {loadError}
            </div>
          ) : (
            <>
              <Table
                columns={columns}
                data={paginatedRows}
                summary={`Synced: ${syncedCount} | Mismatch: ${mismatchCount}`}
                emptyTitle="Produk belum tersedia"
                emptyMessage="Tambahkan produk pertama Anda untuk mulai sinkronisasi."
              />

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs text-slate-500">Halaman {page} dari {totalPages}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => prev - 1)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Sebelumnya
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((prev) => prev + 1)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {isEditModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 card-shadow">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Edit Produk</h3>
                <p className="text-xs text-slate-500">Perbarui data produk lalu simpan perubahan.</p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3">
              <input name="name" value={form.name} onChange={handleChange} placeholder="Nama produk" className="input-clean" />
              <input name="sku" value={form.sku} onChange={handleChange} placeholder="SKU" className="input-clean" />
              <input
                name="price"
                type="number"
                min="0"
                value={form.price}
                onChange={handleChange}
                placeholder="Harga"
                className="input-clean"
              />
              <input
                name="stock"
                type="number"
                min="0"
                value={form.stock}
                onChange={handleChange}
                placeholder="Stok"
                className="input-clean"
              />

              {formError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{formError}</p>
              ) : null}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Simpan Perubahan
                </button>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 card-shadow">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Tambah Produk</h3>
                <p className="text-xs text-slate-500">Masukkan produk baru untuk sinkronisasi marketplace.</p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <input name="name" value={form.name} onChange={handleChange} placeholder="Nama produk" className="input-clean" />
              <input name="sku" value={form.sku} onChange={handleChange} placeholder="SKU" className="input-clean" />
              <input
                name="price"
                type="number"
                min="0"
                value={form.price}
                onChange={handleChange}
                placeholder="Harga"
                className="input-clean"
              />
              <input
                name="stock"
                type="number"
                min="0"
                value={form.stock}
                onChange={handleChange}
                placeholder="Stok"
                className="input-clean"
              />

              {formError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{formError}</p>
              ) : null}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Tambah Produk
                </button>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isDeleteModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 card-shadow">
            <h3 className="text-lg font-semibold text-slate-800">Konfirmasi Hapus Produk</h3>
            <p className="mt-1 text-sm text-slate-600">
              Untuk keamanan, ketik <span className="font-bold text-slate-900">CONFIRM</span> sebelum menghapus data.
            </p>

            <input
              value={deleteConfirmText}
              onChange={(event) => {
                setDeleteConfirmText(event.target.value);
                if (deleteError) {
                  setDeleteError("");
                }
              }}
              placeholder="Ketik CONFIRM"
              className="input-clean mt-3"
            />

            {deleteError ? (
              <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {deleteError}
              </p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
