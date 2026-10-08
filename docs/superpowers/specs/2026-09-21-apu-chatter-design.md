# APU Chatter — Web Product Specification

Status: planning baseline, not an implemented application. Updated 2026-09-21.

## 1. Product direction

APU Chatter is a private, group-centered social website for people who want to talk, share memories, listen together, and collaborate. There is no public discovery feed, friend list, friend-request system, or university-only restriction.

The developer works alone, knows React, and wants running costs as close to free as possible. Start with fewer than 20 invited testers. Deliver a responsive web application; native Android/iOS applications are outside the current release.

### Confirmed constraints

- Web only; usable on desktop and mobile browsers.
- Registration uses email and password, email verification, and email-based password reset.
- Group invitations use QR codes or links and grant immediate entry.
- New members can read all existing group messages and albums, excluding deleted content.
- OpenRouter is the AI provider gateway; its credentials remain on the server.
- Temporary private chatboxes support text only and have no AI, streaks, media, voice, or whiteboard.
- Whiteboards belong to groups and have a fixed maximum of 20 tabs.
- Third-party bots are a later addition.

## 2. Accounts, groups, and privacy

Users have a display name, avatar, short bio, and manually chosen status. Email addresses are private account information, not group-directory fields. Presence is optional and distinct from profile status.

Users create groups with a name, description, and timezone. The creator becomes owner. Owners appoint and demote admins. Group links contain a cryptographically random invitation token; the QR encodes the same HTTPS link. Unauthenticated visitors register or log in before joining. A valid invite joins immediately unless the account is banned from that group. Group messages and member lists are never available merely by possessing an invite URL.

Owners/admins can revoke and replace invite links. Joining is idempotent. A group has exactly one owner. Proposed default: the owner must transfer ownership to a current member before leaving, or explicitly delete the group. Group deletion requires a separate destructive confirmation in the product.

Membership removal immediately revokes server reads/writes and closes associated temporary chats. Previously seen content cannot be made unseen. Server authorization is required on every operation; hiding a screen is not authorization.

### Moderation rules

| Action | Permission or threshold |
|---|---|
| Directly remove ordinary member | Owner or admin |
| Directly remove admin | Owner only |
| Remove owner | Never permitted |
| Start kick/keep vote | Any member except against themselves or the owner |
| Vote to remove ordinary member | Kick votes from at least 50% of other human members, rounded up |
| Vote to remove admin | Kick votes from 100% of other human members |
| Re-entry after removal | Blocked until explicitly allowed back |

The threshold uses all eligible members, not only those who cast ballots. Abstention therefore does not help removal. The target cannot vote; bots are excluded. Successful votes remove automatically, without an admin veto.

Proposed implementation defaults, not additional user decisions:

- Voting lasts 24 hours and finishes early when its threshold is reached.
- Individual ballots are hidden from other clients; totals and outcome are visible. Database operators can technically access ballots.
- Freeze the electorate and target role when the vote starts. If membership or a role changes, cancel the open vote and allow a fresh vote against the new membership state. This avoids entrants/leavers changing a live threshold.
- One active vote per target; 7-day cooldown after an unsuccessful vote against that target. Direct admin removal remains available.
- Restoring a removed ordinary member is an owner/admin action; restoring a removed admin is owner-only. Restoration lifts the ban and allows rejoining as an ordinary member, not automatic reinstatement of their role.
- A report can be sent to the owner; a personal block prevents private requests. A block does not delete shared group history or promise mutual invisibility inside a group.

## 3. Core communication

### Group chat

Persist text messages with sender, server timestamp, and unique client request ID. Show pending, sent, and failed states; retries must not duplicate a message. Load history in pages and reconcile realtime events after reconnecting. Send plain text, never render user HTML. Later media messages share the album asset rather than creating duplicate files.

Proposed pilot defaults: 4,000 characters per text message, 50 messages per history page, 30 sends per user per minute per group. Show an actionable retry state when offline. Do not silently queue temporary-chat text for later delivery after that chat has closed.

### Temporary private chatboxes

