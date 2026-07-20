function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
  return value;
}

function stringArray(value, name) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`required non-empty array: ${name}`);
  return value.map((item, index) => requireString(item, `${name}[${index}]`));
}

export function validateTaskRoomEvolutionHandoff(input) {
  requireObject(input, 'evolutionHandoff');
  const proposal = requireObject(input.proposal, 'proposal');
  const stableMutation = requireObject(input.stableMutation, 'stableMutation');
  const handoff = {
    schema: 'evobuddy-taskroom-evolution-handoff.v1',
    handoffId: requireString(input.handoffId, 'handoffId'),
    roomId: requireString(input.roomId, 'roomId'),
    agentName: requireString(input.agentName, 'agentName'),
    evidenceRefs: stringArray(input.evidenceRefs, 'evidenceRefs'),
    proposal: { ...proposal },
    stableMutation: { ...stableMutation },
    createdAt: requireString(input.createdAt, 'createdAt'),
  };
  if (handoff.agentName !== 'evolution-agent') throw new Error('evolution handoff must target evolution-agent');
  if (proposal.riskLevel === 'high' && stableMutation.status !== 'pending-review') throw new Error('high-risk evolution must remain pending-review');
  handoff.status = stableMutation.status === 'pass' || stableMutation.status === 'pending-review' ? 'pass' : 'fail';
  return handoff;
}

export function createTaskRoomEvolutionHandoff(input) {
  return validateTaskRoomEvolutionHandoff(input);
}
