const NON_GENUINE_TEXT_RE = /(?:^|\b)(?:search result|web search|tavily|browser|tool output|tool result|stdout|stderr|file output|file write|writefile|apply_patch|stack trace|traceback|http[s]?:\/\/|```|<html|markdown|"results"\s*:|"request_id"\s*:|"response_time"\s*:|"query"\s*:|\[search-mode\]|\[analyze-mode\]|<command-instruction\b|<user-task\b|ralph loop|delegate_task\s*\(|run_in_background\s*=\s*true|load_skills\s*=\s*\[\]|▣\s*dcp|▣\s*compression|compression\s*#\d+|compressed conversation section|dcp-message-id|dcp-system-reminder|→\s*topic\s*:|→\s*items\s*:|█{4,}|\b\d{1,3}%\s*(?:complete|progress)?)/i;
const WORKFLOW_WRAPPER_RE = /(?:\[search-mode\]|\[analyze-mode\]|<command-instruction\b|<user-task\b|ralph loop|delegate_task\s*\(|run_in_background\s*=\s*true|load_skills\s*=\s*\[\])/i;

export function sourceLooksNonGenuineEvidence(text) {
  return NON_GENUINE_TEXT_RE.test(String(text ?? ''));
}

export function sourceLooksWorkflowWrapper(text) {
  return WORKFLOW_WRAPPER_RE.test(String(text ?? ''));
}
