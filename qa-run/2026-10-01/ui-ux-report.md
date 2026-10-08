# APU Chatter UI/UX audit

1 October 2026 · Chromium 153.0.8010.12 on Windows · Browser automation (tier B).

## 1. Overall assessment

The private-group Clubhouse interface has consistent teal navigation, readable conversation hierarchy, clear Stories filters and a recognizable music panel. Two confirmed Medium findings remain: tool-row clipping and insufficient contrast for small header/inactive-tab text. No Critical or High UI findings were confirmed in this run. This is a practical review, not a WCAG certification.

The linked [functional report](report.md) tracks 33 checks: 25 passed within their evidence scope, 2 failed, 6 blocked. Production checks were public/read-only; connected interactions used local mocked accounts and APIs, not real production users.

## 2. Page-by-page review

| Surface | Observed checks | Result / limitation |
|---|---|---|
| Public login/register | Production renders at 1366,375,320; separate local account control checks | No document horizontal overflow; real authentication/email delivery not exercised |
| Protected groups | Unauthenticated production visit | Sign-in gate shown, not an automatic redirect |
| Chat | Read/send/retry/deletion with fixtures; composer tools; viewport resize | Functional fixture checks pass; narrow tool rail clips |
| Stories | Photo/text cards, author rail, filters, manual/keyboard viewer and history | Fixture interactions pass; default header/tab contrast finding applies |
| Albums | Folder navigation, refresh persistence, empty state | Fixture checks pass; private media engine checks separately pass |
| Board | Empty state, tab/drawing/text/undo interface with fixtures | Interface checks pass; hosted concurrent editing not exercised |
| AI | Disabled opt-in state, valid/invalid range and summary interface with fixtures | Interface checks pass; actual OpenRouter/scheduler not exercised |
| Music | Open/close, queue and host/player lifecycle with mocks; narrow panel scroll | Fixture checks pass; actual provider audio not exercised |
| Settings/private chat | Existing connected browser regression exercises themes, sounds, profile, blocking and accepted temporary chat | Evidence is fixture behavior, not live service verification |

## 3. Findings table

| ID | Type | Severity | Confidence | Impact |
|---|---|---|---|---|
| UI-001 / BUG-001 | Visual / interaction defect | Medium | Confirmed | Room style and part of Private chats clip on narrow layouts |
| UI-002 / BUG-002 | Accessibility concern | Medium | Confirmed measurement | Small metadata and inactive tabs below normal-text contrast reference |

## 4. Detailed findings

### UI-001 — Group tools overflow inside a clipped app surface

At 768px the tool rail measures 578px of content in a 519px container. Room style extends to x815 in a 768px viewport. At 320px, Private chats ends at x342 and Room style at x388. The document itself reports no horizontal overflow, so that check alone misses the defect. Reproduced in two separate browser passes; screenshots show the clipped controls. Keyboard/automation can scroll a clipped ancestor into view, but that workaround can shift other page content sideways.

Evidence: [768px Chat](evidence/chat-768.png), [320px Chat](evidence/chat-320.png), [first measurements](evidence/ui-measurements.json), [repeat measurements](evidence/ui-repeat-measurements.json).

Recommendation: respond to available main-column width, not only total viewport width. Use compact accessible icon controls for all five tools at narrow container sizes, or expose intentional horizontal rail scrolling. Keep request badges and accessible names. Verify every tool by pointer and keyboard at 768,375,320; repeat group switches and ensure conversation height remains useful. Risk: changed labels/anchors could affect popover focus and private-chat badges.

### UI-002 — Small text contrast falls below the reference

Rendered member-count metadata is rgb(110,129,137) on white at 11px: **4.07:1**. Inactive tabs are rgb(106,124,132) on white at 12px: **4.35:1**. Both are below the 4.5:1 normal-text reference. The colors recur across pages/viewports; ratios were calculated with the installed skill’s contrast calculator. This is a specific measured text contrast failure, not a claim of whole-product WCAG nonconformance.

Evidence: [rendered colors/sizes](evidence/ui-repeat-measurements.json), [candidate contrast measurements](evidence/contrast-findings.json). Entries with transparent/animated backgrounds in the candidate list are not used to confirm this finding; only the opaque white backgrounds above support it.

Recommendation: darken these default shared text tokens, for example toward #526d70, and remeasure at least 4.5:1. Preserve active-tab emphasis and verify custom themes separately. Risk: shared muted tokens can affect other components.

## 5. Consistency review

