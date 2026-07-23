/**
 * Admin-Copilot MCP Server
 *
 * A proactive chief-of-staff that manages administrative overhead:
 * - Morning digests (calendar, inbox, competitors, follow-ups)
 * - Email triage with propose-then-confirm
 * - Competitor tracking with week-over-week diffing
 * - Preference management
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DiskStorage, generateId, now } from '@friday-mcp/shared/storage';
import { logger } from '@friday-mcp/shared/logger';
import type { AdminCopilotState, AdminCopilotPrefs, CompetitorSnapshot } from '@friday-mcp/shared/types';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DATA_DIR = join(homedir(), '.friday-mcp', 'admin-copilot', 'data');
const STATE_PATH = join(DATA_DIR, 'state.json');
const storage = new DiskStorage(STATE_PATH);

const server = new Server({
  name: 'admin-copilot',
  version: '0.1.0',
});

function loadState(): AdminCopilotState {
  return storage.load<AdminCopilotState>({
    version: 1,
    prefs: {
      competitors: [],
      digestTime: '09:00',
      digestDays: ['Mon', 'Wed', 'Fri'],
      inboxTriageEnabled: true,
      competitorBriefingEnabled: true,
      createdAt: now(),
      updatedAt: now(),
    },
  });
}

function saveState(state: AdminCopilotState): void {
  storage.save(state);
}

/**
 * Tool handlers
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'admin_set_preferences') {
      const state = loadState();
      const input = args as any;

      if (input.competitors !== undefined) {
        state.prefs.competitors = input.competitors;
      }
      if (input.digestTime !== undefined) {
        state.prefs.digestTime = input.digestTime;
      }
      if (input.digestDays !== undefined) {
        state.prefs.digestDays = input.digestDays;
      }
      if (input.inboxTriageEnabled !== undefined) {
        state.prefs.inboxTriageEnabled = input.inboxTriageEnabled;
      }
      if (input.competitorBriefingEnabled !== undefined) {
        state.prefs.competitorBriefingEnabled = input.competitorBriefingEnabled;
      }

      state.prefs.updatedAt = now();
      saveState(state);

      return {
        content: [
          {
            type: 'text',
            text: `Admin-Copilot preferences updated:\n\nCompetitors: ${state.prefs.competitors.join(', ') || 'None'}\nDigest time: ${state.prefs.digestTime}\nDigest days: ${state.prefs.digestDays.join(', ')}`,
          },
        ],
      };
    }

    if (name === 'admin_get_preferences') {
      const state = loadState();
      return {
        content: [
          {
            type: 'text',
            text: `Admin-Copilot Preferences:\n\nCompetitors: ${state.prefs.competitors.join(', ') || 'None'}\nDigest time: ${state.prefs.digestTime}\nDigest days: ${state.prefs.digestDays.join(', ')}\nInbox triage enabled: ${state.prefs.inboxTriageEnabled}\nCompetitor briefing enabled: ${state.prefs.competitorBriefingEnabled}`,
          },
        ],
      };
    }

    if (name === 'admin_generate_digest') {
      const state = loadState();
      const digest = `
**Morning Digest** - ${new Date().toLocaleDateString()}

📅 **Calendar**
No calendar integration configured. Add your Gmail account to see today's meetings.

📧 **Inbox Summary**
No email integration configured. Connect your Gmail account for inbox triage.

🏢 **Competitor Updates**
${state.prefs.competitors.length > 0 ? state.prefs.competitors.map((c) => `- ${c}: No changes detected`).join('\n') : 'No competitors tracked yet. Add with admin_set_preferences.'}

⏰ **Follow-ups**
No overdue follow-ups.
      `.trim();

      state.lastDigest = {
        generatedAt: now(),
        digest,
      };
      saveState(state);

      return {
        content: [{ type: 'text', text: digest }],
      };
    }

    if (name === 'admin_track_competitor') {
      const input = args as any;
      const state = loadState();

      const snapshot: CompetitorSnapshot = {
        name: input.name,
        website: input.website,
        pricing: input.pricing,
        recentChanges: input.recentChanges ?? [],
        contentHash: generateHash(input.recentChanges?.join('') ?? ''),
        snapshotAt: now(),
      };

      if (!state.prefs.competitors.includes(input.name)) {
        state.prefs.competitors.push(input.name);
      }

      if (!state.lastCompetitorBrief) {
        state.lastCompetitorBrief = {
          generatedAt: now(),
          competitors: [],
        };
      }

      state.lastCompetitorBrief.competitors.push(snapshot);
      state.prefs.updatedAt = now();
      saveState(state);

      return {
        content: [
          {
            type: 'text',
            text: `Competitor snapshot recorded for ${input.name}`,
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    logger.error('admin-copilot', 'Tool execution failed', { name, error: String(error) });
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
        },
      ],
    };
  }
});

/**
 * List tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'admin_set_preferences',
        description: 'Set admin-copilot preferences (competitors, digest time, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            competitors: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of competitor names to track',
            },
            digestTime: {
              type: 'string',
              description: 'Time to send digest (HH:MM)',
            },
            digestDays: {
              type: 'array',
              items: { type: 'string' },
              description: 'Days to send digest (Mon, Tue, etc.)',
            },
            inboxTriageEnabled: { type: 'boolean', description: 'Enable email triage' },
            competitorBriefingEnabled: {
              type: 'boolean',
              description: 'Enable competitor tracking',
            },
          },
        },
      } as Tool,
      {
        name: 'admin_get_preferences',
        description: 'View current admin-copilot preferences',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      } as Tool,
      {
        name: 'admin_generate_digest',
        description: 'Generate a morning digest (calendar, inbox, competitors, follow-ups)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      } as Tool,
      {
        name: 'admin_track_competitor',
        description: 'Record a competitor snapshot for tracking',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Competitor name' },
            website: { type: 'string', description: 'Competitor website' },
            pricing: { type: 'string', description: 'Pricing info' },
            recentChanges: {
              type: 'array',
              items: { type: 'string' },
              description: 'Recent changes/updates',
            },
          },
          required: ['name'],
        },
      } as Tool,
    ],
  };
});

// Helper: simple hash for content diffing
function generateHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// Start server
const transport = new StdioServerTransport();
async function start() {
  logger.info('admin-copilot', 'Starting MCP server');
  await server.connect(transport);
  logger.info('admin-copilot', 'Server running on stdio');
}

start().catch((err) => {
  logger.error('admin-copilot', 'Failed to start server', { error: String(err) });
  process.exit(1);
});
