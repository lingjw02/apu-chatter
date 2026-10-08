# APU Chatter Core Web Pilot Implementation Plan

> **For agentic workers:** Use the executing-plans skill to implement this plan task-by-task. Do not dispatch subagents unless the user separately requests parallel agent work. Steps use checkboxes for tracking.

**Goal:** Deliver a responsive web pilot in which fewer than 20 testers can register, join groups, chat, moderate membership, and use temporary private text chatboxes.

**Architecture:** React web client with Supabase Auth, Postgres, row-level security, and authorized realtime subscriptions. Use transactional database RPCs for membership, votes, and private-chat closure. Durable database state determines permissions; frontend controls never grant them.

**Tech Stack:** React, TypeScript, Vite, React Router, Supabase JavaScript client and CLI, Vitest, Testing Library, Playwright, Postgres/pgTAP.

**Spec:** `docs/superpowers/specs/2026-09-21-apu-chatter-design.md`

## Global constraints

- Web only; usable on desktop and mobile browsers.
- Registration uses email and password, email verification, and email-based password reset.
- Group invitations use QR codes or links and grant immediate entry.
- New members can read all existing group messages and albums, excluding deleted content.
- OpenRouter is the AI provider gateway; its credentials remain on the server.
- Temporary private chatboxes support text only and have no AI, streaks, media, voice, or whiteboard.
- Whiteboards belong to groups and have a fixed maximum of 20 tabs.
- Third-party bots are a later addition.

Only the core pilot is executed by this plan. The spec's M2–M6 are independent follow-on projects, not hidden work in M1. Albums, OpenRouter calls, and whiteboards have no implementation in this milestone. Planning files are currently the only project files; do not report a runnable app until actual implementation and checks complete.

## Interfaces and ownership

Organize `src/features/` by auth, profiles, groups, chat, moderation, and private-chat. Each feature owns components, API calls, and tests. `src/lib/supabase.ts` owns the browser client; `src/app/router.tsx` owns routes. Database migrations and authorization tests live under `supabase/`; browser journeys live under `e2e/`.

### Routes

`/login`, `/register`, `/auth/callback`, `/forgot-password`, `/reset-password`, `/groups`, `/join/:token`, `/groups/:groupId`, `/groups/:groupId/members`, `/groups/:groupId/settings`, `/groups/:groupId/private/:chatId`, and `/settings/profile`.

Unauthorized group routes return a generic inaccessible state. A logged-out invite visitor returns to the same invite after authentication. Sanitize return paths to local application routes only. Invalid/revoked invites reveal no messages, member directory, or email addresses.

### Database records

Use UUID primary keys, server timestamps, foreign keys, and database constraints. Generate TypeScript database types from migrations instead of hand-maintaining duplicate row types.

| Table | Essential fields and invariants |
|---|---|
| profiles | id references auth.users; display_name (1–40 chars), bio (0–160), status (0–80); no email column |
| groups | id, name (1–80), description (0–500), timezone, created_at; exactly one owner membership |
| memberships | group_id/user_id unique, role owner/admin/member, joined_at; delete on exit |
| group_invites | id, group_id, token_hash unique, created_by, revoked_at; raw token returned only on creation |
| group_bans | group_id/user_id unique, removed_role, reason_type, created_at |
| group_messages | id, group_id, author_id, body (1–4000 after trim), created_at, client_id; unique group/author/client_id |
| member_blocks | blocker_id/blocked_id unique; self-block rejected |
| reports | id, group_id, reporter_id, target_user_id, reason (1–1000), created_at; visible to reporter and owner |
| kick_votes | id, group_id, target_id, target_role, threshold, status, expires_at; at most one open vote per target |
| vote_electorate | vote_id/user_id unique; immutable snapshot while vote open |
| vote_ballots | vote_id/voter_id unique, choice kick/keep; no client reads of other individual ballots |
| private_chats | id, group_id, requester_id, recipient_id, pair_low, pair_high, state pending/open/closed, expires_at, closed_at; partial unique group/pair for pending/open |
| private_messages | id, chat_id, author_id, body (1–4000), created_at, client_id; unique chat/author/client_id |
| moderation_events | id, group_id, actor_id nullable, action, target_id, created_at; no message bodies |

