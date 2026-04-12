/**
 * Performance Prediction Engine
 * Pre-publish scoring for content briefs
 */

import type {
  SocialChannel,
  ContentFormat,
  ContentGoal,
  ContentBrief,
} from "../types.js";

// ============================================
// Prediction Types
// ============================================

export interface PredictionFactor {
  factor: string;
  impact: "positive" | "negative" | "neutral";
  weight: number;
}

export interface PerformancePrediction {
  predictedScore: number;
  engagementRange: { min: number; max: number };
  confidence: number;
  factors: PredictionFactor[];
}

export interface PredictPerformanceParams {
  channel: SocialChannel;
  contentFormat: ContentFormat;
  contentGoals: ContentGoal[];
  targetAudience: string;
  hashtags: string[];
  topic: string;
  keyMessages?: string[];
  scheduledPublishDate?: string;
  dayOfWeek?: number; // 0-6, Sunday-Saturday
  hourOfDay?: number; // 0-23
}

export interface ScoreAudienceFitParams {
  targetAudience: string;
  contentGoals: ContentGoal[];
  channel: SocialChannel;
}

// ============================================
// Channel and Timing Data
// ============================================

// Engagement potential by channel (relative scale 0-100)
const CHANNEL_ENGAGEMENT_BASE: Record<SocialChannel, { base: number; reach: number }> = {
  tiktok: { base: 85, reach: 90 },
  instagram: { base: 75, reach: 80 },
  youtube: { base: 70, reach: 85 },
  x: { base: 60, reach: 70 },
  facebook: { base: 55, reach: 65 },
  linkedin: { base: 50, reach: 55 },
  reddit: { base: 65, reach: 60 },
  blog: { base: 40, reach: 50 },
};

// Format effectiveness by channel
const FORMAT_CHANNEL_FIT: Record<SocialChannel, Record<ContentFormat, number>> = {
  tiktok: { video: 30, image: 10, text: 5, carousel: 5, story: 15, reel: 25, live: 20, thread: 5, link: 0 },
  instagram: { reel: 30, story: 20, image: 25, carousel: 25, video: 20, text: 5, live: 15, thread: 10, link: 5 },
  youtube: { video: 30, text: 10, image: 5, carousel: 5, story: 0, reel: 0, live: 25, thread: 0, link: 10 },
  x: { text: 25, image: 20, video: 15, thread: 20, link: 15, carousel: 5, story: 0, reel: 0, live: 10 },
  facebook: { video: 25, image: 20, carousel: 20, link: 15, text: 15, story: 5, reel: 10, live: 15, thread: 5 },
  linkedin: { text: 20, video: 25, carousel: 25, image: 20, link: 10, story: 0, reel: 10, live: 15, thread: 5 },
  reddit: { text: 25, link: 20, image: 10, video: 15, thread: 20, carousel: 5, story: 0, reel: 0, live: 5 },
  blog: { text: 25, image: 15, video: 10, link: 15, carousel: 5, story: 0, reel: 0, live: 5, thread: 0 },
};

// Optimal posting times by channel (hour ranges)
const OPTIMAL_TIMING: Record<SocialChannel, { weekdays: number[]; weekends: number[] }> = {
  tiktok: { weekdays: [9, 12, 19, 21], weekends: [10, 14, 20] },
  instagram: { weekdays: [11, 14, 17, 19, 21], weekends: [10, 15, 20] },
  youtube: { weekdays: [14, 15, 18, 19, 20], weekends: [9, 11, 14, 16] },
  x: { weekdays: [8, 9, 12, 17, 18], weekends: [10, 12, 16] },
  facebook: { weekdays: [9, 10, 12, 14, 16], weekends: [11, 14, 18] },
  linkedin: { weekdays: [7, 8, 9, 12, 17, 18], weekends: [] },
  reddit: { weekdays: [6, 7, 10, 14, 18, 21], weekends: [8, 12, 16, 20] },
  blog: { weekdays: [6, 7, 8, 10, 15], weekends: [9, 11, 15] },
};

// Goal-to-metric mapping
const GOAL_METRIC_WEIGHTS: Record<ContentGoal, Record<string, number>> = {
  awareness: { impressions: 0.4, reach: 0.3, engagement: 0.2, shares: 0.1 },
  engagement: { engagement: 0.3, likes: 0.2, comments: 0.25, shares: 0.15, clicks: 0.1 },
  conversion: { conversions: 0.35, clicks: 0.3, engagement: 0.2, comments: 0.15 },
  traffic: { clicks: 0.4, shares: 0.25, engagement: 0.2, comments: 0.15 },
  brand: { engagement: 0.25, impressions: 0.25, reach: 0.25, followers: 0.25 },
  community: { comments: 0.35, engagement: 0.3, shares: 0.2, likes: 0.15 },
};

