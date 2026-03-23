# Doc Index & Drift Matrix

**Date:** 2026-03-23
**Companion to:** `2026-03-23-full-codebase-verifier-architecture-audit.md`
**Master:** `e0199a2` | **Base-path:** `feat/base-path-support` @ `673b864`

---

## Matrix Legend

**Verdict values:**
- `accurate` — claims match current code and verification evidence
- `partially-stale` — some claims outdated but doc is still useful
- `stale` — majority of claims outdated or superseded
- `contradicts-current` — claims actively contradict verified state

**Action values:**
- `keep` — no changes needed
- `update` — specific claims need correction (listed)
- `supersede` — replace with newer doc
- `archive` — move to historical reference, mark as non-authoritative

---

## Canonical Sources of Truth

| Doc Path | Branch | Purpose | Req Area | Key Claims | Verdict | Code Evidence | Test/Log Evidence | Action |
|----------|--------|---------|----------|-----------|---------|--------------|-------------------|--------|
| `AGENTS.md` | master | Canonical: agent operating rules | Infra | Must run conductor + self-containment first; cross-repo isolation mandatory | accurate | `scripts/conductor_tools.py`, `scripts/self_containment_audit.py` exist | Both pass on audit run | keep |
| `docs/INDEX.md` | master | Canonical: doc hub | Both | M1 close patches landed (aed6e40, 14d99d6); M2 plan active; base-path required before subpath hosting | accurate | Commits exist; M2 plan docs exist | M1 closeout in failure log | keep |
| `docs/AGENT_PROTOCOL.md` | master | Canonical: agent startup + evidence rules | Infra | 13 mandatory protocol rules; claim discipline; hard-fail gate sequence | accurate | Protocol rules enforced by conductor | N/A | keep |
| `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md` | master | Canonical: M1 acceptance criteria | M1 | Hard-fail gates A-G; M1 = bundle-native idle/attack/death; whole-sheet required; M2 only after M1 closes | accurate | Gates implemented in runners; whole-sheet editor mounted | 7/7 edge-workflow PASS; M1 declared closed | keep |
| `docs/PNG_STRUCTURAL_BASELINE_CONTRACT.md` | master | Canonical: M2 PNG protection | M2 | Any readable PNG → structural XP → runtime-safe; G10/G11/G12 gates; visual correctness out of acceptance scope | accurate | G10-G12 in `gates.py:41-82`; G7-G9 exist but not called | `test_contracts.py` checks dims+sha256 | keep |
| `docs/BASE_PATH_SUPPORT_CHECKLIST.md` | master | Canonical: base-path implementation status | Infra | Shows items as not done / "not safe without base-path env var work" | partially-stale | Branch has bp(), _BP, Flask routes, HTML rewrite all working | Deploy smoke tests pass on branch | **update** — reflect branch implementation status |
| `docs/MVP_DEPLOYMENT.md` | master | Canonical: deployment guide | Deploy | Flask server-backed; runtime committed; GitHub Pages not viable; subpath = future work | partially-stale | Runtime committed ✓; Flask serves ✓ | Subpath working on branch | **update** — "subpath future" → "subpath implemented on branch, pending merge" |
| `docs/LAUNCH_READINESS_CHECKLIST.md` | master | Canonical: launch gates | Deploy | 7 gates; M1 pending (patches landed); verdict NOT READY | partially-stale | M1 now formally closed | PLAYWRIGHT_FAILURE_LOG M1 closeout | **update** — M1 gate status → CLOSED |

## Active Working Plans (Master)

| Doc Path | Branch | Purpose | Req Area | Key Claims | Verdict | Code Evidence | Test/Log Evidence | Action |
|----------|--------|---------|----------|-----------|---------|--------------|-------------------|--------|
| `docs/plans/2026-03-21-milestone-2-practical-png-ingest-plan.md` | master | Active: M2 strategic roadmap | M2 | M2 starts after M1 closes; preserve structural baseline; center on source-panel/manual assembly | accurate | M1 closed ✓; structural baseline contract exists | N/A (plan, not implementation) | keep |
| `docs/plans/2026-03-21-milestone-2-implementation-checklist.md` | master | Active: M2 implementation phases | M2 | 6 phases (M2-A through M2-F); WS editor already mounted; wave-based execution | accurate | Whole-sheet-init.js mounted ✓; phase scopes match code inventory | Phase completion: A~40%, B~50%, C~60%, D~70%, E~30%, F~30% | keep |
| `docs/plans/2026-03-21-milestone-2-png-verifier-design.md` | master | Active: canonical M2 verifier architecture | M2 | State model + SAR blueprint; extends beyond M1 paint-sequence; stateful multi-panel workflows; needs getState() additions | accurate | Edge-workflow SAR infrastructure exists; getState() P1/P2 on branch | No M2 verifier slices built yet | keep |
| `docs/plans/2026-03-22-workbench-verifier-sar-model.md` | master | Active: SAR model theory | M2 | XP truth table ≠ SAR model; current verifier = XP oracle; SAR must cover all panels; keep both long-term | accurate | Truth-table in fidelity runners; SAR in edge-workflow runner | N/A (design doc) | keep |
| `docs/plans/2026-03-22-workbench-sar-table-blueprint.md` | master | Active: exhaustive SAR enumeration | M2 | 7 state surfaces, 28+ actions, state/response/invariant rules per family; identifies debug API gaps | accurate | ~8 of 28+ actions in verifier; 42/48 debug APIs unused | N/A (blueprint, not test evidence) | keep |