Keep closed private_chat records content-free; delete their private_messages in the closing transaction. Cleanup expired requests on access and in periodic maintenance; expiration is also checked during accept, never trusted to the scheduler alone.

### RPC contracts

Functions derive the actor from `auth.uid()`; never accept a caller-supplied actor ID. Return UUIDs for create operations and no body for successful mutations unless stated. Fail with stable error codes: NOT_MEMBER, FORBIDDEN, NOT_FOUND, INVALID_INPUT, BANNED, INVITE_REVOKED, RATE_LIMITED, CHAT_CLOSED, CONFLICT.

```ts
type Role = 'owner' | 'admin' | 'member';
type VoteChoice = 'kick' | 'keep';
type VoteResult = { status: 'open' | 'passed' | 'failed' | 'cancelled'; kickVotes: number; keepVotes: number; threshold: number };
type InviteResult = { inviteId: string; token: string };
// Each maps to a snake_case Postgres RPC with p_ prefixed arguments.
interface Mutations {
  createGroup(name: string, description: string, timezone: string): Promise<string>;
  createInvite(groupId: string): Promise<InviteResult>;
  revokeInvite(inviteId: string): Promise<void>;
  joinGroup(token: string): Promise<string>;
  leaveGroup(groupId: string): Promise<void>;
  transferOwnership(groupId: string, memberId: string): Promise<void>;
  setMemberRole(groupId: string, memberId: string, role: 'admin' | 'member'): Promise<void>;
  removeMember(groupId: string, memberId: string): Promise<void>;
  allowReentry(groupId: string, memberId: string): Promise<void>;
  sendGroupMessage(groupId: string, clientId: string, body: string): Promise<string>;
  deleteGroupMessage(messageId: string): Promise<void>;
  startKickVote(groupId: string, targetId: string): Promise<string>;
  castKickVote(voteId: string, choice: VoteChoice): Promise<VoteResult>;
  requestPrivateChat(groupId: string, recipientId: string): Promise<string>;
  respondPrivateChat(chatId: string, accept: boolean): Promise<void>;
  closePrivateChat(chatId: string): Promise<void>;
  sendPrivateMessage(chatId: string, clientId: string, body: string): Promise<string>;
}
```

Profiles update only their own fields through RLS. Blocks/reports use RLS-constrained inserts; blocking also closes that pair's pending/open chats in a transaction. Reads use RLS-protected tables/views with keyset pagination on `(created_at,id)`. A vote summary view exposes counts but no individual ballots. All security-definer functions set a fixed search_path, explicitly check authorization, and have only necessary execute grants.

## Task 1 — Application shell and verified accounts

**Files:** Create `package.json`, `src/app/router.tsx`, `src/features/auth/`, `src/features/profiles/`, `src/lib/supabase.ts`, `.env.example`, `supabase/config.toml`, `supabase/migrations/202609210001_profiles.sql`, `e2e/auth.spec.ts`.

**Consumes:** empty workspace. **Produces:** authenticated routes, profile record, Supabase client, generated database types, test scripts.

- [ ] Check Node/npm and local Docker availability. Scaffold Vite React TypeScript in a temporary subdirectory and move generated files without overwriting these docs. Initialize local Supabase. Select compatible current versions and lock dependencies.
- [ ] Add scripts `typecheck` (`tsc --noEmit` with appropriate project references), `test` (`vitest run`), `test:e2e` (`playwright test`), and `build` (`vite build`). Keep credentials out of tracked files.
- [ ] Write an auth browser test: register -> email confirmation pending -> local email confirmation link -> profile -> logout -> login -> reset password -> login with replacement password. Before implementation, verify failure at missing route/UI rather than infrastructure startup.
- [ ] Implement auth routes and session handling. Block group access until verification. Show generic recovery responses to avoid exposing account existence. Clear query/realtime/private-chat state on signout.
- [ ] Implement profile creation and own-profile edits, initials avatar, bio/status. Add SQL tests that another user cannot update the profile and group users cannot retrieve email through the public schema.
- [ ] Run `npm run typecheck`, `npm test`, `npx supabase test db`, and the auth browser test. Record actual results. Commit this deliverable only if a repository has been initialized and checks pass.

