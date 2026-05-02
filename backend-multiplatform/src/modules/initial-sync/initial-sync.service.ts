import { DomainError } from "../../shared/errors/domain-error";
import { PLATFORM, type PlatformName } from "../../shared/types/platform";
import type { InventoryService } from "../inventory/inventory.service";
import { ProductRepository } from "../product/product.repository";
import { ShopeeClient, type MarketplaceProductDTO } from "../../infrastructure/external/shopee.client";
import { TikTokClient } from "../../infrastructure/external/tiktok.client";
import type { IntegrationService } from "../integration/integration.service";
import { InitialSyncRepository } from "./initial-sync.repository";

export interface InitialImportResult {
  platform: PlatformName;
  importedCount: number;
}

export interface LinkInput {
  sku: string;
  name: string;
  price: number;
  description?: string;
  isActive?: boolean;
  links: Array<{
    platform: PlatformName;
    externalId: string;
  }>;
}

export interface NormalizeInput {
  sku: string;
  stockSource: PlatformName | "MANUAL";
  manualStock?: number;
}

export class InitialSyncService {
  private readonly shopeeClient: ShopeeClient;
  private readonly tiktokClient: TikTokClient;

  constructor(
    private readonly integrationService: IntegrationService,
    private readonly inventoryService: InventoryService,
    private readonly productRepository: ProductRepository,
    private readonly repository: InitialSyncRepository
  ) {
    this.shopeeClient = new ShopeeClient(integrationService);
    this.tiktokClient = new TikTokClient(integrationService);
  }

  async importMarketplaceProducts(platforms?: PlatformName[]): Promise<InitialImportResult[]> {
    const targets = platforms?.length ? platforms : [PLATFORM.SHOPEE, PLATFORM.TIKTOK];
    const results: InitialImportResult[] = [];

    for (const platform of targets) {
      const items = await this.fetchMarketplaceProducts(platform);
      for (const item of items) {
        await this.repository.upsertMarketplaceProduct({
          platform,
          externalId: item.externalId,
          sku: item.sku,
          name: item.name,
          price: item.price,
          stock: item.stock,
          rawPayload: item.rawPayload ?? item
        });
      }

      results.push({
        platform,
        importedCount: items.length
      });
    }

    return results;
  }

  async listMarketplaceProducts(platform?: PlatformName): Promise<MarketplaceProductDTO[]> {
    const rows = await this.repository.listMarketplaceProducts(platform);
    return rows.map((row) => ({
      externalId: row.externalId,
      sku: row.sku,
      name: row.name,
      price: row.price ?? undefined,
      stock: row.stock,
      rawPayload: row.rawPayload ?? undefined
    }));
  }

  async linkProducts(input: LinkInput): Promise<{ sku: string; linked: Array<{ platform: PlatformName; externalId: string }> }> {
    const product = await this.productRepository.findBySku(input.sku);
    if (!product) {
      await this.productRepository.create({
        sku: input.sku,
        name: input.name,
        description: input.description,
        price: input.price,
        isActive: input.isActive ?? true
      });
    } else {
      await this.productRepository.update(product.id, {
        name: input.name,
        description: input.description,
        price: input.price,
        isActive: input.isActive ?? product.isActive
      });
    }

    const linked: Array<{ platform: PlatformName; externalId: string }> = [];
    for (const link of input.links) {
      const record = await this.repository.findMarketplaceProduct(link.platform, link.externalId);
      if (!record) {
        throw new DomainError("Marketplace product not found", 404, "MARKETPLACE_PRODUCT_NOT_FOUND", {
          platform: link.platform,
          externalId: link.externalId
        });
      }

      await this.repository.upsertLink(input.sku, link.platform, record.id);
      linked.push({ platform: link.platform, externalId: record.externalId });
    }

    return { sku: input.sku, linked };
  }

  async normalizeStock(input: NormalizeInput): Promise<{ sku: string; source: string; before: number; after: number }> {
    const product = await this.productRepository.findBySku(input.sku);
    if (!product) {
      throw new DomainError("Product not found", 404, "PRODUCT_NOT_FOUND", { sku: input.sku });
    }

    let targetStock: number;
    if (input.stockSource === "MANUAL") {
      if (input.manualStock === undefined) {
        throw new DomainError("Manual stock required", 400, "MANUAL_STOCK_REQUIRED");
      }
      targetStock = input.manualStock;
    } else {
      const linked = await this.repository.listLinkedProductsBySku(input.sku);
      const source = linked.find((item) => item.platform === input.stockSource);
      if (!source) {
        throw new DomainError("Linked marketplace product not found", 404, "LINK_NOT_FOUND", {
          sku: input.sku,
          platform: input.stockSource
        });
      }
      targetStock = source.stock;
    }

    const result = await this.inventoryService.setQuantity(input.sku, targetStock);

    return {
      sku: input.sku,
      source: input.stockSource,
      before: result.before,
      after: result.after
    };
  }

  private async fetchMarketplaceProducts(platform: PlatformName): Promise<MarketplaceProductDTO[]> {
    if (platform === PLATFORM.SHOPEE) {
      return this.shopeeClient.listProducts();
    }

    return this.tiktokClient.listProducts();
  }
}