// ============================================
// Helpers
// ============================================

function arrayIncludes<T>(arr: T[], val: T): boolean {
  return arr.indexOf(val) !== -1;
}

function stringIncludes(haystack: string, needle: string): boolean {
  return haystack.indexOf(needle) !== -1;
}

// ============================================
// Performance Predictor Service
// ============================================

export class PerformancePredictorService {
  /**
   * Predict overall performance for a content brief
   */
  predictPerformance(params: PredictPerformanceParams): PerformancePrediction {
    const factors: PredictionFactor[] = [];

    // 1. Channel Fit Score (0-30)
    const channelFit = this.scoreChannelFit(params.channel, params.contentFormat);
    factors.push({
      factor: "channel_fit",
      impact: channelFit >= 20 ? "positive" : channelFit >= 10 ? "neutral" : "negative",
      weight: channelFit,
    });

    // 2. Audience Fit Score (0-25)
    const audienceFit = this.scoreAudienceFit({
      targetAudience: params.targetAudience,
      contentGoals: params.contentGoals,
      channel: params.channel,
    });
    factors.push({
      factor: "audience_fit",
      impact: audienceFit >= 18 ? "positive" : audienceFit >= 12 ? "neutral" : "negative",
      weight: audienceFit,
    });

    // 3. Timing Quality Score (0-20)
    const timingQuality = this.scoreTiming(params);
    factors.push({
      factor: "timing_quality",
      impact: timingQuality >= 15 ? "positive" : timingQuality >= 8 ? "neutral" : "negative",
      weight: timingQuality,
    });

    // 4. Content Format Fit Score (0-15)
    const formatFit = this.scoreFormatFit(params.channel, params.contentFormat);
    factors.push({
      factor: "content_format_fit",
      impact: formatFit >= 12 ? "positive" : formatFit >= 7 ? "neutral" : "negative",
      weight: formatFit,
    });

    // 5. Hashtag Quality Score (0-10)
    const hashtagQuality = this.scoreHashtagQuality(params.hashtags, params.channel);
    factors.push({
      factor: "hashtag_quality",
      impact: hashtagQuality >= 8 ? "positive" : hashtagQuality >= 4 ? "neutral" : "negative",
      weight: hashtagQuality,
    });

    // Calculate total score
    const predictedScore = Math.min(100, channelFit + audienceFit + timingQuality + formatFit + hashtagQuality);

    // Calculate engagement range based on channel base
    const channelBase = CHANNEL_ENGAGEMENT_BASE[params.channel];
    const rangeMultiplier = predictedScore / 100;
    const engagementRange = {
      min: Math.round(channelBase.base * rangeMultiplier * 0.7),
      max: Math.round(channelBase.base * rangeMultiplier * 1.3),
    };

    // Confidence based on data completeness
    const confidence = this.calculateConfidence(params);

    return {
      predictedScore,
      engagementRange,
      confidence,
      factors,
    };
  }

  /**
   * Score how well content fits the target audience (0-25)
   */
  scoreAudienceFit(params: ScoreAudienceFitParams): number {
    let score = 12.5; // Base score

    const audLower = params.targetAudience.toLowerCase();

    // Professional/B2B channels
    if (params.channel === "linkedin") {
      if (arrayIncludes(params.contentGoals, "conversion") || arrayIncludes(params.contentGoals, "brand")) {
        score += 5;
      }
      if (stringIncludes(audLower, "professional") || 
          stringIncludes(audLower, "b2b") ||
          stringIncludes(audLower, "business")) {
        score += 7.5;
      }
    }

    // Visual channels
    if (params.channel === "instagram" || params.channel === "tiktok") {
      if (arrayIncludes(params.contentGoals, "engagement") || arrayIncludes(params.contentGoals, "awareness")) {
        score += 5;
      }
      if (stringIncludes(audLower, "young") ||
          stringIncludes(audLower, "gen z") ||
          stringIncludes(audLower, "millennial")) {
        score += 7.5;
      }
    }

    // Community-focused
    if (arrayIncludes(params.contentGoals, "community")) {
      if (params.channel === "reddit" || params.channel === "x" || params.channel === "facebook") {
        score += 7.5;
      }
    }

    // Traffic goals
    if (arrayIncludes(params.contentGoals, "traffic")) {
      if (params.channel === "x" || params.channel === "reddit" || params.channel === "blog") {
        score += 5;
      }
    }

    return Math.min(25, Math.max(0, score));
  }

