# Member Utility Discovery Design

## Goal

Define member discovery around product utility: finding work that is worth moving out of the main agent's immediate context and into a reusable, delegable member with stable role context and memory.

This spec replaces the narrower question “can we find a member pattern in transcript lines?” with the product question “which recurring work would become cheaper, more reliable, or less context-heavy if a dedicated member handled it?”

## Core Product Benefits

Member exists for two primary benefits.

### 1. Reduce Main-Agent Context Burden

The main agent should not repeatedly spend context and attention reconstructing the same specialist background:

- how to judge a class of artifacts;
- what the user has repeatedly rejected or preferred for that class of work;
- what reference systems or repo conventions matter;
- what proof/eval boundary must be enforced;
- what mistakes have already happened in similar work.

A useful member lets the main agent delegate that work and receive a concise result, instead of loading the whole historical context into the main thread every time.

### 2. Stabilize Repeated Specialist Judgment

Some work benefits from a stable reviewer/designer/maintainer role because the same standards recur across tasks. A member should make those standards persistent and callable.

Examples in this project family:

- eval proof reviewer: distinguishes retained, hermetic, live, product, and observed proof boundaries;
- skill designer: applies superpowers-style skill writing constraints and trigger-language standards;
- member memory maintainer: applies memory candidate, promotion, and visibility rules;
- UI/workbench reviewer: keeps Workbuddy-style member surface decisions consistent;
- product-entry reviewer: checks whether a proposed entry is natural for a real parent-agent session.

## Mechanisms That Are Not Primary Benefits

These are implementation/product mechanisms, not the reason member exists:

- **Natural delegation by the main agent.** This is a required usage path. It is not the benefit itself.
- **Returning concise results to the parent agent.** This is the integration shape. It is not the benefit itself.
- **Cold-start discovery.** This is one way to bootstrap useful members. It is not the value proposition.
- **Workbench/TUI visibility.** This helps users inspect/manage members. It is not the core utility.

## What Counts as a Member

A member is a reusable role agent that can be invoked by the main agent or user-facing workflow to perform a bounded class of work using role-specific context and memory.

A member must have:

- `memberName`: stable, kebab-case identifier for projection and invocation;
- `role`: short role description;
- `responsibilities`: what the member does;
- `nonResponsibilities`: what the member must not own;
- `whenToUse`: invocation conditions from the main agent's perspective;
- `contextPack`: the material this member should see by default;
- `memoryPolicy`: what kind of durable memory belongs to this member;
- `returnContract`: what concise result returns to the parent agent;
- `evidenceRefs`: session/run/artifact evidence showing why this member is useful.

## Member Classes

### Class 1: Explicit Repeated Teammate

This is rare. It exists only when history shows repeated explicit invocation of the same subagent/member-like role for the same class of work and with stable requirements.

A single mention such as “let X review this” is not enough. A valid explicit repeated teammate requires evidence such as:

- repeated user or agent invocations of the same role/member/subagent;
- repeated work type;
- stable expectations for how that role should judge or respond;
- evidence that reusing the role would reduce future main-agent context load.

### Class 2: Repeated Specialist Work

This is expected to be the most common valuable class.

The user may never name a member, but session history shows repeated high-context work of the same kind. The question is not whether the user asked for an expert; the question is whether a reusable expert would reduce repeated context reconstruction.

Signals include:

- recurring artifact review with the same proof or quality standards;
- repeated implementation-plan review for the same subsystem type;
- repeated corrections showing stable preferences;
- repeated references to the same external project, repo convention, or workflow;
- recurring task type where the main agent must remember specialized criteria.

### Class 3: Long-Lived Context Owner

This member owns a stable slice of project/user context that is repeatedly needed across tasks.

Examples:

- a skill-design context owner that remembers how this user wants skills described;
- an eval-proof context owner that remembers what counts as product proof;
- a memory-evolution owner that remembers what may become durable member memory.

This class may be discovered from repeated corrections/preferences even when no explicit role name appears.

## Discovery Question

The cold-start discovery question should be:

> Does this history contain recurring work that would be cheaper, more reliable, or less context-heavy if delegated to a reusable member with stable context and memory?

It should not be only:

> Do these lines explicitly express a reusable member/expert/team-role need?

That old question is too narrow. It misses repeated specialist work where the user never says “make a member”.

## Discovery Inputs

Discovery should be grounded in a chronological project event stream. Session grouping remains important, but it is a provenance/view layer rather than the canonical organization.

