function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function findBaselineInstallMember(report, memberName) {
  if (!Array.isArray(report?.members) || !nonEmptyString(memberName)) return undefined;
  const codexAgentName = memberName.replaceAll('-', '_');
  return report.members.find((member) => (
    member?.memberName === memberName
    || member?.runtimeAgentName === memberName
    || member?.runtimeAgentName === codexAgentName
  ));
}

export function readBaselineRuntimeFile(member, runtime) {
  if (!isObject(member)) return {};

  const legacyRuntimeFile = isObject(member.runtimeFile) ? member.runtimeFile : undefined;
  if (legacyRuntimeFile && runtime === 'opencode' && nonEmptyString(legacyRuntimeFile.path)) {
    return {
      path: legacyRuntimeFile.path,
      digest: legacyRuntimeFile.digest,
      runtimeAgentName: legacyRuntimeFile.runtimeAgentName ?? member.runtimeAgentName,
    };
  }
  if (legacyRuntimeFile && runtime === 'claude' && nonEmptyString(legacyRuntimeFile.path)) {
    return {
      path: legacyRuntimeFile.path,
      digest: legacyRuntimeFile.digest,
      runtimeAgentName: legacyRuntimeFile.runtimeAgentName ?? member.runtimeAgentName,
    };
  }
  if (legacyRuntimeFile && runtime === 'codex' && nonEmptyString(legacyRuntimeFile.path)) {
    return {
      path: legacyRuntimeFile.path,
      digest: legacyRuntimeFile.digest,
      runtimeAgentName: legacyRuntimeFile.runtimeAgentName ?? member.runtimeAgentName,
    };
  }

  const runtimeFile = member.runtimeFiles?.[runtime];
  const runtimeFileDetail = member.runtimeFileDetails?.[runtime];

  return {
    path: typeof runtimeFile === 'string' ? runtimeFile : runtimeFile?.ref,
    digest: runtimeFile?.digest ?? runtimeFileDetail?.digest,
    runtimeAgentName: member.runtimeAgentNames?.[runtime]
      ?? runtimeFile?.runtimeAgentName
      ?? runtimeFileDetail?.runtimeAgentName
      ?? member.runtimeAgentName,
  };
}