  /**
   * Suggest best posting times for a channel
   */
  suggestBestTiming(params: { channel: SocialChannel; dayOfWeek?: number }): string[] {
    const timing = OPTIMAL_TIMING[params.channel];
    const isWeekend = params.dayOfWeek === 0 || params.dayOfWeek === 6;
    const optimalHours = isWeekend ? timing.weekends : timing.weekdays;

    if (optimalHours.length === 0) {
      // Fallback generic times
      return ["09:00", "12:00", "17:00", "20:00"];
    }

    return optimalHours.map((hour) => {
      const period = hour >= 12 ? "PM" : "AM";
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      return `${displayHour}:00 ${period}`;
    });
  }

  // ============================================
  // Private scoring helpers
  // ============================================

  private scoreChannelFit(channel: SocialChannel, format: ContentFormat): number {
    const formatScore = FORMAT_CHANNEL_FIT[channel][format] ?? 0;
    return Math.min(30, formatScore);
  }

  private scoreFormatFit(channel: SocialChannel, format: ContentFormat): number {
    const formatScore = FORMAT_CHANNEL_FIT[channel][format] ?? 0;
    // Scale to 0-15
    return Math.round((formatScore / 30) * 15);
  }

  private scoreTiming(params: PredictPerformanceParams): number {
    let score = 10; // Base neutral score

    if (params.dayOfWeek !== undefined && params.hourOfDay !== undefined) {
      const timing = OPTIMAL_TIMING[params.channel];
      const isWeekend = params.dayOfWeek === 0 || params.dayOfWeek === 6;
      const optimalHours = isWeekend ? timing.weekends : timing.weekdays;

      if (arrayIncludes(optimalHours, params.hourOfDay)) {
        score += 10;
      } else {
        // Penalize far from optimal
        let minDistance = 24;
        for (const hour of optimalHours) {
          const diff = Math.abs(hour - params.hourOfDay!);
          const dist = Math.min(diff, 24 - diff);
          if (dist < minDistance) minDistance = dist;
        }
        score -= Math.min(8, minDistance);
      }
    }

    // Scheduled publish date bonus
    if (params.scheduledPublishDate) {
      const date = new Date(params.scheduledPublishDate);
      const dayOfWeek = date.getDay();
      const hourOfDay = date.getHours();
      
      const timing = OPTIMAL_TIMING[params.channel];
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const optimalHours = isWeekend ? timing.weekends : timing.weekdays;

      if (arrayIncludes(optimalHours, hourOfDay)) {
        score += 5;
      }
    }

    return Math.min(20, Math.max(0, score));
  }

  private scoreHashtagQuality(hashtags: string[], channel: SocialChannel): number {
    if (hashtags.length === 0) return 3;

    const config = {
      x: { max: 10, optimal: 3 },
      instagram: { max: 30, optimal: 8 },
      youtube: { max: 15, optimal: 5 },
      tiktok: { max: 10, optimal: 4 },
      facebook: { max: 10, optimal: 3 },
      linkedin: { max: 5, optimal: 3 },
      reddit: { max: 20, optimal: 5 },
      blog: { max: 10, optimal: 3 },
    };

    const limits = config[channel] ?? { max: 10, optimal: 5 };

    // Score based on count relative to optimal
    let score = 5;
    if (hashtags.length === limits.optimal) {
      score += 3;
    } else if (hashtags.length > limits.max) {
      score -= 4;
    } else if (hashtags.length < limits.optimal) {
      score -= (limits.optimal - hashtags.length) * 0.5;
    }

    // Quality: check for specificity (longer hashtags tend to be more specific)
    const avgLength = hashtags.reduce((sum, tag) => sum + tag.length, 0) / hashtags.length;
    if (avgLength > 15) score += 2;
    else if (avgLength < 8) score -= 2;

    return Math.min(10, Math.max(0, score));
  }

  private calculateConfidence(params: PredictPerformanceParams): number {
    let confidence = 0.5; // Base 50%

    if (params.targetAudience) confidence += 0.1;
    if (params.contentGoals.length > 0) confidence += 0.1;
    if (params.hashtags.length > 0) confidence += 0.1;
    if (params.keyMessages && params.keyMessages.length > 0) confidence += 0.1;
    if (params.scheduledPublishDate) confidence += 0.1;

    return Math.min(0.95, Math.max(0.3, confidence));
  }
}

// Export singleton for convenience
export const performancePredictor = new PerformancePredictorService();
