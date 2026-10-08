# Playful Clubhouse redesign plan

Goal: redesign connected chat, Stories and music surfaces using the user-selected light, teal, tactile direction.
Architecture: retain existing Supabase data flows and provider lifecycles. Add a local account/group-scoped room-style control, media filters/viewer navigation, and presentation-only music motifs. Native CSS and pointer events; no new dependencies or paid services.

## Direction contract
THESIS: A private room that feels inhabited, with conversation foremost and tactile media objects.
OWN-WORLD: white and pale mint surfaces, deep teal controls, Manrope, Phosphor, 12–16px surfaces and pill filters.
STORY: choose a personal room atmosphere, read/send messages, browse group moments, share a soundtrack.
FIRST VIEWPORT: existing compact navigation above a spacious patterned message canvas; composer anchored below; Stories has a horizontal author rail and a photo-led mixed grid; music has a record object above its existing queue.
FORM: code-led extension of the approved Clubhouse world; signature interaction is a pointer-lit wallpaper with a static fallback. No random selection: explicit user choice.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

- [x] Personal wallpaper selection, local persistence, optional pointer response and reduced-motion handling.
- [x] Stories author rail, media filters, photo-led cards and manual previous/next viewer navigation.
- [x] Music record motif, clearer add/search sections and numbered current-track queue without remounting players.
- [x] Desktop/mobile interaction checks, screenshot review, build/secret scan, deployment and release evidence.
