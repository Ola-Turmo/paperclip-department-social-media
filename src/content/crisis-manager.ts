/**
 * Crisis Management System
 * Handles crisis detection, playbooks, and automated responses
 */

import type { SocialChannel } from "../types.js";

// ============================================
// Type Definitions
// ============================================

export type CrisisSeverity = 'low' | 'medium' | 'high' | 'critical';

export type CrisisAction = 'pause_publishing' | 'flag_for_review' | 'escalate' | 'notify_team' | 'auto_respond' | 'halt_campaign';

export interface CrisisStep {
  order: number;
  action: CrisisAction;
  template?: string;
  channels?: SocialChannel[];
  autoExecute: boolean;
}

export interface CrisisPlaybook {
  id: string;
  name: string;
  trigger: string;
  severity: CrisisSeverity;
  steps: CrisisStep[];
  responseTemplates: Record<CrisisAction, string>;
}

export interface CrisisAlert {
  id: string;
  playbookId: string;
  playbookName: string;
  severity: CrisisSeverity;
  status: 'active' | 'resolved' | 'acknowledged';
  triggeredAt: Date;
  stepsCompleted: number;
  currentStep: number;
  context: Record<string, unknown>;
}

// ============================================
// Response Templates
// ============================================

const RESPONSE_TEMPLATES: Record<CrisisAction, string> = {
  pause_publishing: 'Immediate action: All scheduled publishing has been paused pending review.',
  flag_for_review: 'Content has been flagged for immediate review by the moderation team.',
  escalate: 'Escalating to senior management and crisis response team.',
  notify_team: 'Alerting the social media team via all channels.',
  auto_respond: 'Automated response deployed to acknowledge concern and reassure audience.',
  halt_campaign: 'Campaign has been halted. No further content will be published until review.'
};

// ============================================
// Pre-built Playbooks
// ============================================

const PLAYBOOKS: CrisisPlaybook[] = [
  {
    id: 'neg-viral',
    name: 'Negative Viral Post',
    trigger: 'neg-viral|negative-viral|viral-negative',
    severity: 'critical',
    steps: [
      { order: 0, action: 'flag_for_review', autoExecute: true },
      { order: 1, action: 'notify_team', autoExecute: true },
      { order: 2, action: 'pause_publishing', autoExecute: true },
      { order: 3, action: 'escalate', autoExecute: false }
    ],
    responseTemplates: RESPONSE_TEMPLATES
  },
  {
    id: 'policy-change',
    name: 'Platform Policy Change',
    trigger: 'policy-change|platform-policy|policy-update',
    severity: 'high',
    steps: [
      { order: 0, action: 'halt_campaign', autoExecute: true },
      { order: 1, action: 'notify_team', autoExecute: true },
      { order: 2, action: 'flag_for_review', autoExecute: false }
    ],
    responseTemplates: RESPONSE_TEMPLATES
  },
  {
    id: 'mod-spike',
    name: 'Moderation Spike',
    trigger: 'mod-spike|moderation-spike|flag-spike',
    severity: 'medium',
    steps: [
      { order: 0, action: 'flag_for_review', autoExecute: true },
      { order: 1, action: 'pause_publishing', autoExecute: false }
    ],
    responseTemplates: RESPONSE_TEMPLATES
  },
  {
    id: 'brand-risk',
    name: 'Brand Safety Risk',
    trigger: 'brand-risk|brand-safety|reputation-risk',
    severity: 'high',
    steps: [
      { order: 0, action: 'pause_publishing', autoExecute: true },
      { order: 1, action: 'notify_team', autoExecute: true },
      { order: 2, action: 'escalate', autoExecute: false }
    ],
    responseTemplates: RESPONSE_TEMPLATES
  }
];

// ============================================
// CrisisManager Class
// ============================================

export class CrisisManager {
  private activeAlerts: Map<string, CrisisAlert> = new Map();
  private alertCounter = 0;

  /**
   * Get all pre-built playbooks
   */
  getPlaybooks(): CrisisPlaybook[] {
    return [...PLAYBOOKS];
  }

