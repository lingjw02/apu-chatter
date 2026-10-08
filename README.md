<![CDATA[<div align="center">

  <img src="public/logo.svg" alt="APU Chatter" width="80" />

  # APU Chatter

  **A little space. All your people.**

  Private, group-centered social web app built with React, TypeScript & Supabase.

  [![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
  [![Supabase](https://img.shields.io/badge/Supabase-Backend-3ecf8e?logo=supabase&logoColor=white)](https://supabase.com)
  [![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)](https://vite.dev)
  [![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-f38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com)
  [![License](https://img.shields.io/badge/License-Private-gray)](#license)

  <br/>

  <img src="docs/design/clubhouse-desktop.png" alt="Desktop — Group Chat" width="720" />

  <sub>Desktop view — group chat with sidebar navigation, music dock and activity panel</sub>

</div>

<br/>

---

## ✨ What is APU Chatter?

APU Chatter is a **private, group-centered** web app designed for small circles of friends. Think of it as your group's own little corner of the internet — with real-time chat, shared music, collaborative boards, stories, voice rooms and AI-powered insights, all wrapped in a clean, warm Clubhouse-inspired design.

> 🌐 **Preview:** [apu-chatter.pages.dev](https://apu-chatter.pages.dev) &nbsp;·&nbsp; The full release is still in development.

<br/>

## 📸 Screenshots

<div align="center">

| Desktop | Mobile |
|:---:|:---:|
| <img src="docs/design/clubhouse-chat-1280.png" width="480" alt="Connected Chat"/> | <img src="docs/design/clubhouse-chat-390.png" width="200" alt="Mobile Chat"/> |
| <sub>Connected group chat with composer tools</sub> | <sub>Responsive mobile layout</sub> |
| <img src="docs/design/clubhouse-stories-1280.png" width="480" alt="Stories"/> | <img src="docs/design/clubhouse-stories-390.png" width="200" alt="Mobile Stories"/> |
| <sub>Stories with author tiles & media filters</sub> | <sub>Stories on mobile</sub> |
| <img src="docs/design/music-desktop.png" width="480" alt="Music Box"/> | <img src="docs/design/music-mobile.png" width="200" alt="Mobile Music"/> |
| <sub>Music box — shared listening with Apple/YouTube/Spotify</sub> | <sub>Music dock on mobile</sub> |
| <img src="docs/design/board-desktop.png" width="480" alt="Collaborative Board"/> | <img src="docs/design/board-mobile.png" width="200" alt="Mobile Board"/> |
| <sub>Collaborative whiteboard with tabs & tools</sub> | <sub>Board on mobile</sub> |
| <img src="docs/design/voice-desktop.png" width="480" alt="Voice Room"/> | <img src="docs/design/voice-mobile.png" width="200" alt="Mobile Voice"/> |
| <sub>WebRTC voice room with push-to-talk</sub> | <sub>Voice on mobile</sub> |

</div>

<br/>

## 🚀 Features

### 💬 Communication
- **Group Chat** — Real-time messaging with message history, reactions, replies, and message deletion
- **Private Chats** — Temporary 1-on-1 conversations within a group; ending or blocking deletes all messages
- **Voice Rooms** — 4-person WebRTC rooms with muted entry, open mic and push-to-talk
- **Rich Composer** — Image/GIF uploads, preview-before-send voice messages (up to 2 min), emoji picker, dictation and GIF favourites

### 📖 Sharing
- **Stories** — Author tiles, media-type filters (posts/reels/stories), photo-led cards and moment navigation
- **Albums** — Durable album folders with paged history and unread-update avatar links
- **Collaborative Board** — Up to 20 tabs, zoom/pan canvas, drawing/text tools, cursor presence and personal undo

### 🎵 Music
- **Shared Listening** — Group music queues with a persistent player dock, playlists, reactions and skip voting
- **Multi-Provider** — YouTube video/playlist playback, Spotify queue + external open, Apple Music embedded playback
- **AI Song Search** — Real Apple Music catalog matches for easy queuing

### 🤖 AI & Insights
- **AI Summaries** — Server-side OpenRouter summaries, decisions and notes with selectable date ranges
- **Weekly Topics** — Sourced, scheduled AI-generated conversation topics
- **Group Rankings** — Common words, timezone-local streaks and activity stats

### 🎨 Personalization
- **Visual Themes** — Browser-local themes with JSON import/export, safe mode and rollback
- **Chat Wallpapers** — Ripple, Confetti or Plain wallpapers per account and group
- **Notification Sounds** — Per-sender sounds across joined groups
- **Pointer Light** — Optional ambient cursor effect and tactile music presentation

### 🔐 Groups & Moderation
- **QR/Link Invitations** — Generate shareable invite links and QR codes
- **Roles & Governance** — Owner, admin and member roles with kick votes, bans, blocks and reports
- **Owner-Confirmed Deletion** — Safe group deletion with ownership transfer

<br/>

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 · TypeScript 5.8 · Vite 6 |
| **Backend** | Supabase (Auth, Database, Storage, Edge Functions) |
| **Real-time** | Supabase Realtime · WebRTC (voice) |
| **AI** | OpenRouter (Qwen 3.8-27B) |
| **Hosting** | Cloudflare Pages |
| **Styling** | Scoped CSS · Manrope font · Phosphor Icons |

<br/>

## 📁 Project Structure

```
social-app/
├── src/
│   ├── app/                  # App entry point and root layout
│   ├── features/             # Feature modules
│   │   ├── activity/         # Group stats, rankings, streaks
│   │   ├── ai/               # AI summaries, topics, song search
│   │   ├── auth/             # Login, register, profiles
│   │   ├── board/            # Collaborative whiteboard
│   │   ├── composer/         # Rich message composer
│   │   ├── feedback/         # In-app notifications & banners
│   │   ├── groups/           # Group management & invitations
│   │   ├── music/            # Shared music queue & player
│   │   ├── personalization/  # Themes, wallpapers, sounds
│   │   ├── private-chat/     # Temporary private conversations
│   │   ├── sharing/          # Stories, albums, media uploads
│   │   └── voice/            # WebRTC voice rooms
│   └── lib/                  # Shared utilities and helpers
├── supabase/
│   ├── migrations/           # Database migration history
│   └── functions/            # Edge Functions (AI, media, voice ICE)
├── public/                   # Static assets and hosting rules
├── scripts/                  # Test runners, fixtures, diagnostics
├── docs/                     # Setup guides, design references, release audit
└── qa-run/                   # QA reports and evidence logs
```

<br/>

## ⚡ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A [Supabase](https://supabase.com) project (for backend features)

### Installation

```bash
# Clone the repository
git clone https://github.com/lingjw02/apu-chatter.git
cd apu-chatter

# Install dependencies
npm install

# Start the development server
npm run dev
```

### Environment Setup

Copy the example environment file and fill in your Supabase credentials:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
```

> [!IMPORTANT]
> Never put service-role keys, OpenRouter keys or TURN secrets in `VITE_` variables — those belong in server-side `.env` files only.

For AI features, also configure `.env.openrouter` (see `.env.openrouter.example`).

### Build

```bash
npm run build
```

<br/>

## ✅ Verification

| Command | Purpose |
|---|---|
| `npm run build` | TypeScript check + production build |
| `node scripts/check-connected.mjs` | Mocked browser flow tests |
| `node --env-file=.env scripts/check-live-integration.mjs` | Live hosted integration (requires Supabase CLI) |

Set `TEST_LIVE_AI=1` or `TEST_LIVE_VIDEO=1` to include external AI or video fixtures.  
See the [release audit](docs/release-audit.md) for full evidence and acceptance gates.

<br/>

## 📚 Documentation

| Document | Description |
|---|---|
| [DESIGN.md](DESIGN.md) | Clubhouse visual language and UI decisions |
| [Backend Setup](docs/backend-setup.md) | Supabase configuration and deployment |
| [Deployment Ops](docs/deployment.md) | Cloudflare Pages deployment guide |
| [Theme Code Guide](docs/theme-code.md) | Personalization system internals |
| [Release Audit](docs/release-audit.md) | Requirement-by-requirement release checklist |
| [Music Providers](docs/music-provider-verification.md) | YouTube, Spotify & Apple Music verification |

<br/>

## 🗺 Roadmap

- [ ] Voice relay (TURN) configuration for restrictive networks and mobile
- [ ] Physical device / browser compatibility review
- [ ] SMTP configuration and delivery verification
- [ ] Remaining music provider playback checks
- [ ] Physical-device acceptance (microphone, camera, touch)

<br/>

## 🎨 Design Philosophy

APU Chatter follows the **Clubhouse** visual concept: a cool light-gray canvas, white conversation surfaces, deep teal accents (`#076371`), and rounded, approachable controls. The opening animation transitions two dots into the signature double-bubble **C** logo. Typography uses locally-bundled [Manrope](https://manropefont.com/), and icons come from [Phosphor](https://phosphoricons.com/).

All motion is bounded (150–350 ms), respects `prefers-reduced-motion`, and is cancellable on interruption.

<br/>

## 📄 License

This is a private project. All rights reserved.

<br/>

---

<div align="center">

  <img src="public/logo.svg" alt="APU Chatter" width="32" />

  <br/>

  <sub>Good conversation starts with your people.</sub>

</div>
]]>
