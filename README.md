# Social Discovery

Android-first private-beta app for meeting people through authenticated Quick Chat, public posts, persistent DMs, and live interest-based Clubs.

The working product name is intentionally generic until branding is selected.

## Development

Requirements: Node.js and pnpm.

```powershell
pnpm install
pnpm typecheck
pnpm android
```

The app uses the linked Supabase project for authentication, onboarding, profiles, safety, matching, messages, posts, and Club room state. Copy `.env.example` to `.env` for a new development environment.

## Current milestone

- Android/Expo foundation
- Five-tab navigation
- Local onboarding and profile state
- Interactive Quick Chat queue preview
- Feed, Clubs, DMs, and safety-center preview screens
- Supabase client boundary and first RLS-protected identity/safety migration
- Live project link and generated TypeScript database types
- Transactional Quick Chat matching and realtime conversations
- Live feed, replies, likes, follows, and persistent DMs
- Live Clubs discovery, membership, room-stage state, hand raises, and moderation
- Android WebRTC audio client and an authenticated, role-aware Cloudflare Realtime gateway

The Clubs room state is production-backed. Realtime audio activates after a Cloudflare Realtime SFU application is configured with the `CLOUDFLARE_REALTIME_APP_ID` and `CLOUDFLARE_REALTIME_APP_SECRET` Edge Function secrets and the public client feature flag is enabled.

See `docs/MVP.md` and `docs/ARCHITECTURE.md` for the product and technical decisions.
