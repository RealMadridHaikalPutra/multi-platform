import { PLATFORM } from "../../shared/types/platform";
import type { IntegrationService } from "../../modules/integration/integration.service";
import { ExternalApiClient } from "./external-api.client";
import type { MarketplacePollResult, MarketplaceProductDTO } from "./shopee.client";

export class TikTokClient extends ExternalApiClient {
  readonly platform = PLATFORM.TIKTOK;

  constructor(private readonly integrationService: IntegrationService) {
    super("", {});
  }

  async pollEvents(cursor?: string): Promise<MarketplacePollResult> {
    const config = await this.integrationService.requireApiConfig(PLATFORM.TIKTOK);
    const response = await this.request<MarketplacePollResult>({
      method: "GET",
      url: "/api/orders/sync-events",
      params: { cursor }
    }, {
      baseURL: config.baseUrl,
      headers: {
        "x-app-key": config.apiKey ?? "",
        "x-app-secret": config.apiSecret ?? ""
      }
    });

    return {
      cursor: response.cursor,
      orders: response.orders ?? [],
      stockUpdates: response.stockUpdates ?? []
    };
  }

  async getStockBySku(sku: string): Promise<number> {
    const config = await this.integrationService.requireApiConfig(PLATFORM.TIKTOK);
    const response = await this.request<{ quantity: number }>({
      method: "GET",
      url: "/api/products/stock",
      params: { sku }
    }, {
      baseURL: config.baseUrl,
      headers: {
        "x-app-key": config.apiKey ?? "",
        "x-app-secret": config.apiSecret ?? ""
      }
    });

    return response.quantity;
  }

  async listProducts(): Promise<MarketplaceProductDTO[]> {
    const config = await this.integrationService.requireApiConfig(PLATFORM.TIKTOK);
    const response = await this.request<any>({
      method: "GET",
      url: "/api/products"
    }, {
      baseURL: config.baseUrl,
      headers: {
        "x-app-key": config.apiKey ?? "",
        "x-app-secret": config.apiSecret ?? ""
      }
    });

    const items = Array.isArray(response)
      ? response
      : response?.products ?? response?.items ?? [];

    return items
      .map((item: any) => ({
        externalId: String(item.externalId ?? item.id ?? item.product_id ?? item.productId ?? item.sku ?? ""),
        sku: String(item.sku ?? item.seller_sku ?? item.product_sku ?? ""),
        name: String(item.name ?? item.product_name ?? ""),
        price: typeof item.price === "number" ? item.price : undefined,
        stock: Number(item.stock ?? item.quantity ?? 0),
        rawPayload: item
      }))
      .filter((item: MarketplaceProductDTO) => item.externalId && item.sku);
  }
}