One member requests a chat with another current member of the same group. The recipient accepts, declines, or blocks. There is no permanent direct-message inbox independent of groups.

Lifecycle: pending -> open after acceptance -> closed. Either participant can end an open chat. Leaving or removal from the group closes pending/open chats for that participant. Closing deletes the associated text from the live database, clears both clients' visible state, and rejects subsequent sends. Retain only a content-free closed marker to reject stale clients; a new conversation requires a new request and ID.

Proposed default: only one pending/open chat per unordered member pair per group. Pending requests expire after 24 hours. No private message bodies in application logs, push payloads, analytics, or durable browser caches. Deletion does not imply erasure from screenshots or any provider backups; deployment documentation must disclose actual backup retention.

## 4. Updates and shared albums

Posts, short videos/reels, and stories belong to one group and appear in its Updates tab. A member avatar in the main chat has an accessible unread-update indicator; clicking the avatar opens that member's updates in the current group. Provide a separate profile/menu action so this does not hide profile access. Mark an update seen when actually opened, not just when the tab renders.

Stories disappear from the story view after 24 hours. Their album entries remain until explicitly deleted. Albums contain:

1. Shared folder: deliberately uploaded photos/videos.
2. Stories: automatically saved story media.
3. Chat media: photos/videos sent in the group conversation.

Use one canonical content record and asset reference. Explicit deletion from the source or its album representation removes both representations; ordinary story expiry is not deletion. Proposed permission default: authors delete their own content; owner/admins may delete group content for moderation. Retain an audit event without retaining the media or message body. Object-storage deletion can be retried asynchronously, but access is revoked immediately.

Proposed media pilot limits: images compressed to at most 2 MB; videos at most 15 MB and 30 seconds; 100 MB stored assets per group with a deployment-wide ceiling below the provider quota. Reject new uploads clearly when limits are reached; never silently erase old memories. These are cost controls, not permanent product promises.

## 5. Group whiteboard

Each group has one board with up to 20 named tabs. All members may edit simultaneously; no admin locks or editor invitations. Each tab is a fixed-size canvas, not an infinite canvas. Proposed dimensions: 1920 x 1080 logical units, with 25–400% zoom and panning. Zoom never changes saved coordinates.

Tools: pen, eraser, highlighter, text box, colors, stroke thickness, tab renaming, undo/redo. Show collaborator cursors and names and save changes automatically. Undo affects only the current user's edits and does not rewind other people's work.

Use a collaborative operation model/CRDT with stable shape IDs. Persist document state separately from ephemeral cursors; do not write every pointer move to Postgres. Enforce the 20-tab limit atomically on the server under concurrent creation. Proposed eraser behavior: erase a whole selected stroke/object in the initial version. A text object has one active editor at a time, while other board editing remains simultaneous.

## 6. Live music

Each group has an independent listening session. Members explicitly join listening; adding music does not force sound on other users. Everyone can add supported tracks/playlists. The session starter hosts, controls play/pause and queue order, and can transfer hosting. If the host leaves, the longest continuously connected remaining listener becomes host; empty sessions end.

Listeners vote to skip. Proposed default: more than half of current listeners must vote, excluding bots, with one vote per listener per track. Use a brief reconnect grace period before host succession. Playback commands have a monotonically increasing revision and server timestamp; the server chooses the host, not competing clients.

AI song search returns real provider search matches; the requester chooses a result before enqueueing. Never invent track URLs. Treat pasted URLs as untrusted input: provider allowlist, no arbitrary server fetching, no downloading/rehosting copyrighted audio.

Universal synchronized playback is a product aspiration, not a supported guarantee. Provider APIs, accounts, subscriptions, embedded playback, and policies determine what is possible. Run a separate provider feasibility milestone before implementing music. Unsupported links show a clear explanation and can open externally, but external playback must not be represented as synchronized listening. Do not assume Spotify and YouTube tracks can share a universal playback engine.

## 7. Activity, streaks, and AI

### Activity