Environment contract: browser receives `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only. Later AI secrets belong in server configuration, never `VITE_*`. Development email verification uses the local Supabase mail capture service. Production invitations wait for external SMTP delivery verification.

## Task 2 — Groups, membership, and QR/link invitations

**Files:** Create `src/features/groups/`, `supabase/migrations/202609210002_groups.sql`, `supabase/tests/groups.test.sql`, `e2e/groups.spec.ts`.

**Consumes:** authenticated user/profile. **Produces:** create/join/leave/transfer RPCs, membership reads, invite sharing and revocation, authorized group shell.

- [ ] Write database tests using owner A, invitee B, and outsider C. Assert atomic owner creation, invalid-token rejection, idempotent joining, revoked-token rejection, no outsider message/member reads, and owner-leave rejection before ownership transfer.
- [ ] Implement tables, RLS helpers, and transactional RPCs. Use 32 random bytes for invite tokens and persist SHA-256 hashes only. Lock the group row before membership mutations. Transfer ownership atomically with a database-enforced one-owner invariant.
- [ ] Build group list/create form, share-link/QR view, join route, members list, and owner transfer/leave actions. Raw invite token is available for sharing immediately after creation; if lost, create another invite instead of retrieving a secret from its hash.
- [ ] Add a QR encoder dependency after checking its license and compatible version; encode the same tested HTTPS join route. QR scanning can use a phone's existing camera, so an in-app scanner is not required for M1.
- [ ] Verify B can open an invite while logged out, authenticate, and immediately join. Verify mobile layout at 390 px and desktop at 1440 px, keyboard focus, labels, and invalid-link states.
- [ ] Run group database/browser tests and typecheck. Commit the passing membership deliverable.

## Task 3 — Reliable group text chat

**Files:** Create `src/features/chat/`, `supabase/migrations/202609210003_messages.sql`, `supabase/tests/messages.test.sql`, `e2e/chat.spec.ts`.

**Consumes:** membership, group authorization. **Produces:** send/delete RPCs, paginated history, realtime UI with retry/reconnect behavior.

- [ ] Write tests: two members exchange text; same client ID retries return one message; blank/oversized text rejected; outsider cannot read or send; new member sees old history; deletion permitted for author/owner/admin only.
- [ ] Implement message mutations, authorization, database timestamps, and rate limiting. Persist client UUID once per compose/send operation; preserve it across retries. Escape all text in rendering.
- [ ] Implement pending/failed/sent UI, manual retry, and history pages ordered by server timestamp plus ID. Merge pages/events by message ID. On reconnect fetch missing records; never treat receipt of a realtime event as permission to display unvalidated payloads.
- [ ] Subscribe only to the active authorized group. On membership loss unsubscribe and clear rendered group/private state; refetch authorization on reconnect and tab focus. In-flight sends must recheck membership in the database.
- [ ] Test two browser contexts, network interruption, double-click send, logout/account switch, and a membership removal while the chat is open. Confirm no duplicated text and no access after removal.
- [ ] Run targeted tests, build, and typecheck. Commit the passing messaging deliverable.

## Task 4 — Roles, votes, bans, blocks, and reports

**Files:** Create `src/features/moderation/`, `supabase/migrations/202609210004_moderation.sql`, `supabase/tests/moderation.test.sql`, `src/features/moderation/threshold.test.ts`, `e2e/moderation.spec.ts`.

**Consumes:** groups, membership, text chat. **Produces:** role/removal/re-entry/voting RPCs, block/report handling, content-free moderation events.

- [ ] Write threshold unit tests before implementation:

```ts
import { expect, test } from 'vitest';
import { kickThreshold } from './threshold';
test.each([
  ['member', 1, 1], ['member', 3, 2], ['member', 4, 2],
  ['admin', 3, 3], ['admin', 4, 4],
] as const)('%s with %i eligible needs %i', (role, eligible, expected) => {
  expect(kickThreshold(role, eligible)).toBe(expected);
});
test('owner cannot be targeted', () => {
  expect(() => kickThreshold('owner', 4)).toThrow();
});
```

- [ ] Implement the display helper; use matching tests for authoritative SQL, not client values:

```ts
export function kickThreshold(role: 'owner' | 'admin' | 'member', eligible: number): number {
  if (role === 'owner' || !Number.isInteger(eligible) || eligible < 1) {
    throw new Error('Invalid vote target or electorate');
  }
  return role === 'admin' ? eligible : Math.ceil(eligible / 2);
}
```

- [ ] Implement vote tables/RPCs and permissions. Lock group then vote consistently for membership changes and ballot transactions. Derive threshold and electorate on the server. Store one immutable ballot per voter; retries of the same choice are idempotent, changing a cast choice is rejected.
- [ ] On successful vote, insert ban, remove membership, cancel affected votes, and create audit event in the same transaction. Use one internal removal operation shared by direct and voted removal. Task 5 extends it to close private chats atomically.
- [ ] Implement admin role changes, ban list, re-entry allowance, block/report UI, vote totals/deadline, and an explicit target-name confirmation for direct removal. Allowing re-entry does not join the person automatically.
- [ ] Test 4 eligible ordinary voters need 2 Kick votes; 4 eligible admin voters need 4. Test Keep/abstain, target voting rejection, owner immunity, expiration/cooldown, duplicate ballots, simultaneous threshold-reaching ballots, invalidated membership snapshots, revoked invites, and ban bypass using a different invite.
- [ ] Test that admins cannot directly remove/restore admins and cannot appoint themselves owner. Ballot identity queries by other members must fail.
- [ ] Run SQL/unit/browser tests and commit the passing moderation deliverable.

## Task 5 — Temporary private text chatboxes

**Files:** Create `src/features/private-chat/`, `supabase/migrations/202609210005_private_chats.sql`, `supabase/tests/private_chats.test.sql`, `e2e/private-chat.spec.ts`.

**Consumes:** group membership, block state, shared removal transaction. **Produces:** request/respond/close/send private RPCs and deletion behavior.

- [ ] Write SQL tests for recipient-only acceptance, no pre-acceptance messages, block rejection, same-group requirement, duplicate/opposite-direction requests, expiration, member-only access, and outsiders/admins unable to read private text unless they are a participant.
- [ ] Implement pending/open/closed transitions, pair uniqueness, private-message RLS, and idempotent sends. Lock group then chat for accept/send/close/removal; this serializes sends against membership deletion and chat closure.
- [ ] Close chats and delete private message rows inside the same transaction on explicit close, membership removal/leave, or block. Only allow sending when both current memberships exist and state is open. Return CHAT_CLOSED for a stale chat ID.
- [ ] Build requests inside the group UI and a text-only chatbox. Make destructive ending clear: ending closes for both and deletes text. Do not add attachments, AI controls, voice, whiteboard, or streak widgets.
- [ ] Use in-memory client state only for private bodies; no service-worker caching or browser storage of history. Revalidate on focus/reconnect. Closure events clear the screen; query results must also verify current chat state before being displayed.
- [ ] Test send-versus-close races in both transaction orders, acceptance versus removal, and reconnect after another person closes. Inspect database rows to prove message deletion, not merely hidden UI. Confirm another request creates a fresh ID and requires acceptance.
- [ ] Run private SQL/browser tests and regression checks for moderation. Commit the passing temporary-chat deliverable.

## Task 6 — Pilot verification and deployment handoff

**Files:** Create `e2e/pilot.spec.ts`, `docs/pilot-runbook.md`; update `.env.example` and project scripts as needed.

**Consumes:** all M1 deliverables. **Produces:** reproducible local build, tested pilot journeys, deployment checklist with no secrets.

- [ ] Run a fresh migration reset and full checks: `npx supabase db reset`, `npx supabase test db`, `npm test`, `npm run typecheck`, `npm run build`, `npm run test:e2e`. Use a separate local test database; never reset a remote project.
- [ ] Run the complete two-user flow: register/verify -> create/invite -> join -> exchange text -> accepted private chat -> close/delete -> remove/re-entry block -> restore/rejoin. Include a third outsider browser session for authorization checks.
- [ ] Review at desktop/mobile widths with keyboard-only navigation, visible focus, readable error states, long names/messages, no horizontal overflow, and reduced motion. Automated browser engines supplement, not replace, a real mobile Safari/Chrome smoke test before inviting testers.
- [ ] Document local startup, migrations, test commands, environment names, quota checks, deletion limitations, and recovery from failed deployments. Scan the production bundle and tracked files for server credentials and private test data.
- [ ] Configure production SMTP and verify registration/reset mail to a non-team email address before inviting testers. Provisioning credentials is deployment work; missing credentials do not justify claiming deployment success.
- [ ] Choose/configure static HTTPS hosting when deployment is requested. Configure SPA rewrites, auth redirect allowlist, and restricted CORS. Run the pilot flow against that deployment before sharing links.
- [ ] Record exact test outcomes and remaining limitations. No automatic paid upgrades. Start with fewer than 20 invited testers; collect reports of failed sends, reconnects, and usability problems without logging private text.

## Follow-on execution order

After M1 feedback, write separate focused plans for M2 sharing/activity, M3 whiteboard, M4 OpenRouter, M5 audio, and M6 personalization. The product spec includes all nine original feature areas and subsequent corrections. Research music provider support and sandboxed UI customization before committing to implementation promises. Do not scaffold speculative bot APIs, native projects, or unused feature tabs in the core pilot.

## Completion evidence

### Progress recorded 2026-09-21

- Clubhouse interactive demo and motion delivered independently before backend work.
- First backend slice implemented locally: account routes/session integration, profile edits, group create/join, hashed invitation links/revocation, message history/send/subscription, database authorization.
- Embedded Postgres SQL tests and mocked-service connected UI tests pass. Unconfigured account UI and original prototype regression checks pass.
- No hosted Supabase project exists. SMTP, real verification/reset links, deployed JWT/RLS behavior, and realtime multi-user delivery remain unverified. Task 1/2/3 acceptance is therefore partial, not complete.
- Task 4 moderation, Task 5 connected temporary chats, QR rendering, and deployment remain outstanding. See docs/backend-setup.md for exact coverage and instructions.

### Progress recorded 2026-09-22

- QR invitations and core Task 4 controls are implemented locally: roles, direct removals, bans/re-entry, private kick/keep ballots and totals, owner transfer and leave.
- New migration `202609220002_moderation.sql` tested with embedded Postgres; connected controls tested with mocked Supabase on desktop/mobile.
- Blocking/reporting, group deletion, connected temporary chats, production integration and deployment remain outstanding. No hosted project has been configured.

M1 is complete only when all migration/authorization/unit/browser checks pass, real email verification works for testers, two users complete the deployed journey, and removed members cannot use stale clients/invites. Local completion and deployed-pilot completion must be reported separately. This plan itself creates no accounts, services, application code, or deployment.

### Progress recorded 2026-09-23

- Existing hosted Supabase project is connected; core, moderation, policy optimization and temporary-chat migrations are applied.
- User confirms successful account creation and sign-in. SMTP delivery to non-team testers remains unverified.
- Task 5 request/consent, participant-only text, pair uniqueness, expiry, and close/leave/removal deletion are implemented. Embedded SQL tests, hosted rollback smoke checks and mocked desktop/mobile UI checks pass.
- Outstanding: blocks/reports integration, periodic expired-request maintenance, true multi-client race/reconnect verification, group-message deletion and full deployed pilot journey. Do not mark M1 complete yet.

### Additional progress — group message deletion

Task 3 now includes author/owner/admin message deletion, text erasure with retry-safe markers, confirmation controls and refresh of loaded older-message deletions. Production build, embedded authorization tests, mocked UI tests and hosted rollback smoke checks passed. Blocks/reports and full multi-client pilot verification remain outstanding.
