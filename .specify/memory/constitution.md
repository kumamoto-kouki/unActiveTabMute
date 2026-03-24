<!--
SYNC IMPACT REPORT
==================
Version change: [TEMPLATE] → 1.0.0 (initial adoption)

Modified principles:
- [PRINCIPLE_1_NAME] → I. Extension-First Architecture (new)
- [PRINCIPLE_2_NAME] → II. User Privacy (new)
- [PRINCIPLE_3_NAME] → III. Minimal Permissions (new)
- [PRINCIPLE_4_NAME] → IV. Single Responsibility (new)
- [PRINCIPLE_5_NAME] → V. Performance & Compatibility (new)
- [SECTION_2_NAME]   → Technical Constraints (new)
- [SECTION_3_NAME]   → Development Workflow (new)

Added sections: All sections (initial constitution)
Removed sections: None

Templates requiring updates:
- ✅ .specify/templates/plan-template.md — Constitution Check section is generic and compatible
- ✅ .specify/templates/spec-template.md — No constitution-specific references; compatible
- ✅ .specify/templates/tasks-template.md — Task structure is compatible; no updates needed

Follow-up TODOs:
- None. All placeholders resolved.
-->

# unActiveTabMute Constitution

## Core Principles

### I. Extension-First Architecture

All features MUST be implemented using Chrome Extension APIs (Manifest V3).
The extension MUST use a service worker as its background script — persistent
background pages are forbidden under MV3. The popup UI (if any) MUST be
self-contained HTML/CSS/JS with no external framework dependencies unless the
added bundle size is justified. All inter-component communication MUST use the
Chrome messaging API (`chrome.runtime`).

**Rationale**: MV3 is the current and future standard for Chrome extensions.
Aligning with it from the start avoids costly rewrites and ensures Web Store
approval.

### II. User Privacy (NON-NEGOTIABLE)

The extension MUST NOT collect, transmit, or store any user browsing data to
external servers. Tab URLs, titles, and audio state are processed locally only.
No analytics, telemetry, or crash-reporting service may be bundled unless the
user explicitly opts in via a clearly labeled setting. The `privacy` section of
`manifest.json` MUST be reviewed on every permission change.

**Rationale**: Users install browser extensions with high trust. A mute-tab
extension has access to tab metadata; misuse would be a serious breach of that
trust and would violate Chrome Web Store policies.

### III. Minimal Permissions

The extension MUST request only the permissions strictly required for its
operation (`tabs` for reading/writing muted state, `activeTab` where
sufficient). Every permission listed in `manifest.json` MUST have a
corresponding justification comment. Adding a new permission requires a
written rationale documenting why a narrower permission is insufficient.

**Rationale**: Broad permissions increase attack surface and reduce user
confidence. Chrome Web Store reviewers scrutinize over-privileged extensions.

### IV. Single Responsibility

The extension does exactly one thing: mute audio on inactive tabs and restore
audio on the active tab. New features MUST directly serve this core behavior.
Settings that alter mute behavior (e.g., allowlist, delay threshold) are
in-scope; unrelated features (e.g., tab grouping, bookmarking) are out-of-scope
and MUST be rejected.

**Rationale**: Scope creep degrades UX and complicates maintenance. A focused
extension is easier to review, test, and explain to users.

### V. Performance & Compatibility

The service worker MUST respond to tab-activation events within 100 ms under
normal conditions. The extension MUST function correctly on Chrome 112+ and
any Chromium-based browser that supports MV3. Memory usage of the service
worker MUST remain below 10 MB at idle. Performance regressions MUST be
measured and justified before merging.

**Rationale**: Tab switching is a high-frequency user action. Any perceptible
delay breaks the browsing experience.

## Technical Constraints

- **Manifest**: Manifest V3 ONLY — no MV2 fallback paths.
- **Language**: JavaScript (ES2020+) or TypeScript (transpiled to ES2020).
- **Dependencies**: Zero runtime npm dependencies in the extension bundle unless
  individually approved and pinned.
- **Build**: If a build step is introduced it MUST be reproducible via a single
  `npm run build` command.
- **Browser target**: Chrome 112+, Edge 112+ (Chromium MV3 compatible).
- **Storage**: `chrome.storage.local` for persisting user preferences; no
  external databases.

## Development Workflow

- All changes MUST be manually tested in Chrome developer mode
  (`chrome://extensions` → Load unpacked) before any PR is opened.
- The extension MUST pass Chrome Web Store pre-submission checks
  (`chrome.management` lint) on every release branch.
- Breaking changes to `manifest.json` (new permissions, changed `host_permissions`)
  MUST be called out explicitly in the PR description.
- Version in `manifest.json` MUST follow `MAJOR.MINOR.PATCH` and be bumped on
  every release.
- Code review MUST verify that no new permission is introduced without a
  documented justification per Principle III.

## Governance

This constitution supersedes all other documented practices for this project.
Amendments require: (1) a written description of the change and its rationale,
(2) a version bump following semantic rules below, and (3) this file being
updated before the implementing PR is merged.

**Versioning policy**:
- MAJOR — removal or redefinition of a principle.
- MINOR — new principle or section added; material expansion of existing guidance.
- PATCH — clarifications, wording, or typo fixes with no semantic change.

All PRs MUST include a "Constitution Check" confirming compliance with
Principles I–V. Complexity violations (e.g., adding a dependency, requesting
a new permission) MUST be documented in the plan's Complexity Tracking table.

**Version**: 1.0.0 | **Ratified**: 2026-03-24 | **Last Amended**: 2026-03-24
