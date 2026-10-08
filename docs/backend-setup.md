# Connect the first core slice

Status: prepared locally, not deployed. No Supabase project, SMTP sender, or production accounts have been created.

## What is implemented

- Clubhouse sign-in, registration, email-confirmation callback, password recovery/reset screens.
- Supabase client using public browser credentials, session gating, verified-email checks, and sign-out cleanup.
- Connected group UI, separate from the illustrative demo: empty state, create group, share/revoke an invitation link, immediate joining, group text history with pagination, send/retry, profile editing.
- SQL migration: profiles, groups, roles, hashed invites, bans, messages, row-level security, verified-account checks, and database RPCs.
- Realtime INSERT subscription with focus/reconnect and 15-second visible-tab refresh. Membership is rechecked before displaying results; database policies apply on every read/write.

## Setup when a project is available

1. Create a Supabase project on the chosen plan. This task has not enabled billing or created remote resources.
2. Run `supabase/migrations/202609210001_core.sql`, then `supabase/migrations/202609220002_moderation.sql`, once each in that order, using the Supabase SQL editor or your normal migration workflow. These change schema; use a new development project, not an unrelated existing production database. The core script adds the message table to the existing Supabase realtime publication.
3. Enable email/password authentication and email confirmation. Set the minimum password length to 12 in Supabase Auth so the server matches the registration/reset UI. Disable unwanted login providers.
4. Set Site URL to `http://127.0.0.1:5173` during development. Allow auth redirects to `/auth/callback` (including its safe `next` query) and `/reset-password` on that origin. Configure your actual HTTPS origin separately at deployment.
5. Configure custom SMTP before inviting external users. The default Supabase sender is restricted. Confirm the email templates preserve the redirect destination.
6. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using the project URL and **public publishable/anon key**. Never use a service-role key, secret key, database password, or OpenRouter credential in `VITE_*` values. Restart Vite.
7. Open `/register`, confirm the email, then open `/groups`. Use a second verified account/browser to test a group invitation, full history, realtime delivery, and password reset. Verify email delivery to an address that is not a project-team address.

`/demo` retains the design prototype. `/login`, `/register`, `/forgot-password`, and `/reset-password` display the account interface even without configuration and explicitly explain that submissions are unavailable. `/groups` never silently displays fake account data.

## Local checks

Run Vite on port 5173, then:

```powershell
npm run build
node scripts/check-database.mjs
node scripts/check-moderation.mjs
node scripts/check-accounts.mjs
node scripts/check-connected.mjs
node scripts/check-ui.mjs
node scripts/check-motion.mjs
```

`check-database` runs the migration in PGlite (embedded Postgres) with a test `auth.users`, `auth.uid()`, and role fixture. It exercises actual SQL grants/RLS and transactions, but not Supabase's email service, JWT validation, realtime service, or simultaneous multi-client transactions. `check-connected` uses a temporary Vite server on port 5174 with mocked Supabase HTTP responses; it proves the UI wiring, not service availability. `check-hosted.sql` runs against the linked project and rolls back its fixtures; no test sends email. The older `check-accounts` unconfigured-state test requires blank environment values and should not be run unchanged against the configured app.

## Hosted connection — 2026-09-22

Connected existing project **APU chatter** (`ynnzfygliidbwgvpkxjl`, ap-south-1). All three committed migrations are applied. Local `.env` contains the project URL and public client key only; it remains ignored. No plan upgrade or paid add-on was requested.

Hosted Auth uses email/password, required email confirmation, 12-character minimum passwords, and localhost/127.0.0.1 port 5173 confirmation/reset redirects. For future hosted config changes, use the deliberately minimal file: `npx supabase config diff --workdir supabase/hosted --project-ref ynnzfygliidbwgvpkxjl`, then `config push` with the same arguments. The root config contains local development defaults and should not be pushed wholesale.

