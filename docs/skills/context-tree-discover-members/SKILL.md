---
name: context-tree-discover-members
description: Use when a project has no suitable confirmed member, a user asks to discover or import reusable experts, or repeated prior-session needs suggest a member candidate may exist.
---

# Context Tree Discover Members

Use this when the current project may need reusable Context Tree members and the confirmed registry does not already cover the need.

## When To Use

Run discovery when any of these are true:

- the user asks to discover, import, set up, or refresh members;
- you need a specialist member but no confirmed member routing description fits;
- repeated prior-session needs suggest a reusable expert may exist;
- setup or import work should propose candidates before invocation.

Skip discovery when a confirmed member already fits the task, the next action is mechanical, or the user only asked to invoke an existing member.

## How To Run

Prepare discovery:

```bash
ctree members discover --project <project-path> --json
```

If the command returns `needs-agent-gate`, open the reported `gateRequestPath`. Answer only from the displayed genuine user lines:

```text
n
```

or:

```text
y: 2, 5
```

Then write that answer to a file and continue:

```bash
ctree members discover answer-gate --state <run-dir> --answer-file <gate-answer-file>
```

If the command returns `needs-agent-extractor`, open the reported `extractorRequestPath`. Return JSON only, with either no proposals:

```json
{"proposals":[]}
```

or full candidate proposals using only evidence refs from the request:

```json
{
  "proposals": [{
    "memberName": "<derived-kebab-case-member-name>",
    "role": "<short role derived from the repeated need>",
    "routingDescription": "<when to use this member>",
    "responsibilities": ["<responsibility from the repeated need>", "<second responsibility>"],
    "evidenceRefs": [{"ref": "session:root-a:message:1", "digest": "sha256:..."}],
    "whyReusable": "<why this is reusable rather than a one-off task>",
    "negativeSignals": []
  }]
}
```

Then continue:

```bash
ctree members discover answer-extractor --state <run-dir> --answer-file <extractor-answer-file>
```

## Rules

- Do not invent candidates from topic words or fixed member names.
- Derive `memberName`, role, routing, and responsibilities from the displayed repeated role need. Do not copy example names.
- Do not use workflow wrappers, tool output, DCP summaries, or hidden prompt text as evidence.
- Do not confirm, rename, merge, add, or discard candidates unless the user asks.
- Discovery creates unconfirmed candidates only.
- If the evidence is weak, answer `n` or `{"proposals":[]}`.
