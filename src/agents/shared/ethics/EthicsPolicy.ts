/**
 * EthicsPolicy.ts - Rule Registry for ethical governance
 * 
 * This module provides:
 * - Rule-based ethics and bias detection framework
 * - Configurable rule registry for ethical policy enforcement
 * - Severity levels and testing functions
 */

export interface EthicsRule {
  id: string;
  description: string;
  test: (content: string, context?: any) => boolean;
  severity: 'low' | 'medium' | 'high';
}

export const EthicsPolicy: EthicsRule[] = [
  {
    id: 'bias-gender',
    description: 'Avoid gender-based stereotypes or assumptions.',
    severity: 'medium',
    test: (c) => /\b(housewife|strong man|bossy woman)\b/i.test(c),
  },
  {
    id: 'unbalanced-advice',
    description: 'All advice must include both risks and benefits',
    severity: 'high',
    test: (content) => {
      const hasPros = /benefit|pro|advantage/i.test(content);
      const hasCons = /risk|con|danger/i.test(content);
      return !(hasPros && hasCons);
    },
  },
  {
    id: 'opinion-as-fact',
    description: 'Avoid presenting opinions as absolute facts',
    severity: 'medium',
    test: (content) => /clearly|obviously|everyone knows/i.test(content),
  },
  {
    id: 'overclaiming',
    description: 'Avoid presenting opinions as facts (e.g., clearly, obviously, without evidence).',
    severity: 'medium',
    test: (c) => /\b(obviously|everyone knows|undeniable truth|proven fact)\b/i.test(c),
  },
  {
    id: 'emotional-exaggeration',
    description: 'Avoid excessive emotional language or urgency for persuasion.',
    severity: 'low',
    test: (c) => /\b(act now|life-changing|shocking|unbelievable|you'll never guess)\b/i.test(c),
  },
  {
    id: 'gdpr-violation',
    description: 'Avoid referencing or storing personal data without consent.',
    severity: 'high',
    test: (c) => /\b(name:|email:|phone:|ssn:|passport|IP address)\b/i.test(c), // expand as needed
  },
  {
    id: 'clickbait-headline',
    description: 'Avoid deceptive or misleading titles designed to bait users.',
    severity: 'high',
    test: (c) => /\b(the truth about|you won't believe|what happened next|number \d+ will surprise you)\b/i.test(c),
  },
  {
    id: 'manipulative-persuasion',
    description: 'Avoid psychological manipulation tactics (e.g., guilt, false urgency, fear).',
    severity: 'medium',
    test: (c) =>
      /\b(don't miss out|your only chance|before it's too late|you'll regret it)\b/i.test(c),
  },
  {
    id: 'privacy-respect',
    description: 'Respect user anonymity; avoid generating outputs that assume or reference user identity.',
    severity: 'high',
    test: (c) => /\b(as a user|we know you|your history shows)\b/i.test(c),
  },
];

/**
 * Add a custom ethics rule to the policy
 */
export function addEthicsRule(rule: EthicsRule): void {
  EthicsPolicy.push(rule);
}

/**
 * Remove an ethics rule by ID
 */
export function removeEthicsRule(ruleId: string): boolean {
  const initialLength = EthicsPolicy.length;
  const index = EthicsPolicy.findIndex(rule => rule.id === ruleId);
  
  if (index !== -1) {
    EthicsPolicy.splice(index, 1);
    return true;
  }
  
  return false;
}

/**
 * Update an existing ethics rule
 */
export function updateEthicsRule(ruleId: string, updatedRule: Partial<EthicsRule>): boolean {
  const rule = EthicsPolicy.find(rule => rule.id === ruleId);
  
  if (rule) {
    Object.assign(rule, updatedRule);
    return true;
  }
  
  return false;
} 