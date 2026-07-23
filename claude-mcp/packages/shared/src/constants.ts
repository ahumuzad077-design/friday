/**
 * Shared constants.
 */

export const COMPANY_STAGES = [
  'idea',
  'seed',
  'series-a',
  'series-b',
  'series-c',
  'growth',
  'public',
] as const;

export const DECISION_STATUSES = ['proposed', 'decided', 'implemented', 'reversed', 'abandoned'] as const;

export const OKR_STATUSES = ['on-track', 'at-risk', 'off-track'] as const;

export const FRIDAY_MODULES = ['audio', 'mail', 'dev-sandbox', 'chrono', 'web'] as const;
