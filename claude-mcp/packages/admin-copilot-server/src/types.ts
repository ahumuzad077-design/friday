/**
 * TypeScript interfaces for admin-copilot server.
 */

import type { AdminCopilotState, AdminCopilotPrefs } from '@friday-mcp/shared/types';

export interface DigestConfig {
  includeCalendar: boolean;
  includeInbox: boolean;
  includeCompetitors: boolean;
  includeFollowups: boolean;
}
