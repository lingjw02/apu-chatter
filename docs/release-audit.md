# Web release audit — 2026-09-27

The full release is **not complete**. The deployed preview is
https://apu-chatter.pages.dev. This audit preserves the scope of the approved
[specification](superpowers/specs/2026-09-21-apu-chatter-design.md), including
features beyond the original text-chat pilot. An implemented feature is not
automatically a passed release gate.

## Requirement and evidence map

| Requirement | Current evidence | Remaining proof or work |
| --- | --- | --- |
| React web, responsive Clubhouse design, logo/opening motion | Connected app and `/demo`; isolated `check-ui.mjs` and `check-motion.mjs` passed this date; [browser audit](browser-verification.md) | Physical mobile review; demo interactions do not prove connected-app behavior |
| Email/password, verification, reset, safe return paths | Hosted confirmed-account sign-in; isolated `check-accounts.mjs` passed this date with backend disabled | Configure SMTP and verify actual outsider registration/verification/reset delivery |
| Profiles, avatar, bio/status, private email | Hosted two-account avatar upload/removal and read-denial checks; connected profile flow | Complete physical-browser review |
| Groups, QR/link immediate entry, full existing history | Hosted invite join; connected QR/link/revoke and paged-history tests; forced refresh/pagination overlap tested in three engines | Physical QR scan; first-time newcomer pre-join paginated history and three-album access passed on hosted Chromium |
| Owner/admin/member permissions, 50% ordinary/unanimous admin vote, protected owner, bans/re-entry | Moderation SQL tests, hosted authorization/catalog audit and four-account hosted UI promotion/vote/removal/re-entry journey passed this date | Physical-browser review; hosted role-change cancellation/expiry journeys remain covered by SQL rather than this browser check |
| Owner transfer/delete, reports and personal blocks | Safety SQL tests and connected controls; hosted block closure and no-group unblock recovery; hosted ownership transfer/cancel and exact-name group deletion/cancel passed this date | Hosted report/resolve UI journey passed 2026-09-28; physical-browser review remains |
| Group text, idempotent retry, plain text, history/reconnect | Hosted cross-context send; SQL deduplication; connected lost-ack/pre-send retry and pagination regression | Hosted mobile-sized offline and lost-ack retry passed 2026-09-28; physical-device network review remains |
| Accepted temporary text-only chats, either-side closure, deletion on leave/removal/block | `check-private.mjs` rerun this date: consent, expiry, pair uniqueness, participant isolation, dedup and deletion; hosted block closure; real two-browser request/accept/send/close journey passed for both possible closers, including cancelled closure and live-database message-row deletion | Actual provider backup retention disclosure; physical-device review |
| Group Updates, author unread indicator, separate profile access | Connected author filtering, seen state, paged Updates and deletion tests; hosted author-avatar navigation and unread-to-seen transition passed | Physical-device review |
| 24-hour stories, durable Stories/Shared/Chat albums, canonical deletion | `check-sharing.mjs` rerun this date; hosted private storage upload/read/delete; video duration checks recorded in backend setup | Physical-browser video compatibility; first-time newcomer image decoding in all three albums, archived-story access and deletion/storage denial passed on hosted Chromium |
| Media quotas and server validation | Server upload validation plus no direct browser Storage INSERT policy; SQL media checks; [usage report](../scripts/usage-snapshot.sql) | Provider billing dashboard review and operational monitoring |
| Fixed board, 20 tabs, tools/zoom/pan, concurrent edits, cursors, own undo/redo | Board SQL suite; connected tools/retry; hosted two-client drawing, undo/reconnect and text recovery documented in backend setup | Final physical touch/pan/text review; do not claim unlimited shape lifetime |
| Group-only rankings, weekly/all-time counts, common words, topics | Activity SQL suite rerun this date; sourced topic access/deletion checks; hosted AI/topic evidence | Hosted weekly/all-time counts, words, timezone and two-person streak passed 2026-09-28; physical-device review remains |
| Group-local 30% streak, minimum two, frozen electorate and timezone | Activity tests cover dedup, frozen electorate, deletion and minimum two; timezone boundary tests recorded | Pilot UX feedback on eligibility explanation |
| Explicit OpenRouter requests plus one weekly automatic summary | Real requested AI and weekly result persistence checks; scheduler timezone/DST/idempotency tests and live dispatch evidence | Free provider availability is not guaranteed; scheduler/HTTP response review completed 2026-09-28 (one recovered cleanup 503; see below) |
| Selected-range summaries/decisions/notes, source links and song matches chosen before queueing | AI range/context/parser/access tests; real catalog search; connected selection-before-add test | Hosted real-summary source navigation/deleted-source exclusion passed 2026-09-28; physical-device review remains |
| Independent opt-in music queues, host transfer/succession, skip votes and revisions | Music SQL tests and hosted music integration; [provider evidence](music-provider-verification.md) | Physical/provider-region review; Apple independent previews verified on hosted Chromium; Spotify opens externally by the user’s pilot decision |
| YouTube tracks/playlists coordination; external Spotify links | Actual provider component tests and hosted two-user controls; hosted natural YouTube completion advances exactly one item | Physical mobile/Safari and provider restrictions/reconnect review; universal synchronization is explicitly not promised by spec |
| Voice open-mic/PTT, muted entry, safe release, capacity | Voice SQL tests and hosted two-Chromium fake-microphone RTP/control checks | TURN configuration, relay-only/restrictive-network test and physical microphone/mobile test |
| Per-group/per-sender local built-in/imported sounds and mute | Chromium/Firefox import/decode; hosted other-group realtime sound/mute; Windows WebKit unsupported-message regression | Actual Safari audio and physical-device gesture behavior; closed-browser custom sounds are not promised |
| Visual themes, imports/exports, CSS, sandboxed UI code, reset/rollback/keyboard/reduced motion | Connected three-engine checks, CSP escape test, hosted local-theme isolation; [theme guide](theme-code.md) | Individual control coverage expanded and verified 2026-09-28; physical-browser review remains |
| Free HTTPS deployment, deep links, server-only secrets and privacy | Cloudflare Pages stable URL; production Auth redirects; hosted route checks and privileged RPC/RLS audit | SMTP, quota dashboard, retention disclosure and remaining gates above |