Verified live Auth settings and anonymous REST denial; all ten app tables have RLS, and group_messages is in the Realtime publication. `npx supabase db query --linked --file scripts/check-hosted.sql` passed hosted group creation, invite joining, sending, outsider isolation and history access. Its temporary users/data were rolled back. These checks do not verify email delivery or a signed-in browser's Realtime connection.

Advisors: fixed three policy performance warnings in the third migration. Twelve intentional authenticated SECURITY DEFINER RPC warnings remain: these are the constrained mutation API, with explicit identity/membership/role checks, empty search paths, and anonymous/PUBLIC execution revoked. See [Supabase advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Embedded authorization/moderation checks and production build passed.

**Remaining onboarding dependency:** custom SMTP is not configured. Supabase's default sender only accepts project-team recipient addresses (currently two messages/hour). Configure a sender before inviting ordinary testers; keep email confirmation enabled. No verification emails were sent during setup. Update Site URL and redirect allowlist when deploying beyond localhost.

## Current limits / next milestones

- Membership controls now include owner-appointed admins, direct removals, ownership transfer, leaving, kick/keep votes, and re-entry management. Group deletion, user blocking/reporting, and real temporary chatboxes remain outstanding. The temporary chatbox is still a demo only.
- Invitations now include a QR code for the same shareable link. Generating a link revokes the group's previous active invitation. Administrators can lift ordinary-member bans; only owners can lift removed-admin bans. Restored users rejoin as ordinary members.
- Message deletion, attachments, replies/reactions, and Updates/Albums remain demo-only. Connected chat sends plain text. Loaded history currently merges new text messages; deletion synchronization belongs with the later deletion RPC.
- Server limits: 10 groups owned per account and 30 new messages per minute per user/group. Retries reuse their client ID. Database constraints validate body/name lengths and group timezone.
- No end-to-end encryption claim. Access is enforced through database authorization.
- UI motion respects the OS setting; the demo's in-app motion toggle is not yet an account preference.
- Recheck deployed RLS, token refresh, expired/replayed confirmation/reset links, race conditions, browser focus/keyboard behavior, and realtime on a real project before inviting testers. Local green tests do not mark the full pilot complete.

## Moderation behavior added 2026-09-22

The Members button opens member actions, private-ballot vote totals, and (for managers) removed-member controls. The SQL migration enforces ordinary-member Kick threshold `ceil(eligible / 2)` and admin threshold `eligible`, excluding the target. Owners cannot be targeted. Starting a vote does not implicitly cast the initiator's ballot. A cast ballot is immutable; identical retries do not add a vote. Reaching the threshold automatically bans/removes the target in the transaction.

Votes last 24 hours. Failed/expired votes impose a seven-day per-target cooldown. Membership/role changes cancel open votes so a stale electorate cannot remove someone. Ballot rows are readable only by their voter; aggregate counts are stored on the vote record. Service/database operators are not included in this client privacy guarantee. The UI refreshes controls every 10 seconds while visible; expired votes are immediately non-votable even if their stored status is finalized on a later mutation.

Embedded database tests include owner immunity, threshold math, automatic removal, idempotent ballots, private ballot reads, admin authority, re-entry role reset, snapshot cancellation, owner transfer, expired-vote rejection and cooldown. The mocked UI test covers QR rendering, starting/casting a vote, the removed-member flow, and mobile layout. Real QR scanning, SMTP, hosted Supabase behavior and concurrent network clients remain deployment checks.

## Reference documentation

- [Supabase password signup](https://supabase.com/docs/reference/javascript/auth-signup)
- [Redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls)
- [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Database functions](https://supabase.com/docs/guides/database/functions)

## Temporary chatboxes — 2026-09-23

Implemented and applied `20260922142624_private_chatboxes.sql` to the linked project. Groups now have a Private chats entry with request, accept, decline, cancel, open, send and end/delete controls. Requests expire after 24 hours; opposite-direction retries use the existing request. Only the recipient can accept. Both participants must remain members; owners/admins cannot read another pair's text through the client API. End, leave and removal delete private message rows transactionally. No message body is written to browser storage. Closing the panel keeps the conversation open; End conversation requires a deletion confirmation.

Verified: `npm run build`, `node scripts/check-private.mjs`, updated `node scripts/check-connected.mjs` (mocked desktop/mobile request/accept/send/end), and `npx supabase db query --linked --file scripts/check-hosted.sql` (hosted accepted private chat and physical deletion, fixtures rolled back). Mechanical UI detector returned no findings. User confirmed real account creation and sign-in work.

Limits: private UI shows latest 100 messages; it revalidates on realtime notifications, focus/online and a three-second foreground polling fallback. Content already received cannot be recalled from an offline device or screenshots. Database deletion does not promise immediate backup erasure. Blocking/reporting and periodic expired-request maintenance are still pending; expired requests cannot be accepted and are closed on the next request in that group. Two real signed-in browsers and concurrent connection races still need pilot verification. This is not end-to-end encryption.

Advisors report intentional authenticated SECURITY DEFINER RPCs (16 total) and disabled leaked-password protection. The RPCs enforce authorization internally and revoke anonymous execution; no RLS/performance warning was returned at WARN level. Review password protection in the Auth dashboard before wider rollout; no billing or plan settings were changed. SMTP setup/delivery to non-team addresses remains unverified.

## Group message deletion — 2026-09-23

Applied `20260923063146_group_message_deletion.sql`. Authors and group owners/admins can delete messages through a confirmation dialog. Deletion replaces the stored body with a generic marker and records deleted_at. The original text is erased; the client retry key is retained so a delayed duplicate send cannot restore it. Direct table writes remain forbidden. Realtime UPDATE notifications and foreground polling recheck deleted markers for all loaded message IDs, including older pages.

Verified production build, SQL deletion authorization/idempotency tests (`node scripts/check-deletion.mjs`), connected UI cancel/confirm deletion checks, private-chat regression, and hosted rollback smoke text-erasure assertion. Screenshots/offline copies/backups cannot be recalled. The active group updates on notification or the existing 15-second foreground poll; actual two-user network timing remains a pilot check.

## Core safety and activity progress — 2026-09-23

Applied personal blocks, owner reports and exact-name-confirmed group deletion. Blocks close pair chats across groups and erase their private messages; request insertion checks blocks in both directions. A follow-up migration serializes block/request races by pair. SQL tests cover permission/privacy/deletion; browser tests cover Safety controls and destructive name confirmation.

Group Activity now exposes weekly/all-time counts, common English-letter words, and timezone-local group streak progress. Only nondeleted group text counts. A durable daily eligibility snapshot freezes the denominator; minimum two participants, 30% rounded up. Existing groups have no retroactive reliable eligibility history before this feature, so streak tracking begins with recorded snapshots. The first-day snapshot includes then-current members; later days include those joined by midnight. Scheduled snapshots run every minute (group-local dates), and pending private requests expire in cleanup every 15 minutes. Access/send paths also initialize the current snapshot. Hosted cron entries are active.

`check-safety.mjs`, `check-activity.mjs`, expanded mocked `check-connected.mjs`, and build passed. Actual simultaneous connection race testing remains needed; no complete-project or full-pilot claim. Cloudflare Pages selected; login is pending user action. User has OpenRouter but no SMTP provider yet.

## Sharing integration — 2026-09-23

Updates and Albums now use canonical group_content records and the private group-media bucket. Posts can be text-only; stories expire from Updates after 24 hours but remain in Stories; shared/post/reel media appear in Shared; chat-kind publication inserts a group-message reference. Canonical deletion hides both views, wipes captions and marks linked messages deleted. Group deletion enqueues physical objects for cleanup. Reservations enforce 100MB/group, 500MB global and 30 reservations/user/hour; deleted bytes remain charged until storage removal is confirmed. Uploads use upload-media with verified Auth, bounded request size, actual file-size/reservation matching and file signatures; direct browser Storage INSERT is disabled. Image compression is local; video duration is currently checked in-browser only, so server duration verification remains a release gap.

Deployed Edge Functions: upload-media, remove-content and media-cleanup. They check user identity/permissions or the separate cleanup secret inside the function. Legacy gateway JWT checks are disabled to allow current signing keys; this is not unauthenticated data access. MEDIA_CLEANUP_SECRET is stored in an ignored local env file, Edge secrets and Vault. pg_cron invokes a private pg_net cleanup dispatcher every15min. Failed/abandoned uploads expire after1h and group-deletion files are retried. No service key is in Vite.

Live integration test passed with two temporary confirmed Auth accounts: create/join, real image upload/download, Edge deletion, read denial afterward, activity and block-triggered private-message deletion. Test fixtures were deleted and no mail sent. Mocked UI test covers text Update publication. Build passed. Full media UI visual verification, larger-video tests, pagination beyond latest100, avatars/unread indicators and server-side video duration checking remain release tasks. See scripts/check-live-integration.mjs; it reads admin test credentials into process memory and never prints them.
# Local personalization — 2026-09-23

Connected `/groups` now exposes Appearance and Group sounds in the sidebar. Visual theme controls and a restricted CSS editor affect the local conversation surface; JSON imports are validated before application. Interactive HTML/JavaScript runs in an opaque-origin sandbox preview and can suggest validated theme tokens through a source-checked message bridge. Arbitrary code does not run inside the authenticated application. Theme files contain presentation settings only.

Notification settings are local per account, group and sender. Chime, pop, silent and imported audio (2 MB / five-second limits) are supported, with a group mute override. Imports stay in IndexedDB. Users must enable audio after each reload. Only fresh realtime INSERT events from other authors in the currently selected group trigger audio; historical messages and polling do not. Background groups and a closed browser do not currently receive custom sounds. Browser storage eviction can remove local preferences and audio.

Verification: `node --experimental-strip-types scripts/check-personalization.mjs`, `node scripts/check-connected.mjs`, and `npm run build`. Browser coverage uses a mocked backend, not live realtime delivery. The app's deployed AI integration was separately verified with temporary hosted users and a group; server-side OpenRouter secrets are configured for `openrouter/free`.
# Sharing and music progress — 2026-09-24

Sharing now uses 40-item keyset pages, server folder/author filters, loaded-item deletion reconciliation and viewport-triggered media downloads. Chat avatars open author-filtered Updates; unread status comes from a membership/RLS-protected aggregate and is cleared only after opening an update. Display names independently open member profiles.

Profile avatars use a separate private `profile-avatars` bucket and profile-owned reservations. Only the owner and people who can read that profile may fetch the current image. Uploads are compressed to 384px square / 256 KB, server MIME/signature/size checked, rate-limited and bounded by a separate 20 MB pilot quota. Replacing/removing revokes the old reference transactionally; scheduled cleanup reclaims old objects. Real hosted upload/read/anonymous-denial/removal checks and deployed UI upload/removal passed.

Videos now undergo bounded server-side MP4/WebM parsing with Mediabunny 1.59.0. Real one-second and 31-second fixtures were tested against the deployed upload function; short videos succeeded and long ones were rejected. This checks container/sample duration, not content moderation or a guarantee every browser supports every codec.

Music session/queue/listener leases are deployed. The UI supports allowlisted YouTube and Spotify track/playlist links, opt-in listening, host transfer/order controls, majority skip votes, stale-revision rejection and automatic host succession after lease expiry. YouTube single-video commands coordinate through server state; Spotify and playlist embeds currently play individually and are labeled accordingly. No real provider song search yet. Database and real hosted RPC tests passed; browser player integration was tested with a fake YouTube API, so actual provider playback is still a release gate.

### 2026-09-24 private history verification
Private chat history now loads older messages in 100-row keyset pages, rechecking conversation state after each fetch. A mocked browser regression covers 106 messages, loading older history, and ending the conversation. The private-chat SQL suite passes participant-only reads and close/leave/removal deletion. Browser-local sounds across joined groups were also verified against hosted realtime in the prior deployed integration run. SMTP and the remaining README release gates are still pending.

### 2026-09-24 weekly activity topics
The weekly AI worker now returns a summary and up to five discussion topics in one provider request. Topic references are filtered to actual context message IDs, saved through a service-only atomic completion function, and displayed in group Activity with supporting-message links and partial-context disclosure. Opening Activity does not request AI. A topic is excluded when any referenced message is deleted. Parser, worker, SQL access/deletion and mocked browser checks pass. The real free OpenRouter model and hosted persistence/read/deletion flow passed with disposable accounts; the worker was invoked locally, so this does not prove scheduler timing or retries. Migration 20260924040000 and the weekly-ai Edge Function are deployed.

### 2026-09-25 weekly scheduler verification
check-weekly-scheduler.mjs executes the installed SQL definitions in isolated PGlite, replacing only now() for deterministic clock control. It passes Monday 09:00 in Kuala Lumpur, New York spring/fall DST, inclusive start/exclusive end, duplicate ticks, completed-week suppression, crashed-worker cooldown and two-attempt cap, empty/deleted-only/AI-disabled groups, and member denial. Hosted cron inspection confirmed chatter-weekly-ai active at */15 * * * *, latest inspected run succeeded at 2026-09-24 03:30 UTC; matching HTTP responses at 03:00/03:15/03:30 returned 200 with processed=0. Vault secret presence was checked without printing values. This proves scheduler plumbing and isolated boundary behavior; real provider/topic persistence was separately verified with temporary test data.

### 2026-09-25 board recovery
Unconfirmed shape writes retain a visible draft and offer Retry/Discard while the board stays open. Retry checks the stable shape ID and revision before writing: an identical accepted edit is acknowledged without a duplicate, and a newer competing revision is preserved. Drawing, text and eraser writes share this path. Unsaved state is in memory; do not navigate away before resolving it. Browser regression tests cover failure before commit, loss of response after commit, retry and personal undo. Tab lists subscribe to realtime and refresh on focus/online with a five-second foreground fallback. Build and the board SQL suite passed. Undo/redo failure recovery remains a separate improvement.

Hosted two-browser board verification passed: a newly created tab appears for the other member, concurrent strokes both persist, one member’s undo preserves the other’s stroke, and an offline browser catches up after reconnect. Temporary test accounts and groups were removed. Retry acknowledgement additionally requires the stored updated_by to match the current user; an identical competing edit is treated as a conflict.

### 2026-09-25 explicit song search
The find-song Edge Function verifies the user and membership, requires group AI opt-in, and shares the existing 3-per-user / 20-global daily requested-AI quota. OpenRouter free-model output supplies search terms only; actual track/album IDs, artists and titles come from the Apple catalog. Nothing is queued until selection. Retries reuse the stored job result. Apple track IDs and storefronts are validated by the music RPC; the official embed handles individual playback, potentially a 30-second preview without eligible Apple sign-in. No claim of free full-track or synchronized Apple playback.
Parser, quota/access, music URL, existing music/AI SQL, and mocked browser match-selection checks passed. Live find-song with real OpenRouter and Apple, cached retry, and selected-match insertion passed; an earlier live attempt failed with the old generic error, and its exact cause was not identified. Stage-specific failure copy was added. Temporary live-test accounts/groups were removed. Full provider playback remains an open release gate. Run TEST_LIVE_SONG=1 with scripts/check-live-integration.mjs to repeat the live flow.

### 2026-09-26 live local UI customization
Applied themes now persist HTML/JavaScript controls in an opaque sandbox frame. A source/origin/version-checked bridge accepts validated theme/CSS updates and composer focus only. CSS now covers component states, navigation appearance, spacing/layout and bounded motion, with reduced-motion overrides. Imported code stays off, and pause/reset/visit-local rollback/safe-mode reload remain trusted controls. A new parent frame-src policy closed a demonstrated arbitrary-frame-navigation path; the regression failed before the policy and passed afterward. The connected Chromium suite passes runtime styling, blocked parent access/fetch, source spoof rejection, reload persistence, pause, rollback, import opt-in and reduced motion. See docs/theme-code.md for supported capabilities and limits.

Hosted verification passed on the deployed theme build: two signed-in browsers retained independent appearance, the live version-1 bridge changed only the initiating browser, and trusted pause/reset worked. The same hosted run passed sign-in, cross-browser chat, avatar access/removal, private media deletion, concurrent board writes and private-chat block closure. Test users and the group were removed. Stable preview asset index-BCy0Qx1v.js and the frame-src policy were confirmed over HTTPS.

### 2026-09-26 message and board history recovery
Board undo/redo now uses the same stable-ID, revision and author-checked recovery path as drawing writes. History moves only after confirmation, including recovering an accepted operation whose response was lost. Text restoration skips lease acquisition on deleted objects while preserving server lease enforcement. Stopping retries does not claim to reverse already committed changes.
The mocked browser suite passes before-commit and lost-response retries for both group and temporary private messages, with retained input, one stable client ID and one stored message. Existing SQL suites prove server deduplication and private deletion. Hosted two-browser board verification simulated a lost undo acknowledgement and a pre-commit redo connection failure on a real text object; create/undo/redo finished at revision 3, peers reconciled, and test data was removed. Build, board recovery unit tests, board SQL, private SQL and the connected browser suite passed.

### 2026-09-26 Spotify shared track controls
Real provider probing established that Spotify's Embed API controls music previews as well as exposing track playback events. MusicRoom now uses SpotifyPlayer for single tracks, with existing authorized host play/pause/seek commands, duration-aware local preview exhaustion, explicit device audio activation and cleanup on leave. A local preview ending never advances the shared queue. Playlists and Apple embeds remain individual playback.
Build, music SQL, connected browser regression, and real two-component playback passed. The change was deployed to https://1800b9f3.apu-chatter.pages.dev; stable preview serves index-DZvaEd4p.js. A real hosted two-user check passed Spotify preview playback, seek/pause, preview-limit handling, seek-back recovery and leave destruction with desktop/mobile Chromium viewports. It also passed the existing sign-in/chat/avatar/media/board/private-block checks and removed temporary data. Full-song and physical mobile playback are not claimed. See music-provider-verification.md for exact test scope and commands.

### 2026-09-26 reconnect history gaps
Group messages and sharing previously merged a full, disconnected latest page with already loaded history. The older-page cursor then skipped the intervening rows; if all old history was loaded, the older button could stay hidden entirely. Both loaders now detect the lack of overlap and reset to the latest contiguous page with earlier paging available. Overlapping refreshes preserve expanded history, and deletion reconciliation remains active. This resets the displayed history window after a large burst; earlier content is still available through paging.
The connected browser regression reproduced the missing older button independently for 45 new updates and 55 new messages before the fixes. After the fixes it reaches the intervening oldest new update/message through paging and preserves the original message deletion. The full connected browser suite, focused gap test and production build passed. The mocked group-message endpoint now honors timestamp/ID cursors, limits, IDs and deletion filters instead of returning every message.

### 2026-09-26 account-level block recovery
Profile settings now lists the caller's blocked accounts, including people who no longer share a group. Unblocking requires confirmation and retains a retry option on failure; it does not restore deleted conversations. The new verified-caller-only blocked_accounts RPC returns only IDs/display names for the caller's existing blocks. The existing unblock RPC already supports no group membership. Migration 20260926010000_blocked_accounts.sql was applied.
The new PostgreSQL regression, full connected browser suite and production build passed. The hosted security catalog check passed with 55 privileged RPCs; real hosted block-list isolation and unblock after leaving the group passed, with temporary accounts/group removed. Browser tests include having no groups, keeping a block at confirmation and retrying a failed unblock.
