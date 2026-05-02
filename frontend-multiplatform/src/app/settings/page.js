"use client";

import { useEffect, useMemo, useState } from "react";
import { getIntegrations, updateIntegration } from "../../../lib/api";
import Badge from "@/components/ui/Badge";
import LoadingState from "@/components/ui/LoadingState";

const PLATFORM_META = {
  SHOPEE: {
    label: "Shopee",
    helper: "Gunakan Partner ID dan Partner Key dari dashboard Shopee.",
    apiKeyLabel: "Partner ID",
    apiSecretLabel: "Partner Key",
  },
  TIKTOK: {
    label: "TikTok Shop",
    helper: "Gunakan App Key dan App Secret dari TikTok Shop API.",
    apiKeyLabel: "App Key",
    apiSecretLabel: "App Secret",
  },
};

const EMPTY_FORM = {
  baseUrl: "",
  apiKey: "",
  apiSecret: "",
  webhookSecret: "",
};

const buildInitialForms = () => ({
  SHOPEE: { ...EMPTY_FORM },
  TIKTOK: { ...EMPTY_FORM },
});

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export default function SettingsPage() {
  const [forms, setForms] = useState(buildInitialForms);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState({});
  const [notice, setNotice] = useState({});

  const platforms = useMemo(() => Object.keys(PLATFORM_META), []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await getIntegrations();
        const nextForms = buildInitialForms();
        const nextMeta = {};

        data.forEach((item) => {
          if (!item?.platform) {
            return;
          }

          nextForms[item.platform] = {
            baseUrl: item.baseUrl ?? "",
            apiKey: item.apiKey ?? "",
            apiSecret: item.apiSecret ?? "",
            webhookSecret: item.webhookSecret ?? "",
          };
          nextMeta[item.platform] = item;
        });

        setForms(nextForms);
        setMeta(nextMeta);
      } catch (err) {
        setError(err?.message || "Gagal memuat konfigurasi integrasi.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleChange = (platform, field, value) => {
    setForms((prev) => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [field]: value,
      },
    }));
  };

  const handleSave = async (platform) => {
    setSaving((prev) => ({ ...prev, [platform]: true }));
    setNotice((prev) => ({ ...prev, [platform]: "" }));

    try {
      const payload = forms[platform];
      const updated = await updateIntegration(platform, payload);

      setMeta((prev) => ({
        ...prev,
        [platform]: updated,
      }));

      setForms((prev) => ({
        ...prev,
        [platform]: {
          baseUrl: updated.baseUrl ?? "",
          apiKey: updated.apiKey ?? "",
          apiSecret: updated.apiSecret ?? "",
          webhookSecret: updated.webhookSecret ?? "",
        },
      }));

      setNotice((prev) => ({
        ...prev,
        [platform]: "Konfigurasi berhasil disimpan.",
      }));
    } catch (err) {
      setNotice((prev) => ({
        ...prev,
        [platform]: err?.message || "Gagal menyimpan konfigurasi.",
      }));
    } finally {
      setSaving((prev) => ({ ...prev, [platform]: false }));
    }
  };

  if (loading) {
    return <LoadingState text="Mengambil konfigurasi integrasi..." />;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="fade-up">
        <h2 className="text-2xl font-bold text-slate-900">Pengaturan Integrasi</h2>
        <p className="text-sm text-slate-600">
          Atur kredensial marketplace langsung dari dashboard. Pengaturan ini digunakan sebagai sumber utama sinkronisasi.
        </p>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Pusat Kredensial</p>
            <p className="mt-1 text-sm text-slate-600">
              Simpan setiap perubahan di sini agar webhook, polling, dan sinkronisasi stok memakai key yang sama.
            </p>
          </div>
          <Badge variant="info">Sumber DB</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {platforms.map((platform) => {
          const details = PLATFORM_META[platform];
          const integration = meta[platform];
          const source = integration?.source === "database" ? "Database" : "Env";
          const sourceVariant = integration?.source === "database" ? "success" : "neutral";
          const updatedAt = formatDateTime(integration?.updatedAt);
          const isSaving = saving[platform];
          const message = notice[platform];

          return (
            <div key={platform} className="rounded-2xl border border-slate-200 bg-white p-6 card-shadow">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{details.label}</h3>
                  <p className="mt-1 text-xs text-slate-500">{details.helper}</p>
                </div>
                <Badge variant={sourceVariant}>{source}</Badge>
              </div>

              <div className="mt-4 grid gap-3">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Base URL</label>
                <input
                  className="input-clean"
                  value={forms[platform]?.baseUrl}
                  onChange={(event) => handleChange(platform, "baseUrl", event.target.value)}
                  placeholder="https://"
                />

                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {details.apiKeyLabel}
                </label>
                <input
                  className="input-clean"
                  value={forms[platform]?.apiKey}
                  onChange={(event) => handleChange(platform, "apiKey", event.target.value)}
                  placeholder="Masukkan key"
                />

                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {details.apiSecretLabel}
                </label>
                <input
                  className="input-clean"
                  value={forms[platform]?.apiSecret}
                  onChange={(event) => handleChange(platform, "apiSecret", event.target.value)}
                  placeholder="Masukkan secret"
                />

                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Webhook Secret</label>
                <input
                  className="input-clean"
                  value={forms[platform]?.webhookSecret}
                  onChange={(event) => handleChange(platform, "webhookSecret", event.target.value)}
                  placeholder="Masukkan webhook secret"
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">Terakhir update: {updatedAt}</p>
                <button
                  type="button"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                  onClick={() => handleSave(platform)}
                  disabled={isSaving}
                >
                  {isSaving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>

              {message ? (
                <p className="mt-3 text-xs font-semibold text-slate-600">{message}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h4 className="text-sm font-semibold text-slate-800">Catatan Penting</h4>
        <p className="mt-2 text-sm text-slate-600">
          Setelah mengganti key, pastikan webhook URL di Shopee atau TikTok Shop sudah mengarah ke endpoint backend
          Anda agar validasi signature tetap berhasil.
        </p>
      </div>
    </section>
  );
}
