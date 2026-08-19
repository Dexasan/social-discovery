# Architecture Decisions

## Client

- Expo SDK 57 and React Native with TypeScript
- Expo Router for navigation
- Android is the only release target for the first private beta
- Development builds will be used once native integrations are added

## Backend

- Supabase Auth
- PostgreSQL with migrations
- Row Level Security on every exposed table
- Supabase Realtime channels for room state and messages
- Edge Functions for privileged third-party token creation
- Storage only for moderated profile avatars in the first beta

The client boundary is implemented in `src/lib/supabase.ts`. It remains disabled when the two public environment variables are absent. Nine deployed migrations establish identity, onboarding, matching, conversations, feed, Clubs, media sessions, triggers, grants, and RLS policies.

## Environment

Copy `.env.example` to `.env` after creating the Supabase project. Only the project URL and publishable key belong in the mobile client. Secret/service-role keys must remain in server-side functions and CI secrets.

## Safety invariants

- No anonymous Quick Chat
- Users must confirm they are at least 18
- Blocked users cannot match, message, or inspect protected profile activity
- Reports remain available during and after conversations
- Matchmaking is server-authoritative and rate-limited
- Admin credentials are never shipped to the client

## Cost guardrails

- Live audio remains usage-metered and disabled when provider credentials are absent
- No always-on custom server before managed free-tier limits require it
- Track realtime connections, storage, egress, and notification volume from the first beta

## Live audio checkpoint

Club presence, stage roles, hand raises, and moderation live in Supabase and do not depend on a media vendor. Cloudflare Realtime SFU is the Android audio transport because it bills actual outbound bandwidth, includes a substantial bandwidth allowance, and avoids per-participant-minute pricing. The client uses a development build because the React Native WebRTC SDK contains native code.

Cloudflare credentials remain server-side:

- Realtime App ID and App Secret: Supabase Edge Function secrets only; never placed in the app or repository
- Mobile activation: public boolean feature flag (`EXPO_PUBLIC_CLOUDFLARE_REALTIME_ENABLED`)
- Signaling: an authenticated Edge Function verifies the user’s current `room_participants` role before proxying Cloudflare session and track operations

Supabase stores provider-neutral media session metadata and distributes active speaker track IDs through RLS-protected Realtime. Listeners receive tracks but cannot publish. Hosts and speakers publish muted by default. Moving a user to the audience, removing them, or ending a room closes their active publishing session at the database boundary.
