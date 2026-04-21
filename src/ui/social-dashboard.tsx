import * as React from "react";
import { usePluginAction, usePluginData, type PluginPageProps, type PluginWidgetProps } from "@paperclipai/plugin-sdk/ui";
import type { ConnectorHealthSummary } from "../types.js";
import type { DashboardData } from "./social-dashboard-service.js";

type DashboardOverviewResponse = {
  dashboard: DashboardData;
  connectorSummary: ConnectorHealthSummary;
};

const shellStyle: React.CSSProperties = {
  display: "grid",
  gap: "16px",
  color: "#111827",
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  padding: "16px",
  boxShadow: "0 8px 30px rgba(15, 23, 42, 0.04)",
};

const mutedStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
  lineHeight: 1.5,
};

const buttonStyle: React.CSSProperties = {
  borderRadius: "999px",
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  padding: "8px 14px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#111827",
  borderColor: "#111827",
  color: "#ffffff",
};

function StatusBadge({ status }: { status: string }) {
  const palette: Record<string, { bg: string; text: string }> = {
    ok: { bg: "#dcfce7", text: "#166534" },
    degraded: { bg: "#fef3c7", text: "#92400e" },
    error: { bg: "#fee2e2", text: "#991b1b" },
    active: { bg: "#fee2e2", text: "#991b1b" },
    resolved: { bg: "#dcfce7", text: "#166534" },
  };
  const colors = palette[status] ?? { bg: "#f3f4f6", text: "#374151" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px 10px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 700,
        textTransform: "capitalize",
        background: colors.bg,
        color: colors.text,
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ ...cardStyle, padding: "14px" }}>
      <div style={{ ...mutedStyle, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: "28px", fontWeight: 700, marginTop: "6px" }}>{value}</div>
      {sub ? <div style={{ ...mutedStyle, marginTop: "4px" }}>{sub}</div> : null}
    </div>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ ...cardStyle, textAlign: "center", display: "grid", gap: "6px", padding: "22px" }}>
      <strong>{title}</strong>
      <div style={mutedStyle}>{body}</div>
    </div>
  );
}

