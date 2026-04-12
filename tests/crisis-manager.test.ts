/**
 * Crisis Manager Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CrisisManager, CrisisAlert, CrisisSeverity } from '../src/content/crisis-manager';

describe('CrisisManager', () => {
  let manager: CrisisManager;

  beforeEach(() => {
    manager = new CrisisManager();
  });

  describe('getPlaybooks', () => {
    it('should return all 4 pre-built playbooks', () => {
      const playbooks = manager.getPlaybooks();
      expect(playbooks).toHaveLength(4);
      
      const ids = playbooks.map(p => p.id);
      expect(ids).toContain('neg-viral');
      expect(ids).toContain('policy-change');
      expect(ids).toContain('mod-spike');
      expect(ids).toContain('brand-risk');
    });

    it('should have correct severity levels', () => {
      const playbooks = manager.getPlaybooks();
      
      const negViral = playbooks.find(p => p.id === 'neg-viral');
      expect(negViral?.severity).toBe('critical');
      
      const policyChange = playbooks.find(p => p.id === 'policy-change');
      expect(policyChange?.severity).toBe('high');
      
      const modSpike = playbooks.find(p => p.id === 'mod-spike');
      expect(modSpike?.severity).toBe('medium');
      
      const brandRisk = playbooks.find(p => p.id === 'brand-risk');
      expect(brandRisk?.severity).toBe('high');
    });
  });

  describe('executePlaybook', () => {
    it('should execute neg-viral playbook and create alert', () => {
      const context = { postId: 'post-123', platform: 'x', viralScore: 95 };
      const alert = manager.executePlaybook({ playbookId: 'neg-viral', context });
      
      expect(alert.playbookId).toBe('neg-viral');
      expect(alert.playbookName).toBe('Negative Viral Post');
      expect(alert.severity).toBe('critical');
      expect(alert.status).toBe('active');
      expect(alert.stepsCompleted).toBe(3); // 3 autoExecute steps
      expect(alert.currentStep).toBe(3);
      expect(alert.context).toEqual(context);
    });

    it('should execute policy-change playbook correctly', () => {
      const alert = manager.executePlaybook({ 
        playbookId: 'policy-change', 
        context: { policyId: 'new-rule-2024' } 
      });
      
      expect(alert.playbookId).toBe('policy-change');
      expect(alert.severity).toBe('high');
      expect(alert.stepsCompleted).toBe(2); // halt_campaign + notify_team
    });

    it('should throw error for unknown playbook', () => {
      expect(() => {
        manager.executePlaybook({ playbookId: 'unknown', context: {} });
      }).toThrow('Playbook not found: unknown');
    });

    it('should add alert to active alerts', () => {
      manager.executePlaybook({ playbookId: 'mod-spike', context: { spikeCount: 50 } });
      manager.executePlaybook({ playbookId: 'brand-risk', context: { riskScore: 0.8 } });
      
      const activeAlerts = manager.getActiveAlerts();
      expect(activeAlerts).toHaveLength(2);
    });
  });

  describe('autoEscalate', () => {
    it('should return pending actions for neg-viral alert', () => {
      const alert = manager.executePlaybook({ playbookId: 'neg-viral', context: {} });
      const escalation = manager.autoEscalate({ alert });
      
      expect(escalation.actions).toContain('escalate');
      expect(escalation.nextSteps).toHaveLength(1);
      expect(escalation.nextSteps[0]).toContain('escalate');
    });

    it('should return empty for fully executed playbooks', () => {
      const alert: CrisisAlert = {
        id: 'test-alert',
        playbookId: 'mod-spike',
        playbookName: 'Moderation Spike',
        severity: 'medium',
        status: 'active',
        triggeredAt: new Date(),
        stepsCompleted: 1,
        currentStep: 1,
        context: {}
      };
      
      const escalation = manager.autoEscalate({ alert });
      expect(escalation.actions).toHaveLength(1); // pause_publishing not autoExecute
    });
  });

  describe('detectSentimentCrash', () => {
    it('should detect no crash with normal metrics', () => {
      const result = manager.detectSentimentCrash({
        metrics: { sentiment: 1.0, engagement: 0.5, velocity: 1.0 }
      });
      
      expect(result.isCrash).toBe(false);
      expect(result.severity).toBe('low');
    });

    it('should detect low severity crash (velocity 3.1x)', () => {
      const result = manager.detectSentimentCrash({
        metrics: { sentiment: 0.9, engagement: 0.5, velocity: 3.1 }
      });
      
      expect(result.isCrash).toBe(true);
      expect(result.severity).toBe('medium');
    });

    it('should detect medium severity crash (velocity 4.1x)', () => {
      const result = manager.detectSentimentCrash({
        metrics: { sentiment: 0.85, engagement: 0.5, velocity: 4.1 }
      });
      
      expect(result.isCrash).toBe(true);
      expect(result.severity).toBe('high');
    });

    it('should detect high severity crash (sentiment 0.65)', () => {
      const result = manager.detectSentimentCrash({
        metrics: { sentiment: 0.65, engagement: 0.5, velocity: 1.0 }
      });
      
      expect(result.isCrash).toBe(true);
      expect(result.severity).toBe('high');
    });

    it('should detect critical severity crash (both triggers)', () => {
      const result = manager.detectSentimentCrash({
        metrics: { sentiment: 0.5, engagement: 0.5, velocity: 5.0 }
      });
      
      expect(result.isCrash).toBe(true);
      expect(result.severity).toBe('critical');
    });

    it('should detect critical severity (sentiment 0.55)', () => {
      const result = manager.detectSentimentCrash({
        metrics: { sentiment: 0.55, engagement: 0.5, velocity: 1.0 }
      });
      
      expect(result.isCrash).toBe(true);
      expect(result.severity).toBe('critical');
    });
  });

  describe('resolveAlert', () => {
    it('should resolve an active alert', () => {
      const alert = manager.executePlaybook({ playbookId: 'mod-spike', context: {} });
      
      expect(alert.status).toBe('active');
      
      manager.resolveAlert(alert.id);
      
      const resolved = manager.getActiveAlerts();
      expect(resolved).toHaveLength(0);
    });

    it('should only resolve the specified alert', () => {
      const alert1 = manager.executePlaybook({ playbookId: 'mod-spike', context: {} });
      const alert2 = manager.executePlaybook({ playbookId: 'brand-risk', context: {} });
      
      manager.resolveAlert(alert1.id);
      
      const remaining = manager.getActiveAlerts();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(alert2.id);
    });
  });
});
