/**
 * Performance Predictor Tests
 */

import { describe, it, expect } from "vitest";
import {
  PerformancePredictorService,
  PredictPerformanceParams,
} from "../src/content/performance-predictor.js";

describe("PerformancePredictorService", () => {
  const predictor = new PerformancePredictorService();

  describe("predictPerformance", () => {
    it("should predict high score for well-matched TikTok video content", () => {
      const params: PredictPerformanceParams = {
        channel: "tiktok",
        contentFormat: "video",
        contentGoals: ["engagement", "awareness"],
        targetAudience: "young adults, gen z",
        hashtags: ["trending", "viral", "fyp", "foryou"],
        topic: "Campus life tips",
        keyMessages: ["Study hack 1", "Study hack 2", "Time management"],
        scheduledPublishDate: "2024-03-15T19:00:00Z",
        dayOfWeek: 5,
        hourOfDay: 19,
      };

      const prediction = predictor.predictPerformance(params);

      expect(prediction.predictedScore).toBeGreaterThan(60);
      expect(prediction.confidence).toBeGreaterThan(0.7);
      expect(prediction.engagementRange.min).toBeLessThan(prediction.engagementRange.max);
      expect(prediction.factors.length).toBe(5);
    });

    it("should predict lower score for poor format-channel match", () => {
      const params: PredictPerformanceParams = {
        channel: "linkedin",
        contentFormat: "story",
        contentGoals: ["traffic"],
        targetAudience: "business professionals",
        hashtags: [],
        topic: "Tech industry news",
        dayOfWeek: 1,
        hourOfDay: 9,
      };

      const prediction = predictor.predictPerformance(params);

      // LinkedIn doesn't support stories well
      const storyFactor = prediction.factors.find((f) => f.factor === "content_format_fit");
      expect(storyFactor?.impact).toBe("negative");
      expect(prediction.predictedScore).toBeLessThan(70);
    });

    it("should return neutral timing for off-peak posting", () => {
      const params: PredictPerformanceParams = {
        channel: "instagram",
        contentFormat: "reel",
        contentGoals: ["awareness"],
        targetAudience: "millennials",
        hashtags: ["reel", "viral"],
        topic: "Food recipe",
        dayOfWeek: 2,
        hourOfDay: 3, // 3 AM - off peak
      };

      const prediction = predictor.predictPerformance(params);

      const timingFactor = prediction.factors.find((f) => f.factor === "timing_quality");
      expect(timingFactor?.impact).toBe("negative");
    });

    it("should handle minimal params with reasonable defaults", () => {
      const params: PredictPerformanceParams = {
        channel: "x",
        contentFormat: "text",
        contentGoals: ["engagement"],
        targetAudience: "general",
        hashtags: ["news"],
        topic: "Update",
      };

      const prediction = predictor.predictPerformance(params);

      expect(prediction.predictedScore).toBeGreaterThanOrEqual(0);
      expect(prediction.predictedScore).toBeLessThanOrEqual(100);
      expect(prediction.confidence).toBeGreaterThanOrEqual(0.3);
      expect(prediction.engagementRange.min).toBeGreaterThanOrEqual(0);
    });

    it("should score LinkedIn professional content higher for B2B", () => {
      const params: PredictPerformanceParams = {
        channel: "linkedin",
        contentFormat: "video",
        contentGoals: ["conversion", "brand"],
        targetAudience: "B2B professionals, enterprise decision makers",
        hashtags: ["b2b", "enterprise", "leadership", "strategy"],
        topic: "Digital transformation guide",
        keyMessages: ["Key insight 1", "Key insight 2"],
        dayOfWeek: 3,
        hourOfDay: 8,
      };

      const prediction = predictor.predictPerformance(params);

      const audienceFactor = prediction.factors.find((f) => f.factor === "audience_fit");
      expect(audienceFactor?.impact).toBe("positive");
      expect(prediction.predictedScore).toBeGreaterThan(55);
    });
  });

  describe("scoreAudienceFit", () => {
    it("should score high for Reddit community content", () => {
      const score = predictor.scoreAudienceFit({
        targetAudience: "tech enthusiasts",
        contentGoals: ["community", "engagement"],
        channel: "reddit",
      });

      expect(score).toBeGreaterThan(15);
    });

    it("should score low for LinkedIn casual content", () => {
      const score = predictor.scoreAudienceFit({
        targetAudience: "party people",
        contentGoals: ["engagement"],
        channel: "linkedin",
      });

      expect(score).toBeLessThan(18);
    });
  });

  describe("suggestBestTiming", () => {
    it("should suggest weekday times for weekday query", () => {
      const times = predictor.suggestBestTiming({
        channel: "instagram",
        dayOfWeek: 3, // Wednesday
      });

      expect(times.length).toBeGreaterThan(0);
      expect(times).toContain("7:00 PM");
    });

    it("should suggest weekend times for weekend query", () => {
      const times = predictor.suggestBestTiming({
        channel: "tiktok",
        dayOfWeek: 6, // Saturday
      });

      expect(times.length).toBeGreaterThan(0);
    });

    it("should return fallback times for LinkedIn weekend (no optimal weekend times)", () => {
      const times = predictor.suggestBestTiming({
        channel: "linkedin",
        dayOfWeek: 0, // Sunday
      });

      expect(times).toEqual(["09:00", "12:00", "17:00", "20:00"]);
    });
  });
});