## Verification tooling and scope

The isolated historical checks now start their own Vite servers with backend
credentials explicitly disabled: accounts on 5184, demo UI on 5185, demo motion
on 5186. They neither depend on the user's port-5173 server nor submit real
registration email requests. All three passed after updating their routes/setup.

The implementation uses Node assertions/PGlite for deterministic and database
tests, Playwright for browser flows, and application route dispatch instead of
the specification's proposed Vitest/React Router choices. These are architecture
differences to document, not evidence of missing user-facing routing or tests.
The lockfile is present; this workspace has no Git repository, so no commit or PR
is claimed.

The remaining gates above are work items, not a request to reduce the scope.
Native apps and third-party bots remain explicitly deferred by the user.

## Hosted private-chat acceptance evidence

`TEST_DEPLOYED_UI=1 TEST_LIVE_PRIVATE=1 node --env-file=.env scripts/check-live-integration.mjs`
passed on the stable deployment this date. The helper uses two separately signed-in
Chromium contexts (desktop and mobile viewport), verifies that no composer appears
before acceptance, sends in both directions, cancels an end confirmation, then
closes from each participant in separate chats. Both browsers remove all message
elements and the composer, including the peer's unsent draft. An administrative
count for the specific closed chat confirms zero live message rows, rather than
relying on RLS-hidden reads. It does not establish provider backup/disk erasure.
The main runner removed its temporary accounts and group and sent no email.

## Final-build security snapshot (2026-09-27)

`npm audit --json` reported zero vulnerabilities, including development packages.
`check-live-security.mjs` passed 55 privileged RPC grants/search paths, 32 RLS
tables, allowed profile column grants and private Storage policy checks. This
remains a metadata audit, supplemented by the domain authorization tests.
`check-build-secrets.mjs` scanned all 20 current build files against two locally
configured private environment values and found neither. Public Supabase anon
credentials are intentionally allowed. This raw-value comparison is not proof
against unknown, transformed or externally stored secrets. No values are printed.

## Hosted moderation acceptance evidence

`node --env-file=.env scripts/check-live-moderation-ui.mjs` passed on the stable
deployment using four separately authenticated Chromium contexts, one with a
mobile viewport. All accounts were administrative-confirmed synthetic users;
no registration email was sent. The test covers protected-owner controls and
RPC rejection, owner promotion, ordinary-member removal after two of three
eligible Kick ballots (one insufficient), admin removal only after all three
(two insufficient), invite rejection while banned, owner-allowed re-entry and
former-admin role reset. Live database reads verify membership changes.

