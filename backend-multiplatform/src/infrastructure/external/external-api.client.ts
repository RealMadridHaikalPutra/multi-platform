import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import { env } from "../../config/env";
import { sleep } from "../../shared/utils/sleep";

export class ExternalApiClient {
  protected readonly client: AxiosInstance;
  private readonly baseURL: string;
  private readonly defaultHeaders: Record<string, string>;

  constructor(baseURL: string, defaultHeaders?: Record<string, string>) {
    this.baseURL = baseURL;
    this.defaultHeaders = defaultHeaders ?? {};
    this.client = axios.create({
      baseURL,
      timeout: 15_000,
      headers: {
        "content-type": "application/json",
        ...this.defaultHeaders
      }
    });
  }

  protected async request<T>(
    config: AxiosRequestConfig,
    overrides?: { baseURL?: string; headers?: Record<string, string> }
  ): Promise<T> {
    const retryAttempts = env.EXTERNAL_RETRY_ATTEMPTS;

    const client = overrides
      ? axios.create({
          baseURL: overrides.baseURL ?? this.baseURL,
          timeout: 15_000,
          headers: {
            "content-type": "application/json",
            ...this.defaultHeaders,
            ...(overrides.headers ?? {})
          }
        })
      : this.client;

    for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
      try {
        const response = await client.request<T>(config);
        return response.data;
      } catch (error: any) {
        const status = error?.response?.status as number | undefined;
        const retryAfter = Number(error?.response?.headers?.["retry-after"] ?? 0);
        const retryable = !status || status >= 500 || status === 429;

        if (!retryable || attempt === retryAttempts) {
          throw error;
        }

        const backoff = status === 429 && retryAfter > 0
          ? retryAfter * 1000
          : env.EXTERNAL_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);

        await sleep(backoff);
      }
    }

    throw new Error("request failed after retries");
  }
}
