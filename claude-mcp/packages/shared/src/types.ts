/**
 * Shared types across all F.R.I.D.A.Y. Claude MCP servers.
 */

export interface CompanyProfile {
  name: string;
  stage: 'idea' | 'seed' | 'series-a' | 'series-b' | 'series-c' | 'growth' | 'public';
  sector: string;
  description: string;
  team: number;
  funding?: string;
  topChallenges: string[];
  currentFocus: string;
  createdAt: string;
  updatedAt: string;
}

export interface Decision {
  id: string;
  title: string;
  rationale: string;
  alternativesConsidered: string[];
  status: 'proposed' | 'decided' | 'implemented' | 'reversed' | 'abandoned';
  tags: string[];
  createdAt: string;
  decidedAt?: string;
  implementedAt?: string;
  outcome?: string;
}

export interface KeyResult {
  id: string;
  objective: string;
  description: string;
  target: number;
  currentValue: number;
  progress: number; // 0-100
  status: 'on-track' | 'at-risk' | 'off-track';
  unit: string;
}

export interface OKR {
  quarter: string; // e.g., "Q1 2024"
  keyResults: KeyResult[];
  createdAt: string;
  updatedAt: string;
}

export interface CompanyState {
  profile?: CompanyProfile;
  decisions: Decision[];
  okrs: OKR[];
  version: number;
}

export interface AdminCopilotPrefs {
  competitors: string[];
  digestTime: string; // HH:MM
  digestDays: string[]; // ['Mon', 'Tue', ...]
  inboxTriageEnabled: boolean;
  competitorBriefingEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCopilotState {
  prefs: AdminCopilotPrefs;
  lastDigest?: {
    generatedAt: string;
    digest: string;
  };
  lastCompetitorBrief?: {
    generatedAt: string;
    competitors: CompetitorSnapshot[];
  };
  version: number;
}

export interface CompetitorSnapshot {
  name: string;
  website?: string;
  pricing?: string;
  recentChanges: string[];
  contentHash: string;
  snapshotAt: string;
}

export interface EmailTriageProposal {
  messageId: string;
  from: string;
  subject: string;
  proposal: 'archive' | 'reply' | 'flag' | 'snooze';
  reasoning: string;
}