## Active Working Plans (Branch Only)

| Doc Path | Branch | Purpose | Req Area | Key Claims | Verdict | Code Evidence | Test/Log Evidence | Action |
|----------|--------|---------|----------|-----------|---------|--------------|-------------------|--------|
| `docs/plans/2026-03-23-milestone-2-base-path-unified-verifier-plan.md` | feat/base-path-support | Active: unified verifier architecture for M2 | M2 | **M1 is "not yet closed"** with 5 OPEN blockers; 96 user-reachable actions; 5 verifier slices needed; shared infra (verifier_lib, selectors, action_registry) | **contradicts-current** | M1 closed on master (a00c965, 14e8e95). 3 of 5 listed blockers resolved. verifier_lib.mjs exists; selectors.mjs and action_registry.json do not. | PLAYWRIGHT_FAILURE_LOG M1 closeout contradicts blocker list | **update** — M1 status → CLOSED; remove resolved blockers; mark selectors.mjs and action_registry.json as "to be built" |
| `docs/plans/2026-03-23-milestone-2-bug-gap-index.md` | feat/base-path-support | Active: 32-item bug/gap inventory | M2 | 22 OPEN, 5 FIXED, 5 DEFERRED; PB-10/11/12/13 OPEN; VB-01/02 CLOSED | **partially-stale** | PB-10 (runtime files): resolved by committed runtime. PB-12 (cell mismatches): reclassified as non-blocking. PB-13 (Skin Dock stall): resolved by b1faac3. PB-11: may be resolved by edge-workflow fixes. | Master closeout resolves/reclassifies at least 4 OPEN items | **update** — refresh status for PB-10, PB-11, PB-12, PB-13; update OPEN count |
| `docs/plans/2026-03-23-state-capture-contract.md` | feat/base-path-support | Active: getState() vs _state() sourcing rules | Infra | getState() = primary immutable; _state() = fallback for actionStates only; Rule 1-4; captureState() canonical pattern | accurate | `f246828` implements P1/P2 fields; verifier_lib.mjs implements captureState() per contract | Edge-workflow runner uses this pattern on branch | keep — promote to master after merge |

## Stale but Useful History

| Doc Path | Branch | Purpose | Req Area | Key Claims | Verdict | Code Evidence | Test/Log Evidence | Action |
|----------|--------|---------|----------|-----------|---------|--------------|-------------------|--------|
| `INTEGRATION_STRATEGY_AND_REPLAN.md` | master | History: pre-pivot integration plan | M1 | 2026-03-12; recommends EditorApp god-object refactor + hybrid adoption; Phase 2 4-week plan | stale | Predates whole-sheet pivot (2026-03-15); recommended approach not taken | N/A | **archive** — mark as "pre-whole-sheet-pivot, not executed" |
| `REXPAINT_LIBRARY_AUDIT_FINDINGS.md` | master | History: library audit | Research | rexpaintjs-fork + pyrexpaint recommendations; pre-whole-sheet integration | stale | Integration status unknown; predates pivot | N/A | **archive** — informational only |
| `PLAYWRIGHT_FAILURE_LOG.md` | master | Canonical: append-only failure + closeout record | M1 | M1 CLOSED (lines 1272-1324); 7/7 PASS; EV-001/002/003 resolved; canvas-edge non-blocking; base-path clean | accurate | Commits cited (14e8e95, a00c965) verified | This IS the verification evidence | keep |
| `docs/research/ascii/2026-03-15-whole-sheet-rexpaint-pivot.md` | master | History: pivot decision + salvage analysis | Research | Salvageable frame grid/geometry; EditorApp LayerStack target; legacy inspector = debug-only | accurate | Whole-sheet editor IS primary; legacy inspector still exists but secondary | N/A | keep as context |
| `docs/research/ascii/2026-03-15-whole-sheet-seam-map.md` | master | History: seam audit pre-integration | Research | EditorApp NOT integrated into shipped workbench; legacy inspector entry points; whole-sheet canvas absent | partially-stale | Whole-sheet IS now integrated (whole-sheet-init.js mounted) | N/A | keep — note that whole-sheet now mounted |
| `docs/2026-03-20-CLAUDE-HANDOFF-PHASE-4-ACCEPTANCE-STRICT.md` | master | History: Phase 4 acceptance handoff | M1 | Separates manual T review from real acceptance evidence; defines remaining acceptance work | partially-stale | Acceptance work completed (M1 closed) | PLAYWRIGHT_FAILURE_LOG closeout | keep as lineage — note M1 now closed |

