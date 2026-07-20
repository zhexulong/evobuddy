import { createHash } from 'node:crypto';
import { isDurableSourceRef } from './evobuddy-source-support.mjs';

export const KNOWLEDGE_LAYER_PATHS = Object.freeze({
  index: '.evobuddy/knowledge/index.md',
  facts: '.evobuddy/knowledge/facts.md',
  sops: '.evobuddy/knowledge/sops',
});

function assertPathSafeName(name) {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(String(name ?? '')) || String(name).includes('..')) {
    throw new Error('knowledge name must be path-safe');
  }
}

export function knowledgeSopFileName(name) {
  assertPathSafeName(name);
  return `${name}.md`;
}

export function createKnowledgeDigest(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

export function renderKnowledgeIndex({ pointers = [], rules = [] } = {}) {
  const pointerLines = pointers.map((pointer) => `- ${pointer.key} -> ${pointer.ref}`);
  const ruleLines = rules.map((rule) => `- ${rule}`);
  return `# EvoBuddy Knowledge Index\n\n> L1-style minimum sufficient pointers. Do not put how-to details here.\n\n## Pointers\n${pointerLines.join('\n') || '- none'}\n\n## Rules\n${ruleLines.join('\n') || '- No Execution, No Memory'}\n`;
}

export function validateKnowledgeIndex(text) {
  const value = String(text ?? '');
  if (!/^# EvoBuddy Knowledge Index/m.test(value)) throw new Error('knowledge index must start with # EvoBuddy Knowledge Index');
  const meaningfulLines = value.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && !line.startsWith('>'));
  if (meaningfulLines.length > 30 || /\bStep\s*\d+\b|How to run|```|\b(run|inspect|patch) command\b/i.test(value)) {
    throw new Error('knowledge index must be minimum sufficient pointers');
  }
  const pointers = [];
  const rules = [];
  let section = '';
  for (const line of value.split('\n')) {
    if (/^##\s+Pointers/.test(line)) section = 'pointers';
    else if (/^##\s+Rules/.test(line)) section = 'rules';
    else if (line.startsWith('- ') && section === 'pointers' && line.includes(' -> ')) {
      const [key, ref] = line.slice(2).split(' -> ');
      pointers.push({ key, ref });
    } else if (line.startsWith('- ') && section === 'rules') {
      rules.push(line.slice(2));
    }
  }
  return { pointers, rules };
}

export function validateKnowledgeFacts(text) {
  const value = String(text ?? '');
  if (!/^# EvoBuddy Knowledge Facts/m.test(value)) throw new Error('knowledge facts must start with # EvoBuddy Knowledge Facts');
  if (/current\s+PID|currently running|current timestamp|temporary session id|\/tmp\//i.test(value)) {
    throw new Error('knowledge facts must not store volatile state');
  }
  return { sections: value.split('\n').filter((line) => /^##\s+/.test(line)).map((line) => line.replace(/^##\s+/, '')) };
}

export function renderKnowledgeSop({ name, title, trigger, sourceRefs = [], body }) {
  assertPathSafeName(name);
  if (typeof trigger !== 'string' || trigger.trim().length === 0) throw new Error('knowledge SOP requires Trigger');
  if (!Array.isArray(sourceRefs) || sourceRefs.length === 0 || !sourceRefs.every(isDurableSourceRef)) {
    throw new Error('knowledge SOP requires durable source ref');
  }
  if (typeof body !== 'string' || body.trim().length === 0) throw new Error('knowledge SOP requires body');
  return `# ${title ?? name}\n\nName: ${name}\nTrigger: ${trigger}\nSourceRefs: ${sourceRefs.join(' | ')}\n\n## Core\n${body.trim()}\n`;
}

export function parseKnowledgeSop(text) {
  const value = String(text ?? '');
  const title = value.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const name = value.match(/^Name:\s*(.+)$/m)?.[1]?.trim();
  const trigger = value.match(/^Trigger:\s*(.+)$/m)?.[1]?.trim();
  const sourceRefs = (value.match(/^SourceRefs:\s*(.+)$/m)?.[1] ?? '').split('|').map((item) => item.trim()).filter(Boolean);
  const body = value.match(/## Core\n([\s\S]*?)(\n##\s+|$)/)?.[1]?.trim() ?? '';
  renderKnowledgeSop({ name, title, trigger, sourceRefs, body });
  return { name, title, trigger, sourceRefs, body };
}
