import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createKnowledgeDigest,
  knowledgeSopFileName,
  parseKnowledgeSop,
  renderKnowledgeIndex,
  renderKnowledgeSop,
  validateKnowledgeFacts,
  validateKnowledgeIndex,
} from '../../src/core/evobuddy-knowledge-store.mjs';

describe('EvoBuddy knowledge store', () => {
  it('renders a GenericAgent-style minimal insight index', () => {
    const text = renderKnowledgeIndex({
      pointers: [
        { key: 'live-eval-proof-loop', ref: 'sops/live-eval-proof-loop.md' },
      ],
      rules: ['No Execution, No Memory'],
    });
    assert.match(text, /^# EvoBuddy Knowledge Index/m);
    assert.match(text, /live-eval-proof-loop -> sops\/live-eval-proof-loop\.md/);
    assert.doesNotMatch(text, /Step 1|How to run product proof|retained\/hermetic\/live\/product/);
    assert.equal(validateKnowledgeIndex(text).pointers.length, 1);
  });

  it('rejects index content that becomes a how-to dump', () => {
    assert.throws(() => validateKnowledgeIndex('# EvoBuddy Knowledge Index\n\n- live-eval: Step 1 run command, Step 2 inspect report, Step 3 patch code\n'), /index must be minimum sufficient pointers/);
  });

  it('renders and parses SOP knowledge with trigger and source refs', () => {
    const sop = {
      name: 'live-eval-proof-loop',
      title: 'Live eval proof loop',
      trigger: 'Use when release proof claims need retained/hermetic/live/product distinction.',
      sourceRefs: ['observed-transcript:ses-1:msg-1#sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
      body: 'Retained, hermetic, live, product, and product-observed evals are distinct proof tiers.',
    };
    const text = renderKnowledgeSop(sop);
    const parsed = parseKnowledgeSop(text);
    assert.equal(parsed.name, sop.name);
    assert.deepEqual(parsed.sourceRefs, sop.sourceRefs);
    assert.match(createKnowledgeDigest(parsed), /^sha256:[a-f0-9]{64}$/);
  });

  it('rejects active SOP knowledge with volatile-only tmp source refs', () => {
    assert.throws(() => renderKnowledgeSop({
      name: 'bad-proof-loop',
      title: 'Bad proof loop',
      trigger: 'Use when bad.',
      sourceRefs: ['artifact:/tmp/report.json'],
      body: 'Bad.',
    }), /durable source ref/);
  });

  it('validates stable facts but rejects volatile state', () => {
    assert.doesNotThrow(() => validateKnowledgeFacts('# EvoBuddy Knowledge Facts\n\n## Project\n- Release proof reports are stored under `.evobuddy/release/`.\n'));
    assert.throws(() => validateKnowledgeFacts('# EvoBuddy Knowledge Facts\n\n- Current PID is 12345.\n'), /volatile state/);
  });

  it('rejects path-unsafe SOP names', () => {
    assert.throws(() => knowledgeSopFileName('../bad'), /knowledge name must be path-safe/);
  });
});
