# Sharing and activity implementation plan

Goal: deliver the spec's M2 within the connected group UI, without demo data.
Architecture: private Supabase assets with one canonical content record; client uploads use reserved paths and quotas. Activity is computed by authorized RPCs with durable per-day eligibility snapshots. Existing React components remain the shell.
Spec: ../specs/2026-09-21-apu-chatter-design.md

## Activity deliverable
Files: CLI-generated activity migration; src/features/activity/ActivityPanel.tsx; scripts/check-activity.mjs.
Interfaces: group_activity(p_group_id uuid) returns JSON {timezone, week_start, rankings, words, streak, today}; daily snapshots {group_id,local_date,eligible_ids} private to SQL, initialized under group lock. Snapshot uses members joined by local midnight; first group day snapshots creator(s) present at group creation. Daily cron populates snapshots; access/send fallback catches current day without counting newcomers early. RLS admits group members only. Counts exclude deleted group text and all private text. Freeze daily electorate; qualifying threshold greatest(2,ceil(cardinality(eligible)*.3)). Streak counts consecutive qualifying dates ending today or yesterday if today incomplete.
Tests: owner/member/outsider visibility, duplicate sends counted once, deleted text excluded, timezone week boundary, newly joined not eligible until next local date, minimum2 and threshold rounding. Tokenization is deterministic English/Latin words with a documented stoplist, no AI call.
Implementation steps: failing SQL tests; migration and snapshot helpers; activity RPC; group Activity view and refresh; embedded tests plus hosted transaction smoke; build and UI check. Do not rewrite prior-day snapshots after membership changes.

## Media deliverable
Files: CLI-generated sharing migration; src/features/sharing/{SharingPanel,media}.tsx; server cleanup function; scripts/check-sharing.mjs.
Reserve authenticated upload with expected byte size, safe MIME, canonical UUID path. Lock deployment quota row then group row to atomically enforce 100MB/group and conservative global quota. Storage insert RLS admits only reservation owner/exact path and expected MIME/size; no overwrite. Publish verifies object exists/metadata before making content visible. Group members select authorized objects; no public bucket. Delete revokes reads through canonical row and schedules physical storage cleanup. Client validates image/video limits and compresses images; server/storage enforces bytes independently. Expired abandoned reservations are reconciled with objects before freeing quota.
Content types: post/reel/story/shared/chat; album folder determined by canonical record, no duplicate uploads. Story view filters created_at+24h; albums retain stories. Member content delete or manager moderation revokes all representations. Reads/page cursors must respect group access and avoid leaking filenames via public URLs. Tests cover outsider upload/read rejection, concurrent quotas, invalid MIME/size, expired story retention and canonical deletion.

Activity can ship independently before media. External deployment is gated by completing both and the remaining milestones in completion-and-deployment.md.
