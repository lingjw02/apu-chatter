# APU Chatter completion and deployment plan

Goal: finish the approved web scope and deploy a tested pilot, without paid upgrades.
Spec: ../specs/2026-09-21-apu-chatter-design.md
Execution: inline, with focused plans per subsystem and real verification before status changes. Existing approval covers implementation and deployment. Credentials and unavailable external accounts remain explicit dependencies.

## Release sequence

Current evidence and remaining acceptance work are tracked in [the release audit](../../release-audit.md). The broad checkboxes below remain open until each milestone's full gate is verified; they do not mean its implementation has not started.
- [ ] Finish core safety: personal blocks closing private chats, owner reports, owner-confirmed group deletion, expired-request cleanup; SQL permission and rollback tests, connected UI tests.
- [ ] Sharing: canonical private media assets with quotas and authorized storage; Updates posts/reels/stories, 24-hour story view plus durable album folders, avatars and unread indicators; deletion and upload failure tests.
- [ ] Activity: group-local weekly/total rankings, common words, daily electorate snapshot and 30%/minimum-two streaks; midnight/DST/deletion tests.
- [ ] Board: fixed 1920x1080 canvas, max20 tabs atomically, stable-ID operations, realtime reconciliation, personal undo, text editor leases and collaborator cursors; two-client reconnect/race tests.
- [ ] AI: server-only OpenRouter, explicit summary/notes requests, source links, budget limits, once-weekly idempotent scheduler; no private chat context; model/credential setup and provider failure tests.
- [ ] Audio: provider feasibility first; opt-in voice with muted start/PTT and capacity control; allowed music embeds, queue/session revisions, host succession/transfer and skip voting; honest unsupported-provider UI.
- [ ] Personalization: local theme tokens/scoped CSS, imports/export/reset and isolated UI-code preview/bridge; per-sender/group built-in and imported sounds; sandbox and audio gesture tests.
- [ ] Release: two-user hosted flow, outsider/removal checks, desktop/mobile/reduced-motion checks, quota and credential audit, free HTTPS hosting/SPA routing, production Auth redirects and SMTP, final deployed smoke check.

## External dependencies being clarified
Hosting account/provider, SMTP credentials and sender verification, OpenRouter key/model. TURN/provider music credentials may be needed after feasibility checks. Do not silently substitute demos for integrations. No claim of completion until release gates pass.

## Core safety interfaces and files
Create a CLI-named safety migration, scripts/check-safety.mjs, src/features/groups/SafetyControls.tsx; integrate in GroupControls. RPCs: set_member_block(p_group_id uuid,p_member_id uuid,p_blocked boolean), report_member(p_group_id uuid,p_target_id uuid,p_reason text), resolve_report(p_report_id uuid), delete_group(p_group_id uuid,p_name text). Authorize from auth.uid, never caller identity. Store block rows globally per account pair, expose only blocker rows; both directions prevent private requests. A block trigger closes all pair chats and deletes bodies. Reports readable by author/current group owner; owners resolve. Group deletion requires exact name and ownership. Lock group then chat in consistent order; lock all common groups in sorted order for cross-group blocks. Test failing absent RPCs first, then SQL and UI; push migration only after authorization checks pass. No Git repository is initialized, so no fabricated commits.
