import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildMemberUtilityEpisodes } from '../../src/core/member-utility-episodes.mjs';
import { runMemberUtilityDiscovery } from '../../src/core/member-utility-discovery.mjs';

function msg(sessionId, ordinal, text, extra = {}) {
  return {
    role: 'user',
    sessionId,
    ordinal,
    ref: `session:${sessionId}:message:${ordinal}`,
    digest: `sha256:${sessionId}-${ordinal}`,
    text,
    evidenceSourceKind: 'genuine-user-message',
    ...extra,
  };
}

function scan(messages, extra = {}) {
  const sessions = [...new Set(messages.map((m) => m.sessionId))];
  return {
    artifactKind: 'session-corpus-scan',
    projectIdentity: 'project:/repo/context-tree',
    includedSessions: sessions.map((sessionId) => ({ sessionId, runtime: 'opencode', saturated: false })),
    scannedMessages: messages,
    ...extra,
  };
}

function proposal(overrides = {}) {
  return {
    memberName: 'eval-proof-reviewer',
    memberClass: 'repeated-specialist-work',
    role: 'Eval proof review specialist',
    routingDescription: 'Use before accepting eval or capability-matrix pass claims.',
    responsibilities: ['Review proof-tier claims against digest-backed evidence.', 'Reject overclaims that lack product proof.'],
    nonResponsibilities: ['Do not implement eval runner code.'],
    whenToUse: ['When a capability-matrix or member-system report is claimed to pass.'],
    contextPack: 'Proof-tier definitions, answer-source boundaries, and report acceptance rules.',
    memoryPolicy: 'Carry proof-tier vocabulary and evidence checklist only; do not store active project state.',
    returnContract: 'Return a concise verdict with proof-tier classification and blocking evidence gaps.',
    contextBurdenReduction: 'Reduces repeated proof-tier and context-boundary explanation before every eval report review.',
    utilityEvidenceSummary: 'Repeated proof review requests cite concrete source messages and digest-backed evidence.',
    whyReusable: 'The same proof-tier review responsibility recurs across sessions.',
    evidenceRefs: [
      { ref: 'session:eval-a:message:1', digest: 'sha256:eval-a-1' },
      { ref: 'session:eval-b:message:1', digest: 'sha256:eval-b-1' },
    ],
    negativeSignals: [],
    ...overrides,
  };
}

async function discover({ messages, proposals, gate = { hasDelegationOpportunity: true, episodeRefs: [], reason: 'test gate' }, scanExtra = {} }) {
  const scanArtifact = scan(messages, scanExtra);
  const episodesArtifact = buildMemberUtilityEpisodes({ scan: scanArtifact });
  return runMemberUtilityDiscovery({
    scan: scanArtifact,
    episodesArtifact,
    utilityGate: async () => gate,
    utilityExtractor: async () => ({ proposals }),
  });
}