Ownership transfer is cancelled once, then confirmed; the former owner loses
delete controls. The new owner cancels deletion once, then supplies the exact
group name and deletes the synthetic group. A live administrative read confirms
the group is absent. Cleanup removed all four test accounts. An initial test
attempt raced the re-entry confirmation; waiting for its UI completion fixed
the test without a production change. Physical-device behavior, report/resolve
UI, vote expiry and role-change cancellation are outside this hosted check.

## Hosted first-time newcomer and sharing evidence

`TEST_DEPLOYED_UI=1 TEST_LIVE_SHARING=1 node --env-file=.env scripts/check-live-integration.mjs`
passed on the stable deployment. The helper adds a third, entirely new confirmed
account, which joins only after the owner has uploaded photos through the UI to
Shared, Stories and Chat media. It verifies decoded image pixels in each folder
from a separate mobile-sized Chromium context. Fifty-five synthetic pre-join
messages exercise the actual earlier-message pagination.

The new member opens an unread author avatar, sees the author-filtered Updates,
opens the post and returns to a read avatar state. A story timestamp is explicitly
backdated 25 hours for the expiry fixture: it is absent from Updates while still
readable in Stories. Deletion is cancelled once, then confirmed; the item disappears
and a fresh Storage download is denied. This is a clock-fixture test, not a
25-hour wall-clock observation or proof of remote browser cache erasure.

The initial harness used an incorrect exact select-label locator and masked its
failure during UI cleanup; those harness issues were corrected. A passing
returning-member run was strengthened to a first-time account, then passed again.
Temporary objects, all three accounts and the group were cleaned up. No emails
were sent. Physical devices and video playback remain separate gates.

## Hosted report privacy — 2026-09-28

The expanded `check-live-moderation-ui.mjs` passed in full. An ordinary member
submitted a synthetic report through Safety; the reporter and owner could read
it. Both a separate admin and the report target saw no report rows and were
denied direct resolution requests. Owner resolution appeared when the reporter
reopened Safety. The empty report submit button was disabled. Voting, role
changes, ownership/deletion checks also passed; all test data was removed.

## Hosted AI request and source navigation — 2026-09-28

`TEST_DEPLOYED_UI=1 TEST_LIVE_AI_UI=1 node --env-file=.env scripts/check-live-integration.mjs`
passed with the real hosted group-ai function and configured free OpenRouter
provider. The owner cancels consent, then enables AI, selects Past 24 hours and
requests a summary through the UI. The resulting done job contains nonempty
provider text and cites the synthetic study-message ID. A second signed-in
account reads the result and opens that source; after the underlying message is
marked deleted, reopening shows the unavailable-source explanation without the
old message body. Only the owner sees AI configuration controls, and disabling
AI disables further request controls. No AI output was mocked.

The full baseline integration also passed and removed temporary users/group.
This verifies one requested summary/source journey, not provider uptime, every
model response or scheduler execution. Selected-range boundaries have separate
SQL coverage; the UI test selects the 24-hour option.

## Scheduled worker and cleanup snapshot — 2026-09-28

The read-only `scripts/scheduled-worker-snapshot.sql` query at 05:18 UTC checked
actual pg_net responses as well as cron dispatch. In its six-hour window, 24
responses with the weekly worker’s `processed` field returned HTTP 200; none
reported `skipped`. The media worker had 23 HTTP 200 responses and one HTTP 503
at 04:30 UTC, classified by its known fixed response as “media cleanup batch
unavailable.” Both workers most recently returned HTTP 200 at 05:15 UTC. No
transport errors or timeouts were present. The underlying transient batch error
is not exposed by that response, so its cause is not asserted.

All four schedules were active with successful latest dispatches. The separate
usage snapshot at 05:18 UTC showed zero Storage objects, zero pending media or
avatar cleanup entries and a 16,796,819-byte database. HTTP response shape is
used for worker classification because retained response rows do not include
the endpoint URL. Successful HTTP calls do not prove nonzero weekly workload or
provider-quality results; real weekly job execution and requested-provider
results have separate evidence. No private response bodies/headers are printed.

## Theme control coverage — 2026-09-28

