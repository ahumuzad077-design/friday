#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const ignoreDirs = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.venv', 'coverage']);
const defaultKeywords = ['TODO', 'FIXME', 'HACK', 'BUG', 'XXX', 'console.log', 'throw new Error'];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const text = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    env[key] = value.replace(/^['"]|['"]$/g, '');
  }
  return env;
}

const env = { ...process.env, ...loadEnvFile(path.join(repoRoot, '.env')) };

function pickProvider() {
  const preferred = (env.AI_PROVIDER || env.PROVIDER || '').toLowerCase();
  if (preferred) return preferred;
  if (env.OPENAI_API_KEY) return 'openai';
  if (env.ANTHROPIC_API_KEY) return 'anthropic';
  if (env.OPENROUTER_API_KEY) return 'openrouter';
  return 'local';
}

function safeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  return res.json();
}

async function callModel(provider, prompt) {
  const systemPrompt = 'You are a repo-aware software engineering agent. Find real work, explain root causes, propose the safest fix, and give a clear execution plan.';

  if (provider === 'local' || !provider) {
    return {
      content: `Local-only mode. I can still scan the repo and suggest tasks, but no cloud model is connected.\n\nPlan:\n1. Review scan output.\n2. Prioritize tasks by risk and impact.\n3. Draft patch for the highest-value issue.\n4. Validate with minimal tests.`
    };
  }

  if (provider === 'openai') {
    const key = env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is missing');
    const model = env.OPENAI_MODEL || 'gpt-4o-mini';
    const data = await fetchJson('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      })
    });
    return { content: data.choices?.[0]?.message?.content || 'No response from OpenAI.' };
  }

  if (provider === 'anthropic') {
    const key = env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY is missing');
    const model = env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    const data = await fetchJson('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    return { content: data.content?.[0]?.text || 'No response from Anthropic.' };
  }

  if (provider === 'openrouter') {
    const key = env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY is missing');
    const model = env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
    const data = await fetchJson('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      })
    });
    return { content: data.choices?.[0]?.message?.content || 'No response from OpenRouter.' };
  }

  return { content: `Unsupported provider: ${provider}` };
}

async function webSearch(query) {
  const safeQuery = encodeURIComponent(query.trim());
  const url = `https://duckduckgo.com/html/?q=${safeQuery}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FridayAgent/1.0; +https://github.com/ahumuzad077-design/friday)'
    }
  });

  if (!res.ok) return [];
  const html = await res.text();
  const matches = [...html.matchAll(/<a rel="nofollow" class="result-link" href="(.*?)"/g)]
    .map((m) => m[1])
    .filter(Boolean)
    .slice(0, 5);
  return matches;
}

function listFiles(root) {
  const files = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.existsSync(current) ? fs.readdirSync(current, { withFileTypes: true }) : [];
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name)) stack.push(full);
      } else {
        files.push(full);
      }
    }
  }
  return files;
}

function scanRepoForWork(root) {
  const files = listFiles(root);
  const findings = [];

  for (const file of files) {
    try {
      const rel = path.relative(root, file).replace(/\\/g, '/');
      if (rel.startsWith('node_modules/')) continue;
      if (/\.(png|jpg|jpeg|gif|svg|ico|pdf|mp4|mp3|zip|gz|woff|woff2)$/i.test(rel)) continue;

      const text = fs.readFileSync(file, 'utf8');
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const lower = line.toLowerCase();
        const hasKeyword = defaultKeywords.some((keyword) => lower.includes(keyword.toLowerCase()));
        if (hasKeyword) {
          findings.push({ file: rel, line: i + 1, text: safeText(line) });
        }
      }
    } catch {
      // ignore binary or unreadable files
    }
  }

  return findings.slice(0, 150);
}

function buildWorkPrompt(repoName, findings, webResults) {
  const findingsText = findings.length
    ? findings.map((f) => `- ${f.file}:${f.line} :: ${f.text}`).join('\n')
    : 'No explicit TODO/FIXME/HACK markers were found in the repo.';

  const webText = webResults.length
    ? webResults.map((url, idx) => `${idx + 1}. ${url}`).join('\n')
    : 'No web results found.';

  return `
You are operating inside repo: ${repoName}

Task: find the highest-value, real work that should be done next.

Codebase issues found:
${findingsText}

Relevant web search results:
${webText}

Please return:
1. Top 3 real work items with priority and why they matter
2. The likely root cause for the most important issue
3. A concrete implementation plan
4. Suggested validation commands
5. Risk notes and edge cases
`;
}

async function main() {
  const provider = pickProvider();
  const repoName = path.basename(repoRoot) || 'repo';

  const findings = scanRepoForWork(repoRoot);
  const query = `site:github.com/ahumuzad077-design/friday ${repoName} project work tasks`;

  let webResults = [];
  try {
    webResults = await webSearch(query);
  } catch {
    webResults = [];
  }

  console.log('=== Friday agent: repo scan ===');
  console.log(`Detected provider: ${provider}`);
  console.log(`Repo: ${repoName}`);
  console.log(`Findings: ${findings.length}`);
  console.log('');

  if (findings.length === 0) {
    console.log('No obvious TODO/FIXME/HACK markers found.');
  } else {
    console.log('Top findings:');
    findings.slice(0, 10).forEach((item) => {
      console.log(`- ${item.file}:${item.line} :: ${item.text}`);
    });
    console.log('');
  }

  if (webResults.length) {
    console.log('Web results:');
    webResults.forEach((url, idx) => console.log(`${idx + 1}. ${url}`));
    console.log('');
  }

  try {
    const prompt = buildWorkPrompt(repoName, findings, webResults);
    const response = await callModel(provider, prompt);
    console.log('=== AI work analysis ===');
    console.log(response.content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log('=== Local fallback plan ===');
    console.log('No model key configured or the provider failed. Using local planning logic.');
    console.log('');
    console.log('Recommended next work:');
    if (findings.length) {
      console.log('1. Fix the highest-impact TODO/FIXME/HACK issue in the codebase.');
      console.log('2. Validate the exact file and behavior before broad changes.');
      console.log('3. Add tests around the risky path and keep patch scope small.');
    } else {
      console.log('1. Create a focused issue list from the repo architecture and specification docs.');
      console.log('2. Choose the highest-risk feature boundary and inspect its implementation.');
      console.log('3. Implement the smallest testable improvement with verification commands.');
    }
    console.log('');
    console.log(`Provider message: ${message}`);
  }
}

main();
