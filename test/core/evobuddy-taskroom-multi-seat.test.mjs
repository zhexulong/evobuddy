import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as taskroomMutation from '../../src/core/evobuddy-taskroom-mutation.mjs';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import { readTaskRoom, updateTaskRoom } from '../../src/core/evobuddy-taskroom-store.mjs';

async function withTempProject(prefix, run) {
  const projectRoot = mkdtempSync(join(tmpdir(), prefix));
  try {
    await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
    return await run(projectRoot);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
}

function participantByRole(room, role) {
  return room.participants.find((participant) => participant.role === role);
}

describe('evobuddy TaskRoom multi-seat metadata and claim', () => {
  it('createTaskRoomFromDraft creates distinct builder and reviewer seats with pi default runtime', async () => {
    await withTempProject('evobuddy-taskroom-multiseat-create-', async (projectRoot) => {
      const room = await taskroomMutation.createTaskRoomFromDraft(projectRoot, {
        objective: 'Coordinate builder and reviewer seats',
        actor: 'alice-builder',
      });

      assert.ok(room.participants.length >= 2);
      const builder = participantByRole(room, 'builder');
      const reviewer = participantByRole(room, 'reviewer');
      assert.ok(builder, 'builder participant must exist');
      assert.ok(reviewer, 'reviewer participant must exist');
      assert.notEqual(builder.participantId, reviewer.participantId);
      assert.equal(builder.actorName, 'alice-builder');
      assert.equal(reviewer.actorName, 'reviewer');
      assert.equal(builder.runtime, 'pi');
      assert.equal(reviewer.runtime, 'pi');
      assert.deepEqual(new Set(room.participants.map((participant) => participant.participantId)).size, room.participants.length);
    });
  });

  it('claimTaskRoom records one exclusive owner and allows same-owner idempotency', async () => {
    await withTempProject('evobuddy-taskroom-multiseat-claim-', async (projectRoot) => {
      const room = await taskroomMutation.createTaskRoomFromDraft(projectRoot, {
        objective: 'Claim a builder seat exactly once',
        runtime: 'codex',
      });
      const builder = participantByRole(room, 'builder');
      const reviewer = participantByRole(room, 'reviewer');

      const firstClaim = await taskroomMutation.claimTaskRoom(projectRoot, room.roomId, builder.participantId);
      assert.equal(firstClaim.ownerParticipantId, builder.participantId);
      assert.match(firstClaim.claimedAt, /^\d{4}-\d{2}-\d{2}T/);

      const secondSameOwnerClaim = await taskroomMutation.claimTaskRoom(projectRoot, room.roomId, builder.participantId);
      assert.equal(secondSameOwnerClaim.ownerParticipantId, builder.participantId);
      assert.equal(secondSameOwnerClaim.claimedAt, firstClaim.claimedAt);

      await assert.rejects(
        () => taskroomMutation.claimTaskRoom(projectRoot, room.roomId, reviewer.participantId),
        /already claimed|owner/i,
      );

      const reloaded = await readTaskRoom(projectRoot, room.roomId);
      assert.equal(reloaded.ownerParticipantId, builder.participantId);
      assert.equal(reloaded.claimedAt, firstClaim.claimedAt);
    });
  });

  it('projectTaskRoomsForWorkbench exposes participant role, runtime, id, and display name', async () => {
    await withTempProject('evobuddy-taskroom-multiseat-project-', async (projectRoot) => {
      const room = await taskroomMutation.createTaskRoomFromDraft(projectRoot, {
        objective: 'Project multi-seat metadata',
        actor: 'build-lead',
        runtime: 'claude',
      });

      const [projected] = await taskroomMutation.projectTaskRoomsForWorkbench(projectRoot, { nativeSessions: [] });

      assert.equal(projected.id, room.roomId);
      assert.ok(projected.participants.length >= 2);
      assert.deepEqual(
        projected.participants.map((participant) => ({
          id: participant.id,
          displayName: participant.displayName,
          role: participant.role,
          runtime: participant.runtime,
        })),
        room.participants.map((participant) => ({
          id: participant.participantId,
          displayName: participant.actorName === 'build-lead' ? 'Build Lead' : 'Reviewer',
          role: participant.role,
          runtime: participant.runtime,
        })),
      );
    });
  });

  it('durable needs-review status validates and projects as NeedsReview', async () => {
    await withTempProject('evobuddy-taskroom-multiseat-needs-review-', async (projectRoot) => {
      const room = await taskroomMutation.createTaskRoomFromDraft(projectRoot, {
        objective: 'Move handoff into review',
        runtime: 'opencode',
      });

      const updated = await updateTaskRoom(projectRoot, room.roomId, (current) => ({
        ...current,
        status: 'needs-review',
        digest: undefined,
      }));
      assert.equal(updated.status, 'needs-review');

      const [projected] = await taskroomMutation.projectTaskRoomsForWorkbench(projectRoot, { nativeSessions: [] });
      assert.equal(projected.status, 'NeedsReview');
    });
  });
});
