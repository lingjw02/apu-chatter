# Physical-device acceptance

Target: https://apu-chatter.pages.dev. Latest checked build: `index-D5ZsmiIJ.js`
(deployed 2026-09-30). Record the device, OS, browser/version, date and result for each
item. These checks are **pending**; desktop mobile-sized viewports are not
physical-device evidence. Use a temporary test group and harmless test content.

Selected physical test environment: Android with Chrome. Device model, browser
version and test results are still pending from the user.

## One phone, existing account

1. Sign in, open the group, type with the on-screen keyboard and send a message.
   Check that the composer and Send button remain reachable. Rotate the phone;
   no controls should become inaccessible or cause horizontal page scrolling.
2. Open Board. Draw, highlight, erase and add/edit a text box. Pan and zoom, switch
   tabs, undo and redo your own edit. Confirm the page does not scroll instead
   of the board while drawing, and the keyboard does not cover text-save controls.
3. Upload a phone photo and a short video. Open them from Stories and the correct
   album folder. Refresh and confirm the same group, tab and folder remain selected and the media still loads. Confirm video play, pause and sound after a tap. A story should
   also be in Stories; the 24-hour expiry boundary has separate automated evidence.
4. Open Appearance, change bubbles, apply, reload and reset. Enable the device's
   reduced-motion setting and confirm controls remain usable. Test the safe-theme
   recovery URL `/groups?safe-theme=1` if trying custom UI code.
5. Enable group notification sounds with a tap and preview a built-in sound.
   Import a supported small audio file and preview it. Record any browser error.
   This app does not promise custom sounds while the browser is closed.
6. Join the music queue. Start a YouTube item with a tap and test play/pause.
   Follow a Spotify link into Spotify; it is intentionally individual playback.
   Try an Apple preview if available in your region. Record provider restrictions.

7. From the message tools, preview/send an image and GIF, save a favourite GIF and reuse it after refresh. Record a voice message, stop and preview it, then send; confirm the recipient can play and seek it. Cancel a second recording and confirm microphone use stops. Start dictation, review/edit its draft, and stop; note unsupported browsers or recognition-service errors.
8. Minimize music controls while listening, type in chat and reopen the queue. Refresh, confirm audio does not start automatically, and use Rejoin. Save/load a playlist and check song reactions with another account.

## Two different accounts and devices

Use existing verified accounts until SMTP registration delivery is configured.
No tester is required to share a password or API key in chat.

1. Display an invite QR on the first device and scan it with the phone camera.
   Check immediate group entry and access to existing messages and album photos.
2. Send in both directions, then disable the phone network, try a message, restore
   connectivity and retry. The draft should survive and the message appear once.
3. Edit the same board tab concurrently, including a text box. Check cursor
   presence, saved edits, reconnect and that one person's undo preserves the
   other person's work.
4. Request a temporary chat. No conversation should open before acceptance.
   Accept, exchange text and end it from either side; both views should close.
5. Set different group sounds for the two senders and verify messages trigger the
   selected sound while the app is open. Check mute and a second joined group.
6. Join voice muted. Test open mic, push-to-talk release, switching apps and
   leaving. Both people should hear the expected audio, without continued
   transmission after release/leave. Repeat with one device on mobile data and
   the other on Wi-Fi **after TURN is configured**. Record each network separately.
7. Follow the same YouTube queue item on both devices, transfer host and leave.
   Provider ads, authentication and buffering can limit timing; record what occurs.

## Result format

`Device / OS / browser — check number — pass or fail — observed behavior`

For a failure, include the exact error text and steps. Do not include private
messages, credentials or other people's personal information. Failures remain
open until fixed and retested; skipped checks are not passes.

## Separate external gates

- SMTP: verified sender/login/key, then actual outsider signup, confirmation and
  password-reset delivery. Local `.env.smtp` is prepared; secrets stay local.
- TURN: local `.env.turn` credentials, Edge secret configuration and relay-only
  verification before the cross-network voice check.
- Operations: Supabase billing usage/egress/realtime dashboard review and the
  documented provider-retention limits. SQL byte totals are not a billing ledger.
