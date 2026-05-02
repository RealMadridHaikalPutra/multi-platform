import { env } from "../../config/env";
import { DomainError } from "../../shared/errors/domain-error";
import { PLATFORM, type PlatformName } from "../../shared/types/platform";
import { IntegrationRepository, type IntegrationRecord } from "./integration.repository";

export interface IntegrationConfig {
  platform: PlatformName;
  baseUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
}

export interface IntegrationSummary extends IntegrationConfig {
  source: "database" | "env";
  updatedAt?: Date | null;
}

export interface IntegrationUpdateInput {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
}

export class IntegrationService {
  constructor(private readonly repository: IntegrationRepository) {}

  async listIntegrations(): Promise<IntegrationSummary[]> {
    return Promise.all([
      this.resolveIntegration(PLATFORM.SHOPEE),
      this.resolveIntegration(PLATFORM.TIKTOK)
    ]);
  }

  async resolveIntegration(platform: PlatformName): Promise<IntegrationSummary> {
    const record = await this.repository.findByPlatform(platform);
    const fallback = this.buildFallback(platform);
    const resolved = this.mergeIntegration(platform, record, fallback);

    return {
      ...resolved,
      source: record ? "database" : "env",
      updatedAt: record?.updatedAt ?? null
    };
  }

  async upsertIntegration(platform: PlatformName, input: IntegrationUpdateInput): Promise<IntegrationSummary> {
    await this.repository.upsert({
      platform,
      baseUrl: input.baseUrl.trim(),
      apiKey: input.apiKey.trim(),
      apiSecret: input.apiSecret.trim(),
      webhookSecret: input.webhookSecret.trim()
    });

    return this.resolveIntegration(platform);
  }

  async requireApiConfig(platform: PlatformName): Promise<IntegrationConfig> {
    const resolved = await this.resolveIntegration(platform);
    const missing = [
      { key: "baseUrl", value: resolved.baseUrl },
      { key: "apiKey", value: resolved.apiKey },
      { key: "apiSecret", value: resolved.apiSecret }
    ]
      .filter((item) => !item.value)
      .map((item) => item.key);

    if (missing.length > 0) {
      throw new DomainError("Integration not configured", 400, "INTEGRATION_NOT_CONFIGURED", {
        platform,
        missing
      });
    }

    return resolved;
  }

  async requireWebhookSecret(platform: PlatformName): Promise<string> {
    const resolved = await this.resolveIntegration(platform);
    if (!resolved.webhookSecret) {
      throw new DomainError("Webhook secret not configured", 400, "WEBHOOK_SECRET_NOT_CONFIGURED", {
        platform
      });
    }

    return resolved.webhookSecret;
  }

  private mergeIntegration(
    platform: PlatformName,
    record: IntegrationRecord | null,
    fallback: IntegrationConfig
  ): IntegrationConfig {
    return {
      platform,
      baseUrl: this.firstNonEmpty(record?.baseUrl, fallback.baseUrl),
      apiKey: this.firstNonEmpty(record?.apiKey, fallback.apiKey),
      apiSecret: this.firstNonEmpty(record?.apiSecret, fallback.apiSecret),
      webhookSecret: this.firstNonEmpty(record?.webhookSecret, fallback.webhookSecret)
    };
  }

  private buildFallback(platform: PlatformName): IntegrationConfig {
    if (platform === PLATFORM.SHOPEE) {
      return {
        platform,
        baseUrl: this.normalizeValue(env.SHOPEE_BASE_URL),
        apiKey: this.normalizeValue(env.SHOPEE_PARTNER_ID),
        apiSecret: this.normalizeValue(env.SHOPEE_PARTNER_KEY),
        webhookSecret: this.normalizeValue(env.SHOPEE_WEBHOOK_SECRET)
      };
    }

    return {
      platform,
      baseUrl: this.normalizeValue(env.TIKTOK_BASE_URL),
      apiKey: this.normalizeValue(env.TIKTOK_APP_KEY),
      apiSecret: this.normalizeValue(env.TIKTOK_APP_SECRET),
      webhookSecret: this.normalizeValue(env.TIKTOK_WEBHOOK_SECRET)
    };
  }

  private normalizeValue(value?: string | null): string | undefined {
    if (!value) {
      return undefined;
    }

    const trimmed = String(value).trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private firstNonEmpty(value?: string | null, fallback?: string): string | undefined {
    const normalized = this.normalizeValue(value);
    return normalized ?? this.normalizeValue(fallback);
  }
}