describe('runMemberUtilityDiscovery', () => {
  it('repeated eval proof review accepts eval-proof-reviewer without explicit member naming', async () => {
    const messages = [
      msg('eval-a', 1, 'Before accepting the capability-matrix report, review retained/live/product proof tiers and reject context overclaim.'),
      msg('eval-b', 1, 'For the member-system report, check digest-backed answer-source evidence and proof-tier boundaries before saying it passes.'),
    ];

    const result = await discover({ messages, proposals: [proposal()] });

    assert.equal(result.profileCandidates.candidates[0].memberName, 'eval-proof-reviewer');
    assert.equal(result.candidateManifests.manifests[0].memberClass, 'repeated-specialist-work');
    assert.match(result.candidateManifests.manifests[0].contextBurdenReduction, /proof-tier|context/i);
    assert(result.candidateManifests.manifests[0].nonResponsibilities.includes('Do not implement eval runner code.'));
    assert.equal(result.utilityDiscovery.status, 'candidate-discovered');
    assert.equal(result.profileCandidates.candidates[0].sourceAuthority, 'session-derived-unconfirmed');
    assert.notEqual(result.profileCandidates.candidates[0].status, 'active');
  });

  it('single explicit teammate mention is rejected', async () => {
    const messages = [
      msg('solo', 1, 'Please ask @proof-specialist to review this one report.'),
    ];

    const result = await discover({
      messages,
      proposals: [proposal({
        memberName: 'proof-specialist',
        memberClass: 'explicit-repeated-teammate',
        evidenceRefs: [{ ref: 'session:solo:message:1', digest: 'sha256:solo-1' }],
      })],
    });

    assert.equal(result.profileCandidates.candidates.length, 0);
    assert.match(result.rejectedProposals[0].reason, /single explicit|insufficient repeated/i);
  });

  it('repeated explicit skill-designer episodes are accepted', async () => {
    const messages = [
      msg('skill-a', 1, 'Ask @skill-designer to review the skill instructions, boundaries, and return contract before we install it.'),
      msg('skill-b', 1, 'Again use @skill-designer to check the skill design, non-responsibilities, and evidence-backed instructions.'),
    ];

    const result = await discover({
      messages,
      proposals: [proposal({
        memberName: 'skill-designer',
        memberClass: 'explicit-repeated-teammate',
        role: 'Skill design reviewer',
        routingDescription: 'Use when recurring skill authoring needs design review.',
        responsibilities: ['Review skill instruction boundaries.', 'Check return contracts and non-responsibilities.'],
        nonResponsibilities: ['Do not implement unrelated product code.'],
        whenToUse: ['When a reusable skill is being drafted or revised.'],
        contextPack: 'Skill writing boundaries, return contracts, and installation checklist.',
        returnContract: 'Return concise skill-design findings with required fixes.',
        contextBurdenReduction: 'Avoids reloading skill-design context and boundary rules in each session.',
        evidenceRefs: [
          { ref: 'session:skill-a:message:1', digest: 'sha256:skill-a-1' },
          { ref: 'session:skill-b:message:1', digest: 'sha256:skill-b-1' },
        ],
      })],
    });

    assert.equal(result.profileCandidates.candidates[0].memberName, 'skill-designer');
    assert.equal(result.candidateManifests.manifests[0].memberClass, 'explicit-repeated-teammate');
  });

  it('topic-only eval frequency is rejected', async () => {
    const messages = [
      msg('topic-a', 1, 'eval eval eval'),
      msg('topic-b', 1, 'eval eval planning eval'),
    ];

    const result = await discover({
      messages,
      proposals: [proposal({
        evidenceRefs: [
          { ref: 'session:topic-a:message:1', digest: 'sha256:topic-a-1' },
          { ref: 'session:topic-b:message:1', digest: 'sha256:topic-b-1' },
        ],
      })],
    });

    assert.equal(result.profileCandidates.candidates.length, 0);
    assert.match(result.rejectedProposals[0].reason, /topic-only|utility/i);
  });

  it('contract validator keeps long-lived context owner as warning candidate from live proposal artifact', async () => {
    const messages = [
      msg('context-owner-a', 1, 'Across release sessions, one reusable role should remember earlier architectural decisions and keep scope edges consistent before new work starts.'),
      msg('context-owner-b', 1, 'We keep needing the same persistent coordinator to carry prior decisions, rejected options, and workstream boundaries between follow-up conversations.'),
    ];
    const episodesArtifact = buildMemberUtilityEpisodes({
      scan: scan(messages, {
        projectIdentity: 'project:/repo/context-tree',
      }),
    });
    const parsedProposal = {
      proposals: [proposal({
        memberName: 'agent-native-v1-5-context-owner',
        memberClass: 'long-lived-context-owner',
        role: 'Long-lived context owner',
        routingDescription: 'Use when a recurring cross-session role should preserve durable project history and scope boundaries.',
        responsibilities: ['Preserve durable project history across recurring sessions.', 'Track stable scope boundaries and prior decision context.'],
        nonResponsibilities: ['Do not act as the implementation owner for feature work.'],
        whenToUse: ['When repeated follow-up sessions need the same reusable owner of durable history and scope boundaries.'],
        contextPack: 'Durable architecture history, scope edges, and earlier decision records.',
        memoryPolicy: 'Carry stable historical context and scope limits, not active implementation ownership.',
        returnContract: 'Return the durable background, scope boundaries, and prior decision context relevant to the current task.',
        contextBurdenReduction: 'Reduces repeated historical retelling across follow-up sessions by keeping durable boundary context available.',
        utilityEvidenceSummary: 'Multiple sessions ask for the same reusable role to preserve durable history and scope boundaries.',
        whyReusable: 'The same continuity responsibility recurs across distinct follow-up sessions.',
        evidenceRefs: [
          { ref: 'session:context-owner-a:message:1', digest: 'sha256:context-owner-a-1' },
          { ref: 'session:context-owner-b:message:1', digest: 'sha256:context-owner-b-1' },
        ],
      })],
    };

    const result = await runMemberUtilityDiscovery({
      scan: { projectIdentity: episodesArtifact.projectIdentity, supportingRuns: [] },
      episodesArtifact,
      utilityGate: async () => ({ hasDelegationOpportunity: true, episodeRefs: [], reason: 'live utility proposal regression' }),
      utilityExtractor: async () => parsedProposal,
    });

    const contextOwner = result.profileCandidates.candidates.find((candidate) => candidate.memberName === 'agent-native-v1-5-context-owner');
    assert(contextOwner, 'agent-native-v1-5-context-owner should remain a candidate instead of semantic hard rejection');
    assert.equal(result.utilityDiscovery.status, 'candidate-discovered');
    assert(Array.isArray(result.utilityDiscovery.warnings));
    assert(result.utilityDiscovery.warnings.some((warning) => warning.memberName === 'agent-native-v1-5-context-owner'));
    assert.equal(result.utilityDiscovery.warningCount, result.utilityDiscovery.warnings.length);
    assert.deepEqual(result.utilityDiscovery.rejectedProposals, result.rejectedProposals);
    assert(!result.rejectedProposals.some((rejection) => /non-generic utility reasoning|contextBurdenReduction/i.test(rejection.reason)));
  });
});
