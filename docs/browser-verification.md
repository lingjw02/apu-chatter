# Browser release verification

## 2026-09-27 connected UI audit

The connected browser suite supports `TEST_BROWSER=chromium`, `firefox`, or
`webkit` (defaults to Chromium). Install engines with
`npx playwright install chromium firefox webkit`.

PowerShell example:

```powershell
$env:TEST_BROWSER='firefox'
node scripts/check-connected.mjs
```

Firefox 155 (Playwright build 1543): the full suite passed. This includes
mocked account/group flows, history pagination and reconnect gaps, board saves,
music controls, private chats, moderation, theme CSS/code confinement and
recovery, reduced motion, mobile viewport overflow checks, imported WAV decoding,
sender preferences, avatar changes and recovery of blocked accounts without groups.

WebKit 26.6 (Playwright build 2359 on Windows): connected UI checks passed
after the fixes below, with an explicit Web Audio limitation.

- The intermittent history failure was reproduced in Chromium by dispatching
  focus while an earlier-page response was pending. Both calls shared a request
  counter, so the refresh discarded the earlier-page response. Message loads
  now run sequentially within a group; switching groups invalidates its old
  queue. The cursor comes from the latest loaded history when the queued load
  starts. The overlap regression passed in Chromium, Firefox and WebKit.
- A minimal page confirmed that this Windows WebKit build has no `AudioContext`
  global. Sound import/playback cannot be verified with this engine. The app now
  reports that notification sounds are unsupported instead of exposing a raw
  JavaScript error. `check-audio-unavailable.mjs` reproduced the old error and
  passed after the fix. The connected suite verifies this error when Web Audio
  is absent; it still requires actual WAV import/decoding on capable engines.
- Set `TEST_HISTORY_TRACE=1` to log synthetic group-message request cursors and
  window focus events during investigation. This does not enable production logs.

The backend, YouTube and Spotify are mocked in this suite. These results do not
prove live provider playback, real email delivery, microphone/network transport,
or physical iOS/Android behavior. Windows WebKit is not an actual Safari device.
Do not mark the browser/mobile release gate complete from these results.

## Deployed regression fix

Deployed 2026-09-27 to https://f44f0d16.apu-chatter.pages.dev and the stable
https://apu-chatter.pages.dev alias, entry asset `index-vS_imOIs.js`.
Production build passed; `/` and `/groups` returned HTTP 200 with this asset.
`TEST_DEPLOYED_UI=1 node --env-file=.env scripts/check-live-integration.mjs`
passed real desktop/mobile-viewport sign-in, cross-context messaging, avatar
upload/removal and access checks, group joins, private storage, activity, board
concurrency, block closure and post-group unblock recovery. Temporary test
accounts and the group were removed. This test sends no registration/reset email.
