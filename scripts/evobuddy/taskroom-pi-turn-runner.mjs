import { runPiTaskRoomTurn } from '../../src/core/evobuddy-taskroom-pi-runner.mjs';

function required(value, name) {
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

const [projectRoot, roomId, participantId, messageId, body, turnId] = process.argv.slice(2);
runPiTaskRoomTurn(required(projectRoot, 'projectRoot'), {
  roomId: required(roomId, 'roomId'),
  participantId: required(participantId, 'participantId'),
  messageId: required(messageId, 'messageId'),
  body: required(body, 'body'),
  turnId: required(turnId, 'turnId'),
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