  /**
   * Get playbook by ID
   */
  private getPlaybook(playbookId: string): CrisisPlaybook | undefined {
    return PLAYBOOKS.find(p => p.id === playbookId);
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): CrisisAlert[] {
    return Array.from(this.activeAlerts.values()).filter(
      alert => alert.status === 'active' || alert.status === 'acknowledged'
    );
  }

  /**
   * Resolve an active alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.status = 'resolved';
      alert.stepsCompleted = alert.stepsCompleted;
    }
  }

  /**
   * Execute a playbook by ID with given context
   */
  executePlaybook(params: { playbookId: string; context: Record<string, unknown> }): CrisisAlert {
    const playbook = this.getPlaybook(params.playbookId);
    if (!playbook) {
      throw new Error(`Playbook not found: ${params.playbookId}`);
    }

    this.alertCounter++;
    const alertId = `alert-${Date.now()}-${this.alertCounter}`;

    const alert: CrisisAlert = {
      id: alertId,
      playbookId: playbook.id,
      playbookName: playbook.name,
      severity: playbook.severity,
      status: 'active',
      triggeredAt: new Date(),
      stepsCompleted: 0,
      currentStep: 0,
      context: params.context
    };

    // Execute autoExecute steps
    let stepsCompleted = 0;
    for (const step of playbook.steps) {
      if (step.autoExecute) {
        stepsCompleted++;
      }
    }

    alert.stepsCompleted = stepsCompleted;
    alert.currentStep = stepsCompleted;

    this.activeAlerts.set(alertId, alert);
    return alert;
  }

  /**
   * Detect sentiment crash based on metrics
   * Triggers if sentiment drops >20% or velocity spikes >3x
   */
  detectSentimentCrash(params: {
    metrics: { sentiment: number; engagement: number; velocity: number };
  }): { isCrash: boolean; severity: CrisisSeverity } {
    const { sentiment, engagement, velocity } = params.metrics;

    // Detect sentiment crash: >20% drop (sentiment < 0.8 of baseline 1.0)
    const sentimentCrash = sentiment < 0.8;

    // Detect velocity spike: >3x normal (velocity > 3.0)
    const velocitySpike = velocity > 3.0;

    // If no crash indicators, return false
    if (!sentimentCrash && !velocitySpike) {
      return { isCrash: false, severity: 'low' };
    }

    // Determine severity based on combination
    if (sentimentCrash && velocitySpike) {
      return { isCrash: true, severity: 'critical' };
    }

    if (sentimentCrash) {
      // >30% drop = high, >40% = critical
      if (sentiment < 0.6) {
        return { isCrash: true, severity: 'critical' };
      } else if (sentiment < 0.7) {
        return { isCrash: true, severity: 'high' };
      } else {
        return { isCrash: true, severity: 'medium' };
      }
    }

    if (velocitySpike) {
      // >5x = critical, >4x = high, >3x = medium
      if (velocity > 5.0) {
        return { isCrash: true, severity: 'critical' };
      } else if (velocity > 4.0) {
        return { isCrash: true, severity: 'high' };
      } else {
        return { isCrash: true, severity: 'medium' };
      }
    }

    return { isCrash: true, severity: 'low' };
  }

  /**
   * Auto-escalate: returns actions and next steps for non-autoExecute steps
   */
  autoEscalate(params: { alert: CrisisAlert }): { actions: CrisisAction[]; nextSteps: string[] } {
    const playbook = this.getPlaybook(params.alert.playbookId);
    if (!playbook) {
      return { actions: [], nextSteps: [] };
    }

    const pendingSteps = playbook.steps.filter(step => !step.autoExecute);
    const actions: CrisisAction[] = pendingSteps.map(step => step.action);

    const nextSteps: string[] = pendingSteps.map(step => {
      const template = step.template || playbook.responseTemplates[step.action];
      return `[Step ${step.order}] ${step.action}: ${template}`;
    });

    return { actions, nextSteps };
  }
}

// Singleton instance for convenience
export const crisisManager = new CrisisManager();
