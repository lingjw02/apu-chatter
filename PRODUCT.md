# APU Chatter
Responsive web social app for private groups; solo developer, under 20 pilot users. React and TypeScript; future Supabase backend and OpenRouter AI. Full requirements live in docs/superpowers/specs/2026-09-21-apu-chatter-design.md.

Current deliverable is a UI-only, interactive Clubhouse prototype. Sample messages, members, updates, albums, and activity are illustrative. No authentication, live music, realtime messaging, invites, or backend integration is claimed. Local message composition and group creation are ephemeral demonstrations.

Update: the prototype remains available at /demo. A separate account/group integration is now prepared locally at /login, /register, and /groups, with a Supabase migration. It has no configured hosted backend. See docs/backend-setup.md for implemented capabilities, local test evidence, and remaining pilot work. Do not treat the demo's features as connected capabilities.

User selected the Clubhouse visual concept: cool light gray, white, deep teal, rounded conversation bubbles, sidebar, central conversation, collapsible activity panel, and a double-bubble C logo. Opening animation turns two dots into that logo. Preserve this approved world. Mobile is responsive web, not a native app.

2026-09-23 status: the existing Supabase project is connected and the user has verified account creation/sign-in. `/groups` now includes connected temporary private text chatboxes with acceptance and transactional deletion on end/leave/removal. `/demo` remains illustrative. See docs/backend-setup.md for current verification and limitations; the earlier unconfigured-backend statements are historical.
