/**
 * Trend Detection Service
 * Real-time trend detection and opportunity matching for social media content
 */

import { SocialChannel, ContentFormat, ContentGoal, CreateBriefParams } from "../types.js";

// ============================================
// Trend Types
// ============================================

export interface Trend {
  id: string;
  tag: string;
  category: string;
  velocity: number; // Growth rate (10-200)
  volume: number;    // Current volume (100-5000)
  sentiment: number; // 0.1-0.9 (negative to positive)
  emerging: boolean;
  expiresAt: string;
}

export interface TrendOpportunity {
  trend: Trend;
  matchScore: number; // 0-100
  suggestedBrief: Partial<CreateBriefParams>;
  urgency: "low" | "medium" | "high" | "critical";
}

// ============================================
// Mock Data
// ============================================

const MOCK_TRENDS: Trend[] = [
  {
    id: "trend-001",
    tag: "#UniversityInnovation",
    category: "education",
    velocity: 150,
    volume: 4200,
    sentiment: 0.85,
    emerging: true,
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "trend-002",
    tag: "#CampusLife",
    category: "lifestyle",
    velocity: 85,
    volume: 3100,
    sentiment: 0.78,
    emerging: false,
    expiresAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "trend-003",
    tag: "#AcademicExcellence",
    category: "education",
    velocity: 120,
    volume: 2800,
    sentiment: 0.72,
    emerging: true,
    expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "trend-004",
    tag: "#StudentSuccess",
    category: "education",
    velocity: 95,
    volume: 2400,
    sentiment: 0.81,
    emerging: false,
    expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "trend-005",
    tag: "#RemoteLearning",
    category: "technology",
    velocity: 45,
    volume: 1800,
    sentiment: 0.55,
    emerging: false,
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "trend-006",
    tag: "#ResearchBreakthrough",
    category: "science",
    velocity: 180,
    volume: 3500,
    sentiment: 0.88,
    emerging: true,
    expiresAt: new Date(Date.now() + 1.5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "trend-007",
    tag: "#ClimateAction",
    category: "environment",
    velocity: 110,
    volume: 4800,
    sentiment: 0.42,
    emerging: true,
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "trend-008",
    tag: "#BudgetCuts",
    category: "politics",
    velocity: 75,
    volume: 2100,
    sentiment: 0.25,
    emerging: false,
    expiresAt: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "trend-009",
    tag: "#CampusSafety",
    category: "safety",
    velocity: 25,
    volume: 900,
    sentiment: 0.35,
    emerging: false,
    expiresAt: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "trend-010",
    tag: "#AIInEducation",
    category: "technology",
    velocity: 195,
    volume: 5000,
    sentiment: 0.79,
    emerging: true,
    expiresAt: new Date(Date.now() + 2.5 * 60 * 60 * 1000).toISOString(),
  },
];

// ============================================
// Service Implementation
// ============================================

export interface DetectTrendsParams {
  categories?: string[];
  minVelocity?: number;
  minVolume?: number;
  limit?: number;
}

export interface FindOpportunitiesParams {
  briefs?: Array<{ id: string; topic: string; channel: SocialChannel; contentGoals: ContentGoal[]; tags: string[] }>;
  minMatchScore?: number;
  limit?: number;
}

export class TrendDetectorService {
  private trends: Trend[];

  constructor(trends: Trend[] = MOCK_TRENDS) {
    this.trends = trends;
  }

  /**
   * Detect trends based on filtering criteria
   */
  detectTrends(params: DetectTrendsParams = {}): Trend[] {
    const { categories, minVelocity = 0, minVolume = 0, limit = 50 } = params;

    let filtered = this.trends.filter((trend) => {
      if (categories && categories.length > 0) {
        if (!categories.includes(trend.category)) return false;
      }
      if (trend.velocity < minVelocity) return false;
      if (trend.volume < minVolume) return false;
      return true;
    });

    // Sort by velocity descending
    filtered.sort((a, b) => b.velocity - a.velocity);

    return filtered.slice(0, limit);
  }

  /**
   * Find opportunities by matching trends to existing briefs
   */
  findOpportunities(params: FindOpportunitiesParams = {}): TrendOpportunity[] {
    const { briefs = [], minMatchScore = 0, limit = 20 } = params;

    const opportunities: TrendOpportunity[] = [];

    for (const trend of this.trends) {
      for (const brief of briefs) {
        const matchScore = this.calculateMatchScore(trend, brief);
        if (matchScore >= minMatchScore) {
          opportunities.push({
            trend,
            matchScore,
            suggestedBrief: this.generateSuggestedBrief(trend, brief),
            urgency: this.determineUrgency(trend, matchScore),
          });
        }
      }
    }

    // Sort by match score descending
    opportunities.sort((a, b) => b.matchScore - a.matchScore);

    return opportunities.slice(0, limit);
  }

  /**
   * Get breaking alerts for trends with high velocity or negative sentiment
   */
  getBreakingAlerts(): Trend[] {
    return this.trends.filter(
      (trend) => trend.velocity > 100 || trend.sentiment < 0.3
    );
  }

  /**
   * Calculate match score between a trend and a brief
   */
  private calculateMatchScore(
    trend: Trend,
    brief: { topic: string; channel: SocialChannel; contentGoals: ContentGoal[]; tags: string[] }
  ): number {
    let score = 0;

    // Topic/tag similarity (up to 40 points)
    const trendWords = trend.tag.toLowerCase().replace("#", "").split(/(?=[A-Z]|[0-9])/);
    const topicWords = brief.topic.toLowerCase().split(/\s+/);
    const tagWords = brief.tags.map((t) => t.toLowerCase().replace("#", ""));
    
    const combinedWords = [...topicWords, ...tagWords];
    const matchingWords = trendWords.filter((tw) =>
      combinedWords.some((cw) => cw.includes(tw) || tw.includes(cw))
    );
    score += Math.min(40, matchingWords.length * 15);

    // Velocity factor (up to 30 points)
    score += Math.min(30, trend.velocity * 0.15);

    // Sentiment factor (up to 20 points)
    score += trend.sentiment * 20;

    // Emerging bonus (10 points)
    if (trend.emerging) {
      score += 10;
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Generate a suggested brief based on trend and existing brief
   */
  private generateSuggestedBrief(
    trend: Trend,
    brief: { id: string; topic: string; channel: SocialChannel; tags: string[] }
  ): Partial<CreateBriefParams> {
    return {
      title: `${trend.tag.replace("#", "")} - ${brief.topic}`,
      topic: `${trend.tag} ${brief.topic}`,
      hashtags: [trend.tag, ...brief.tags.slice(0, 4)],
      contentGoals: ["awareness", "engagement"],
    };
  }

  /**
   * Determine urgency level based on trend metrics and match score
   */
  private determineUrgency(trend: Trend, matchScore: number): "low" | "medium" | "high" | "critical" {
    if (trend.velocity > 150 && trend.sentiment > 0.7 && matchScore > 70) {
      return "critical";
    }
    if (trend.velocity > 100 || trend.emerging) {
      return "high";
    }
    if (matchScore > 50 || trend.sentiment > 0.6) {
      return "medium";
    }
    return "low";
  }
}

// Default export
export default TrendDetectorService;
