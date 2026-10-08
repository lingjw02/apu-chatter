# Music provider verification

## Current Spotify pilot decision — 2026-09-27

The user chose to keep Spotify links in the shared queue and open playback in
Spotify while permission is clarified. This applies to tracks and playlists.
Spotify embeds and shared Spotify play/pause/seek controls are removed from the
production MusicRoom. Queue ordering, next-item actions and skip voting remain.
Earlier Spotify playback evidence below describes experimental behavior, not
the current release mode; standalone provider fixtures remain research tools.

The external-only regression failed on the old shared-play controls, then passed
after the change. Build and deployed route checks passed. Hosted verification
with `TEST_DEPLOYED_UI=1 TEST_LIVE_MUSIC=1` passed both track and playlist links in
two real signed-in contexts, no embedded players or shared playback controls,
no Spotify resource requests before following a link, and majority skip votes.
Test accounts/group were removed. Deployment: https://f660e11e.apu-chatter.pages.dev,
stable alias https://apu-chatter.pages.dev, entry asset `index-BxvkyhTl.js`.

The playlist feasibility probe passed signed-out preview playback (27.221 seconds
available in the tested first track), time advancement, seek and pause. Native
selection of another playlist row exposed a different track URI via the official
API. Combining native Next with an immediate API Play did not expose a new URI
in the first probe, so arbitrary control combinations are not proven reliable.
Run with `SPOTIFY_TEST_URI=spotify:playlist:37i9dQZF1DXcBWIGoYBM5M` and
`node scripts/probe-spotify-playback.mjs`.

