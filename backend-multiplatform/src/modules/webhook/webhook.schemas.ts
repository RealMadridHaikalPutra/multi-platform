import { z } from "zod";

export const ShopeeWebhookSchema = z.object({
  event_id: z.string().min(1),
  event_type: z.enum(["ORDER_STATUS", "STOCK_CHANGE"]),
  shop_id: z.union([z.string(), z.number()]),
  timestamp: z.number().int(),
  data: z.object({
    order_id: z.string().optional(),
    sku: z.string().optional(),
    quantity: z.number().int().optional(),
    status: z.string().optional(),
    delta: z.number().int().optional()
  })
});

export const TikTokWebhookSchema = z.object({
  event_id: z.string().min(1),
  type: z.enum(["ORDER_STATUS_CHANGED", "PRODUCT_STOCK_CHANGED"]),
  shop_id: z.union([z.string(), z.number()]),
  timestamp: z.number().int(),
  data: z.object({
    order_id: z.string().optional(),
    sku: z.string().optional(),
    quantity: z.number().int().optional(),
    status: z.string().optional(),
    delta: z.number().int().optional()
  })
});

export type ShopeeWebhookPayload = z.infer<typeof ShopeeWebhookSchema>;
export type TikTokWebhookPayload = z.infer<typeof TikTokWebhookSchema>;