## Branch-Specific / WT Documents

| Doc Path | Branch | Purpose | Req Area | Key Claims | Verdict | Code Evidence | Test/Log Evidence | Action |
|----------|--------|---------|----------|-----------|---------|--------------|-------------------|--------|
| `PLAYWRIGHT_STATUS.md` (base-path WT) | feat/base-path-support | Diagnostic: test status | Infra | 2026-03-10; "Test This Skin" disabled; runtime missing | stale | Runtime files now committed; button gating fixed (894ea9d on master) | Predates M1 closeout by 13 days | **archive** — completely superseded |
| `PLAYWRIGHT_FAILURE_LOG.md` (base-path WT) | feat/base-path-support | Diagnostic: failure log | Infra | 2026-03-10; same stale runtime-missing report | stale | Predates branch's own fixes | Master's failure log is canonical | **archive** — master version is authoritative |
| `progress.md` (base-path WT) | feat/base-path-support | Branch: progress notes | Infra | 2026-02-26; conductor fixes, bootstrap hardening, WASM issues | stale | Branch-specific diagnostic from early development | N/A | keep in branch only; do not merge without refresh |
| `docs/plans/2026-03-22-base-path-support-plan.md` (base-path WT) | feat/base-path-support | Branch: base-path implementation design | Infra | Design for base-path env var implementation | accurate | Implementation complete on branch | Deploy smoke tests pass | keep |

## CLAUDE.md Status

| Doc Path | Branch | Purpose | Req Area | Key Claims | Verdict | Code Evidence | Test/Log Evidence | Action |
|----------|--------|---------|----------|-----------|---------|--------------|-------------------|--------|
| `CLAUDE.md` (master) | master | Memory: session constraints | Both | "master at 5caeb07 stale/unknown"; "EditorApp not embedded"; "undo/redo TODO stubs"; 10-byte cells; 7-byte caveat | partially-stale | Master at e0199a2 (not 5caeb07). Whole-sheet editor IS embedded. Undo/redo still stubs. 10-byte cells correct. | N/A | **update** — refresh HEAD reference; note whole-sheet IS mounted; keep undo stub warning |
| `CLAUDE.md` (base-path WT) | feat/base-path-support | Memory: session constraints | Both | Same stale claims as master copy (branches share same CLAUDE.md content) | partially-stale | Same as above | N/A | Same updates needed |

---

## Drift Classification Summary

| Drift Type | Count | Severity Range |
|------------|-------|---------------|
| Requirement drift (M1 open vs closed) | 1 | CRITICAL |
| Implementation drift (code divergence between branches) | 3 | CRITICAL-HIGH |
| Verifier behavior drift (captureState patterns) | 1 | HIGH |
| Documentation drift (stale claims in active plans) | 4 | HIGH-MEDIUM |
| Accepted non-blocking residuals | 1 | LOW (canvas-edge mismatches) |

---

## Cross-Reference: Suspected Drift Points (from Audit Request)

| # | Suspected Drift | Verified? | Finding |
|---|----------------|-----------|---------|
| 1 | Base-path M2 planning docs still claim M1 is open | **YES** | DF-01: Line 19 says "not yet closed" with 5 blockers. Master says CLOSED. |
| 2 | Base-path edge-workflow runner behind master on SAR + tab hydration | **YES** | DF-02: Missing 14 master commits including strengthened waits, generated SAR, preload support. |
| 3 | verifier_lib.mjs weaker than M1 runners on readiness waiting | **PARTIALLY** | verifier_lib.mjs has basic openWorkbench + waitForSessionHydration. Master's runners have more robust dual-gate + settle-delay patterns. Merge will reconcile. |
| 4 | Shared state-capture incomplete (actionStates _state() fallback) | **YES** | DF-04: actionStates still requires _state(). State-capture contract documents this explicitly. Curated version planned but not built. |
| 5 | Operator docs describe prefixed hosting as future-only | **YES** | DF-10: MVP_DEPLOYMENT.md and BASE_PATH_SUPPORT_CHECKLIST describe subpath as future. Branch has working implementation. |
| 6 | M2 planning docs claim shared verifier infra exists more than it does | **YES** | DF-08: Plan references selectors.mjs and action_registry.json — neither exists. verifier_lib.mjs exists but only on branch. |
| 7 | M2 bug-gap counts stale after recent commits | **YES** | DF-05: At least 4 of 22 OPEN items resolved/reclassified by master's closeout session. |
