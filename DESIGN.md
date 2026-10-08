# Clubhouse — default visual direction

The user selected the Clubhouse concept on 2026-09-21. This is an Operate surface: the conversation is primary. Expression belongs in the identity, considered spacing, muted colors, and a short opening moment.

## Implemented language

Connected membership controls added 2026-09-22: a native dialog with Members, Votes and Removed views. Destructive actions name the target and show a confirmation; ownership transfer explains the user's resulting admin role. Vote totals show an ordinary progress bar, explicit counts, eligibility, and deadlines. QR invitations render the actual link locally. Screenshots use mocked account data and are not proof of a deployed backend.

Cool gray outer canvas, white conversation surface, soft gray sidebar, deep teal action color (#076371), pale teal outgoing messages. Locally bundled Manrope variable type. Phosphor icons, consistent rounded controls, grouped messages, fine separators, and initials-based demo avatars. Desktop has group navigation, chat, and a collapsible activity panel. Mobile uses a dedicated group drawer and an activity overlay.

The original vector logo is public/logo.svg: a dark teal C-shaped conversation mark paired with a smaller muted-teal bubble. Opening motion transitions two dots into the logo/wordmark over approximately 1.4 seconds. It is silent, skippable, session-limited, replayable from the profile menu, and bypassed for reduced motion.

## Prototype behavior

Group filtering and creation, group switching, local sends/reactions, chat/updates/albums navigation, folder selection, photo lightbox, local notification toggle, member previews, and ephemeral private-chat demonstration are functional. Closing a temporary chat removes its local message state. External integrations deliberately show explanatory dialogs. Content is labeled illustrative; there is no server or authenticated user.

## Assets and provenance

- Logo: original project-authored SVG geometry, not a stock icon or trademark clearance claim.
- Font: Manrope via @fontsource-variable/manrope; bundled locally.
- Icons: @phosphor-icons/react.
- Photos: illustrative Unsplash images downloaded to public/images from images.unsplash.com. Source IDs: photo-1476514525535-07fb3b4ae5f1, photo-1519608487953-e999c86e7455, photo-1441974231531-c6227db76b6e, photo-1470252649378-9c29740c9fa8. Replace with user content when connecting albums; no claim these depict actual users or trips.
- Concept reference: the user-approved generated Clubhouse comparison image in the conversation. Screenshots in docs/design show the implemented prototype, not the generated reference.

## Validation

## Motion and interaction update

Native CSS and Web Animations API provide bounded 150–350 ms feedback for replies, reactions, messages, panels, tabs, and photo previews. Navigation animations are cancelled on interruption. No continuously running background effects or animation package added. The profile menu exposes Reduce motion, with OS reduced-motion preference also respected. Replies carry a visible quote, emoji insertion returns focus to the composer, and the photo viewer supports buttons plus left/right arrow keys. Touch users see message actions without hovering. Resizing across the desktop breakpoint resets activity panel visibility. All messaging remains local demo state.

Validation scripts: `node scripts/check-ui.mjs` and `node scripts/check-motion.mjs` against the running Vite server. The latter covers emoji insertion, reply context, photo keyboard navigation, manual reduced motion, and resize behavior.

Production TypeScript/Vite build; scripted Chromium checks at desktop and mobile widths; local sending, tabs, folders, group creation, activity toggle, private-chat deletion, no horizontal mobile overflow, no browser runtime errors. Mechanical design detector returned no findings. Screenshots were inspected together and image-loading/readability corrections applied. This is not full accessibility, cross-browser, backend, or security certification.

## Playful Clubhouse connected extension · 2026-10-01

This is the user-selected light, teal, tactile extension of the original Clubhouse identity. Conversation remains primary; Manrope, Phosphor icons, the double-bubble logo, existing navigation, and the original opening moment continue to define the world. This section describes the connected `/groups` surfaces; the earlier prototype sections describe `/demo` and retain their historical scope.

### Colors and material

The existing deep teal (`#076371`) remains the action and selected-state color. The connected message canvas uses a near-white mint (`#f6faf9`), with confetti on a slightly greener ground (`#f3f8f6`) and plain wallpaper on white. Incoming bubbles are white; outgoing bubbles use pale mint (`#dbeee7`). Supporting text uses muted teal-gray (`#526d70`). Stories and expanded music use a quiet near-white ground (`#f8fbfa`); the music scene and current queue row use soft mint (`#dfeee6`), and the listening dock uses (`#e0eee7`). These are observed local CSS values, not replacements for global palette tokens.

Tactility comes from restrained shadows and rounded geometry: message bubbles (`16px`, shadow `0 3px 9px #204d4310`), Stories cards (`16px`, shadow `0 5px 18px #234e4110`), and the music scene (`16px`). Composer and media cards keep clear edges; filters use pill corners (`24px`). The message composer uses (`#f4f8f6`) with a (`#cadfd6`) border. Do not promote surface-specific CSS overrides into unrelated screens.

### Layout and components

Room style sits with the connected group tools. Ripple, Confetti, and Plain are explicit choices; Ripple with pointer response enabled is the initial preference. The choice is private to this browser and stored under `apu-room-style:<userId>:<groupId>`. It does not change another member’s room or write shared backend state. Selection still works when browser storage is unavailable, without persistence. The chooser uses three swatches, a selected border/check, and a separate Pointer response toggle. Send and room-style controls provide at least (`44px`) touch targets.

Stories keeps authors visible above the media: a horizontally scrollable author rail, counted All moments / Stories / Posts / Reels filters, and a mixed media/text grid. At desktop the grid has two columns with (`22px`) gaps and a (`1100px`) maximum width; a first media item can span both columns with image and caption side by side. At (`700px`) and below it becomes one column and that feature card stacks. Desktop media is (`250px`) high, the featured image (`300px`), and mobile images (`240px`). Author tiles use rounded squares (`62px`, `22px` corners; mobile `56px`). The viewer provides Previous/Next buttons and left/right arrow keys over the selected collection. Opening an author story switches to the Stories collection so the viewer count and navigation remain coherent. Updates shows stories from the last 24 hours; the Stories album retains older story media through the existing album flow.

Music adds an original CSS record object above the existing session controls, white add-link/current-track surfaces, a numbered queue with a mint current-track row, and a compact record motif in the listening dock. The main record is (`108px`) wide, reducing to (`85px`) at (`600px`); dock records are (`38px`) and (`30px`). The record is decorative and does not imply playback state. Provider descriptions remain visible: Spotify opens externally with individual playback; YouTube host coordination retains its timing limitations; other provider playback remains individual.

### Motion and lifecycle invariants

Motion uses native CSS and pointer events; this extension adds no animation dependency. Ripple/Confetti light follows mouse movement only, accounts for message scroll position, and clears on pointer exit. Touch has a static pattern. Disabling Pointer response or the OS reduced-motion preference hides the light; plain wallpaper remains white. The switch transition is (`200ms`); Stories card lift and author-tile tilt use (`250ms`) transitions; the record settles once on listening-state entry over (`1.1s`, `cubic-bezier(.16,1,.3,1)`). Reduced motion disables these decorative transitions/transforms and record animation. There is no continuous record spin or background animation loop.

Preserve the music lifecycle when editing presentation: `MusicRoom` remains keyed by group/account outside the chat/Stories view branch; its provider players remain in the stable listening-dock portal, keyed by current track. Opening/closing the popover or switching chat/Stories must not remount a provider, start audio, or end a listening session. Joining, leaving, host controls, heartbeat/polling, queue mutations, and provider cleanup continue through their existing handlers. Wallpaper choices and decorative records never participate in provider state.

### Assets and validation scope

Ripple, Confetti, pointer light, and record grooves/highlights are original project-authored CSS geometry. This extension introduces no shipping raster assets. Existing logo/font/icon provenance above still applies; group media is supplied through the existing content pipeline. `docs/design/clubhouse-{chat,stories,music}-{1280,390}.png` are review captures, not shipping imagery or evidence of live user content.

The connected interaction check (`node scripts/check-connected.mjs`) and Clubhouse design check (`node scripts/check-clubhouse-design.mjs`) passed with mocked data during this extension. The reviewer’s story collection/navigation defect was corrected; the reviewer scored it resolved and issued a ship disposition. Separate hosted regression evidence and deployment details are recorded in docs/release-audit.md. The mocked checks do not establish full accessibility or physical-device coverage. Preserve the distinction between mocked UI evidence and connected service verification.
