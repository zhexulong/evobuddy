import { listNativeSessions } from './evobuddy-native-session-store.mjs';
import { startPiRpcWorker } from './evobuddy-pi-rpc-worker.mjs';
import { listWakes } from './evobuddy-taskroom-wake-store.mjs';
import { readTaskRoom } from './evobuddy-taskroom-store.mjs';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

const LIVE_LIFECYCLES = new Set(['creating', 'attachable', 'attached', 'detached']);

export async function spawnSeatOnWake(projectRoot, input = {}, deps = {}) {
  requireString(projectRoot, 'projectRoot');
  const roomId = requireString(input.roomId, 'roomId');
  const participantId = requireString(input.participantId, 'participantId');
  const listSessions = deps.listNativeSessions ?? listNativeSessions;
  const listRoomWakes = deps.listWakes ?? listWakes;
  const readRoom = deps.readTaskRoom ?? readTaskRoom;
  const startWorker = deps.startPiRpcWorker ?? startPiRpcWorker;

  const wakes = await listRoomWakes(projectRoot, roomId);
  const wake = [...wakes].reverse().find((entry) => entry.participantId === participantId);
  if (!wake) {
    return { status: 'queued-with-reason', reason: 'no-wake-for-participant', worker: null };
  }

  const room = await readRoom(projectRoot, roomId);
  const participant = (room.participants ?? []).find((entry) => entry.participantId === participantId);
  if (!participant) {
    return { status: 'queued-with-reason', reason: 'participant-missing', worker: null };
  }

  const sessions = await listSessions(projectRoot);
  const live = sessions.some((session) => (
    session.roomId === roomId
    && (session.agentInstanceId === participantId || session.participantId === participantId)
    && LIVE_LIFECYCLES.has(session.lifecycle)
  ));
  if (live) {
    return { status: 'already-live', reason: null, worker: null };
  }

  const runtime = participant.runtime ?? 'pi';
  if (runtime !== 'pi') {
    return {
      status: 'queued-with-reason',
      reason: `spawn-on-wake only implemented for pi (got ${runtime})`,
      worker: null,
    };
  }

  const worker = await startWorker({
    cwd: input.cwd ?? projectRoot,
  }, deps);
  return { status: 'spawned', reason: null, worker, wake };
}
