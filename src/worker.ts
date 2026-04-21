import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import { ContentPlanningService } from "./content-planning-service.js";
import { PerformanceAnalysisService } from "./performance-analysis-service.js";
import SocialDashboardService from "./ui/social-dashboard-service.js";
import {
  createInitialConnectorHealthState,
  updateConnectorHealthState,
  computeDepartmentHealthStatus,
  generateToolkitLimitations,
  formatAllLimitations,
  performRuntimeHealthCheck,
  type ConnectorHealthState,
} from "./connector-health.js";
import type {
  CreateBriefParams,
  SubmitForReviewParams,
  ReviewBriefParams,
  ApproveBriefParams,
  AnalyzePerformanceParams,
  ExtractPatternParams,
  CreateEscalationParams,
  SocialChannel,
  ConnectorHealthSummary,
  SetConnectorHealthParams,
  GetConnectorHealthParams,
} from "./types.js";

// Initialize services
const contentPlanningService = new ContentPlanningService();
const performanceAnalysisService = new PerformanceAnalysisService();
const socialDashboardService = new SocialDashboardService(
  contentPlanningService,
  performanceAnalysisService,
);

// Connector health state (XAF-007)
let connectorHealthState: ConnectorHealthState[] = createInitialConnectorHealthState();

const plugin = definePlugin({
  async setup(ctx) {
    ctx.events.on("issue.created", async (event) => {
      const issueId = event.entityId ?? "unknown";
      await ctx.state.set({ scopeKind: "issue", scopeId: issueId, stateKey: "seen" }, true);
      ctx.logger.info("Observed issue.created", { issueId });
    });

    // Health check (now includes connector health status - XAF-007)
    ctx.data.register("health", async () => {
      const limitations = generateToolkitLimitations(connectorHealthState);
      const overallStatus = computeDepartmentHealthStatus(connectorHealthState);
      return {
        status: overallStatus,
        checkedAt: new Date().toISOString(),
        hasLimitations: limitations.length > 0,
        limitations: limitations,
      };
    });

    // Connector health data (XAF-007)
    ctx.data.register("connectorHealth", async (params) => {
      const p = params as unknown as GetConnectorHealthParams;
      if (p?.toolkitId) {
        const state = connectorHealthState.find((s) => s.toolkitId === p.toolkitId);
        if (!state) {
          return { error: `Connector '${p.toolkitId}' not found` };
        }
        const limitations = state.status !== "ok"
          ? generateToolkitLimitations([state])
          : [];
        return { connector: state, limitations };
      }
      const limitations = generateToolkitLimitations(connectorHealthState);
      const overallStatus = computeDepartmentHealthStatus(connectorHealthState);
      const summary: ConnectorHealthSummary = {
        overallStatus,
        checkedAt: new Date().toISOString(),
        connectors: connectorHealthState,
        limitations,
        hasLimitations: limitations.length > 0,
      };
      return summary;
    });

    ctx.data.register("dashboard.overview", async () => {
      const dashboard = await socialDashboardService.getDashboardOverview();
      const limitations = generateToolkitLimitations(connectorHealthState);
      const connectorSummary: ConnectorHealthSummary = {
        overallStatus: computeDepartmentHealthStatus(connectorHealthState),
        checkedAt: new Date().toISOString(),
        connectors: connectorHealthState,
        limitations,
        hasLimitations: limitations.length > 0,
      };

      return {
        dashboard,
        connectorSummary,
      };
    });

    // ============================================
    // Connector Health Actions (XAF-007)
    // ============================================

    /**
     * Set connector health status (for simulation/testing)
     * XAF-007: Simulate connector degradation to verify limitation messaging
     */
    ctx.actions.register("connector.setHealth", async (params) => {
      const p = params as unknown as SetConnectorHealthParams;
      ctx.logger.info("Setting connector health", { toolkitId: p.toolkitId, status: p.status });
      connectorHealthState = updateConnectorHealthState(
        connectorHealthState,
        p.toolkitId,
        p.status,
        p.error
      );
      const limitations = generateToolkitLimitations(connectorHealthState);
      const overallStatus = computeDepartmentHealthStatus(connectorHealthState);
      return {
        success: true,
        toolkitId: p.toolkitId,
        status: p.status,
        overallStatus,
        limitations,
        formattedLimitations: limitations.length > 0 ? formatAllLimitations(limitations) : undefined,
      };
    });

    /**
     * Get connector health summary
     * XAF-007
     */
    ctx.actions.register("connector.getHealth", async () => {
      const limitations = generateToolkitLimitations(connectorHealthState);
      const overallStatus = computeDepartmentHealthStatus(connectorHealthState);
      return {
        overallStatus,
        checkedAt: new Date().toISOString(),
        connectors: connectorHealthState,
        limitations,
        hasLimitations: limitations.length > 0,
      };
    });

    /**
     * Simulate connector degradation for testing
     * XAF-007
     */
    ctx.actions.register("connector.simulateDegradation", async (params) => {
      const p = params as unknown as { toolkitId: string; severity?: "degraded" | "error" };
      const status = p.severity ?? "degraded";
      ctx.logger.info("Simulating connector degradation", { toolkitId: p.toolkitId, status });
      connectorHealthState = updateConnectorHealthState(
        connectorHealthState,
        p.toolkitId,
        status,
        status === "error"
          ? "Simulated: Connector authentication failed"
          : "Simulated: Connector responding slowly"
      );
      const limitations = generateToolkitLimitations(connectorHealthState);
      const overallStatus = computeDepartmentHealthStatus(connectorHealthState);
      return {
        success: true,
        toolkitId: p.toolkitId,
        status,
        overallStatus,
        limitations,
        formattedLimitations: limitations.length > 0 ? formatAllLimitations(limitations) : undefined,
      };
    });

    /**
     * Restore connector to healthy state
     * XAF-007
     */
    ctx.actions.register("connector.restore", async (params) => {
      const p = params as unknown as { toolkitId: string };
      ctx.logger.info("Restoring connector health", { toolkitId: p.toolkitId });
      connectorHealthState = updateConnectorHealthState(
        connectorHealthState,
        p.toolkitId,
        "ok"
      );
      const limitations = generateToolkitLimitations(connectorHealthState);
      const overallStatus = computeDepartmentHealthStatus(connectorHealthState);
      return {
        success: true,
        toolkitId: p.toolkitId,
        status: "ok",
        overallStatus,
        limitations,
        hasLimitations: limitations.length > 0,
      };
    });

    /**
     * Perform actual runtime health check for all connectors.
     * 
     * This implements XAF-007: Department workflows degrade explicitly when
     * dependent connectors or tools are impaired, rather than blindly reporting ok.
     */
    ctx.actions.register("connector.checkHealth", async () => {
      ctx.logger.info("Performing runtime connector health check", { 
        connectorCount: connectorHealthState.length 
      });
      
      const checkResult = await performRuntimeHealthCheck(connectorHealthState);
      connectorHealthState = checkResult.updatedStates;
      
      ctx.logger.info("Connector health check completed", {
        overallStatus: checkResult.overallStatus,
        checkedConnectors: checkResult.checkResults.filter(r => r.wasChecked).length,
        hasImpaired: checkResult.checkResults.some(r => r.status !== "ok"),
      });
      
      const limitations = generateToolkitLimitations(connectorHealthState);
      
      return {
        success: true,
        overallStatus: checkResult.overallStatus,
        checkedAt: new Date().toISOString(),
        connectors: connectorHealthState,
        checkResults: checkResult.checkResults,
        limitations,
        hasLimitations: limitations.length > 0,
        formattedLimitations: limitations.length > 0 ? formatAllLimitations(limitations) : undefined,
      };
    });

    // Content Planning Actions (VAL-DEPT-SOCIAL-001)
    ctx.actions.register("content.createBrief", async (params: Record<string, unknown>) => {
      const p = params as unknown as CreateBriefParams;
      ctx.logger.info("Creating content brief", { channel: p.channel });
      const brief = contentPlanningService.createBrief(p);
      return { brief, success: true };
    });

    ctx.actions.register("content.getBrief", async (params: Record<string, unknown>) => {
      const p = params as { briefId: string };
      const brief = contentPlanningService.getBrief(p.briefId);
      return { brief: brief ?? null, success: !!brief };
    });

    ctx.actions.register("content.submitForReview", async (params: Record<string, unknown>) => {
      const p = params as unknown as SubmitForReviewParams;
      ctx.logger.info("Submitting brief for review", { briefId: p.briefId });
      const brief = contentPlanningService.submitForReview(p);
      return { brief, success: !!brief };
    });

    ctx.actions.register("content.reviewBrief", async (params: Record<string, unknown>) => {
      const p = params as unknown as ReviewBriefParams;
      ctx.logger.info("Reviewing brief", { briefId: p.briefId, decision: p.decision });
      const brief = contentPlanningService.reviewBrief(p);
      return { brief, success: !!brief };
    });

    ctx.actions.register("content.approveBrief", async (params: Record<string, unknown>) => {
      const p = params as unknown as ApproveBriefParams;
      ctx.logger.info("Approving brief", { briefId: p.briefId, decision: p.decision });
      const brief = contentPlanningService.approveBrief(p);
      return { brief, success: !!brief };
    });

    ctx.actions.register("content.getBriefsByStatus", async (params: Record<string, unknown>) => {
      const p = params as { status: string };
      const briefs = contentPlanningService.getBriefsByStatus(p.status as any);
      return { briefs, count: briefs.length };
    });

    ctx.actions.register("content.getBriefsByChannel", async (params: Record<string, unknown>) => {
      const p = params as { channel: SocialChannel };
      const briefs = contentPlanningService.getBriefsByChannel(p.channel);
      return { briefs, count: briefs.length };
    });

    // Performance Analysis Actions (VAL-DEPT-SOCIAL-002)
    ctx.actions.register("performance.analyze", async (params: Record<string, unknown>) => {
      const p = params as unknown as AnalyzePerformanceParams;
      ctx.logger.info("Analyzing performance", { briefId: p.briefId });
      const performance = performanceAnalysisService.analyzePerformance(p);
      return { performance, success: true };
    });

    ctx.actions.register("performance.getPattern", async (params: Record<string, unknown>) => {
      const p = params as { patternId: string };
      const pattern = performanceAnalysisService.getPattern(p.patternId);
      return { pattern: pattern ?? null, success: !!pattern };
    });

    ctx.actions.register("performance.extractPattern", async (params: Record<string, unknown>) => {
      const p = params as unknown as ExtractPatternParams;
      ctx.logger.info("Extracting pattern", { patternKey: p.patternKey });
      const pattern = performanceAnalysisService.extractPattern(p);
      return { pattern, success: true };
    });

    ctx.actions.register("performance.discoverPatterns", async (params?: Record<string, unknown>) => {
      const p = params as { minEvidenceCount?: number } | undefined;
      ctx.logger.info("Discovering patterns automatically");
      const patterns = performanceAnalysisService.discoverPatterns(p?.minEvidenceCount);
      return { patterns, count: patterns.length };
    });

    ctx.actions.register("performance.getTopPerformers", async (params?: Record<string, unknown>) => {
      const p = params as { limit?: number } | undefined;
      const performers = performanceAnalysisService.getTopPerformers(p?.limit);
      return { performers, count: performers.length };
    });

    // Escalation Actions (VAL-DEPT-SOCIAL-002)
    ctx.actions.register("escalation.create", async (params: Record<string, unknown>) => {
      const p = params as unknown as CreateEscalationParams;
      ctx.logger.info("Creating escalation", { trigger: p.trigger, severity: p.severity });
      const escalation = performanceAnalysisService.createEscalation(p);
      return { escalation, success: true };
    });

    ctx.actions.register("escalation.getActive", async () => {
      const escalations = performanceAnalysisService.getActiveEscalations();
      return { escalations, count: escalations.length };
    });

    ctx.actions.register("escalation.updateStatus", async (params: Record<string, unknown>) => {
      const p = params as unknown as {
        escalationId: string;
        status: "triggered" | "investigating" | "mitigating" | "resolved" | "dismissed";
        responseActions?: string[];
        mitigationNotes?: string[];
      };
      ctx.logger.info("Updating escalation status", { escalationId: p.escalationId, status: p.status });
      const escalation = performanceAnalysisService.updateEscalationStatus(p);
      return { escalation, success: !!escalation };
    });

    // Summary actions
    ctx.actions.register("ping", async () => {
      ctx.logger.info("Ping action invoked");
      return { pong: true, at: new Date().toISOString() };
    });

    ctx.actions.register("contentPlanning.summary", async () => {
      return { summary: contentPlanningService.generateSummary() };
    });

    ctx.actions.register("performanceAnalysis.summary", async () => {
      return { summary: performanceAnalysisService.generateSummary() };
    });
  },

  async onHealth() {
    return { status: "ok", message: "Plugin worker is running" };
  }
});

export default plugin;
runWorker(plugin, import.meta.url);
