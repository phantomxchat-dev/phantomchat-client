/**
 * Usage Tracker & Free Tier Limits for Phantom Chat
 * Tracks media uploads in localStorage using current date key format: phantom_media_count_${YYYY-MM-DD}
 * Free user media upload limit: 2 images/day (automatically resets at midnight)
 */

import { FREE_TIER_ROOM_TIMER_SECONDS as CONFIG_FREE_TIMER } from "../config/limits";

export const FREE_TIER_DAILY_MEDIA_LIMIT = 2;
export const VIP_TIER_DAILY_MEDIA_LIMIT = 15;
export const FREE_TIER_ROOM_TIMER_SECONDS = CONFIG_FREE_TIMER || 120; // 2 minutes (120 seconds)

export function getTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDailyMediaStorageKey(): string {
  return `phantom_media_count_${getTodayDateKey()}`;
}

export function getDailyMediaUploadCount(): number {
  try {
    const key = getDailyMediaStorageKey();
    const val = localStorage.getItem(key);
    if (!val) return 0;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  } catch {
    return 0;
  }
}

export function incrementDailyMediaUploadCount(): number {
  try {
    const key = getDailyMediaStorageKey();
    const current = getDailyMediaUploadCount();
    const updated = current + 1;
    localStorage.setItem(key, String(updated));
    return updated;
  } catch {
    return 1;
  }
}

export function checkMediaUploadQuota(isPro: boolean, isVip: boolean): {
  allowed: boolean;
  count: number;
  limit: number | "UNLIMITED";
  message?: string;
} {
  const count = getDailyMediaUploadCount();
  if (isPro) {
    return { allowed: true, count, limit: "UNLIMITED" };
  }
  if (isVip) {
    if (count >= VIP_TIER_DAILY_MEDIA_LIMIT) {
      return {
        allowed: false,
        count,
        limit: VIP_TIER_DAILY_MEDIA_LIMIT,
        message: "🔒 VIP DAILY DURATION AT CAPACITY (15/15). Upgrade to Phantom PRO for infinite transfers.",
      };
    }
    return { allowed: true, count, limit: VIP_TIER_DAILY_MEDIA_LIMIT };
  }

  // Free Tier: 2 images/day
  if (count >= FREE_TIER_DAILY_MEDIA_LIMIT) {
    return {
      allowed: false,
      count,
      limit: FREE_TIER_DAILY_MEDIA_LIMIT,
      message: "Daily free media limit reached (2/2)",
    };
  }

  return { allowed: true, count, limit: FREE_TIER_DAILY_MEDIA_LIMIT };
}
