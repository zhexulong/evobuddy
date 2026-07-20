function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
  return value.trim();
}

function optionalString(value, name) {
  if (value === undefined) return undefined;
  return requireString(value, name);
}

function normalizeStringArray(value, name) {
  const items = value ?? [];
  if (!Array.isArray(items)) {
    throw new Error(`required array: ${name}`);
  }
  return items.map((item, index) => requireString(item, `${name}[${index}]`));
}

export function renderOpenCodeNativeBuddyTaskPrompt(input) {
  const buddyName = requireString(input?.buddyName, 'buddyName');
  const task = requireString(input?.task, 'task');
  const invocationPacketRef = requireString(input?.invocationPacketRef, 'invocationPacketRef');
  const invocationPacketDigest = requireString(input?.invocationPacketDigest, 'invocationPacketDigest');
  const targetRefs = normalizeStringArray(input?.targetRefs, 'targetRefs');
  const materializedContextRef = optionalString(input?.materializedContextRef, 'materializedContextRef');

  const sections = [
    `Buddy review target: ${buddyName}`,
    task,
    `Invocation packet ref: ${invocationPacketRef}`,
    `Invocation packet digest: ${invocationPacketDigest}`,
    'Keep the invocation packet digest bound to this review while you work.',
    'Return the result directly to the parent agent when the review is complete.',
  ];

  if (targetRefs.length > 0) {
    sections.push('Target refs:');
    for (const ref of targetRefs) {
      sections.push(`- ${ref}`);
    }
  }

  if (materializedContextRef) {
    sections.push(`Materialized context ref: ${materializedContextRef}`);
  }

  sections.push('Keep the response focused on the requested Buddy task and the provided runtime-visible refs.');
  return `${sections.join('\n')}\n`;
}