| Component | Chat | Stories / Albums | Music / AI | Assessment |
|---|---|---|---|---|
| Navigation | Same shared header/tab/tool rail | Same shared shell | Same shared shell | Consistent; inherits both findings |
| Primary action | Teal send control | Teal New update / Upload | Teal Join listening / opt-in action | Semantic treatment consistent; sizes vary with role |
| Surfaces | Rounded mint bubbles | White media cards | Mint record scene / white inputs | Deliberate material variation, not a defect |
| Typography | Manrope, compact message metadata | Manrope, larger page/media headings | Manrope, compact section headings | Coherent hierarchy; small text contrast needs work |
| Overlay | Native dialogs for protected-focus actions | Native media/upload dialog | Nonmodal music/style popover | Different focus behavior fits distinct tasks |

Measured control sizes/colors/fonts/radii are preserved in ui-measurements.json; no new design system is proposed.

## 6. Accessibility review

Room style keyboard Tab reached Ripple wallpaper with a visible 2px teal outline at all tested widths; Escape dismissed the popover. Stories previous/next arrow navigation passed the browser regression. Reduced-motion record behavior passed. Meaningful icon controls observed have accessible names. These are specific paths, not proof every control is accessible. Message profile links measure 22px high: consider larger mobile hit areas, but target-spacing exceptions were not evaluated and this is an improvement note rather than an additional confirmed failure. No screen reader was used.

## 7. Responsive review

Resized actual local browser viewports to **1920,1366,1010,768,375,320**, height930. Reviewed Chat, Stories, Albums, Board, AI and Music captures; repeated narrow sizes. Public production auth/gate views checked at1366,375,320. No document horizontal overflow in recorded states; internal tool clipping is confirmed. Music panel remains scrollable at320. Physical keyboard/camera/microphone/touch behavior and 200% browser zoom were not exercised.

## 8. Interaction and state review

Existing browser regressions exercise draft preservation/retry, lost acknowledgements, deletion confirmation, private acceptance/retry, custom theme safe mode, profile controls, blocking recovery, media history and local GIF persistence. New design regression exercises eight group switches, wallpaper refresh, type filters and Posts-to-author-story navigation. The previous duplicate Activity button did not recur. Empty AI/board/media states were inspected; permission-denied audio and mock dictation behavior are limited browser tests. No user-perceived performance benchmark or physical audio-quality claim is made.

## 9. Design system recommendations

Keep the approved Clubhouse identity and original CSS wallpapers/record. Change only responsive tool sizing and the specific default muted text colors first. Consider larger message-profile hit areas afterward. Do not replace the layout or introduce another animation library based on this audit.

## 10. Coverage and limitations

Only Chromium automated this run. Connected fixture accounts include owner/member flows; there was no authenticated read of real user content. Production data was not modified and no emails were sent. SQL media/music checks ran against disposable in-memory databases. A standalone private-chat SQL harness fails during setup because storage.buckets is missing; this is a test-fixture gap, not a confirmed app failure. Real SMTP, TURN, OpenRouter execution, hosted multi-user board concurrency, physical Android and other browser engines remain unverified. Screenshots contain synthetic data and an existing stock photo. Candidate measurement hits require manual context; only the two confirmed findings above count as defects.

## 11. Prioritized implementation checklist

- [x] Fix the group-tools clipping; validate pointer/keyboard access at tablet and narrow phones.
- [x] Darken header metadata/inactive-tab tokens and measure default-theme contrast.
- [x] Repair standalone private SQL test fixture, then rerun it.
- [ ] Complete SMTP delivery and TURN/physical-device checks before broadening the pilot.
- [ ] Run actual AI/weekly and hosted concurrent board acceptance in an authorized test environment.
- [ ] Consider larger message-profile touch areas and a screen-reader/zoom review.

The preceding sections preserve the initial audit. See the verified corrections below for current status.

## 12. Verified corrections — 1 October 2026

Both confirmed findings are resolved and deployed. Below 900px, group actions use 44px icon controls with accessible names and titles. All five controls fit at 1920, 1366, 1010, 768, 375 and 320px. Header metadata and inactive tabs now use #526d70; 100 rendered checks meet 4.5:1 with a minimum 5.56:1. Message-profile link height increased from 22px to 28px; full touch-target compliance is not claimed. The private SQL fixture now defines storage tables before migrations; consent, isolation, retry and deletion checks pass.

Evidence: evidence/ui-repeat-measurements.json, evidence/fix-contrast.json, evidence/private-engine-retest.log and evidence/fix-connected-regression.log. Screenshot files now show post-fix captures; use ui-measurements.json, contrast-findings.json and fix-red.log for original failures. Build and secret scan passed. Production serves index-D-FmhTNH.js at https://apu-chatter.pages.dev/. External test limitations in section 10 remain, except the repaired private SQL fixture.