Leaderboards exist inside each group only. Show weekly and all-time message counts and rankings, common words, and weekly topics. Count accepted human group messages, excluding system messages, AI output, temporary private messages, and retries. Proposed default: deleted messages are removed from counts. Use a deterministic tokenizer/stop-word list for common words and label its language limitations; use the weekly AI job for topics.

Group streak qualifies when at least ceil(0.30 * human member count) distinct members send a qualifying message on the group-local date. Proposed minimum: two human participants. Freeze the daily eligible-member set at local midnight; on a group's first day, use its first nonempty membership snapshot. Newly joined members begin counting the following day. This prevents mid-day joins/removals moving the goal. Display progress and explain eligibility. No personal/1-to-1 streaks remain after the change to temporary chats.

The group timezone defaults to its creator's IANA timezone. Proposed pilot default: timezone is fixed after creation to avoid rewriting daily history. Weeks run Monday 00:00 through the following Monday 00:00 in that timezone.

### OpenRouter AI

Only explicit requests trigger AI, except one weekly automatic summary per group on Monday at 09:00 group-local time. No continuous analysis, unsolicited bot replies, or private-chat analysis. Do not generate extra summaries for every message or daily topic analysis.

Requested capabilities: catch up on a selected conversation range, summarize decisions, draft notes/tasks on request, and search for songs. AI-created actions require user confirmation; model output cannot directly modify permissions, delete messages, or execute code.

Weekly output covers key discussions, decisions, and topics with source-message links. Only include music shared that week if supported. If there is no new content, skip generation. Mark incomplete coverage when message volume exceeds the configured context budget. One job key per group/week prevents duplicate posts; bounded retries handle provider failure without pretending a summary succeeded. A scheduler checks due work in UTC using each group's timezone rather than a fixed UTC offset.

The backend verifies current membership, selects only that group's allowed messages, and supplies minimal context. Disclose external AI processing in group onboarding. Group text is private by access control, not claimed end-to-end encrypted. Never send passwords, emails, secrets, temporary-chat text, or cross-group context to the model. Treat chat text as untrusted data, not instructions to the assistant's tools.

Proposed cost controls: AI disabled until an operator configures a tested model ID; allowlisted free model initially; no paid fallback; 3 requested jobs per user/day; 20 requested jobs deployment-wide/day; reserve separate capacity for weekly jobs; maximum 8,000 input and 1,000 output tokens per job. Check actual provider quotas before enabling. A rate-limit/capacity failure leaves normal chat operational. OpenRouter free capacity is not a reliability guarantee.

## 8. Voice, notifications, and customization

Voice rooms allow members to join/leave freely and choose open microphone or push-to-talk. Proposed pilot cap: four simultaneous participants in one room per group. Microphones start muted and require permission. Push-to-talk releases on key-up, focus loss, touch cancellation, and disconnect. A later voice feasibility milestone chooses signaling and TURN/SFU service after measuring cost and browser reliability; full-mesh WebRTC is not assumed to be free or reliable on every network.

Each listener assigns a built-in/imported notification sound to each sender in each group. A mapping does not affect other members. Browser implementation: custom sounds while the application is open and audio has been unlocked by user interaction; background/closed-browser notifications use supported browser/OS behavior. Do not promise arbitrary per-sender background sounds. Imports are validated audio with short duration and local storage. Muting a group overrides sender sound preferences.

Customization includes a visual editor, theme imports, and a code editor for bubbles, page layouts, controls, navigation appearance, animations, and UI interactions. Changes remain in that browser profile on that device; no cloud theme sync by default.

Build in stages: CSS tokens and scoped styles first; advanced interaction code later in a sandboxed iframe without same-origin privileges. Never eval imported code in the authenticated application. Expose a small versioned, capability-based UI bridge with synthetic/display data, not credentials or unrestricted chat data/network access. Auth, consent, moderation confirmations, and reset/recovery controls remain trusted application UI. This is a proposed security boundary for the requested UI-only customization, not permission for arbitrary application extensions. Provide preview, reset, rollback, keyboard accessibility, and reduced-motion support. Theme exports contain presentation configuration only.

