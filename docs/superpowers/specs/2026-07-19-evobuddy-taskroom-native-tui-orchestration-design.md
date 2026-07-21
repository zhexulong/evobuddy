# EvoBuddy TaskRoom Native-TUI Orchestration Design

## 0. Decision

EvoBuddy will be a **TaskRoom orchestration shell that launches and attaches to each runtime's native TUI**.

It will not become a replacement chat client for Claude Code, Codex CLI, OpenCode, Gemini CLI, or other agent runtimes. It will not embed arbitrary full-screen TUIs as Ratatui widgets in the MVP.

The product boundary is:

```text
EvoBuddy owns work coordination, continuity, attention, handoff, and evidence.
The native runtime owns conversation, tools, diffs, permissions, and runtime UX.
The terminal substrate owns PTYs, rendering, resize, scrollback, and attach/detach.
```

The user enters EvoBuddy to decide what work needs attention, opens or attaches to the relevant native agent session, performs runtime-specific interaction there, and detaches back to the same TaskRoom.

## 1. Why This Product Should Exist

Every major coding-agent runtime already has a capable interaction client. Rebuilding those clients would force EvoBuddy to duplicate:

- streaming conversation rendering;
- tool execution and shell output;
- patch and diff presentation;
- permission prompts and sandbox controls;
- structured questions;
- cancellation, history, compaction, and resume behavior;
- runtime-specific keyboard and mouse interaction.

Those capabilities change independently in every runtime. A universal reimplementation would be expensive, incomplete, and likely to lag the native clients.

EvoBuddy has a different product job:

- show work rather than a list of installed agents;
- organize work into durable TaskRooms;
- coordinate TeamAgents and Focused Buddies across runtimes;
- expose pending input, blocked work, returned results, and review loops;
- carry context and evidence across forks and handoffs;
- launch or resume the right native interaction surface;
- preserve honest runtime and proof boundaries.

The result is not "another Agent TUI." It is a cross-runtime workbench above existing Agent TUIs.

The MVP does not include a hidden or mandatory orchestrator. EvoBuddy does not interpret open-ended natural-language instructions and independently decide which agents to create, how to decompose the work, or how to advance a team workflow. Those decisions remain with the user, the current primary Agent, runtime-native team behavior, or an explicitly visible coordinator TeamAgent.

## 2. Authoritative Reference Baseline

Only high-adoption, actively maintained projects are retained as implementation references. Star counts below were queried from GitHub on 2026-07-19 and are snapshots, not permanent requirements.