The review found missing individual-control selectors and expanded the bounded
CSS allowlist for sharing cards, board tabs/tools, music session controls/queue/
link input, voice toggle/actions and AI request/result/source controls. The
Appearance guide now derives its selectors from the same exported compiler list.
Trusted consent, account, moderation and recovery selectors remain rejected.
The selector regression failed before the extension and passed afterward;
production build and raw-local-secret scan passed. Connected Chromium checks
verified computed styles on board, AI and Updates controls.

Deployment https://38f40130.apu-chatter.pages.dev uses entry `index-BiCn412l.js`;
the stable alias serves that entry on five app routes, with the existing meta
CSP and nosniff header. Hosted two-account theme checks passed local AI-control
and bubble styles, sandbox bridge, pause/reset and isolation from the other
browser; baseline integration passed and removed test data. The first route
probe incorrectly expected CSP as an HTTP header; inspection confirmed it is
an HTML meta policy, and the corrected probe passed. No header change was made.

## Hosted message recovery and activity — 2026-09-28

Separate full baseline runs passed with `TEST_DEPLOYED_UI=1` and either
`TEST_LIVE_RECOVERY=1` or `TEST_LIVE_ACTIVITY=1` (use the activity fixture alone
so its known message counts are unchanged). Recovery disables the mobile-sized
Chromium context network before send, then deliberately replaces a successful
real-server acknowledgement with a 503 on the next attempt. The draft survives
both failures; all three attempts use one client ID and leave exactly one
database row and one visible message in each browser. No horizontal overflow
was observed. This is controlled network fault injection, not a physical phone.

The activity fixture supplies known current-week messages from two people and
one eight-day-old message. Both users see the expected weekly/all-time counts,
six occurrences of “orchard,” the group timezone, and a one-day streak with two
of two eligible participants. Opening Activity creates no AI job. All synthetic
accounts and groups were removed by the successful runners.

## Safety report recovery — 2026-09-28

A failed report request previously cleared the form because its error-catching
helper resolved without a success indication. The browser regression reproduced
the lost field. Safety actions now return whether the server accepted the action;
report text and the selected member remain after failure, and clear after success.
A post-save refresh failure is reported separately to avoid implying that the
action itself failed. The report text is disabled during submission.

The connected browser suite passed after the change. Its populated-textarea
lookup was corrected after DOM inspection showed the retained field existed but
the exact wrapping-label selector no longer matched. Build and private-value
scan passed. Deployment https://96716b57.apu-chatter.pages.dev serves entry
`index-WU9NbZE7.js`; the stable groups route was verified. The full hosted
moderation suite passed, including an injected pre-send report failure, retained
text and real retry, followed by report privacy/resolution, votes, re-entry,
ownership transfer and deletion. Synthetic accounts/group were removed.

## Music and requested Qwen model — 2026-09-29

The user supplied a new OpenRouter key and requested `qwen/qwen3.8-27b:free`.
The key/model are installed as server-only Supabase secrets. Both summaries and
song search previously hard-coded the free router; regressions failed before
the configured-model implementation and passed afterward. The live catalog
listed the requested model with zero prompt/completion prices; key authentication
succeeded, while initial completions returned upstream HTTP 429. The user then
explicitly approved `openrouter/free` fallback. A shared bounded request helper
tries only allowed free models, once each, for transient failures. Authentication
and billing errors do not trigger fallback. Privacy settings are preserved.

The three Edge functions (group-ai, weekly-ai, find-song) were deployed. Real
hosted song search and summary tests passed with the new configuration, including
real catalog IDs, cached retries, no automatic queue insertion, explicit matched
track insertion and source attribution. A separate real weekly worker call
(local worker against hosted DB/provider) passed structured topics, persistence
and deleted-source filtering; this does not re-test scheduler timing.

Hosted Spotify external track/playlist links and skip votes passed, as did
YouTube natural completion advancing exactly one queue item for both accounts.
These preserve the approved Spotify external-playback mode. Provider playback
limitations and physical-device gates remain. All synthetic test accounts/groups
were removed. The current frontend build scan contains neither configured local
private value. No frontend rebuild was needed for the server-only change.