Technical capability does not establish provider permission. The
[Developer Policy](https://developer.spotify.com/policy) restricts certain
mixed-service/shared-playback uses, and [Widget Terms](https://developer.spotify.com/documentation/embeds/terms)
have their own scope. No claim of definitive contractual permission or violation
is made here. The user-approved external-link mode avoids expanding the
unresolved shared Spotify integration. The API observation uses the official
[IFrame API](https://developer.spotify.com/documentation/embeds/references/iframe-api).

Evidence collected 2026-09-26. These checks use real provider traffic in headless Chromium, without a provider account or an autoplay-policy bypass. They do not prove playback on Safari, mobile hardware, every catalog item or two hosted listeners.

## YouTube

Run `node scripts/check-youtube-live.mjs` with port 5182 available. The fixture renders the application's actual `YouTubePlayer` component. The script observes the real IFrame API instance, clicks Play, checks advancing playback time, seeks to 10 seconds and pauses. All assertions passed on this date using YouTube's API example video `M7lc1UVf-VE`. Screenshot: `design/youtube-live.png`.

Single-video completion was implemented and checked on 2026-09-27. Only the
current host submits the existing revision-checked `next` action. A local listener
ending does not advance the room; an ended listener promoted to host may complete
the item. Completion is attempted once, with an explicit retry after failure.
Polling does not restart the ended video. New host playback/seek commands reset
the completion guard.

The connected regression first failed on the missing completion/retry behavior,
then passed follower ending, host takeover, failed-update/no-loop and retry-to-next
item checks. `check-youtube-live.mjs` also passed real playback/seek/pause, seeking
near the end, natural completion with exactly one callback and no polling replay.
That real-provider check uses the actual component with fixture session state;
it is not evidence of a hosted two-user natural completion. Wider browser timing
checks remain open. Playlist verification is recorded below.

Hosted completion then passed with `TEST_DEPLOYED_UI=1 TEST_LIVE_YOUTUBE_END=1`
using `check-live-integration.mjs`: two real signed-in contexts observed exactly
one queue advance after the host's real YouTube video ended naturally (seek near
the end, then play through). The runner awaits each queue-add acknowledgement
before submitting another item; its first attempt raced that acknowledgement
and was corrected. This does not assert listener audio or physical-mobile behavior.
Both attempts removed their temporary users/group. Deployed build:
https://3b49a5c0.apu-chatter.pages.dev, stable alias https://apu-chatter.pages.dev,
entry asset `index-Ce9MRNGY.js`. Build and stable route checks passed.

Playlist follow-up: `node scripts/probe-youtube-playlist.mjs` passed with public playlist `PLUl4u3cNGP63EdVPNLG3ToM6LaEUuStEY`: 32 items discovered, first playback started, `playVideoAt(1)` selected and played the second item, and pause worked. The older playlist ID shown in the provider documentation exposed only one item in this environment, so that first attempt could not prove switching. The current probe defaults to the verified multi-item playlist and supports a validated `YOUTUBE_TEST_PLAYLIST` override. This is provider feasibility evidence, not shared application playback.

Playlist integration was deployed on 2026-09-27. Migration `20260926020000_music_playlist_position.sql` is applied. MusicRoom uses YouTubePlaylistPlayer with host-published video ID/index, follower ID matching, previous/next track buttons, play/pause/seek, failed-update recovery and last-track queue advancement. A host selection stays local while its RPC is in flight; revision and queue-item checks reject stale callbacks. Unavailable follower videos produce a status rather than deliberately selecting a different ID.

Local checks passed: playlist RPC permissions/validation/duplicate observations, connected-app failed-request/no-loop handling, follower native-navigation correction, last-track queue advancement, and actual two-player selection/pause/natural playlist transition. The test fixture initially failed because its intercepted HTML lacked Vite's React preamble; transforming that fixture HTML fixed startup.

Hosted check `TEST_DEPLOYED_UI=1 TEST_LIVE_PLAYLIST=1` with `scripts/check-live-integration.mjs` passed two real signed-in Chromium contexts: initial playback, host app/native selection, matching video IDs, pause, natural playlist advancement, host succession at the same selection and destruction on leave. Desktop/mobile viewports were used, with no autoplay bypass. Test data was removed. Deployment: https://240b578b.apu-chatter.pages.dev; stable entry asset `index-Du8vm_WN.js`. The hosted security catalog audit also passed. Physical mobile/Safari, region-restricted playlists, reconnect timing and extended provider-error recovery still need release review.

YouTube recovery follow-up (2026-09-27): the reconciliation timer previously erased provider-error/autoplay messages. A failing browser regression demonstrated it. Provider failures now persist with an explicit playback retry, and autoplay-blocked players wait for the local Enable audio gesture. The connected regression verifies persistent failure copy, retry, and no repeated play command while blocked. Real two-component and hosted two-user playlist tests passed again, with stronger natural-advance checks requiring playing state and a positive playback time on both players after selecting the next track. Test accounts/group were removed. Recovery build: https://ffd9c7b8.apu-chatter.pages.dev; stable entry asset `index-DaCZqaMN.js`. Region-specific unavailable-content and physical-browser behavior still need wider verification.

## Spotify — historical experiment, superseded

The following evidence records the earlier embedded-player experiment. It is not
the current production behavior. The current external-link decision is above.

Run `node scripts/probe-spotify-playback.mjs` with port 5182 available. This isolated feasibility fixture uses Spotify's real Embed API, not the application's current individual iframe player. It loads `spotify:track:2Foc5Q5nqNiosCNqttzHof`, invokes Play from a click, requires an advancing position, seeks to 10 seconds, and requires a paused event after Pause. All assertions passed. The provider reported an available duration of 16,546 ms; the screenshot explicitly labels the content Preview and offers full listening on Spotify. Screenshot: `design/spotify-provider-probe.png`.

This changed the implementation decision: API-controlled music previews are feasible in this tested environment. Do not assume the API is podcast-only. The probe alone does not prove full-song playback, arbitrary playlist synchronization or MusicRoom integration.

`SpotifyPlayer` was previously integrated into MusicRoom for single tracks. It preserves provider authentication/preview restrictions, displays the available duration, suppresses repeated playback after local exhaustion, and offers a per-device gesture button. Local preview endings never advance the shared queue. Seeking back resets the local limit state. Play/pause/seek use the existing host-authorized, revision-checked RPC. Spotify playlists still use individual playback.

`node scripts/check-spotify-live.mjs` passed using two actual application components sharing a test session state: both previews advanced within three seconds, followed seeking and paused. This fixture does not replace hosted transport testing.

Hosted verification also passed on https://apu-chatter.pages.dev (deployment https://1800b9f3.apu-chatter.pages.dev, entry asset `index-DZvaEd4p.js`). That historical run used `scripts/check-live-integration.mjs` with `.env`, `TEST_DEPLOYED_UI=1` and `TEST_LIVE_MUSIC=1`; this flag now verifies external Spotify links instead. Two separately authenticated Chromium contexts, at desktop and mobile viewport sizes, joined the same music session, played the real Spotify preview, followed host seek/pause, stopped at their local duration limit without queue removal, recovered after seeking back, and destroyed their player on leave. No autoplay-policy bypass was used. Temporary hosted accounts and group were deleted in cleanup. Screenshots: `design/spotify-hosted-desktop.png`, `design/spotify-hosted-mobile.png`.

The connected browser regression additionally checks that polling does not repeatedly restart an exhausted preview. Music SQL authorization/revision tests and the production build passed. Full-song playback, physical mobile/Safari behavior and Spotify playlist synchronization remain unverified or unfinished.

Official reference: https://developer.spotify.com/documentation/embeds/references/iframe-api

## Apple Music

Signed-out preview playback is verified as individual provider playback. No
shared playback control or full-song guarantee is implemented.

On 2026-09-27, the standalone `check-apple-live.mjs` probe passed a user Play
gesture, advancing media time and Pause. The initial probe failed because it
looked for case-sensitive `Pause` while the actual accessible button was
`PAUSE`; inspecting the live controls and correcting the selector fixed the
check without an app behavior change.

Hosted verification with `TEST_DEPLOYED_UI=1 TEST_LIVE_APPLE=1` and
`check-live-integration.mjs` passed two separately signed-in Chromium contexts
at desktop/mobile viewport sizes: both official embeds played previews; pausing
the first left the second playing with advancing time; no shared Play controls
were exposed; leaving removed the embeds. The mobile page had no horizontal
overflow. Screenshot: `design/apple-hosted-mobile.png`. Temporary accounts/group
were removed. The test used the stable deployment, entry `index-BxvkyhTl.js`.
Physical mobile/Safari, authenticated full-song playback and other regions are
not established by this check.
