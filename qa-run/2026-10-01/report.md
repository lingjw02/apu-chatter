# QA Report - APU Chatter — production public / local fixture audit

- **Environment:** test   **Capability tier:** B   **Run started:** 2026-10-01T13:08:07   **Report generated:** 2026-10-01T13:27:09

## Executive Summary

Fix verification on 1 October 2026: 33 inventoried checks; 28 passed within their stated scope, 0 failed and 5 blocked. Both confirmed Medium UI bugs are verified fixed: all five group tools fit at six widths from 320 to 1920px, and 100 rendered header/tab contrast checks pass with a minimum 5.56:1. The standalone private-chat SQL fixture now passes. Connected browser regression, build and secret scan passed. Corrections deployed to https://apu-chatter.pages.dev/ (entry index-D-FmhTNH.js). Production build verified by HTTP. Authenticated UI retests used isolated local fixtures, and SQL checks used in-memory databases; no production data was modified. SMTP, real provider AI/voice, hosted board concurrency, physical devices and other browser engines remain unverified in this run. Original numerical failure evidence is retained; screenshot files were replaced with post-fix captures.

**Coverage (from tracker):** 28/33 features executed (84%). PASSED 28, BLOCKED 5.

**Open defects:** none.
**Critical blockers:** none recorded.
**Untested/blocked areas:** 5 feature(s) - see Coverage Gaps.

## Feature Coverage

| Feature | Tested | Result | Issues |
|---|---:|---|---|
| F-001 Auth / Public / Production login and registration render | Yes | PASSED | - |
| F-002 Auth / Groups / Unauthenticated group access shows sign-in gate | Yes | PASSED | - |
| F-003 Auth / Forms / Account form controls and safe return paths with fixture configuration | Yes | PASSED | - |
| F-004 Groups / Groups / Create a group with fixture backend | Yes | PASSED | - |
| F-005 Chat / Chat / Send retries retain draft and deduplicate lost acknowledgements | Yes | PASSED | - |
| F-006 Chat / Chat / Delete message confirmation and deleted marker | Yes | PASSED | - |
| F-007 Groups / Invites / Create QR invitation and revoke fixture invite | Yes | PASSED | - |
| F-008 Groups / Members / Kick vote removes member and owner permits reentry | Yes | PASSED | - |
| F-009 Profile / Profile / Edit profile and avatar controls | Yes | PASSED | - |
| F-010 Stories / Stories / Publish fixture text post and open seen update | Yes | PASSED | - |
| F-011 Stories / Stories / Paged history and refresh reconcile deleted content | Yes | PASSED | - |
| F-012 Stories / Stories / Type filters and manual/keyboard viewer navigation | Yes | PASSED | - |
| F-013 Albums / Albums / Selected group view and album folder persist across refresh | Yes | PASSED | - |
| F-014 Board / Board / Drawing text tabs and personal undo interface | Yes | PASSED | - |
| F-015 AI / AI / Opt-in summary interface and invalid date range recovery | Yes | PASSED | - |
| F-016 Music / Music / Queue selection host controls and natural-end retry with provider mocks | Yes | PASSED | - |
| F-017 Music / Music / Minimize keeps listening and same provider instance | Yes | PASSED | - |
| F-018 Music / Library / Save/load deduplication and outsider denial in isolated SQL engine | Yes | PASSED | - |
| F-019 Private chat / Private / Request acceptance and retryable private message sends | Yes | PASSED | - |
| F-020 Safety / Profile / Blocking closes private chat and unblock retry works with no groups | Yes | PASSED | - |
| F-021 Themes / Appearance / Custom CSS import sandbox and safe mode | Yes | PASSED | - |
| F-022 Composer / Chat / Emoji image preview GIF favourites and dictation draft with browser mocks | Yes | PASSED | - |
| F-023 Sound / Group sounds / Persistent sender preferences and unsupported audio feedback | Yes | PASSED | - |
| F-024 Wallpaper / Room style / Local style persistence reduced motion and eight group switches | Yes | PASSED | - |
| F-025 Media / Storage / Private media permissions constraints story retention and canonical deletion in SQL engine | Yes | PASSED | - |
| F-026 UI / All group pages / Tool rail remains reachable at tablet and narrow mobile widths | Yes | PASSED | BUG-001 |
| F-027 Accessibility / Group header and tabs / Normal text contrast meets 4.5 to 1 reference | Yes | PASSED | BUG-002 |
| F-028 Voice / Voice room / Physical microphone and cross-network relay audio | No | BLOCKED | - |
| F-029 Email / Registration / Outsider verification and reset email delivery | No | BLOCKED | - |
| F-030 AI / Provider / Actual OpenRouter requests and weekly scheduler this run | No | BLOCKED | - |
| F-031 Board / Collaboration / Hosted concurrent multi-account editing this run | No | BLOCKED | - |
| F-032 Private chat / SQL engine / Private chat SQL standalone harness | Yes | PASSED | - |
| F-033 Browser / Compatibility / Physical Android screen reader and other browser engines | No | BLOCKED | - |

## Bug Report

