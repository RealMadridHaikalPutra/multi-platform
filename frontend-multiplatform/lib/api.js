const DEFAULT_API_BASE_URL = "http://localhost:5008";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL;

const normalizeApiUrl = (path) => {
  const base = API_BASE_URL.replace(/\/$/, "");
  const nextPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${nextPath}`;
};

const parseJsonSafely = (text) => {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const fetchJson = async (path, options = {}) => {
  const response = await fetch(normalizeApiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = parseJsonSafely(text);

  if (!response.ok) {
    const message = data?.message || data?.error || response.statusText || "Request failed";
    throw new Error(message);
  }

  return data;
};

const normalizeStatusLabel = (status = "") => {
  const normalized = String(status).trim();
  if (!normalized) {
    return "Unknown";
  }

  return normalized
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatDate = (dateString) => {
  if (!dateString) {
    return "-";
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toISOString().slice(0, 10);
};

export const getProducts = async () => {
  const [products, inventory] = await Promise.all([
    fetchJson("/api/products"),
    fetchJson("/api/inventory").catch(() => []),
  ]);

  const inventoryMap = new Map(inventory.map((item) => [item.sku, item]));

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    price: product.price,
    stock: inventoryMap.get(product.sku)?.quantity ?? 0,
  }));
};

export const getStocks = async () => {
  const [inventory, products] = await Promise.all([
    fetchJson("/api/inventory").catch(() => []),
    fetchJson("/api/products").catch(() => []),
  ]);

  const productMap = new Map(products.map((product) => [product.sku, product.name]));

  return inventory.map((item) => ({
    sku: item.sku,
    name: productMap.get(item.sku) || item.sku,
    shopee: item.quantity,
    tiktok: item.quantity,
    system: item.quantity,
    status: "Synced",
  }));
};

export const getOrders = async () => {
  const [orders, products] = await Promise.all([
    fetchJson("/api/orders").catch(() => []),
    fetchJson("/api/products").catch(() => []),
  ]);

  const productMap = new Map(products.map((product) => [product.sku, product.name]));

  return orders.map((order) => ({
    id: order.externalOrderId || order.id,
    marketplace: order.platform === "SHOPEE" ? "Shopee" : order.platform === "TIKTOK" ? "TikTok" : order.platform,
    product: productMap.get(order.sku) || order.sku,
    qty: order.quantity,
    status: normalizeStatusLabel(order.status),
    date: formatDate(order.createdAt || order.updatedAt),
  }));
};

export const getDashboard = async () => {
  const [products, inventory, orders, metrics] = await Promise.all([
    fetchJson("/api/products").catch(() => []),
    fetchJson("/api/inventory").catch(() => []),
    fetchJson("/api/orders").catch(() => []),
    fetchJson("/api/observability/metrics").catch(() => null),
  ]);

  const totalProducts = products.length;
  const totalStock = inventory.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalOrders = orders.length;

  const errorRate = metrics?.errorRate ?? 0;
  const mismatchRate = metrics?.consistencyMismatchRate ?? 0;
  const syncStatus = errorRate > 0.05 || mismatchRate > 0.05 ? "Unhealthy" : "Healthy";

  return {
    totalProducts,
    totalStock,
    totalOrders,
    syncStatus,
  };
};

export const createProduct = async ({ sku, name, price, description, isActive }) => {
  return fetchJson("/api/products", {
    method: "POST",
    body: JSON.stringify({ sku, name, price, description, isActive }),
  });
};

export const updateProduct = async (id, payload) => {
  return fetchJson(`/api/products/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
};

export const deleteProduct = async (id) => {
  return fetchJson(`/api/products/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
};

export const setInventoryQuantity = async (sku, quantity) => {
  return fetchJson(`/api/inventory/${encodeURIComponent(sku)}`, {
    method: "PUT",
    body: JSON.stringify({ quantity, reason: "ui-set" }),
  });
};

export const deleteInventory = async (sku) => {
  return fetchJson(`/api/inventory/${encodeURIComponent(sku)}`, {
    method: "DELETE",
  });
};

export const getIntegrations = async () => {
  return fetchJson("/api/integrations");
};

export const updateIntegration = async (platform, payload) => {
  return fetchJson(`/api/integrations/${encodeURIComponent(platform)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
};
