import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import { createTaskRoomFromDraft, createHandoffFromDraft } from '../../src/core/evobuddy-taskroom-mutation.mjs';
import { readTaskRoom } from '../../src/core/evobuddy-taskroom-store.mjs';
import {
  appendWake,
  listWakes,
  pullHandoffBodyAfterWake,
} from '../../src/core/evobuddy-taskroom-wake-store.mjs';
import { createTaskRoomWake } from '../../src/core/evobuddy-taskroom-mailbox.mjs';
import { resolveEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';

test('appendWake writes content-free wake lines and listWakes reads them', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-wake-store-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createTaskRoomFromDraft(projectRoot, { objective: 'Wake store room' });
  const reviewer = room.participants.find((p) => p.role === 'reviewer');
  const wake = createTaskRoomWake({
    roomId: room.roomId,
    messageId: 'message:handoff:1',
    participantId: reviewer.participantId,
    occurredAt: '2026-07-22T00:00:00.000Z',
    reason: 'handoff-ready',
  });
  await appendWake(projectRoot, wake);
  const wakes = await listWakes(projectRoot, room.roomId);
  assert.equal(wakes.length, 1);
  assert.equal(wakes[0].participantId, reviewer.participantId);
  assert.equal(wakes[0].reason, 'handoff-ready');
  assert.equal(wakes[0].body, undefined);

  const state = resolveEvobuddyProjectState({ projectRoot });
  const raw = await readFile(join(state.taskroomPath(room.roomId), 'wakes.jsonl'), 'utf8');
  assert.match(raw, /handoff-ready/);
  assert.doesNotMatch(raw, /"body"/);
});

test('createHandoffFromDraft writes wake, sets needs-review, and pull returns body without wake body', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-handoff-wake-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createTaskRoomFromDraft(projectRoot, { objective: 'Builder to reviewer handoff' });
  const builder = room.participants.find((p) => p.role === 'builder');
  const reviewer = room.participants.find((p) => p.role === 'reviewer');
  const handoff = await createHandoffFromDraft(projectRoot, {
    roomId: room.roomId,
    from: builder.participantId,
    to: reviewer.participantId,
    body: 'Please review the patch summary.',
  });
  assert.equal(handoff.messageId.startsWith('message:'), true);

  const wakes = await listWakes(projectRoot, room.roomId);
  assert.equal(wakes.length, 1);
  assert.equal(wakes[0].participantId, reviewer.participantId);
  assert.equal(wakes[0].reason, 'handoff-ready');
  assert.equal(wakes[0].body, undefined);

  const updated = await readTaskRoom(projectRoot, room.roomId);
  assert.equal(updated.status, 'needs-review');

  const pulled = await pullHandoffBodyAfterWake(projectRoot, {
    roomId: room.roomId,
    participantId: reviewer.participantId,
  });
  assert.equal(pulled.body, 'Please review the patch summary.');
  assert.equal(pulled.wake.reason, 'handoff-ready');
  assert.equal(pulled.wake.body, undefined);
  assert.equal(pulled.handoff.messageId, handoff.messageId);
});