### 29 September: conversation-first tool rail
- Preserved the Clubhouse logo, Manrope typography, teal palette, rounded controls, routes and main tabs.
- Replaced four stacked Music / Voice / Activity / Private chats rows with one compact toolbar. Music and Voice use native nonmodal popovers, keeping the message list height unchanged. Escape, outside clicks and explicit close dismiss the panel; closing Music retains the existing leave-listening behavior. Voice remains connected, with the microphone released when its panel closes.
- Panels scroll independently, with sticky close controls, small-screen sizing and reduced-motion support. Activity and private-chat dialogs retain their existing behavior.
- AI entry remains Group → AI. The owner enables it once; members choose Catch me up, Find decisions or Draft notes & tasks. There is no @AI message command.
- Validation: production build and private-value bundle scan passed; connected Chromium regression passed, including 1280px/390px toolbar height, unchanged chat height with Music and Voice open, Escape/close behavior, no horizontal overflow, and desktop/mobile screenshot inspection.

### 29 September: Stories label and refresh navigation
- Renamed the visible Updates tab to Stories in the connected app and demo; existing posts/reels and story archive behavior remain supported.
- Root cause of apparently missing uploads: initial group loading always selected the first group by creation time. Read-only production aggregates confirmed two live media records and two storage objects in the second group, while the first group had no content.
- Added account-scoped, per-tab navigation restoration for group and main view, plus account/group-scoped album-folder restoration. Restored group IDs are checked against accessible groups; missing access falls back to an available group. No media content is cached in browser storage.
- Verification: connected Chromium multi-group reload regression passed, including retained Stories tab and album folder; demo label/navigation checks, production build and bundle secret scan passed. Production build served locally against hosted Supabase passed actual image uploads, reloads in all album folders, image decoding, newcomer history, archived stories and deletion/access checks. Synthetic accounts, group and files were removed by the harness.

### 30 September: persistent music and expressive composer
- Music controls minimize without leaving or unmounting the provider player. A visible dock retains track/host information and Queue/Leave controls; YouTube remains visible. Refresh offers explicit Rejoin using an atomic, account-authorized connection replacement that preserves a solo listener's queue. Leaving remains explicit.
- Added group-saved playlists (10 per group, current queue up to 100 entries), idempotent playlist loading, added-by labels and one adjustable reaction per person per queue item. New RPCs have fixed search paths and membership checks; tables use RLS.
- Composer supports private image/GIF attachments, recording/preview/cancel/send of voice messages, browser speech recognition into an editable draft, emoji, and 20 local GIF favourites per account/device. GIF/image uploads are limited to 2 MB; audio to 5 MB and 120 seconds. Browser recordings are finalized into seekable files before upload. Dictation may use the browser's remote recognition service; the UI discloses this and never auto-sends transcripts. Favourites do not sync across devices.
- Added delayed app-wide Supabase HTTP activity feedback and contextual preparation/upload/save feedback; small navigation/panel/recording motion respects reduced motion. Heavy recording tools load on demand.
- Database tests passed media constraints, publication idempotency, outsider denial, playlist save/load deduplication, reaction isolation and music resume ownership. Actual MP4/WebM audio fixtures passed duration validation; 121-second files were rejected.
- Connected Chromium checks passed image preview/cancel, emoji insertion, GIF favourite persistence/removal, simulated dictation draft review, stable player identity when minimized, and responsive views. Simulated dictation does not prove the external speech service or physical microphone quality.
- The production deployment passed actual two-account image/GIF/recorded-audio upload/read/refresh, delayed-action indicator, lost-upload-response retry without duplication, recording cancellation/track shutdown, solo-listener music rejoin without queue loss, saved playlist loading, reactions and explicit leave. Actual YouTube natural completion still advanced exactly one queue item for both accounts. Synthetic users/groups/files were cleaned up; no registration emails were sent.
- Hosted security catalog passed 59 privileged RPCs and 35 RLS tables, private buckets and no direct browser upload-policy bypass. Wrangler was updated to 4.144.0 after npm reported transitive undici advisories; npm then reported zero vulnerabilities. Bundle private-value scan passed. Physical Android/audio/dictation/provider testing, SMTP/TURN setup and the earlier external release gates remain open.

Final frontend deployment: https://0b4f1f8d.apu-chatter.pages.dev (stable https://apu-chatter.pages.dev), entry `index-D5ZsmiIJ.js`. Stable HTML verified. Final build and 25-file local-secret scan passed. Real-backend composer check additionally verified that typing the next draft during attachment upload preserves that text (`qa-run/archive/2026-10-03/logs/.draft-preservation-check.log`). Final provider/GIF loading-label additions were build-checked; the preceding production integration run covered actual uploads, retry deduplication, voice playback, music recovery/library and YouTube advancement. Physical-device and external release gates remain open.


