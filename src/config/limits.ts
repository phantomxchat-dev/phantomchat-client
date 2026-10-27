/**
 * Global Platform Limits & Timer Configurations
 * Standard (free) tier rooms expire after 2 minutes (120 seconds).
 * Extended lifespans (1 hour, 6 hours) are reserved for VIP and Pro clearances.
 */

export const FREE_TIER_ROOM_TIMER_SECONDS = 120; // 2 minutes (120 seconds) for standard/free tier
export const VIP_TIER_ROOM_TIMER_SECONDS = 3600; // 1 hour (3600 seconds) for VIP tier
export const PRO_TIER_ROOM_TIMER_SECONDS = 21600; // 6 hours (21600 seconds) for Pro tier

export const FREE_TIER_DAILY_MEDIA_LIMIT = 2;
export const VIP_TIER_DAILY_MEDIA_LIMIT = 15;
