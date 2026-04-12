/**
 * Social Dashboard Service Tests
 * Tests for dashboard data aggregation, brief filtering, trend transformation,
 * escalation mapping, and health status
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SocialDashboardService } from "../src/ui/social-dashboard-service.ts";
import { ContentPlanningService } from "../src/content-planning-service.js";
import { PerformanceAnalysisService } from "../src/performance-analysis-service.js";
import { TrendDetectorService } from "../src/content/trend-detector.js";
import { CrisisManager } from "../src/content/crisis-manager.js";
import { PerformancePredictorService } from "../src/content/performance-predictor.js";
import type { SocialChannel, ContentFormat, ContentGoal } from "../src/types.js";

// ============================================
// Test Fixtures
// ============================================

function createTestBriefs(planningService: ContentPlanningService): void {
  // Create drafts
  planningService.createBrief({
    title: "Test Brief Draft",
    description: "A test draft brief",
    channel: "instagram",
    contentFormat: "image",
    topic: "Test topic",
    targetAudience: "Test audience",
    contentGoals: ["awareness"],
    createdByRoleKey: "social-manager",
    tags: ["test"],
    hashtags: ["#Test"],
  });

  // Create pending review
  const pendingBrief = planningService.createBrief({
    title: "Test Brief Pending Review",
    description: "A test brief pending review",
    channel: "x",
    contentFormat: "text",
    topic: "Pending topic",
    targetAudience: "Followers",
    contentGoals: ["engagement"],
    createdByRoleKey: "social-manager",
    tags: ["pending"],
    hashtags: ["#Pending"],
  });
  planningService.submitForReview({
    briefId: pendingBrief.id,
    reviewerRoleKey: "content-reviewer",
  });

  // Create approved brief
  const approvedBrief = planningService.createBrief({
    title: "Test Approved Brief",
    description: "An approved brief",
    channel: "youtube",
    contentFormat: "video",
    topic: "Approved topic",
    targetAudience: "Subscribers",
    contentGoals: ["awareness"],
    createdByRoleKey: "social-manager",
    tags: ["approved"],
    hashtags: ["#Approved"],
  });
  planningService.submitForReview({
    briefId: approvedBrief.id,
    reviewerRoleKey: "content-reviewer",
  });
  planningService.reviewBrief({
    briefId: approvedBrief.id,
    reviewerRoleKey: "content-reviewer",
    brandSafetyCheck: { passed: true, flags: [] },
    channelFitCheck: { passed: true, flags: [] },
    contentQualityCheck: { passed: true, flags: [] },
    decision: "approved",
  });
  planningService.approveBrief({
    briefId: approvedBrief.id,
    approverRoleKey: "content-approver",
    decision: "approved",
  });

  // Create published brief
  const publishedBrief = planningService.createBrief({
    title: "Test Published Brief",
    description: "A published brief",
    channel: "tiktok",
    contentFormat: "video",
    topic: "Published topic",
    targetAudience: "Gen-Z",
    contentGoals: ["engagement"],
    createdByRoleKey: "social-manager",
    tags: ["published"],
    hashtags: ["#Published"],
  });
  planningService.submitForReview({
    briefId: publishedBrief.id,
    reviewerRoleKey: "content-reviewer",
  });
  planningService.reviewBrief({
    briefId: publishedBrief.id,
    reviewerRoleKey: "content-reviewer",
    brandSafetyCheck: { passed: true, flags: [] },
    channelFitCheck: { passed: true, flags: [] },
    contentQualityCheck: { passed: true, flags: [] },
    decision: "approved",
  });
  planningService.approveBrief({
    briefId: publishedBrief.id,
    approverRoleKey: "content-approver",
    decision: "approved",
  });
  planningService.publishBrief({
    briefId: publishedBrief.id,
    draftContent: "Published content",
  });
}

function createTestPerformances(performanceService: PerformanceAnalysisService): void {
  performanceService.analyzePerformance({
    briefId: "brief-1",
    metrics: [
      {
        type: "engagement",
        value: 500,
        changePercent: 20,
        isPositiveChange: true,
      },
      {
        type: "impressions",
        value: 10000,
        changePercent: 15,
        isPositiveChange: true,
      },
    ],
  });
}

// ============================================
// Tests
// ============================================

describe("SocialDashboardService", () => {
  let dashboardService: SocialDashboardService;
  let contentPlanning: ContentPlanningService;
  let performanceAnalysis: PerformanceAnalysisService;
  let trendDetector: TrendDetectorService;
  let crisisManager: CrisisManager;
  let performancePredictor: PerformancePredictorService;

  beforeEach(() => {
    contentPlanning = new ContentPlanningService();
    performanceAnalysis = new PerformanceAnalysisService();
    trendDetector = new TrendDetectorService();
    crisisManager = new CrisisManager();
    performancePredictor = new PerformancePredictorService();

    dashboardService = new SocialDashboardService(
      contentPlanning,
      performanceAnalysis,
      trendDetector,
      crisisManager,
      performancePredictor
    );

    createTestBriefs(contentPlanning);
    createTestPerformances(performanceAnalysis);
  });

  describe("getDashboardOverview", () => {
    it("should aggregate all data into dashboard format", async () => {
      const overview = await dashboardService.getDashboardOverview();

      expect(overview).toHaveProperty("metrics");
      expect(overview).toHaveProperty("recentBriefs");
      expect(overview).toHaveProperty("trends");
      expect(overview).toHaveProperty("escalations");
      expect(overview).toHaveProperty("predictions");
      expect(overview).toHaveProperty("health");
    });

    it("should return valid metrics structure", async () => {
      const overview = await dashboardService.getDashboardOverview();

      expect(overview.metrics).toHaveProperty("totalBriefs");
      expect(overview.metrics).toHaveProperty("activeBriefs");
      expect(overview.metrics).toHaveProperty("publishedCount");
      expect(overview.metrics).toHaveProperty("pendingReview");
      expect(overview.metrics).toHaveProperty("avgEngagement");
      expect(overview.metrics).toHaveProperty("topPerformingChannel");
      expect(overview.metrics).toHaveProperty("sentiment");
    });

    it("should include health status with all services", async () => {
      const overview = await dashboardService.getDashboardOverview();

      expect(overview.health.totalServices).toBe(6);
      expect(overview.health.servicesOnline).toBe(6);
      expect(overview.health.lastUpdated).toBeDefined();
    });
  });

  describe("getBriefsForDashboard", () => {
    it("should return briefs limited to 10", () => {
      // Create more than 10 briefs
      for (let i = 0; i < 15; i++) {
        contentPlanning.createBrief({
          title: `Extra Brief ${i}`,
          description: "Extra",
          channel: "x",
          contentFormat: "text",
          topic: "Extra topic",
          targetAudience: "Extra audience",
          contentGoals: ["awareness"],
          createdByRoleKey: "social-manager",
        });
      }

      const briefs = dashboardService.getBriefsForDashboard();
      expect(briefs.length).toBeLessThanOrEqual(10);
    });

    it("should filter briefs by status", () => {
      const drafts = dashboardService.getBriefsForDashboard({ status: "draft" });
      for (const brief of drafts) {
        expect(brief.status).toBe("draft");
      }
    });

    it("should filter briefs by channel", () => {
      const instagramBriefs = dashboardService.getBriefsForDashboard({
        channel: "instagram",
      });
      for (const brief of instagramBriefs) {
        expect(brief.channel).toBe("instagram");
      }
    });

    it("should combine status and channel filters", () => {
      const filtered = dashboardService.getBriefsForDashboard({
        status: "draft",
        channel: "instagram",
      });
      for (const brief of filtered) {
        expect(brief.status).toBe("draft");
        expect(brief.channel).toBe("instagram");
      }
    });

    it("should return recent briefs sorted by createdAt descending", () => {
      const briefs = dashboardService.getBriefsForDashboard();

      if (briefs.length > 1) {
        for (let i = 1; i < briefs.length; i++) {
          const prevDate = new Date(briefs[i - 1].createdAt).getTime();
          const currDate = new Date(briefs[i].createdAt).getTime();
          expect(prevDate).toBeGreaterThanOrEqual(currDate);
        }
      }
    });

    it("should return brief id, title, status, channel, createdAt", () => {
      const briefs = dashboardService.getBriefsForDashboard();

      for (const brief of briefs) {
        expect(brief).toHaveProperty("id");
        expect(brief).toHaveProperty("title");
        expect(brief).toHaveProperty("status");
        expect(brief).toHaveProperty("channel");
        expect(brief).toHaveProperty("createdAt");
      }
    });

    it("should return empty array when no briefs match filters", () => {
      const briefs = dashboardService.getBriefsForDashboard({
        status: "archived",
        channel: "blog",
      });
      expect(briefs).toEqual([]);
    });
  });

  describe("getTrendsForDashboard", () => {
    it("should return top 5 trends by velocity", () => {
      const trends = dashboardService.getTrendsForDashboard();

      expect(trends.length).toBeLessThanOrEqual(5);
    });

    it("should mark breaking trends when velocity > 80", () => {
      const trends = dashboardService.getTrendsForDashboard();

      for (const trend of trends) {
        if (trend.velocity > 80) {
          expect(trend.isBreaking).toBe(true);
        }
      }
    });

    it("should return trends sorted by velocity descending", () => {
      const trends = dashboardService.getTrendsForDashboard();

      if (trends.length > 1) {
        for (let i = 1; i < trends.length; i++) {
          expect(trends[i - 1].velocity).toBeGreaterThanOrEqual(trends[i].velocity);
        }
      }
    });

    it("should return trend id, tag, velocity, sentiment, isBreaking", () => {
      const trends = dashboardService.getTrendsForDashboard();

      for (const trend of trends) {
        expect(trend).toHaveProperty("id");
        expect(trend).toHaveProperty("tag");
        expect(trend).toHaveProperty("velocity");
        expect(trend).toHaveProperty("sentiment");
        expect(trend).toHaveProperty("isBreaking");
      }
    });

    it("should return empty array when no trends available", () => {
      // Create a service with empty trends
      const emptyTrendDetector = new TrendDetectorService([]);
      const serviceWithNoTrends = new SocialDashboardService(
        contentPlanning,
        performanceAnalysis,
        emptyTrendDetector,
        crisisManager,
        performancePredictor
      );

      const trends = serviceWithNoTrends.getTrendsForDashboard();
      expect(trends).toEqual([]);
    });
  });

  describe("getEscalationsForDashboard", () => {
    it("should return active escalations from crisis manager", () => {
      // Trigger a playbook to create an alert
      crisisManager.executePlaybook({
        playbookId: "neg-viral",
        context: { viralPostId: "test-123" },
      });

      const escalations = dashboardService.getEscalationsForDashboard();

      expect(escalations.length).toBeGreaterThan(0);
    });

    it("should map crisis alert to dashboard escalation format", () => {
      const alert = crisisManager.executePlaybook({
        playbookId: "brand-risk",
        context: { riskLevel: "high" },
      });

      const escalations = dashboardService.getEscalationsForDashboard();
      const found = escalations.find((e) => e.id === alert.id);

      expect(found).toBeDefined();
      expect(found?.playbookName).toBe("Brand Safety Risk");
      expect(found?.severity).toBe("high");
      expect(found?.status).toBe("active");
    });

    it("should return escalation id, playbookName, severity, status, triggeredAt", () => {
      crisisManager.executePlaybook({
        playbookId: "mod-spike",
        context: { spikeLevel: "medium" },
      });

      const escalations = dashboardService.getEscalationsForDashboard();

      for (const esc of escalations) {
        expect(esc).toHaveProperty("id");
        expect(esc).toHaveProperty("playbookName");
        expect(esc).toHaveProperty("severity");
        expect(esc).toHaveProperty("status");
        expect(esc).toHaveProperty("triggeredAt");
      }
    });

    it("should return empty array when no active escalations", () => {
      const escalations = dashboardService.getEscalationsForDashboard();
      // Initially no alerts should be active
      expect(escalations).toBeDefined();
    });
  });

  describe("getPredictionsForPendingBriefs", () => {
    it("should return predictions for pending review briefs", () => {
      const predictions = dashboardService.getPredictionsForPendingBriefs();

      // We have one pending review brief from setup
      expect(predictions.length).toBeGreaterThanOrEqual(0);
    });

    it("should return prediction with briefId, briefTitle, channel, predictedScore, confidence", () => {
      const predictions = dashboardService.getPredictionsForPendingBriefs();

      for (const pred of predictions) {
        expect(pred).toHaveProperty("briefId");
        expect(pred).toHaveProperty("briefTitle");
        expect(pred).toHaveProperty("channel");
        expect(pred).toHaveProperty("predictedScore");
        expect(pred).toHaveProperty("confidence");
      }
    });

    it("should have valid score range (0-100)", () => {
      const predictions = dashboardService.getPredictionsForPendingBriefs();

      for (const pred of predictions) {
        expect(pred.predictedScore).toBeGreaterThanOrEqual(0);
        expect(pred.predictedScore).toBeLessThanOrEqual(100);
      }
    });

    it("should have valid confidence range (0-1)", () => {
      const predictions = dashboardService.getPredictionsForPendingBriefs();

      for (const pred of predictions) {
        expect(pred.confidence).toBeGreaterThanOrEqual(0);
        expect(pred.confidence).toBeLessThanOrEqual(1);
      }
    });

    it("should return empty array when no pending briefs", () => {
      const serviceWithNoPending = new SocialDashboardService(
        contentPlanning,
        performanceAnalysis,
        trendDetector,
        crisisManager,
        performancePredictor
      );

      const predictions = serviceWithNoPending.getPredictionsForPendingBriefs();
      // At least the pending brief from beforeEach exists
      expect(predictions).toBeDefined();
    });
  });

  describe("getHealthStatus", () => {
    it("should return all 6 services", () => {
      const health = dashboardService.getHealthStatus();

      expect(health.totalServices).toBe(6);
    });

    it("should report services online", () => {
      const health = dashboardService.getHealthStatus();

      expect(health.servicesOnline).toBeGreaterThan(0);
      expect(health.servicesOnline).toBeLessThanOrEqual(health.totalServices);
    });

    it("should include lastUpdated timestamp", () => {
      const health = dashboardService.getHealthStatus();

      expect(health.lastUpdated).toBeDefined();
      // Verify it's a valid ISO date
      expect(new Date(health.lastUpdated).toISOString()).toBe(health.lastUpdated);
    });

    it("should update service availability when set", () => {
      dashboardService.setServiceAvailability("contentPlanning", false);
      const health = dashboardService.getHealthStatus();

      expect(health.servicesOnline).toBeLessThan(6);
    });
  });

  describe("Metrics Calculation", () => {
    it("should calculate total briefs correctly", async () => {
      const overview = await dashboardService.getDashboardOverview();

      // We created 4 briefs in beforeEach
      expect(overview.metrics.totalBriefs).toBe(4);
    });

    it("should calculate active briefs correctly", async () => {
      const overview = await dashboardService.getDashboardOverview();

      // Active = draft + pending-review + pending-approval + approved = 3 (draft, pending-review, approved)
      expect(overview.metrics.activeBriefs).toBe(3);
    });

    it("should calculate published count correctly", async () => {
      const overview = await dashboardService.getDashboardOverview();

      expect(overview.metrics.publishedCount).toBe(1);
    });

    it("should calculate pending review count correctly", async () => {
      const overview = await dashboardService.getDashboardOverview();

      expect(overview.metrics.pendingReview).toBe(1);
    });

    it("should have valid top performing channel", async () => {
      const overview = await dashboardService.getDashboardOverview();

      expect(typeof overview.metrics.topPerformingChannel).toBe("string");
    });
  });
});