The reason is product behavior: useful member patterns often form across sessions. One session may introduce a candidate responsibility, another may correct its boundary, a third may use it, and a later session may prove that the routing or return contract needs to change. If discovery only sees independent session buckets, it can miss the interaction among those events.

The canonical input should therefore be:

```text
ProjectEventStream
  -> SessionEpisodeView
  -> MemberTimelineView
  -> WorkstreamTimelineView
```

### Project Event Stream

Each event should be globally ordered by observed time and carry enough provenance to reconstruct session-local context when needed:

- `eventId` and stable source digest;
- `timestamp` / ordering key;
- `runtime`: `opencode`, `codex`, `claude-code`, or another adapter;
- `projectIdentity`;
- `sessionId`;
- optional `parentSessionId`, `subagentId`, `memberName`, or `candidateId`;
- `eventKind`: user message, assistant summary, member invocation, member result, import decision, correction, artifact review, setup/import action, or discovery/dream output;
- genuine user text or filtered summary text when applicable;
- references to artifacts/tool outputs when they are review targets, not raw model input;
- source authority and coverage metadata.

Events are the durable audit spine. They answer “what happened, in what order, and from which runtime/session did it come?”

### Views Over the Stream

`SessionEpisodeView` groups adjacent events from one session so the model can inspect local context. It should not be the only discovery unit.

`MemberTimelineView` groups evidence, corrections, invocations, warnings, and setup/import decisions for one candidate/member. It is the primary view for deciding whether a member is becoming more useful, drifting, overlapping, or stale.

`WorkstreamTimelineView` groups events by long-lived project/workstream when a candidate is a `long-lived-context-owner`. This prevents context-owner candidates from being judged as isolated proof/review artifacts.

### Session Episodes

Session episodes are still useful model input. A `MemberUtilityEpisode` should include:

- runtime: `opencode`, `codex`, or `claude-code`;
- session id / root or subagent status;
- session title or recap when available;
- selected genuine user messages;
- relevant assistant summary when available;
- related tool/artifact refs when they are the target of review, not raw tool-output noise;
- evidence of correction, repeated review, repeated delegation, or repeated standards;
- coverage metadata from multi-runtime coverage proof.

Flat user lines remain useful as raw evidence, but discovery should not stop at flat lines or independent session buckets. It should build chronological windows and then render the appropriate view for the model task.

### Reference Lessons

This design follows two reference lessons, without depending on either implementation as a product contract:

- Claude Code Auto Dream, as described in the local third-party reference, treats dream as consolidation over existing memory plus recent signal. It orients on current memory, gathers targeted transcript signal, merges overlapping entries, resolves contradictions, and keeps the startup index compact. It is not a “read only today's transcript” pass.
- Magic Context uses a stronger engineering pattern: scheduled dream tasks, content watermarks separate from run timestamps, overlap around watermarks, deterministic write-path deduplication, semantic/embedding consolidation, leases, and successful-run-only advancement. Its retrospective task explicitly scans new project messages since a content watermark and includes pre-watermark overlap so patterns crossing run boundaries are not missed.

## Discovery Pipeline

### Stage 0: Runtime Export and Event Normalization

Input: runtime/session exports from supported adapters plus existing member/import/run artifacts.

Output: `member-discovery-event-stream.json`.

Responsibilities:

- normalize OpenCode/Codex/Claude session records into one chronological stream;
- preserve runtime/session/source provenance instead of collapsing events into anonymous transcript text;
- preserve parent/subagent/member/run relationships when the adapter exposes them;
- tag event kinds so later stages can distinguish user correction, member invocation, member result, setup/import decision, artifact review, and ordinary task text;
- keep deterministic event IDs and source digests for later audit;
- record coverage limits and adapter gaps.

The event stream is append-only. Later dream runs should add new events and derived discovery events, not rewrite past runtime facts.

### Stage 1: Pre-Agent Evidence Hygiene and Window Builder

Input: `member-discovery-event-stream.json` plus multi-runtime coverage metadata.

Output: chronological discovery windows and view artifacts, including `member-utility-episodes.json` when session views are useful.

Responsibilities:

- preserve runtime/source/session provenance;
- group events into chronological windows, session episodes, member timelines, and workstream timelines;
- include root/subagent/cap limitation metadata;
- remove workflow wrappers/tool-output-like noise from candidate evidence before any agent/model gate or extractor sees it;
- keep enough context for model judgment without claiming complete history.