| ID | Severity | Feature | Status | Reproduction |
|---|---|---|---|---|
| BUG-001 | Medium | F-026 | VERIFIED_FIXED | 2/2 (Confirmed) |
| BUG-002 | Medium | F-027 | VERIFIED_FIXED | 2/2 (Confirmed) |

## Detailed Findings

### BUG-001 - Group tools clip on tablet and narrow phones

- **Severity:** Medium   **Confidence:** Confirmed   **Kind:** ui   **Status:** VERIFIED_FIXED
- **Affected features:** F-026
- **Problem:** Group tools clip on tablet and narrow phones
- **Preconditions:** Connected local fixture account, group selected; Chromium at 768 or 320px.
- **Steps:**
  1. Open Chat at 768px with desktop sidebar visible.
  2. Inspect Room style at the right edge of Group tools.
  3. Repeat at 320px and inspect Private chats and Room style.
- **Expected:** All five tools are visible and reachable without hidden horizontal clipping.
- **Actual:** At 768px rail scrollWidth578/clientWidth519; Room style right edge815 exceeds viewport768. At 320px Private chats right342 and Room style right388 exceed viewport320. No page scrollbar signals the hidden actions.
- **Reproduction rate:** 2/2
- **Evidence:** `evidence\chat-768.png`; `evidence\chat-320.png`; `evidence\ui-measurements.json`; `evidence\ui-repeat-measurements.json`
- **Recommended modification:** Use available chat-container width to switch all five controls to accessible 44px icon buttons, or provide deliberate horizontal tool scrolling; preserve labels for screen readers.
- **Implementation area:** Group tools responsive layout / connected.css / room-style.css
- **Risk of the change:** Keep popover focus/anchor behavior and private request badge visible.
- **Verification test:** At 768,375,320 every tool fits and can open by pointer and keyboard; repeat group switching and check message area height.
- _History 2026-10-01T13:26:10:_ claimed fixed (UNVERIFIED) Compact labelled tools fit at all six tested widths.
- _History 2026-10-01T13:26:11:_ retest PASS Rendered widths 1920,1366,1010,768,375,320 have no tool clipping. Screenshot files now show post-fix captures; baseline remains ui-measurements.json and fix-red.log.

### BUG-002 - Small header and inactive navigation text fall below contrast reference

- **Severity:** Medium   **Confidence:** Confirmed   **Kind:** accessibility   **Status:** VERIFIED_FIXED
- **Affected features:** F-027
- **Problem:** Small header and inactive navigation text fall below contrast reference
- **Preconditions:** Default Clubhouse theme in local rendered UI.
- **Steps:**
  1. Open Chat and measure member-count text against its white header.
  2. Measure inactive tab labels and repeat on Stories and another viewport.
- **Expected:** Normal-sized text has at least 4.5:1 contrast.
- **Actual:** Member-count text rgb(110,129,137) on white at11px is4.07:1; inactive tabs rgb(106,124,132) on white at12px are4.35:1.
- **Reproduction rate:** 2/2
- **Evidence:** `evidence\ui-repeat-measurements.json`; `evidence\contrast-findings.json`
- **Recommended modification:** Darken default header metadata and inactive tab text to a tested token such as #526d70; keep selected-tab state distinct.
- **Implementation area:** Shared muted text tokens / group header and tab CSS
- **Risk of the change:** Recheck dark/imported themes and other surfaces consuming the muted token.
- **Verification test:** Remeasure normal text contrast on default Chat and Stories; verify visible keyboard focus and active/disabled distinctions.
- _History 2026-10-01T13:26:11:_ claimed fixed (UNVERIFIED) Darker header metadata and inactive tabs.
- _History 2026-10-01T13:26:12:_ retest PASS 100 rendered header/tab contrast checks passed; minimum 5.56:1.

## Observations (not defects)

- **NOTE-001** (observation, F-032): Private SQL standalone test cannot initialize because its fixture lacks storage.buckets required by a newer migration. Restore the local storage fixture, then rerun; not evidence private chats fail in the app.
- **NOTE-002** (ux-suggestion): Message profile links measured22px high. Consider larger mobile hit areas; no blanket WCAG target-size failure claimed because spacing/exception analysis and assistive-device testing were not performed.
- **NOTE-003** (expected-behavior): Wallpapers and favourite GIFs are device-local, dictation browser-dependent, Spotify playback external, and music joins explicit; these are intentional product choices, not defects.

## Coverage Gaps

| Feature | State | Reason / note |
|---|---|---|
| F-028 Physical microphone and cross-network relay audio | BLOCKED | No physical microphone/device or TURN relay credentials exercised. |
| F-029 Outsider verification and reset email delivery | BLOCKED | No SMTP configuration or outbound email exercise in this audit. |
| F-030 Actual OpenRouter requests and weekly scheduler this run | BLOCKED | No actual model request or weekly execution; mocked interface only. |
| F-031 Hosted concurrent multi-account editing this run | BLOCKED | No writes to production; local fixture interface does not establish hosted concurrency. |
| F-033 Physical Android screen reader and other browser engines | BLOCKED | Chromium desktop automation only; no screen reader, physical device or Firefox/WebKit run. |

## Recommended Development Order

_Engineering work ordered by risk (not a ranking of the product)._

_No open Confirmed/Probable defects._
