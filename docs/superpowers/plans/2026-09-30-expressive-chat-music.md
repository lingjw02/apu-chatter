# Expressive chat and persistent music implementation plan

**Goal:** Implement the approved music improvements, app-wide wait feedback and motion, and image/voice/dictation/emoji/GIF/favourite-GIF composition.
**Architecture:** Keep provider players mounted independently of the expandable music controls. Reuse private group media reservations and publication for chat attachments; extend validated media types for audio and animated GIFs. Use browser speech recognition when supported, with explicit start/stop and review-before-send. Favourites store only user-selected GIF blobs locally, scoped to the account. Track Supabase HTTP work with a delayed accessible global indicator, supplemented by contextual progress.

- [x] Persistent music dock, session rejoin hint, readable queue and host state; verify minimization never leaves/recreates the active player and explicit Leave does.
- [x] Authenticated media extension: GIF plus bounded audio, server validation, existing quotas/access/deletion; database and format tests before deployment.
- [x] Composer tools: image preview/upload, audio recording with preview/cancel, dictation with supported-browser feedback, emoji picker, GIF upload/preview/local favourites; cancellation and retry retain drafts safely.
- [x] App wait indicator, contextual upload/record/playback feedback, overview spacing and reduced-motion-aware transitions; delayed network tests and keyboard/mobile review.
- [x] Verify integrated desktop/mobile flows, inspect renders, build/secret scan, deploy backend and frontend, then verify hosted behavior and update release evidence.

## Scope notes
The user approved both voice messages and speech-to-text. Speech recognition is browser-dependent and must disclose when the browser uses its recognition service. No silent recording or automatic sending. Spotify stays external. YouTube's visible player remains available while minimized; do not implement hidden video-to-audio playback. No new paid API/provider is introduced. Existing full-release SMTP, TURN and physical-device gates remain separate.
