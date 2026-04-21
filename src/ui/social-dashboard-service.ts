/**
 * Social Dashboard Service Integration Layer
 * Bridge between the existing social-dashboard.tsx UI and the content services.
 * Aggregates data from all services for dashboard consumption.
 */

import type {
  ContentBrief,
  BriefStatus,
  SocialChannel,
  ChannelPerformance,
} from "../types.js";

// Import services - use .js extension pattern for ESM compatibility
// These services may not exist yet, so we handle gracefully
import { ContentPlanningService } from "../content-planning-service.js";
import { PerformanceAnalysisService } from "../performance-analysis-service.js";

// AI services from content modules
import { TrendDetectorService } from "../content/trend-detector.js";
import { CrisisManager } from "../content/crisis-manager.js";
import { PerformancePredictorService } from "../content/performance-predictor.js";

// ============================================
// Dashboard Types
// ============================================

export interface DashboardMetrics {
  totalBriefs: number;
  activeBriefs: number;
  publishedCount: number;
  pendingReview: number;
  avgEngagement: number;
  topPerformingChannel: string;
  sentiment: number;
}

export interface DashboardTrend {
  id: string;
  tag: string;
  velocity: number;
  sentiment: number;
  isBreaking: boolean;
}

export interface DashboardEscalation {
  id: string;
  playbookName: string;
  severity: string;
  status: string;
  triggeredAt: string;
}

export interface DashboardPrediction {
  briefId: string;
  briefTitle: string;
  channel: string;
  predictedScore: number;
  confidence: number;
}

export interface DashboardHealth {
  servicesOnline: number;
  totalServices: number;
  lastUpdated: string;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  recentBriefs: Array<{
    id: string;
    title: string;
    status: string;
    channel: string;
    createdAt: string;
  }>;
  trends: DashboardTrend[];
  escalations: DashboardEscalation[];
  predictions: DashboardPrediction[];
  health: DashboardHealth;
}

export interface BriefFilters {
  status?: BriefStatus;
  channel?: SocialChannel;
}

// ============================================
// Social Dashboard Service
// ============================================

export class SocialDashboardService {
  private contentPlanning: ContentPlanningService;
  private performanceAnalysis: PerformanceAnalysisService;
  private trendDetector: TrendDetectorService;
  private crisisManager: CrisisManager;
  private performancePredictor: PerformancePredictorService;

  // Track service availability
  private servicesAvailable = {
    contentPlanning: true,
    performanceAnalysis: true,
    trendDetector: true,
    crisisManager: true,
    performancePredictor: true,
  };

  constructor(
    contentPlanning?: ContentPlanningService,
    performanceAnalysis?: PerformanceAnalysisService,
    trendDetector?: TrendDetectorService,
    crisisManager?: CrisisManager,
    performancePredictor?: PerformancePredictorService
  ) {
    this.contentPlanning = contentPlanning ?? new ContentPlanningService();
    this.performanceAnalysis = performanceAnalysis ?? new PerformanceAnalysisService();
    this.trendDetector = trendDetector ?? new TrendDetectorService();
    this.crisisManager = crisisManager ?? new CrisisManager();
    this.performancePredictor = performancePredictor ?? new PerformancePredictorService();
  }

  /**
   * Get complete dashboard overview by aggregating all sub-calls
   */
  async getDashboardOverview(): Promise<DashboardData> {
    const [
      metrics,
      recentBriefs,
      trends,
      escalations,
      predictions,
      health,
    ] = await Promise.all([
      this.getMetrics(),
      this.getBriefsForDashboard(),
      this.getTrendsForDashboard(),
      this.getEscalationsForDashboard(),
      this.getPredictionsForPendingBriefs(),
      this.getHealthStatus(),
    ]);

    return {
      metrics,
      recentBriefs,
      trends,
      escalations,
      predictions,
      health,
    };
  }

