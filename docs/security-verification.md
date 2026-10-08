# Security verification — 2026-09-26

This is an evidence record for the current preview, not a claim that the whole application or release is complete.

## Hosted database

`node scripts/check-live-security.mjs` queries the linked database catalog through the authenticated Supabase CLI. It reads permissions and bucket metadata, not user records or secrets. The check passed for:

- 54 public SECURITY DEFINER RPCs: anonymous execution denied, fixed empty search paths, 45 reviewed authenticated entry points and nine worker-only functions.
- 32 public/private tables: RLS enabled, no anonymous table/column access, no direct authenticated inserts or truncates, no browser access to the six private tables.
- Direct profile updates restricted to `display_name`, `bio`, `status`; voice-signal deletion is the only direct authenticated table-delete grant.
- Private `group-media` and `profile-avatars` buckets; no browser INSERT/UPDATE storage policy that would bypass Edge Function file validation.

The script uses `scripts/security-catalog.sql`. Its RPC allowlist deliberately requires review when new privileged functions are added. Grant checks alone do not establish correct authorization inside an RPC.

## Advisor results and disposition

The hosted Supabase security advisor returned no ERROR items and these categories:

- Six INFO items for RLS tables without policies in the private schema. Browser roles have no access; these server-managed rate limits, counters and cleanup records are intentionally closed.
- 45 WARN items because authenticated users can execute SECURITY DEFINER functions. These are the intended controlled-write/read API. Revoking all execution would break the app. Authorization behavior is separately tested below; the warning itself is not proof of an exploit or proof of safety.
- One WARN for disabled leaked-password protection. Supabase documents this feature as Pro-plan-and-above. No paid upgrade was enabled. This remains a free-plan limitation: https://supabase.com/docs/guides/auth/password-security.

Repeat the advisor check with `npx supabase db advisors --linked --type security --level info --output json`.

## Authorization behavior

These existing suites were executed successfully against the current migrations in embedded PostgreSQL on this date:

| Script | Checked boundaries |
| --- | --- |
| `check-database.mjs` | Verified accounts, RLS, group/invite creation, revoked/banned invites, message idempotency, role escalation, profile isolation |
| `check-moderation.mjs` | Vote thresholds, owner immunity, automatic removal, ballot privacy, re-entry authority, role reset and ownership transfer |
| `check-safety.mjs` | Both-direction blocks, private-message erasure, block/report privacy, owner report resolution and exact-name deletion |
| `check-private.mjs` | Consent, participant-only reads, owner isolation, expiry, closure and membership-removal deletion |
| `check-sharing.mjs` | Storage privacy, publication metadata, outsiders, constraints, story retention and canonical deletion |
| `check-board.mjs` | Membership, tab cap, independent writes, stale revisions, data validation, leases and removal |
| `check-ai.mjs` | Owner opt-in, member access, quotas, request identity, worker-only completion and disable gate |
| `check-song-access.mjs` | AI opt-in/membership/quota, retry identity and catalog queue validation |
| `check-topic-access.mjs` | Member-only topics, no client writes, source-deletion suppression |
| `check-voice.mjs` | Capacity, outsider/spoof rejection, recipient-only signaling, leave/removal cleanup |

These are domain regression tests, not a claim of exhaustive coverage for every input to every RPC. Hosted two-user tests described in `backend-setup.md` additionally exercised real account, media, board and private-chat access boundaries.

## Dependencies and remaining gates

Follow-up: `blocked_accounts()` was added for account-level block recovery after leaving all groups. It verifies the caller and exposes only IDs and display names from that caller's existing block relationships. The current hosted grant audit passed with 55 privileged RPCs (46 authenticated, nine worker-only) and the same 32 tables. `check-blocked-accounts.mjs` passed ownership/privacy, no-membership unblock, cross-account mutation denial and anonymous denial. The hosted integration check passed real own-block recovery after leaving the shared group and isolation from the other account. The browser regression passed profile access with no groups, confirmation cancellation and failure/retry behavior.

`npm audit --json` reported zero known vulnerabilities across production and development dependencies on this date. This does not assess custom application code or future advisories.

SMTP/outside-team email delivery, restrictive-network voice relay, physical mobile/browser verification, remaining music functionality and the full requirement-by-requirement completion audit remain open. Server secret leakage checks should be repeated on the final release build.
