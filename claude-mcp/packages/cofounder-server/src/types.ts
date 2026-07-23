/**
 * TypeScript interfaces for cofounder server.
 */

import type { CompanyProfile, Decision, OKR } from '@friday-mcp/shared/types';

export interface CofounderContext {
  profile: CompanyProfile;
  recentDecisions: Decision[];
  latestOKR: OKR | null;
}