## 9. Architecture and first release

Use React + TypeScript + Vite, React Router, and CSS variables for the web client. Supabase provides Auth, Postgres with row-level security, Realtime, private Storage, and server functions. OpenRouter calls run in server functions only. Use Vitest for deterministic client logic, database integration tests for authorization/transactions, and Playwright for user journeys. Select compatible stable versions when scaffolding and commit the lockfile; no version claims are made here.

Client flow: authenticate -> retrieve authorized group data -> subscribe to authorized realtime changes -> execute validated server mutations -> reconcile canonical database results. Use durable records for messages and membership; realtime is an update signal, not the source of truth. No service-role or OpenRouter secret belongs in Vite environment variables.

The first pilot includes accounts, text profiles/status, group invites, group text chat, roles, votes, bans, blocks/reports, and temporary text chatboxes. Rich media/avatar uploads, Updates, whiteboard, voice, music, AI, and custom themes are subsequent milestones. Use initials-based avatars in the first pilot. Do not create nonfunctional navigation tabs for unreleased features.

## 10. Milestones and acceptance

| Milestone | Working deliverable | Release gate |
|---|---|---|
| M1: core groups | Accounts, invites, chat, moderation, temporary chats | Two real users complete the whole flow; authorization tests reject outsiders and removed members |
| M2: sharing/activity | Updates, stories, albums, streaks, rankings | Story expiry preserves album copy; explicit deletion removes both; timezone boundaries pass |
| M3: collaboration | Whiteboard with 20 tabs | Concurrent edits survive reconnect; 21st tab rejected under race; personal undo preserves others' work |
| M4: AI | Requested AI and weekly group summary | No cross-group leakage; no unsolicited triggers; one summary/week; quota failures handled |
| M5: audio | Voice, then verified provider-specific music | NAT/mobile tests; permission handling; host transfer and skip votes; unsupported links clearly labeled |
| M6: personalization | Sender sounds, visual themes, imports, sandboxed UI code | Theme cannot read credentials; recovery works; browser audio limitations explained |
| Future | Third-party bots and possible native applications | Separate specification and permissions model |

All confirmed requirements map to these milestones. M2–M6 require focused execution plans before implementation; this document fixes their product intent without pretending provider feasibility has been established.

## 11. Cost and deployment facts

Near-zero cost is a pilot target, not a guarantee for the whole feature set. Avoid provisioning paid services or enabling billing automatically. Use a free static host candidate after deployment constraints are checked; no hosting account or deployment is created by this specification. Hosting vendor selection is a deployment decision, not a prerequisite for local M1 work.

Supabase free quotas are finite and shared across the deployment. Configure a real SMTP sender before inviting external testers; its default email sender is restricted. Sender/domain setup may involve costs. Use local development email capture for automated tests, not real inbox spam. Monitor database/storage/egress/realtime quota usage; refuse new uploads before storage exhaustion instead of silently upgrading.

### Sources checked 2026-09-21

- [Supabase pricing](https://supabase.com/pricing): free-tier allowances must be rechecked before deployment.
- [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp): built-in email service restrictions and custom SMTP setup.
- [OpenRouter limits](https://openrouter.ai/docs/api_reference/limits): quotas, credit caps, and provider rate-limit failures.
- [Spotify developer policy](https://developer.spotify.com/policy): provider-policy review is required before promising music behavior.
- [MDN autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay): browser media permission/user-interaction constraints.
- [MDN Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API): browser notifications are a separate capability from foreground audio.

## 12. Assumptions to revisit at milestone boundaries

The user confirmed the feature direction, thresholds, web platform, OpenRouter, and pilot size. Canvas dimensions, rate limits, vote timing/cooldown/electorate rules, streak snapshots/minimum, timezone immutability, media caps, sandbox bridge details, and voice capacity are proposed engineering defaults, explicitly not recorded as user-selected requirements. Validate these through pilot feedback. Provider/model selection, production SMTP credentials, and hosting setup require deployment-specific configuration. None prevents implementing and testing core groups locally.