This stage owns input hygiene. Tool output, workflow prompts, system reminders, compression/progress summaries, internal initiators, and assistant-generated handoff text should not be treated as model-review evidence and should not be present in the agent's discovery input except as exclusion diagnostics.

The window builder should favor chronological continuity over isolated session buckets. It may render a session episode to the model, but that episode should carry neighboring prior/later anchors when those anchors affect the same candidate/member/workstream.

### Stage 2: Utility Gate

Input: chronological discovery windows and rendered views.

Output: high-recall utility verdict.

The utility gate asks whether any chronological window, session episode, member timeline, or workstream timeline suggests recurring work suitable for member delegation.

The gate should optimize for recall. A false positive can be rejected later by extraction/validation. A false negative prevents discovery entirely.

Expected output shape:

```json
{
  "hasDelegationOpportunity": true,
  "eventRefs": ["event:..."],
  "viewRefs": ["timeline:...", "episode:..."],
  "reason": "Repeated eval proof review consumes context and requires stable proof-boundary judgment."
}
```

A `false` result is valid only for the covered event windows/views. It must carry coverage limitations.

### Stage 3: Member Proposal Extractor

Input: flagged event windows and rendered views.

Output: member proposals.

Each proposal must explain:

- proposed `memberName`;
- class: `explicit-repeated-teammate`, `repeated-specialist-work`, or `long-lived-context-owner`;
- role/responsibilities/non-responsibilities;
- when the main agent should invoke it;
- what context/memory it needs;
- how it reduces main-agent context burden;
- evidence refs;
- why this is reusable rather than a one-off task.

Evidence refs should point to events or source-backed view anchors. Session refs are allowed as provenance, but the proposal should remain auditable against the chronological event stream.

### Stage 4: Contract Validator

Input: proposals.

Output: contract-valid member profile candidates, warnings, and contract-rejected proposals.

The validator is not another semantic reviewer. It should not decide whether a proposed member is “good enough” by reinterpreting the same event windows/views the agent/model already judged. Its job is to enforce product and evidence contracts that must be stable and deterministic.

Hard-reject only when a proposal violates contract boundaries:

- evidence refs do not resolve to the filtered event stream or source-backed view anchors;
- evidence digests do not match;
- evidence comes from non-genuine sources that should have been filtered before the agent input;
- required fields are absent or structurally invalid;
- `memberClass` is outside the allowed set;
- repeated-evidence minimums are not met and there is no run/import corroboration;
- the proposal attempts to mark itself durable/active instead of candidate-only;
- proof scope, source authority, or runtime coverage is overclaimed.

Warnings, not hard rejection, should be used for semantic quality concerns that are better handled by the agent/model or by setup/import confirmation:

- broad or vague `contextBurdenReduction`;
- broad `long-lived-context-owner` scope needing an explicit workstream boundary;
- weak `whenToUse` wording;
- role overlap with an existing candidate;
- likely need for rename/merge/discard in Workbench setup/import.

The validator may require that fields such as `contextBurdenReduction`, `whenToUse`, `nonResponsibilities`, and `returnContract` exist, but it must not hard-reject a source-backed proposal merely because its wording fails a keyword or regex heuristic. Regex/topic signals are recall hints and diagnostics, not acceptance authority.

### Stage 5: Candidate Ledger Update

Input: contract-valid proposals, rejected proposals, warnings, existing candidate/member records, and chronological event stream.

Output: updated `MemberCandidateLedger`.

The ledger is the place where multi-day patterns accumulate. A single dream run should not have to rediscover the whole pattern from scratch.

Each candidate ledger entry should keep:

- stable candidate ID and current proposed `memberName`;
- status: `candidate`, `imported`, `active`, `rejected`, `superseded`, or `stale`. `candidate` means discovered but not durable/active; `imported` means accepted into project state but not necessarily invoked; `active` requires the separate setup/import/lifecycle path;
- member class and role fields;
- evidence refs and first/last observed timestamps;
- `seenCount`: independent runs/windows that rediscovered or strengthened the candidate;
- `useCount`: observed member invocations or retrieval/use events;
- `correctionCount`: user or parent-agent corrections affecting the member;
- warnings;
- merge/supersede links;
- source authority and proof scope history.

This mirrors the useful part of Magic Context's distinction between seen and retrieved signals: repeated extraction suggests durability, but actual use proves utility. Member promotion should treat use/confirmation as stronger than mere repeated detection.

