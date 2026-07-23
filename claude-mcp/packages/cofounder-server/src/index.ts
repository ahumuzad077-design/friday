/**
 * Cofounder MCP Server
 *
 * A co-founder that remembers your company context, challenges your thinking,
 * and tracks your strategic decisions.
 *
 * This is a Model Context Protocol (MCP) server that Claude can call.
 * It provides tools for:
 * - Managing company profile
 * - Logging and searching decisions
 * - Tracking OKRs
 * - Injecting context into conversations
 * - Analyzing blind spots
 * - Generating briefings
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  TextContent,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DiskStorage, generateId, now } from '@friday-mcp/shared/storage';
import { logger } from '@friday-mcp/shared/logger';
import type {
  CompanyProfile,
  CompanyState,
  Decision,
  OKR,
  KeyResult,
} from '@friday-mcp/shared/types';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Initialize storage
const DATA_DIR = join(homedir(), '.friday-mcp', 'cofounder', 'data');
const STATE_PATH = join(DATA_DIR, 'company-state.json');
const storage = new DiskStorage(STATE_PATH);

// Initialize MCP server
const server = new Server({
  name: 'cofounder',
  version: '0.1.0',
});

// Load initial state
function loadState(): CompanyState {
  return storage.load<CompanyState>({
    version: 1,
    decisions: [],
    okrs: [],
  });
}

function saveState(state: CompanyState): void {
  storage.save(state);
}

/**
 * Tool: cofounder_profile
 * View or update company profile
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'cofounder_profile') {
      const action = (args as any).action as string;

      if (action === 'view') {
        const state = loadState();
        if (!state.profile) {
          return {
            content: [
              {
                type: 'text',
                text: 'No company profile yet. Use action: "create" to set one up.',
              },
            ],
          };
        }

        const profileText = formatProfile(state.profile);
        return {
          content: [{ type: 'text', text: profileText }],
        };
      }

      if (action === 'create' || action === 'update') {
        const state = loadState();
        const input = args as any;

        const profile: CompanyProfile = {
          name: input.name ?? state.profile?.name ?? 'Unnamed Company',
          stage: input.stage ?? state.profile?.stage ?? 'idea',
          sector: input.sector ?? state.profile?.sector ?? '',
          description: input.description ?? state.profile?.description ?? '',
          team: input.team ?? state.profile?.team ?? 0,
          funding: input.funding ?? state.profile?.funding,
          topChallenges: input.topChallenges ?? state.profile?.topChallenges ?? [],
          currentFocus: input.currentFocus ?? state.profile?.currentFocus ?? '',
          createdAt: state.profile?.createdAt ?? now(),
          updatedAt: now(),
        };

        state.profile = profile;
        saveState(state);

        return {
          content: [
            {
              type: 'text',
              text: `Company profile ${
                action === 'create' ? 'created' : 'updated'
              }:\n\n${formatProfile(profile)}`,
            },
          ],
        };
      }

      throw new Error(`Unknown action: ${action}`);
    }

    if (name === 'cofounder_decision') {
      const action = (args as any).action as string;
      const state = loadState();

      if (action === 'log') {
        const input = args as any;
        const decision: Decision = {
          id: generateId('decision'),
          title: input.title,
          rationale: input.rationale,
          alternativesConsidered: input.alternativesConsidered ?? [],
          status: 'decided',
          tags: input.tags ?? [],
          createdAt: now(),
          decidedAt: now(),
        };

        state.decisions.push(decision);
        saveState(state);

        return {
          content: [
            {
              type: 'text',
              text: `Decision logged:\n\n${formatDecision(decision)}`,
            },
          ],
        };
      }

      if (action === 'search') {
        const query = (args as any).query as string;
        const matches = state.decisions.filter(
          (d) =>
            d.title.toLowerCase().includes(query.toLowerCase()) ||
            d.rationale.toLowerCase().includes(query.toLowerCase()) ||
            d.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()))
        );

        if (matches.length === 0) {
          return {
            content: [{ type: 'text', text: `No decisions found matching "${query}"` }],
          };
        }

        const text = matches.map((d) => formatDecision(d)).join('\n\n---\n\n');
        return {
          content: [{ type: 'text', text: `Found ${matches.length} decision(s):\n\n${text}` }],
        };
      }

      if (action === 'list') {
        if (state.decisions.length === 0) {
          return {
            content: [{ type: 'text', text: 'No decisions logged yet.' }],
          };
        }

        const text = state.decisions.map((d) => formatDecision(d)).join('\n\n---\n\n');
        return {
          content: [{ type: 'text', text: `${state.decisions.length} decisions:\n\n${text}` }],
        };
      }

      throw new Error(`Unknown action: ${action}`);
    }

    if (name === 'cofounder_okr') {
      const action = (args as any).action as string;
      const state = loadState();

      if (action === 'set') {
        const input = args as any;
        const quarter = input.quarter as string;
        const keyResults = (input.keyResults as any[]).map((kr) => ({
          id: generateId('kr'),
          objective: kr.objective,
          description: kr.description ?? '',
          target: kr.target,
          currentValue: kr.currentValue ?? 0,
          progress: Math.round((kr.currentValue ?? 0) / kr.target * 100),
          status: 'on-track' as const,
          unit: kr.unit ?? '%',
        }));

        const existingIndex = state.okrs.findIndex((o) => o.quarter === quarter);
        const okr: OKR = {
          quarter,
          keyResults,
          createdAt: existingIndex !== -1 ? state.okrs[existingIndex].createdAt : now(),
          updatedAt: now(),
        };

        if (existingIndex !== -1) {
          state.okrs[existingIndex] = okr;
        } else {
          state.okrs.push(okr);
        }

        saveState(state);

        return {
          content: [
            {
              type: 'text',
              text: `OKRs set for ${quarter}:\n\n${formatOKR(okr)}`,
            },
          ],
        };
      }

      if (action === 'view') {
        const quarter = (args as any).quarter as string;
        const okr = state.okrs.find((o) => o.quarter === quarter);

        if (!okr) {
          return {
            content: [{ type: 'text', text: `No OKRs found for ${quarter}` }],
          };
        }

        return {
          content: [{ type: 'text', text: formatOKR(okr) }],
        };
      }

      if (action === 'update_kr') {
        const input = args as any;
        const quarter = input.quarter as string;
        const krId = input.krId as string;
        const currentValue = input.currentValue as number;

        const okr = state.okrs.find((o) => o.quarter === quarter);
        if (!okr) {
          throw new Error(`No OKRs found for ${quarter}`);
        }

        const kr = okr.keyResults.find((k) => k.id === krId);
        if (!kr) {
          throw new Error(`Key result ${krId} not found`);
        }

        kr.currentValue = currentValue;
        kr.progress = Math.round((currentValue / kr.target) * 100);
        if (!input.status) {
          kr.status = kr.progress >= 100 ? 'on-track' : kr.progress >= 70 ? 'on-track' : 'at-risk';
        } else {
          kr.status = input.status;
        }

        okr.updatedAt = now();
        saveState(state);

        return {
          content: [{ type: 'text', text: `Updated KR progress to ${kr.progress}%` }],
        };
      }

      throw new Error(`Unknown action: ${action}`);
    }

    if (name === 'cofounder_context_inject') {
      const state = loadState();
      if (!state.profile) {
        return {
          content: [
            {
              type: 'text',
              text: 'No company profile. Set one up first with cofounder_profile action: "create"',
            },
          ],
        };
      }

      const context = buildContextBlock(state);
      return {
        content: [{ type: 'text', text: context }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    logger.error('cofounder', 'Tool execution failed', { name, error: String(error) });
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
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'cofounder_profile',
        description: 'View or update company profile',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['view', 'create', 'update'],
              description: 'Action to perform',
            },
            name: { type: 'string', description: 'Company name' },
            stage: {
              type: 'string',
              enum: ['idea', 'seed', 'series-a', 'series-b', 'series-c', 'growth', 'public'],
              description: 'Company stage',
            },
            sector: { type: 'string', description: 'Industry/sector' },
            description: { type: 'string', description: 'Company description' },
            team: { type: 'number', description: 'Team size' },
            funding: { type: 'string', description: 'Funding raised' },
            topChallenges: {
              type: 'array',
              items: { type: 'string' },
              description: 'Top challenges',
            },
            currentFocus: { type: 'string', description: 'Current focus area' },
          },
          required: ['action'],
        },
      } as Tool,
      {
        name: 'cofounder_decision',
        description: 'Log, search, or list strategic decisions',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['log', 'search', 'list'],
              description: 'Action to perform',
            },
            title: { type: 'string', description: 'Decision title' },
            rationale: { type: 'string', description: 'Why this decision was made' },
            alternativesConsidered: {
              type: 'array',
              items: { type: 'string' },
              description: 'Alternatives that were considered',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags for the decision',
            },
            query: { type: 'string', description: 'Search query' },
          },
          required: ['action'],
        },
      } as Tool,
      {
        name: 'cofounder_okr',
        description: 'Set, view, or update OKRs',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['set', 'view', 'update_kr'],
              description: 'Action to perform',
            },
            quarter: { type: 'string', description: 'Quarter (e.g., "Q1 2024")' },
            keyResults: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  objective: { type: 'string' },
                  description: { type: 'string' },
                  target: { type: 'number' },
                  currentValue: { type: 'number' },
                  unit: { type: 'string' },
                },
              },
              description: 'Key results to set',
            },
            krId: { type: 'string', description: 'Key result ID to update' },
            currentValue: { type: 'number', description: 'Current progress value' },
            status: {
              type: 'string',
              enum: ['on-track', 'at-risk', 'off-track'],
              description: 'Manual status override',
            },
          },
          required: ['action'],
        },
      } as Tool,
      {
        name: 'cofounder_context_inject',
        description: 'Get the current company context block for injection',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      } as Tool,
    ],
  };
});

// Helper functions
function formatProfile(p: CompanyProfile): string {
  return `**${p.name}** (${p.stage})\n\nSector: ${p.sector}\nTeam: ${p.team}\nDescription: ${p.description}\nFunding: ${p.funding ?? 'N/A'}\nChallenges: ${p.topChallenges.join(', ') || 'None yet'}\nFocus: ${p.currentFocus}`;
}

function formatDecision(d: Decision): string {
  return `**${d.title}** [${d.status}]\n\nRationale: ${d.rationale}\nAlternatives: ${d.alternativesConsidered.join(', ') || 'None'}\nTags: ${d.tags.join(', ') || 'None'}\nLogged: ${d.createdAt}`;
}

function formatOKR(o: OKR): string {
  const krs = o.keyResults
    .map((kr) => `- ${kr.objective}: ${kr.currentValue}/${kr.target} ${kr.unit} (${kr.progress}%) [${kr.status}]`)
    .join('\n');
  return `**${o.quarter}** OKRs\n\n${krs}`;
}

function buildContextBlock(state: CompanyState): string {
  if (!state.profile) return 'No company context available.';

  let context = `## Company Context\n\n`;
  context += formatProfile(state.profile) + '\n\n';

  if (state.okrs.length > 0) {
    const latest = state.okrs[state.okrs.length - 1];
    context += `## Latest OKRs (${latest.quarter})\n\n${formatOKR(latest)}\n\n`;
  }

  if (state.decisions.length > 0) {
    const recent = state.decisions.slice(-3);
    context += `## Recent Decisions\n\n${recent.map((d) => formatDecision(d)).join('\n\n')}\n\n`;
  }

  return context;
}

// Start the server
const transport = new StdioServerTransport();
async function start() {
  logger.info('cofounder', 'Starting MCP server');
  await server.connect(transport);
  logger.info('cofounder', 'Server running on stdio');
}

start().catch((err) => {
  logger.error('cofounder', 'Failed to start server', { error: String(err) });
  process.exit(1);
});
