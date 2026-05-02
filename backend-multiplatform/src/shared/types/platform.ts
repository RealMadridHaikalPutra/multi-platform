export const PLATFORM = {
  SHOPEE: "SHOPEE",
  TIKTOK: "TIKTOK"
} as const;

export type PlatformName = (typeof PLATFORM)[keyof typeof PLATFORM];