### Stage 6: Consolidation and Curate

This is a maintenance path, not the latency-sensitive discovery path. It must not be a hidden Context Tree background worker that silently changes the member roster. It runs only when a user-visible runtime trigger source is enabled, and its outputs remain visible as candidate/ledger changes until promotion is explicitly authorized through the normal agent-visible lifecycle.

Responsibilities:

- merge duplicate/overlapping candidates;
- mark superseded or stale candidates;
- preserve `mergedFrom` and `supersededBy` links;
- tighten broad `long-lived-context-owner` scopes when evidence supports a clearer workstream;
- avoid cross-category merges unless the member semantics clearly match;
- leave ambiguous overlaps for Workbench setup/import instead of silently merging them.

The consolidation path may use semantic similarity or an agent/model, but writes must still pass deterministic contract checks and be auditably tied to source events.

## Runtime-Owned Triggering

Member discovery and member memory maintenance need a trigger, but Context Tree should not secretly start an agent or mutate durable member state in the background. The trigger belongs to the runtime chosen by the user: Claude Code, OpenCode, Codex, or another adapter.

The product should expose trigger semantics rather than hard-code one command shape. Each runtime adapter can map these semantics to its native affordances: command surface, plugin action, skill, hook, scheduled task, agent team action, or explicit parent-agent instruction.

The trigger is not the execution run. Cold start, discovery, dream, curate, verify, and classify are better run by a dedicated maintenance subagent / member run, not by the parent agent that noticed the need. The current parent agent may request the run, pass the project/runtime identity and visible reason, and later receive a short status/result summary. The derived member/subagent run owns the expensive scan and proposal work so it does not pollute or consume the user's active design/debug conversation. Some runtimes may persist that derived run as a child session, but the product concept is member/subagent execution, not opening a normal new session.

Allowed trigger kinds:

- **manual request**: the user asks the current agent to scan history, refresh members, consolidate member memory, or diagnose routing;
- **runtime command surface**: the user invokes the runtime's native command/action surface for member discovery/status/dream/backfill;
- **session boundary**: after wrap-up, plan completion, major review completion, or other visible agent workflow boundary;
- **threshold**: unread event count, new root sessions, repeated corrections, or member-run counts cross a configured threshold;
- **scheduled**: time-based execution, but only if the user enabled it for that project/runtime;
- **diagnostic**: natural-use failure asks the current agent why it did not call a member, what roster it saw, and what trigger condition was missing.

The project's trigger settings should be user-visible. They can be represented however the adapter needs; conceptually they answer which explainable trigger sources are enabled for which runtime. Examples: a user asks the parent agent to refresh members; a runtime action starts member discovery; a skill/agent definition asks for dream after plan completion; unread project events cross a threshold; Workbench import/refresh is clicked; or a natural-use failure asks why no member was invoked.

```json
{
  "memberDiscovery": {
    "enabled": true,
    "runtime": "opencode",
    "triggers": {
      "manual": true,
      "runtimeCommandSurface": true,
      "sessionBoundary": ["wrap-up", "plan-complete", "review-complete"],
      "threshold": { "unreadEvents": 200, "newRootSessions": 5, "memberRuns": 3 },
      "scheduled": false
    }
  }
}
```

The exact command spelling is not part of the core contract. For example, Claude Code may expose a native command surface or natural-language action, OpenCode may expose a command/plugin surface, and Codex may expose a skill or app-server/collab action. The invariant is that a real runtime agent requests or mediates the action, a derived maintenance/member run performs the scan/consolidation when needed, and the result is visible to the parent-agent workflow.

All triggered runs must record:

- triggering runtime and trigger kind;
- requesting parent session and execution member/subagent run;
- user-visible source, such as user request, command invocation, workflow boundary, threshold report, or diagnostic request;
- event-stream watermark and safe frontier;
- candidate ledger mutation refs;
- whether outputs are candidate-only, active memory, or rejected;
- a short status summary that the parent agent can report back to the user.

## Bootstrap and Dream Cadence

### Bootstrap

Bootstrap is a bounded historical backfill. It should scan available runtime history, build the initial event stream, build initial candidate ledger entries, and produce candidate-only members for setup/import.

Bootstrap must not imply complete historical absence when coverage is partial. Its report should say which runtimes, sessions, event counts, and caps were included.

### Incremental Dream

