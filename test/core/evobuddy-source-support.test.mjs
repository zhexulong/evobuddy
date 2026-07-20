import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  assertActiveSourceSupport,
  classifySourceSupport,
} from '../../src/core/evobuddy-source-support.mjs';

describe('EvoBuddy source support', () => {
  it('accepts repo-local or runtime-observed source refs for active updates', () => {
    const result = classifySourceSupport({
      sourceRefs: ['observed-transcript:ses-1:msg-1#sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
      sourceQuality: { status: 'pass', excludedToolOutputCount: 0, excludedWorkflowWrapperCount: 0 },
    });
    assert.equal(result.status, 'active-source-supported');
    assert.doesNotThrow(() => assertActiveSourceSupport({
      targetKind: 'knowledge-sop',
      sourceRefs: result.activeSourceRefs,
      sourceQuality: result.sourceQuality,
    }));
  });

  it('keeps tmp-only source refs pending instead of copying them into evidence buckets', () => {
    const result = classifySourceSupport({
      sourceRefs: ['artifact:/tmp/evobuddy-report.json'],
      sourceQuality: { status: 'pass', excludedToolOutputCount: 0, excludedWorkflowWrapperCount: 0 },
    });
    assert.equal(result.status, 'pending-stable-source');
    assert.deepEqual(result.activeSourceRefs, []);
    assert.match(result.reason, /volatile|tmp|stable source/);
    assert.throws(() => assertActiveSourceSupport({
      targetKind: 'knowledge-sop',
      sourceRefs: result.activeSourceRefs,
      sourceQuality: result.sourceQuality,
    }), /stable source support/);
  });

  it('rejects tool-output and workflow-wrapper source quality for active updates', () => {
    const result = classifySourceSupport({
      sourceRefs: ['tool:search:raw-json'],
      sourceQuality: { status: 'fail', reason: 'tool-output', excludedToolOutputCount: 1 },
    });
    assert.equal(result.status, 'rejected-dirty-source');
    assert.throws(() => assertActiveSourceSupport({
      targetKind: 'skill',
      sourceRefs: result.activeSourceRefs,
      sourceQuality: result.sourceQuality,
    }), /dirty source/);
  });
});