## 1 October 2026 — Playful Clubhouse redesign

User selected light, teal and tactile. Shipped connected chat wallpaper picker (Ripple, Confetti, Plain), account/group-scoped local preferences and optional mouse spotlight with reduced-motion fallback. Stories now has a create-story tile, author rail, media filters, media-led cards and manual/keyboard viewer navigation. Music has an original CSS record motif, numbered current queue and refined persistent dock; existing provider/player lifecycle remains unchanged. No new runtime dependencies, paid APIs, or shipping raster assets.

Validation: `check-connected.mjs` passed existing custom-theme/sandbox, music minimization/player identity, chat/media/group and personalization checks plus new preference persistence/filter checks. `check-clubhouse-design.mjs` passed desktop 1280 and mobile 390px layouts, loaded-image captures, filters, Posts-to-author-story navigation, previous/next keyboard navigation, wallpaper refresh restoration and reduced-motion record. Screenshots `docs/design/clubhouse-{chat,stories,music}-{1280,390}.png` use synthetic group/content data and an existing stock photo documented in DESIGN.md, not real users. Independent finish reviewer disposition **ship** after resolving one story collection mismatch. Detector's radial-wallpaper grid advisory reviewed as non-applicable to the expressly requested wallpaper.

Final build passed; raw secret scan passed for 24 files. Vite reports the entry chunk at 500.83 kB uncompressed, 146.67 kB gzip; this slightly exceeds its advisory threshold. Deployment https://f4df48bf.apu-chatter.pages.dev; stable https://apu-chatter.pages.dev confirmed entry `index-D1BIpGEx.js`. Existing SMTP/TURN/physical-device release gates remain open; this is completion of the requested UI redesign, not the entire project.

Hosted regression run `qa-run/archive/2026-10-03/logs/.clubhouse-deployed-check.log` passed music recovery/library/reactions, real private image/GIF/recorded-audio sends and upload retry deduplication, peer playback metadata, authentication/chat/avatar, invite/Storage/access, board concurrency and cleanup. Synthetic microphone only; no authentication emails sent. Temporary test accounts and group removed.

1 October group-tools correction: reproduced the reported duplicate Activity launcher after one group switch (expected 1, received 2). ActivityPanel and RoomStyle were keyed by the same group ID among siblings. Assigned unique component-prefixed keys. The browser regression now switches between two groups eight times and checks a single Activity and Room style control after each return; it passed along with the design interaction checks. Build and 24-file local-secret scan passed. Frontend entry `index-DqVrBw9K.js`.

## QA corrections — 2026-10-01

Fixed clipped group tools with labelled compact controls below 900px; darkened header metadata and inactive tabs; increased message-profile hit height to 28px. Repaired standalone private-chat PGlite storage fixture. Six-width browser retest, 100 contrast measurements (minimum 5.56:1), connected regression, private SQL tests, build and build-secret scan passed. Deployed https://7c402100.apu-chatter.pages.dev; stable production verified serving index-D-FmhTNH.js. QA inventory: 28 passed, no failed, five blocked. See qa-run/2026-10-01/report.md and ui-ux-report.md for scope and remaining external checks.

## Incoming message banners — 2026-10-03

IMPLEMENTATION_COMPLETE / TESTED: approved in-app notifications reuse the joined-group realtime subscription and event deduplication. Up to three text-safe banners show group, sender (or Group member fallback) and a bounded message/attachment preview; click opens the group Chat, dismiss removes a banner, and oldest banner expires after eight seconds with hover/focus pause. Own/deleted/old messages are excluded; focused current Chat is suppressed. Per-sender sound behavior remains. No notification permission prompt, browser OS notifications or closed-app push were added.

Verification: check-notifications.mjs passed browser eligibility, mobile containment, open/dismiss and automatic-dismiss checks. TEST_NOTIFICATIONS=1 check-connected.mjs passed duplicate event dispatch through the actual notification callback, visible banner and click-to-Chat plus full existing connected fixture regression. Build and build-secret scan passed. These are isolated Chromium fixture checks; actual cross-device delivery and physical mobile checks remain unverified.
Deployment: https://5aede7df.apu-chatter.pages.dev; stable https://apu-chatter.pages.dev verified serving index-Ba_tEnc8.js. Deployed frontend verified; live multi-account delivery awaits user acceptance.