Incremental dream should process new content since a content watermark, not just “today's sessions.” A daily run that only reads the current day will miss patterns whose evidence spans several days. The run may be manual, command-triggered, boundary-triggered, threshold-triggered, or scheduled, but it must come from a user-visible trigger source enabled for the project/runtime.

The incremental input should be:

```text
new events since memberDiscoveryWatermarkMs
+ overlap before watermark
+ active candidate/member anchors
+ recent rejected/warned candidates
+ existing member/candidate ledger
```

The overlap is required because useful signals may straddle run boundaries. A candidate introduced before the watermark and corrected after it must be visible as one timeline. The overlap can be bounded by recent N events, recent N days, and/or candidate-specific evidence anchors.

The watermark must be a content watermark, not a scheduler completion timestamp. Failed runs and skipped runs must not advance it. If scanning is capped or truncated, the next watermark should advance only to the safe frontier of scanned content, so unseen events are not skipped.

### Periodic Curate

Some maintenance should run less frequently than incremental dream. Like incremental dream, it is not an invisible global background process; it is a trigger-policy-controlled maintenance action whose changes are visible through the agent and Workbench:

- duplicate/near-duplicate merge;
- stale/superseded candidate cleanup;
- long-lived context owner scope tightening;
- cross-member overlap review;
- evidence decay and confidence adjustment.

This is closer to Magic Context's curate/consolidate tasks and Claude Dream's prune/index phase. It should be separate from day-to-day discovery so expensive whole-pool consolidation does not block fresh candidate detection. Unlike Magic Context, which can treat memory consolidation as a context-manager plugin concern, Context Tree discovery can affect the callable member roster, so candidates and promotions must remain user-visible and agent-mediated.

## What Should Not Create a Member

Do not create a member for:

- a one-off task;
- a generic topic such as “eval”, “proof”, “UI”, or “docs” without recurring specialist standards;
- a single explicit name mention without repeated use or stable expectations;
- workflow wrapper text;
- tool output;
- implementation details that belong in a library/helper rather than a role agent;
- a member whose role would be “do everything the main agent can do”.

These exclusions should be enforced as early as possible. Workflow wrappers and tool output should normally be removed by pre-agent evidence hygiene before the utility gate/proposal model sees the input; the contract validator only keeps defense-in-depth checks.

## Invocation Model

Discovery only proposes candidates. Product use still depends on invocation.

A useful member must eventually support:

1. main agent sees a task;
2. main agent decides a member should handle a bounded part;
3. main agent invokes the member through runtime-appropriate projection/instruction/tool path;
4. member uses role context and memory;
5. member returns concise result to parent agent;
6. parent agent decides what to tell the user or what to do next.

This spec does not require the product to own all runtime spawn behavior. It requires the member profile to be strong enough that existing subagent/team-member style runtimes can use it.

## Cold-Start Behavior Boundaries

### Example 1: Repeated eval proof review

- **Input:** Multi-session history where the user repeatedly asks whether eval artifacts prove live/product behavior, rejects retained evidence overclaims, and asks for correction loops.
- **Expected result:** Discovery proposes a member such as `eval-proof-reviewer` or a similarly evidence-derived name, with clear proof-boundary responsibilities and non-responsibilities.
- **Failure signal:** Discovery returns zero candidates merely because the user never said “create an eval reviewer”.
- **Correction path:** Improve chronological window construction, member/workstream timeline rendering, or utility gate recall.

### Example 2: Single explicit teammate mention

- **Input:** One session where the user says “let skill-designer review this”, with no repeated use or stable requirements.
- **Expected result:** No durable member candidate, or a low-confidence candidate requiring confirmation and more evidence.
- **Failure signal:** The system creates an active durable member from a single mention.
- **Correction path:** Tighten contract-level repeated-evidence requirements or setup/import promotion rules. Do not solve this by adding a semantic agent-validator.

### Example 3: Explicit repeated teammate

- **Input:** Multiple sessions where the same named subagent/member is invoked for skill design and the user repeatedly corrects the same trigger/description/contract-pointer issues.
- **Expected result:** Discovery proposes or updates `skill-designer` with stable role memory and invocation conditions.
- **Failure signal:** Discovery treats each invocation as unrelated one-off work.
- **Correction path:** Improve chronological event linking, member timeline aggregation, and candidate ledger update logic.

### Example 4: Topic-only repeated work