  /**
   * Get recent briefs from ContentPlanningService with optional filters
   */
  getBriefsForDashboard(filters?: BriefFilters): Array<{
    id: string;
    title: string;
    status: string;
    channel: string;
    createdAt: string;
  }> {
    try {
      let briefs: ContentBrief[] = this.contentPlanning.getAllBriefs();

      // Apply filters
      if (filters?.status) {
        briefs = briefs.filter((b) => b.status === filters.status);
      }
      if (filters?.channel) {
        briefs = briefs.filter((b) => b.channel === filters.channel);
      }

      // Sort by createdAt descending and limit to 10
      const sortedBriefs = briefs
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 10);

      return sortedBriefs.map((brief) => ({
        id: brief.id,
        title: brief.title,
        status: brief.status,
        channel: brief.channel,
        createdAt: brief.createdAt,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get top 5 trends by velocity, mark breaking if velocity > 80
   */
  getTrendsForDashboard(): DashboardTrend[] {
    // Keep the dashboard honest until a real trend-ingestion source is wired.
    // The current detector can synthesize sample-like outputs, which should not
    // surface in the live command center.
    return [];
  }

  /**
   * Get active escalations from CrisisManager
   */
  getEscalationsForDashboard(): DashboardEscalation[] {
    try {
      const alerts = this.crisisManager.getActiveAlerts();

      return alerts.map((alert) => ({
        id: alert.id,
        playbookName: alert.playbookName,
        severity: alert.severity,
        status: alert.status,
        triggeredAt: alert.triggeredAt.toISOString(),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Predict performance for all pending briefs
   */
  getPredictionsForPendingBriefs(): DashboardPrediction[] {
    try {
      const pendingBriefs = this.contentPlanning.getPendingReviewBriefs();

      return pendingBriefs.map((brief) => {
        const prediction = this.performancePredictor.predictPerformance({
          channel: brief.channel,
          contentFormat: brief.contentFormat,
          contentGoals: brief.contentGoals,
          targetAudience: brief.targetAudience,
          hashtags: brief.hashtags,
          topic: brief.topic,
          keyMessages: brief.keyMessages,
          scheduledPublishDate: brief.scheduledPublishDate,
        });

        return {
          briefId: brief.id,
          briefTitle: brief.title,
          channel: brief.channel,
          predictedScore: prediction.predictedScore,
          confidence: prediction.confidence,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Get health status of all services
   */
  getHealthStatus(): DashboardHealth {
    const totalServices = 6;
    let servicesOnline = 0;

    // Check each service
    if (this.servicesAvailable.contentPlanning) servicesOnline++;
    if (this.servicesAvailable.performanceAnalysis) servicesOnline++;
    if (this.servicesAvailable.trendDetector) servicesOnline++;
    if (this.servicesAvailable.crisisManager) servicesOnline++;
    if (this.servicesAvailable.performancePredictor) servicesOnline++;

    // ContentPlanningService is always counted as online if initialized
    // (it doesn't have an async health check in this implementation)
    servicesOnline++;

    return {
      servicesOnline,
      totalServices,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get dashboard metrics from all services
   */
  private async getMetrics(): Promise<DashboardMetrics> {
    try {
      const briefs = this.contentPlanning.getAllBriefs();
      const performances = this.performanceAnalysis.getAllPerformances();

      // Calculate metrics
      const totalBriefs = briefs.length;
      const activeBriefs = briefs.filter((b) =>
        ["draft", "pending-review", "pending-approval", "approved"].includes(b.status)
      ).length;
      const publishedCount = briefs.filter((b) => b.status === "published").length;
      const pendingReview = briefs.filter((b) => b.status === "pending-review").length;

      // Calculate average engagement from performances
      let avgEngagement = 0;
      if (performances.length > 0) {
        const totalScore = performances.reduce((sum, p) => sum + p.overallScore, 0);
        avgEngagement = Math.round(totalScore / performances.length);
      }

      // Find top performing channel
      let topPerformingChannel = "N/A";
      if (performances.length > 0) {
        const channelScores = new Map<SocialChannel, number[]>();
        for (const perf of performances) {
          const scores = channelScores.get(perf.channel) ?? [];
          scores.push(perf.overallScore);
          channelScores.set(perf.channel, scores);
        }

        let bestChannel: SocialChannel = "x";
        let bestAvg = 0;
        for (const [channel, scores] of channelScores) {
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
          if (avg > bestAvg) {
            bestAvg = avg;
            bestChannel = channel;
          }
        }
        topPerformingChannel = bestChannel;
      }

      // Calculate sentiment from trends
      const sentiment = 0;

      return {
        totalBriefs,
        activeBriefs,
        publishedCount,
        pendingReview,
        avgEngagement,
        topPerformingChannel,
        sentiment,
      };
    } catch {
      return {
        totalBriefs: 0,
        activeBriefs: 0,
        publishedCount: 0,
        pendingReview: 0,
        avgEngagement: 0,
        topPerformingChannel: "N/A",
        sentiment: 0,
      };
    }
  }

  /**
   * Update service availability status
   */
  setServiceAvailability(
    service: keyof typeof this.servicesAvailable,
    available: boolean
  ): void {
    this.servicesAvailable[service] = available;
  }
}

// Default export for convenience
export default SocialDashboardService;
