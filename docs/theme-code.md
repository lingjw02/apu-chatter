# Local appearance and UI code

Appearance settings belong to the signed-in account in this browser's local storage. They are not sent to Supabase or shared with group members. Visual controls, CSS and HTML/JavaScript can be exported together as a JSON theme. Imported code remains disabled until the user enables live controls and applies the theme.

The CSS editor supports the listed component selectors, including group navigation, chat bubbles, page panels, the composer and drawing/music controls. Optional `:hover`, `:focus-visible` and `:active` states are supported. Values are bounded: hex colors; 0–24px spacing; 0–32px corners; 12–20px type; 400–800 weight; limited alignment, flex direction, borders and short transitions. Built-in `chatter-theme-fade` and `chatter-theme-arrive` animations accept 150/200/250ms. Reduced-motion overrides apply to compiled theme styles. Auth, permission confirmations, profile/account controls and appearance recovery are outside the selector allowlist.

## Component coverage

The editor guide is generated from the compiler's selector list, so accepted
selectors and the visible guide stay aligned. Alongside chat bubbles, composer,
navigation and page containers, individual controls include:

- Updates/albums: .sharing-open.
- Board: .board-tabs button and .board-tools button.
- Music: .music-session-controls button, .music-add input and .music-queue.
- Voice: .voice-actions button and .voice-toggle.
- AI: .ai-actions button, .ai-result and .ai-sources button.

The same bounded declarations and local-only storage apply to these selectors.
AI consent controls, moderation confirmations and account/recovery controls
remain excluded. Provider-owned embedded player internals are not editable by
application CSS.

## Live UI bridge, version 1

Code runs in a frame without same-origin privileges. It receives no chat messages, credentials or account object. It can build its own HTML controls and send these presentation-only requests to the parent:

```html
<button onclick="parent.postMessage({
  type: 'chatter-ui',
  version: 1,
  css: '.bubble { padding: 12px; border-radius: 12px; }',
  action: 'focus-composer'
}, '*')">Compact chat and start typing</button>
```

- `css` replaces the current custom CSS after validation.
- `theme` optionally supplies all six validated visual values: `accent`, `background`, `bubble`, `text`, `radius`, `fontSize`.
- `action: 'focus-composer'` focuses the current group message input. It cannot send, delete, join, moderate or change permissions.
- Messages must come from the active runtime frame, use version 1 and its opaque origin. Updates are limited to one per 200ms; controls should debounce rapid input.

The older `chatter-theme` message is supported by the color preview; version 1 also works in live controls. The code source persists when applied. Normal fetch, image, nested-frame, form and media requests are blocked by the frame policy. The parent additionally restricts frame navigation to the app and supported music embed hosts. These browser restrictions do not make arbitrary JavaScript immune to performance problems; a broken script can still require recovery.

## Recovery

**Pause UI code** is outside the custom frame and stops it without discarding its source. **Reset** restores Clubhouse defaults. **Roll back** restores the appearance before the most recent apply/reset in the current visit. Load `/groups?safe-theme=1` to start without saved styles or code, including after a problematic script; open Appearance and reset or edit the saved configuration.

Verification: `check-personalization.mjs`, `check-connected.mjs` and `check-theme-navigation.mjs` cover style confinement, runtime changes, source checks, parent-page denial, blocked fetch, blocked arbitrary frame navigation, persistence, pause, safe mode, import opt-in, rollback and reduced motion. Connected UI checks also passed in Firefox and Windows WebKit on 2026-09-27. Windows WebKit lacks Web Audio, so its run verifies the unsupported-sound message rather than audio import/playback. Physical mobile verification remains pending. See [browser verification](browser-verification.md) for exact scope and reproduction commands.