- **Input:** Many mentions of “eval” but no repeated review standard, correction, delegation, artifact judgment, or context burden.
- **Expected result:** No member candidate.
- **Failure signal:** The system creates `eval-reviewer` solely from topic frequency.
- **Correction path:** Fix pre-agent episode construction or agent proposal prompt so topic frequency alone does not become a proposal. If a topic-only proposal still appears, the contract validator may reject it only when evidence refs lack source-backed recurring work; it should not rely on topic regex alone.

### Example 5: Long-lived context owner

- **Input:** Multiple sessions in the same workstream where the user repeatedly asks the agent to recover plan lineage, unresolved blockers, proof status, and next-step sequencing.
- **Expected result:** Discovery may propose a `long-lived-context-owner` candidate with a bounded workstream, explicit non-responsibilities, and a context-burden reduction rationale.
- **Failure signal:** The system rejects the candidate solely because the rationale does not contain proof/review/verdict keywords.
- **Correction path:** Treat this as a validator-boundary bug. The agent/model owns utility semantics; the hard validator should emit warnings for broad scope, not reject source-backed context-owner candidates for keyword mismatch.

### Example 6: Pattern crosses dream boundaries

- **Input:** Day 1 introduces a recurring proof-review concern, Day 2 has no related work, Day 3 contains a correction that narrows the expected member behavior, and Day 5 has another similar review request.
- **Expected result:** Incremental dream links the Day 3/Day 5 events to the Day 1 candidate through the ledger and overlap anchors, increasing evidence instead of producing unrelated candidates.
- **Failure signal:** The Day 5 run sees only that day's session and either returns zero candidates or creates a duplicate member.
- **Correction path:** Use `memberDiscoveryWatermarkMs` plus overlap and active candidate anchors. Do not treat daily calendar boundaries as discovery boundaries.

### Example 7: Overlapping candidates

- **Input:** Bootstrap proposes `proof-boundary-verdict-auditor`, a later dream proposes `eval-proof-reviewer`, and both cite overlapping evidence and return contracts.
- **Expected result:** The ledger marks a possible overlap. Periodic curate either merges them with `mergedFrom` links or leaves a Workbench confirm/rename/discard decision if the scopes differ.
- **Failure signal:** Both become active durable members independently without visible overlap evidence.
- **Correction path:** Add candidate-level dedup/merge review using deterministic normalized keys plus semantic similarity, while preserving source refs and avoiding silent cross-category merges.

## Product Evidence Requirements

A product-grade discovery proof must show:

- runtime/session/event coverage for the material considered;
- chronological window refs and source digests;
- event stream watermark, overlap range, and any safe-frontier truncation state;
- observed or retained model gate/extractor outputs, classified honestly;
- proposal evidence refs;
- contract-validator decision with accept/reject/warning reasons, including rejected proposal details;
- candidate ledger update: created/updated/merged/superseded/stale decisions;
- whether accepted candidates are candidate-only or durable/active;
- if used in a later task, observed member invocation and return-to-parent evidence.

A zero-candidate result is meaningful only if it says which coverage, event windows, session views, and candidate anchors were considered. It must not imply all-history absence unless all relevant runtime histories were covered.

## Relationship to Multi-Runtime Coverage Proof

Multi-runtime coverage proof remains necessary but not sufficient.

It answers:

> What history did discovery see?

Member utility discovery answers:

> Does that history contain work worth delegating to a reusable context-bearing member?

The two specs should compose as follows:

1. multi-runtime coverage produces honest corpus/scan/gate coverage;
2. utility discovery consumes that coverage while building the chronological event stream and derived views;
3. reports distinguish coverage limitation from discovery quality limitation.

## Invariants

- The primary value of member is context savings and stable specialist judgment.
- Natural delegation and parent-result return are required usage mechanics, not the value proposition.
- Explicit teammate discovery is rare and requires repeated invocation plus stable requirements.
- Repeated specialist work can create a member even without explicit member naming.
- Topic frequency alone must not create a member.
- The chronological event stream is the canonical discovery substrate; sessions, member timelines, and workstream timelines are views over it.
- Dream uses a content watermark plus overlap/anchors, not a daily-only calendar slice.
- Failed or skipped dream runs do not advance the content watermark.
- Candidate evidence accumulates in a ledger; a single run need not rediscover the full pattern.
- Discovery must not promote retained/diagnostic evidence to product proof.
- Candidate memory/profile creation remains reviewable; discovery does not silently create durable active members unless the surrounding product flow explicitly allows it.
