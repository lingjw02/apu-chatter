# Playlist integration continuation

Within the already approved music scope; no new account or paid provider dependency is required for the tested YouTube embed controls.

## Current evidence and local work

- Real YouTube playlist probe passed discovery, playback, index 1 selection and pause on a 32-item public playlist. See `docs/music-provider-verification.md`.
- Local migration `20260926020000_music_playlist_position.sql` is tested and pending deployment. It adds session `playlist_index` and nullable `playlist_video_id`, resets them when queue items change, and extends `music_action` with `playlist_track`.
- Payload: existing revision/connection plus `item_id`, `index`, `video_id`, optional `position` (seconds, defaults to zero). Only the current host can publish; current queue item must be a YouTube playlist. Index 0..9999, 11-character video ID, finite bounded position. Duplicate same-index/same-video observation is a no-op. Queue revision/item checks reject stale events after skip or transfer.
- Existing Spotify and Apple validation is preserved by basing the replacement music action on the latest song-search migration.

## Remaining implementation

1. Extend YouTubePlayer for playlist ID, server index/video ID and host track-change callbacks. Load the playlist with the official API. Observe playlist IDs/index on ready/cued/playing events; publish host changes including natural next-video transitions.
2. Track in-flight host observations so polling cannot immediately force the host back to the old server index before its update returns. Guard stale component callbacks after queue changes and avoid repeated submissions on stale revisions/network failure.
3. Followers select the host video by ID within their local playlist when possible, rather than assuming every region has the same visible index. If unavailable, present an honest status; never silently play a different track.
4. Preserve host play/pause/seek semantics and user-gesture activation. Playlist navigation must keep native provider controls accessible. Add explicit host previous/next track controls if useful; Next item still advances the app queue.
5. Add component and MusicRoom regressions before wiring: follower cannot publish, old-track callbacks cannot mutate new item, manual/natural track transitions converge, host transfer and reconnect preserve selection, unavailable items and failed updates do not loop.
6. Run real two-component playback and hosted two-user tests, apply the migration only with its consumer ready, deploy and verify the stable preview. Full playlist completion/automatic next queue item also remains to implement.

Do not mark playlist synchronization complete from the database contract or provider probe alone. Spotify playlists and Apple playback still require their own feasibility/integration decisions.

## 2026-09-27 execution status

YouTubePlaylistPlayer and MusicRoom wiring are implemented and deployed with the migration at https://240b578b.apu-chatter.pages.dev. Connected browser tests cover initial publication, previous/next controls, failed update without retry looping, retry, follower native navigation correction and host last-track completion. Two real components verified app/native selection, pause and a natural transition after seeking near the end. The real hosted two-user flow verified these behaviors plus host succession and leave destruction; security catalog passed. Stable entry asset: index-Du8vm_WN.js.

Provider-error/autoplay recovery is now implemented and deployed at https://ffd9c7b8.apu-chatter.pages.dev. The formerly disappearing error was reproduced by a failing regression; persistent error/retry and gesture-only autoplay recovery now pass. Natural-advance assertions now require playing state and positive playback time on both clients; local real-player and hosted two-user checks passed again. Stable asset: index-DaCZqaMN.js.

Remaining targeted review: unavailable tracks and reconnection across physical browsers/regions. Single-video queue completion is still absent. Spotify playlists remain individual playback. Do not treat this execution status as the full project completion audit.