function ConnectorPanel({
  connectorSummary,
  onCheckHealth,
  isChecking,
}: {
  connectorSummary: ConnectorHealthSummary;
  onCheckHealth: () => Promise<void>;
  isChecking: boolean;
}) {
  return (
    <div style={{ ...cardStyle, display: "grid", gap: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <strong>Connector Health</strong>
          <div style={mutedStyle}>Only live runtime checks are shown. No synthetic connector status is generated here.</div>
        </div>
        <button type="button" style={buttonStyle} disabled={isChecking} onClick={() => void onCheckHealth()}>
          {isChecking ? "Checking…" : "Verify connectors"}
        </button>
      </div>
      <div style={{ display: "grid", gap: "8px" }}>
        {connectorSummary.connectors.map((connector) => (
          <div
            key={connector.toolkitId}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              padding: "10px 12px",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
            }}
          >
            <div style={{ display: "grid", gap: "2px" }}>
              <strong style={{ fontSize: "13px", textTransform: "capitalize" }}>{connector.toolkitId.replace(/-/g, " ")}</strong>
              <span style={mutedStyle}>{connector.toolkitId}</span>
            </div>
            <StatusBadge status={connector.status} />
          </div>
        ))}
      </div>
      {connectorSummary.limitations.length > 0 ? (
        <div style={{ ...cardStyle, padding: "12px", borderColor: "#f59e0b", background: "#fff7ed" }}>
          <strong style={{ color: "#9a3412" }}>Current limitations</strong>
          <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
            {connectorSummary.limitations.map((item) => (
              <li key={`${item.toolkitId}-${item.displayName}`} style={mutedStyle}>
                {item.limitationMessage}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function BriefsPanel({ dashboard }: { dashboard: DashboardData }) {
  if (dashboard.recentBriefs.length === 0) {
    return (
      <EmptyPanel
        title="No content briefs yet"
        body="This department will stay empty until real briefs are created through the worker actions. Nothing here is padded with fake campaigns."
      />
    );
  }

  return (
    <div style={{ ...cardStyle, display: "grid", gap: "12px" }}>
      <div>
        <strong>Recent Briefs</strong>
        <div style={mutedStyle}>Live content planning state from the worker.</div>
      </div>
      <div style={{ display: "grid", gap: "8px" }}>
        {dashboard.recentBriefs.map((brief) => (
          <div
            key={brief.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "12px",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "12px",
            }}
          >
            <div style={{ display: "grid", gap: "4px" }}>
              <strong style={{ fontSize: "13px" }}>{brief.title}</strong>
              <div style={mutedStyle}>{brief.channel} · {new Date(brief.createdAt).toLocaleString()}</div>
            </div>
            <StatusBadge status={brief.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendsPanel({ dashboard }: { dashboard: DashboardData }) {
  if (dashboard.trends.length === 0) {
    return <EmptyPanel title="No live trends detected" body="Trend data stays empty until a real detection pass produces signals." />;
  }

  return (
    <div style={{ ...cardStyle, display: "grid", gap: "12px" }}>
      <div>
        <strong>Trends</strong>
        <div style={mutedStyle}>Current detections from the trend service.</div>
      </div>
      <div style={{ display: "grid", gap: "8px" }}>
        {dashboard.trends.map((trend) => (
          <div key={trend.id} style={{ display: "grid", gap: "4px", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
              <strong style={{ fontSize: "13px" }}>{trend.tag}</strong>
              {trend.isBreaking ? <StatusBadge status="active" /> : null}
            </div>
            <div style={mutedStyle}>Velocity {trend.velocity} · Sentiment {trend.sentiment}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EscalationsPanel({ dashboard }: { dashboard: DashboardData }) {
  if (dashboard.escalations.length === 0) {
    return <EmptyPanel title="No active escalations" body="Escalations will appear only after a real risk or moderation event is recorded." />;
  }

  return (
    <div style={{ ...cardStyle, display: "grid", gap: "12px" }}>
      <div>
        <strong>Escalations</strong>
        <div style={mutedStyle}>Current escalation state from the performance workflow.</div>
      </div>
      <div style={{ display: "grid", gap: "8px" }}>
        {dashboard.escalations.map((escalation) => (
          <div key={escalation.id} style={{ border: "1px solid #e5e7eb", borderRadius: "12px", padding: "12px", display: "grid", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
              <strong style={{ fontSize: "13px" }}>{escalation.playbookName}</strong>
              <StatusBadge status={escalation.status} />
            </div>
            <div style={mutedStyle}>{escalation.severity} · {new Date(escalation.triggeredAt).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PredictionsPanel({ dashboard }: { dashboard: DashboardData }) {
  if (dashboard.predictions.length === 0) {
    return <EmptyPanel title="No predictions yet" body="Predictions only appear when there are real pending briefs to score." />;
  }

  return (
    <div style={{ ...cardStyle, display: "grid", gap: "12px" }}>
      <div>
        <strong>Predictions</strong>
        <div style={mutedStyle}>Performance estimates for actual pending briefs.</div>
      </div>
      <div style={{ display: "grid", gap: "8px" }}>
        {dashboard.predictions.map((prediction) => (
          <div key={prediction.briefId} style={{ border: "1px solid #e5e7eb", borderRadius: "12px", padding: "12px", display: "grid", gap: "4px" }}>
            <strong style={{ fontSize: "13px" }}>{prediction.briefTitle}</strong>
            <div style={mutedStyle}>{prediction.channel} · Score {prediction.predictedScore} · Confidence {prediction.confidence}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SocialDashboardInner({ compact }: { compact: boolean }) {
  const overview = usePluginData<DashboardOverviewResponse>("dashboard.overview");
  const checkHealth = usePluginAction("connector.checkHealth");
  const [isChecking, setIsChecking] = React.useState(false);

  async function handleCheckHealth() {
    setIsChecking(true);
    try {
      await checkHealth({});
      await overview.refresh();
    } finally {
      setIsChecking(false);
    }
  }

  if (overview.loading) return <div style={cardStyle}>Loading social media department…</div>;
  if (overview.error) return <div style={{ ...cardStyle, borderColor: "#dc2626", color: "#991b1b" }}>{overview.error.message}</div>;
  if (!overview.data) return <EmptyPanel title="No department data" body="The worker returned no social media state." />;

  const { dashboard, connectorSummary } = overview.data;

  if (compact) {
    return (
      <div style={{ ...cardStyle, display: "grid", gap: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
          <div>
            <strong>Social Media Command Center</strong>
            <div style={mutedStyle}>Live state only. Zero-state when the department has no real content or signals.</div>
          </div>
          <StatusBadge status={connectorSummary.overallStatus} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
          <MetricCard label="Briefs" value={dashboard.metrics.totalBriefs} />
          <MetricCard label="Pending Review" value={dashboard.metrics.pendingReview} />
          <MetricCard label="Published" value={dashboard.metrics.publishedCount} />
          <MetricCard label="Escalations" value={dashboard.escalations.length} />
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <div style={{ ...cardStyle, display: "grid", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <strong>Social Media Command Center</strong>
            <div style={mutedStyle}>A clean, live-only operating view for social planning, patterns, and escalations.</div>
          </div>
          <StatusBadge status={connectorSummary.overallStatus} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
          <MetricCard label="Total Briefs" value={dashboard.metrics.totalBriefs} />
          <MetricCard label="Active Briefs" value={dashboard.metrics.activeBriefs} />
          <MetricCard label="Published" value={dashboard.metrics.publishedCount} />
          <MetricCard label="Pending Review" value={dashboard.metrics.pendingReview} />
          <MetricCard label="Avg Engagement" value={dashboard.metrics.avgEngagement || "0"} sub={dashboard.metrics.topPerformingChannel !== "N/A" ? `Top channel ${dashboard.metrics.topPerformingChannel}` : "No performance samples yet"} />
          <MetricCard label="Sentiment" value={dashboard.metrics.sentiment} sub={`Updated ${new Date(dashboard.health.lastUpdated).toLocaleString()}`} />
        </div>
      </div>

      <ConnectorPanel connectorSummary={connectorSummary} onCheckHealth={handleCheckHealth} isChecking={isChecking} />
      <BriefsPanel dashboard={dashboard} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
        <TrendsPanel dashboard={dashboard} />
        <PredictionsPanel dashboard={dashboard} />
      </div>
      <EscalationsPanel dashboard={dashboard} />
    </div>
  );
}

export function DashboardWidget(_props: PluginWidgetProps) {
  return <SocialDashboardInner compact={true} />;
}

export function SocialMediaCommandCenterPage(_props: PluginPageProps) {
  return <SocialDashboardInner compact={false} />;
}