| Reference | Stars at review | Role in the design | What EvoBuddy should copy | What EvoBuddy should not copy |
| --- | ---: | --- | --- | --- |
| [tmux](https://github.com/tmux/tmux) | 47,878 | MVP terminal substrate | Persistent server-owned sessions, PTY fidelity, attach/detach, session discovery, resize and scrollback behavior | tmux's raw session/window ontology as the product model |
| [Zellij](https://github.com/zellij-org/zellij) | 34,365 | Portability and future substrate reference | Explicit attached/detached lifecycle, session manager UX, resurrection model, Rust implementation patterns | A Zellij plugin dependency in the MVP |
| [cmux](https://github.com/manaflow-ai/cmux) | 24,772 | Terminal-native workspace and future macOS integration reference | Fast workspace focus, agent attention indicators, terminal-as-a-primitive philosophy | macOS-only architecture or rebuilding EvoBuddy as a terminal emulator |
| [Claude Squad](https://github.com/smtg-ai/claude-squad) | 8,141 | Task/session workflow reference | One task per isolated workspace, attach/detach loop, review-before-apply, simple command model | Session-first information architecture or Claude-centric naming |
| [Agent of Empires](https://github.com/agent-of-empires/agent-of-empires) | 2,842 | Primary Rust/Ratatui agent-session reference | Rust implementation approach, agent-aware state, tmux-backed persistence, worktrees, terminal handoff, diff and remote-ready boundaries | Treating an agent session as the first-level product object |

These five references are normative for subsequent implementation research. Lower-adoption projects may be consulted only as non-authoritative examples when a concrete engineering question is not answered by this baseline; they must not drive product scope or architecture.

### 2.1 Evidence that the pattern is established

The pattern is already proven:

- Claude Squad explicitly describes itself as a terminal application that manages multiple agent tasks, creates isolated tmux sessions and git worktrees, attaches with `Enter`, and detaches with `Ctrl+Q`.
- Agent of Empires runs every agent in its own tmux session, preserves those sessions when the dashboard or terminal closes, and detaches back to the TUI with `Ctrl+B d`.
- tmux provides the durable client/server PTY substrate instead of requiring the outer workbench to emulate a terminal.
- Zellij validates a modern Rust implementation of persistent attached/detached workspaces and session recovery.
- cmux validates the product principle that agent-native terminal interaction should remain a primitive instead of being hidden behind a generic chat wrapper.

EvoBuddy's opportunity is therefore not inventing native-TUI attach. Its differentiated layer is **TaskRoom continuity, cross-runtime coordination, explicit handoffs, and evidence-backed work state**.

## 3. Product Model

### 3.0 Compatibility With Workbench V0

The current read-only Workbench remains a compatibility and evidence-inspection surface. It must continue to render deterministic recorded artifacts without launching runtimes or mutating TaskRoom state.

TaskRoom Native-TUI Orchestration is the next interactive surface. It must use a separate command path, schema boundary, or explicit feature flag until real PTY launch/attach proof exists. Existing read-only evals must not be reclassified as launch/attach product proof.

Phase 1 may migrate the navigation language to TaskRoom-first, but it must not silently turn the existing read-only command into a mutating runtime launcher.

### 3.1 First-level object: TaskRoom

The home screen is a work inbox. Its first-level objects are TaskRooms, not runtime sessions or Agent definitions.

A TaskRoom answers:

```text
What outcome are we trying to produce?
Who is participating?
What is running or waiting?
What needs human attention?
What work was handed off?
What result and evidence returned?
```

A TaskRoom may contain multiple runtime sessions across multiple agents. A session is an execution facet of a TaskRoom participant, not the product identity of the room.

### 3.2 Agent definitions and runtime sessions

EvoBuddy must distinguish:

- `ActorDefinition`: durable TeamAgent or Focused Buddy identity and routing behavior;
- `AgentInstance`: one live or historical participant in a TaskRoom;
- `RuntimeSessionRef`: the runtime or terminal session that can be attached or resumed;
- `TaskRoom`: the durable work and coordination container.

One ActorDefinition may have many AgentInstances. An AgentInstance may use an existing native runtime session or launch a new one. Continuing a TaskRoom does not guarantee resuming the same operating-system process.

### 3.3 Work states

First-level states use work language:

| State | Meaning |
| --- | --- |
| `Queued` | Work exists but no runtime activity has been observed. |
| `Working` | At least one participant is actively executing. |
| `Needs input` | A participant is waiting for a human or parent decision. |
| `Needs review` | Work returned and requires review or acceptance. |
| `Blocked` | Runtime, permission, context, dependency, or evidence prevents progress. |
| `Returned` | A participant returned a result to its requester. |
| `Completed` | The TaskRoom outcome was accepted and the required evidence was recorded. |
| `Failed` | Execution ended without an acceptable result. |
| `Archived` | The room is retained but no longer active. |

Proof tiers and mechanism labels remain in Trace and Diagnostics. They never replace these work states.

## 4. Ownership Boundaries

### 4.1 EvoBuddy owns

- TaskRoom identity, objective, lifecycle, participants, rounds, and current owner;
- actor selection, fork, handoff, wake, return, review, and evolution relationships;
- normalized work state and attention queue;
- runtime selection and launch/attach routing;
- context packets used when creating or continuing sessions;
- runtime, process, terminal, and provider conversation references;
- result artifacts, evidence references, diagnostics, and trace;
- explicit choices that belong to EvoBuddy, such as runtime selection, adapter fallback, retry, continue/new session, or evolution-patch approval;
- recovery guidance when a terminal session or runtime conversation is unavailable.

### 4.2 Native runtime owns

- conversation rendering and editing;
- tool calls, command output, patches, and diffs generated during the session;
- runtime-native questions and permission prompts;
- model/runtime-specific plans, history, compaction, rewind, and resume;
- runtime sandbox and execution authorization;
- runtime-specific shortcuts, mouse behavior, and terminal layout.

### 4.3 Terminal substrate owns

- PTY creation and persistence;
- terminal escape sequences and alternate-screen behavior;
- keyboard and mouse forwarding while attached;
- terminal resize and `SIGWINCH` propagation;
- scrollback and pane/session lifecycle;
- attach/detach transport.

For the MVP, tmux is the only required substrate. The architecture must define a narrow substrate interface so Zellij or cmux routing can be added later without changing TaskRoom semantics.

## 5. System Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│ EvoBuddy Ratatui Workbench                                  │
│ TaskRooms · Attention · Actors · Handoffs · Evidence        │
└──────────────────────────────┬───────────────────────────────┘
                               │ TaskRoom actions
┌──────────────────────────────▼───────────────────────────────┐
│ Runtime Session Router                                      │
│ choose provider · build context · launch · attach · recover │
└───────────────┬──────────────────────┬───────────────────────┘
                │                      │
┌───────────────▼────────────┐  ┌──────▼───────────────────────┐
│ Terminal Substrate        │  │ Runtime Evidence Adapters    │
│ tmux MVP                  │  │ session refs · artifacts     │
│ Zellij/cmux future        │  │ result return · diagnostics  │
└───────────────┬────────────┘  └──────┬───────────────────────┘
                │                      │
┌───────────────▼──────────────────────▼───────────────────────┐
│ Native Runtime TUI                                          │
│ Claude Code · Codex · OpenCode · Gemini CLI · others        │
└──────────────────────────────────────────────────────────────┘
```

### 5.1 Runtime Session Router

The router translates an EvoBuddy action into a runtime and terminal action. It does not render native conversations.

Its input is a `RuntimeSessionIntent`:

```text
TaskRoom id
AgentInstance id
runtime/provider
workspace cwd
launch mode: new | attach | resume | continue-with-context
provider conversation ref, if known
terminal session ref, if known
context packet ref
safety mode
expected evidence/export path
recovery hint
```

Its output records one of:

```text
launched and attached
attached to existing terminal session
resumed provider conversation in a new terminal session
started a new provider conversation with TaskRoom context
blocked with an actionable reason
```

### 5.2 Terminal substrate interface

The TaskRoom layer must not directly issue scattered tmux commands. It depends on a small interface:

```text
probe()
create_session(descriptor)
attach_interactive(session_ref) -> AttachOutcome
inspect(session_ref)
list_sessions(scope)
terminate(session_ref)
```

`detach` is normally a user action inside the attached terminal, not a command issued by the suspended EvoBuddy process. An optional `detach_client(client_ref)` may exist for externally managed clients, but it is not part of the normal launch/attach flow.

`AttachOutcome` is one of:

```text
detached
session-ended
attach-failed
interrupted
```

The router refreshes TaskRoom state from this outcome and from subsequent runtime evidence.

`inspect` returns substrate facts, not Agent semantics:

```text
exists
attached client count
child process alive
last activity time
exit state, when known
```

Agent-specific state is derived separately from runtime hooks, exporters, provider protocols, or explicit evidence. Screen scraping is not release-grade evidence.

### 5.3 Session descriptor

Every managed runtime session has a durable descriptor:

```text
descriptorVersion
taskRoomId
agentInstanceId
runtime
workspace
terminalSubstrate
terminalSessionRef
providerConversationRef
launchCommandRef
createdAt
lastAttachedAt
safetyMode
evidenceRefs[]
recoveryPolicy
```

Secrets and raw authentication tokens must not be serialized in the descriptor. Environment construction remains runtime-adapter responsibility.

### 5.4 Session naming

Session names are derived, human-readable, collision-resistant, and never treated as durable identity:

```text
evb-<project-slug>-<taskroom-short-id>-<actor-slug>-<instance-short-id>
```

The durable identity is the descriptor and TaskRoom record. A user may rename a display label without invalidating the underlying relationship.

### 5.5 Atomic session lifecycle

Each `AgentInstance` has a per-instance lifecycle lock. Launch and attach operations for the same instance cannot run concurrently.

Creation uses a two-phase descriptor lifecycle:

1. reserve a descriptor with `creating` state;
2. create the substrate session;
3. verify the child process and runtime facts;
4. record the terminal session reference;
5. mark the descriptor `attachable` only after verification succeeds.

Startup reconciliation and failed-launch cleanup classify substrate sessions as `matched`, `orphaned`, `conflicted`, or `stale` before any new launch is allowed for that instance. A descriptor write failure after substrate creation must leave an orphan diagnostic and must not trigger an unverified duplicate launch.

## 6. Main TUI Design

### 6.1 Work inbox

The main screen prioritizes work requiring action:

```text
┌ EvoBuddy ─ Work ─────────────────────────────────────────────┐
│ Needs input  2   Needs review  1   Working  4   Blocked  1 │
├ TaskRooms ───────────────────┬ Selected TaskRoom ────────────┤
│ ▲ Login regression       2m │ Goal: restore login flow      │
│ ● Release readiness      8m │ Participants                  │
│ ◆ Skill trigger review  14m │  ● builder   Codex   working │
│ ! Runtime proof         22m │  ▲ reviewer Claude needs input│
│                            │                               │
│                            │ [Enter] Open selected session │
│                            │ [h] Handoffs  [e] Evidence    │
├─────────────────────────────┴───────────────────────────────┤
│ Enter Open  n New room  h Handoff  / Search  : Commands   │
└─────────────────────────────────────────────────────────────┘
```

The list sorts by actionable attention first, then recent activity. Status alone does not claim proof; the detail and trace expose evidence quality.

### 6.2 TaskRoom detail

TaskRoom detail contains:

- objective and acceptance criteria;
- participants grouped by role, not by terminal process;
- active, waiting, returned, and historical instances;
- current round and review continuity;
- pending and completed handoffs;
- latest result summary;
- evidence and trace entry points;
- runtime action for each participant.

Participant actions are explicit:

```text
Open native runtime
Attach existing session
Resume provider conversation
Continue with TaskRoom context
Start new runtime session
View evidence
Mark blocked
Stop session
```

The interface never labels a heuristic continuation as an exact resume.

### 6.3 Contextual action bar and on-demand input

All primary screens show a **contextual action bar**, not a persistent text input. The bar exposes the valid actions for the current focus and makes immediate user actions discoverable without implying that EvoBuddy contains a natural-language orchestrator.

Examples:

```text
TaskRoom list:
Enter Open  n New room  / Search  f Filter  : Commands  ? Help

TaskRoom detail:
Enter Open agent  a Add participant  h Handoff  e Evidence  Esc Back

AgentInstance detail:
Enter Attach  r Resume  c Continue with context  x Stop  Esc Back
```

Text input appears only after the user invokes an action with an explicit scope:

| Trigger | Input surface | Destination and effect |
| --- | --- | --- |
| `/` | temporary search field | filters visible TaskRooms or participants; no runtime mutation |
| `:` | deterministic command palette | executes a known EvoBuddy command with completion and validation |
| `n` | structured TaskRoom form | records objective, workspace, participant/runtime choice, and creation action |
| `h` | structured handoff form | records sender, receiver, body, artifacts, expected next action, and return destination |
| EvoBuddy question | inline structured answer control | answers only the displayed EvoBuddy-owned choice |

The command palette accepts defined commands such as `attach reviewer`, `filter needs-input`, `open evidence`, or `archive room-12`. It is not an open-ended natural-language planning surface.

Free-text fields inside forms remain valid where the field meaning and destination are explicit, such as a TaskRoom objective or handoff body. EvoBuddy records those values; it does not infer a team plan from them.

Open-ended conversation with an Agent, including a future coordinator, always occurs in that member's native runtime TUI. Generic text must never be silently delivered to whichever session happens to be selected.

### 6.4 Structured questions

There are two question classes.

**EvoBuddy-owned questions** appear inline in the Workbench and follow the Grok Build interaction pattern:

- short question and context;
- numbered choices;
- `1-9` direct selection;
- arrow navigation plus `Enter`;
- free-text answer where applicable;
- visible effect and cancellation path.

Examples include selecting a runtime, choosing exact resume versus new session, accepting adapter fallback, retrying a blocked launch, or approving an evolution patch.

**Runtime-owned questions and permissions** remain in the native TUI. EvoBuddy shows `Needs input in Claude`, `Permission required in Codex`, or another source-qualified attention state, then offers `Open session`.

### 6.5 Orchestrator and coordinator boundary

There is no mandatory orchestrator in the MVP.

Coordination may be performed by:

- the user through explicit TaskRoom actions and structured forms;
- the current primary Agent using EvoBuddy's projected commands and records;
- runtime-native team behavior where it can be observed honestly;
- an optional `coordinator` TeamAgent.

If a coordinator exists, it is a normal, visible Agent Team member with an ActorDefinition, AgentInstance, runtime, safety mode, TaskRoom participation, native TUI, and evidence trail. It is not a hidden service behind the Workbench action bar. The user communicates with it by opening or attaching to its native runtime session.

The Workbench itself never silently assumes coordinator authority, selects agents from an open-ended prompt, or advances a multi-agent workflow without an explicit user, primary-Agent, runtime-native, or visible-coordinator action.

## 7. Launch, Attach, Detach, and Return Flow

### 7.1 New session

```text
User selects TaskRoom participant
-> EvoBuddy validates runtime and tmux availability
-> router creates session descriptor
-> runtime adapter builds command, cwd, environment, context, and safety mode
-> tmux creates the persistent session
-> descriptor records terminal session ref
-> EvoBuddy suspends its terminal UI and attaches
-> native TUI owns input
```

The attach operation must use a `TerminalModeGuard`. Before invoking interactive attach, EvoBuddy must flush the current frame, disable raw mode, leave the alternate screen, show the cursor, and then invoke the substrate attach command. On every normal return and error path, the guard must re-enter the alternate screen, enable raw mode, clear/redraw the workbench, and restore the cursor state. If restoration fails, EvoBuddy must emit an actionable terminal-recovery diagnostic rather than continuing with an unverified UI state.

### 7.2 Detach and return

The MVP adopts the proven tmux detach mechanism. EvoBuddy displays the exact detach shortcut before entering the session and in the managed tmux status line.

Required behavior:

- detach returns to the suspended EvoBuddy process;
- detach never stops the Agent process;
- EvoBuddy refreshes TaskRoom state immediately after return;
- the previous TaskRoom and participant selection remain focused;
- failure to re-enter raw terminal mode must not leave the shell corrupted.

The default shortcut should remain compatible with tmux (`Ctrl+B d`) unless implementation testing proves that a dedicated no-prefix key is safer. EvoBuddy must not invent a global escape key that breaks native runtime input without evidence.

### 7.3 Existing live session

If the terminal session exists and its child process is alive, `Open native runtime` attaches to it. It must not launch a duplicate.

### 7.4 Stopped terminal, resumable provider conversation

If the terminal session no longer exists but the provider conversation has an exact resume identity, EvoBuddy creates a new terminal session and runs the provider's exact resume command.

If only heuristic resume is available, the UI must say so and require an explicit user choice when more than one candidate conversation could exist.

### 7.5 No resumable session

EvoBuddy creates a new runtime conversation with a TaskRoom context packet containing:

- objective and acceptance criteria;
- actor role and assignment;
- relevant prior summaries and handoffs;
- artifact paths and evidence refs;
- expected return destination;
- explicit known losses.

This is `Continue with TaskRoom context`, not `Resume same session`.

### 7.6 Runtime capability matrix

The router must use a per-runtime capability descriptor. It must not infer resume behavior from a display name or from the existence of a transcript.

| Runtime | New command | Exact resume identity source | Exact resume command | Heuristic candidate source | Needs-input source | Result/evidence source | MVP rule |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OpenCode | runtime adapter launch command | observed provider session/root conversation ref when available | runtime-specific exact session command when the ref is validated | provider latest-session discovery only when explicitly supported | stable runtime/exporter signal, otherwise `Unknown` | exporter/session artifacts and TaskRoom handoff records | exact resume only when the provider ref is validated; otherwise context continuation |
| Claude Code | runtime adapter launch command | provider session id when observed and bound to the AgentInstance | provider-specific resume command using that id | provider continue/latest behavior | stable hook/protocol signal when available | runtime/exporter artifacts and explicit return record | never label heuristic continuation as exact resume |
| Codex CLI | runtime adapter launch command | provider session ref only when observed and validated | provider-specific exact resume when supported by installed CLI | latest/continue behavior, if available | stable app-server or exporter signal when available | app-server/exporter artifacts and explicit return record | if exact identity is unavailable, offer context continuation only |
| Gemini CLI | runtime adapter launch command | provider session ref only when observed and validated | provider-specific exact resume when supported | latest/continue behavior, if available | stable runtime signal when available | runtime/exporter artifacts and explicit return record | unsupported capability is shown as blocked or context continuation |

The exact command and evidence-source fields are adapter-owned and version-checked during capability probing. A runtime with no validated exact identity cannot expose an `Exact resume` action.

## 8. Attention and Status

Status must be derived from the strongest available source in this order:

1. runtime-native hook or stable protocol event;
2. runtime exporter/session evidence;
3. terminal process lifecycle and activity;
4. bounded terminal-pattern hint;
5. unknown.

Terminal pattern matching may drive a provisional attention hint but cannot prove task completion, exact permission state, result return, or product-quality runtime behavior.

Every status record includes:

```text
state
source kind
source ref
observedAt
confidence
staleAfter
```

A stale state is visibly downgraded rather than presented as current.

## 9. Handoffs and Evidence Loop

Launch/attach alone would be only a session switcher. EvoBuddy becomes a TaskRoom coordination workbench by closing the evidence loop; this does not imply a hidden intelligent orchestrator.

After detach, runtime exit, exporter update, or explicit return:

1. EvoBuddy refreshes runtime and terminal facts.
2. It ingests available result, artifact, and session evidence.
3. It updates the AgentInstance and TaskRoom work state.
4. It records returned-to and handoff relationships.
5. It surfaces the next action: review, continue, retry, apply, or archive.

An `AgentInstance` is not marked `Returned` solely because its terminal became idle. Returned requires a result or handoff record with a destination. A TaskRoom is not marked `Completed` solely because all processes exited. Completion requires accepted outcome evidence defined by the room.

Fork and handoff remain durable product records. The TaskRoom state must preserve `ForkRecord` and `HandoffRecord` compatibility with `2026-07-19-evobuddy-fork-handoff-team-design.md` sections 2.2, 2.3, and 9.1. A terminal session, provider conversation, or transcript may be attached as evidence to those records, but cannot replace them. A visible terminal handoff without a durable sender, receiver, TaskRoom, message/artifact refs, expected next action, and return destination is not product-observed handoff proof.

## 10. Failure and Recovery

### 10.1 Missing tmux

The MVP blocks launch/attach with an installation diagnostic. It may still show recorded TaskRooms and evidence in read-only mode.

### 10.2 Session name collision

The router inspects the existing session descriptor. If ownership matches, it attaches. If ownership differs or cannot be verified, it generates a new substrate name and records the conflict diagnostic.

### 10.3 Terminal session exists but child Agent died

The session is shown as `Stopped` or `Failed`, not `Working`. The user may inspect evidence, restart with exact resume, or continue with context.

### 10.4 Descriptor exists but terminal session is missing

EvoBuddy marks the terminal ref orphaned, retains it as trace evidence, and chooses exact resume, heuristic resume, or context continuation according to provider capabilities.

### 10.5 EvoBuddy crashes while Agent continues

The tmux session remains authoritative for PTY liveness. On restart, EvoBuddy reconciles descriptors with substrate sessions and restores TaskRoom links.

### 10.6 Attach failure or terminal corruption

EvoBuddy restores terminal mode before showing the error. The failure record contains the attempted action, substrate ref, exit status, and recovery command. It must never kill the Agent merely because the client attach failed.

## 11. Security and Permission Model

- EvoBuddy never auto-approves runtime-native permission prompts unless the user selected a runtime safety mode that explicitly allows it.
- Launch descriptors store references and policy, not secret values.
- Environment variables and credentials are assembled by runtime adapters at launch time.
- Attach gives the user direct control of a powerful native runtime; the TaskRoom must show the selected safety mode before launch.
- Screen scraping must never be used to auto-answer permission prompts.
- Automated orchestration may send a wake or task handoff only through an explicit runtime adapter with a target-specific delivery contract. Raw terminal input and `send-keys` are not MVP orchestration channels or permission bypasses.
- For the MVP, EvoBuddy excludes terminal text injection. User-initiated attach is the only interactive path into a native runtime. Future runtime-scoped sending requires stable protocol support or, at minimum, foreground-process verification, exact TaskRoom/session target display, an audit record, and a hard prohibition on handling permission or credential prompts.
- Termination actions distinguish detach, stop Agent, close terminal session, and archive TaskRoom.
- Destructive lifecycle actions require confirmation and state the effect on process, provider conversation, worktree, and evidence.

## 12. MVP Scope

### 12.1 Included

- TaskRoom-first work inbox and detail flow;
- participants with runtime and terminal session facets;
- tmux capability probe;
- create, inspect, attach, detach, list, and terminate through a substrate adapter;
- runtime-specific launch descriptors for the initially supported runtimes;
- exact wording for attach, exact resume, heuristic resume, and continue-with-context;
- return to the same TaskRoom after detach;
- worktree-aware cwd selection where already available;
- attention states with source and staleness;
- evidence refresh after detach and runtime lifecycle changes;
- contextual action bars on primary screens;
- on-demand scoped search, command, TaskRoom creation, handoff, and structured-answer inputs;
- inline EvoBuddy-owned structured questions;
- trace and diagnostics for substrate and runtime boundaries.

### 12.2 Excluded

- re-rendering native Agent conversations in Ratatui;
- embedding arbitrary TUIs as widgets;
- building a general terminal emulator;
- universal runtime chat injection;
- persistent open-ended Workbench text input;
- hidden or mandatory orchestrator behavior;
- proxying native permission or Ask Question flows;
- screen scraping as release evidence;
- Windows-native PTY management;
- requiring Zellij or cmux in the MVP;
- web or mobile terminal streaming;
- replacing runtime-native session history.

## 13. Phased Evolution

### Phase 1: Workbench correction

Make TaskRooms and attention the first-level UI. Replace actions that imply fake execution with explicit orchestration actions and honest blocked states.

### Phase 2: tmux launch/attach MVP

Implement the substrate adapter and runtime session router. Prove launch, attach, detach-return, no-duplicate attach, and crash reconciliation with real native Agent TUIs.

### Phase 3: Evidence loop

Connect runtime exporters and TaskRoom records so returned results, handoffs, blocked state, and completion are evidence-backed rather than inferred from terminal idleness.

### Phase 4: Runtime capability refinements

Add exact provider resume where supported, source-qualified needs-input events, runtime-scoped message APIs where stable, and per-runtime diagnostics.

### Phase 5: Additional substrates

Consider Zellij for terminal-centric Rust users and cmux workspace focus on macOS. Additional substrates must implement the same interface and must not alter TaskRoom identity or evidence semantics.

### Phase 6: Optional supervised terminal mode

Only after measured launch/attach usage demonstrates unacceptable switching cost may EvoBuddy evaluate a PTY-host or terminal-emulator mode. That work is a separate design and must not be smuggled into a Ratatui widget.

## 14. Behavior Evaluation

### 14.1 Concrete examples

#### Example A: launch a new Codex participant

Given a TaskRoom with no Codex session, selecting `Open native runtime` creates one tmux session, starts Codex in the correct workspace with the TaskRoom assignment, attaches the user's terminal, and returns to the same TaskRoom on detach.

#### Example B: attach an existing Claude session

Given a live managed Claude tmux session, selecting `Open native runtime` attaches to that session and does not spawn another Claude process.

#### Example C: runtime asks for permission

Given a runtime-native permission prompt observed through a reliable hook or protocol, EvoBuddy marks the participant `Needs input in <runtime>` and routes the user to the native session. EvoBuddy does not reproduce or answer the permission prompt.

#### Example D: tmux survives EvoBuddy exit

Given a working Agent session, quitting or crashing EvoBuddy does not stop the Agent. Restarting EvoBuddy reconciles the session to the original TaskRoom.

#### Example E: terminal lost, exact resume available

Given a missing tmux session and a known exact provider conversation ref, EvoBuddy labels the action `Resume conversation`, creates a new terminal session, and resumes that exact provider conversation.

#### Example F: terminal lost, exact resume unavailable

Given only prior TaskRoom evidence, EvoBuddy labels the action `Continue with TaskRoom context`; it does not claim session resume.

#### Example G: idle is not returned

Given an idle native TUI with no result-return artifact, EvoBuddy may show `Idle` in the runtime facet but does not mark the participant `Returned` or the TaskRoom `Completed`.

### 14.2 Invariants

- A TaskRoom id does not depend on a terminal or provider session id.
- Detach never means stop.
- Attach never silently creates a duplicate live session.
- Exact resume is claimed only with an exact provider identity.
- Native permissions remain native-runtime-owned.
- First-level work state remains separate from proof and trace state.
- Terminal output alone cannot prove a returned result or completed TaskRoom.
- Every runtime action names its target participant, runtime, workspace, and safety mode.
- Every text entry surface names its destination and effect before submission.

### 14.3 Failure signals

- two live sessions are created for one attach action;
- detaching kills or suspends the Agent;
- returning from attach loses the previous TaskRoom selection;
- EvoBuddy terminal rendering remains in raw or alternate-screen mode after an error;
- an idle prompt is shown as completed work;
- a heuristic continuation is labeled resume;
- a runtime permission is answered by generic Workbench input;
- an open-ended Workbench prompt silently creates participants or advances workflow;
- TaskRoom state cannot be reconciled after EvoBuddy restarts;
- native Agent shortcuts or full-screen rendering are corrupted by attach handling.

### 14.4 Observable evidence and acceptance oracle

Acceptance requires real PTY tests, not only reducer snapshots:

- process tree proves the intended native runtime is running inside the managed tmux session;
- tmux session inspection proves persistence after EvoBuddy detaches or exits;
- attach/resize/input tests demonstrate full-screen native TUI fidelity;
- session counts prove attach does not duplicate;
- TaskRoom records retain stable participant links across EvoBuddy restart;
- runtime/exporter artifacts prove result return and handoff where claimed;
- negative controls prove idle terminal output cannot satisfy completion;
- terminal mode checks prove the shell is restored after normal detach and attach failure.
- lifecycle tests cover duplicate concurrent opens, descriptor failure after substrate creation, orphan reconciliation, child exit during attach, and panic/error-path terminal cleanup.

### 14.5 Correction path

If real PTY testing fails, fix the launch/attach boundary or substrate adapter. Do not compensate by recreating the Agent interaction UI. If a runtime cannot expose reliable attention or result evidence, display `Unknown` or `Needs review` and document the capability gap. If tmux cannot support a required target environment, evaluate another substrate through a separate design rather than weakening TaskRoom semantics.

## 15. Reject Criteria

Reject a full unified runtime client until all target runtimes provide stable, documented APIs for messages, tool calls, permissions, structured questions, cancellation, session resume, and artifacts.

Reject arbitrary embedded native TUIs in the MVP if implementation requires EvoBuddy to own VT parsing, alternate-screen emulation, mouse mode arbitration, clipboard semantics, or nested terminal rendering.

Reject generic message injection when the target session, permission boundary, or delivery evidence cannot be made explicit.

Reject terminal-derived completion when there is no result-return or acceptance evidence.

Reject any design that makes tmux sessions the first-level product object. tmux is infrastructure; TaskRoom is the user-facing work object.

## 16. Implementation Direction

The next implementation plan should use the retained references as follows:

1. **Agent of Empires** for Rust/Ratatui structure, tmux-backed session persistence, runtime support boundaries, worktree integration, and terminal handoff.
2. **Claude Squad** for the minimal task/session creation flow, isolated workspace model, attach/detach interaction, and review-before-apply workflow.
3. **tmux** as the MVP PTY and attach/detach substrate, using its public command/control behavior rather than copying internals unnecessarily.
4. **Zellij** for the substrate abstraction, explicit detached/resurrectable lifecycle vocabulary, and later Rust-native backend design.
5. **cmux** for future macOS workspace-focus integration and attention UX, not for the cross-platform MVP.

Implementation must remain incremental: TaskRoom UI correction first, substrate interface second, one-runtime real PTY proof third, then broader runtime coverage and evidence integration.
