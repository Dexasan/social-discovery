# Yappie after dark

The app uses charcoal surfaces, warm chalk typography, vermilion accents, and original editorial artwork. The visual reference is [Pure](https://pure.app/): expressive illustration, confident type contrasts, and a distinct identity. Yappie’s illustrations and navigation drawings are original.

## Design system

- Barlow Condensed Bold for headlines and navigation; Instrument Serif for editorial accents; DM Sans for controls and reading. Six font faces are bundled locally, loaded before the app opens, and resolved consistently on Android, iOS, and web.
- Dark backgrounds throughout, including the system UI and splash configuration. Chalk-filled selected controls use dark text; red actions have a separate solid color so their white labels remain readable.
- The five tabs use original SVG ink drawings: lips, an eye, intertwined loops, a letter, and a cameo. The selected tab has an irregular paper stamp, a slight tilt, and a vermilion underline. Text labels and native tab accessibility remain intact.
- Shared typography, headers, buttons, fields, avatars, and empty states extend through authentication, onboarding, profiles, connections, clubs, live rooms, messages, calls, settings, legal pages, and gifts.

## Local review

Run `pnpm ui:review`, then open `http://localhost:4173`. The review bundles the actual screen components with local sample data. It replaces service modules at build time; no Supabase session, real messages, calls, memberships, or payments are used. The production app has no preview route or authentication bypass.

The desktop sidebar offers screen and state navigation. Main tabs also work at phone widths. Additional review URLs accept `screen=call`, `screen=club`, `screen=room`, `screen=person`, `screen=post`, and `screen=quick-conversation`.

## Artwork provenance

Asset: `assets/art/conversation-night-print.png`. Created with the built-in image generation tool, then copied into the repository. No Pure imagery is bundled.

Original generation prompt:

> Use case: illustration-story. Create an original editorial ink illustration for Yappie, a social conversation app. Wide landscape 3:2, warm ivory paper background #F4F0E7. Two delightfully odd abstract human profiles facing each other, expressive wavy black brush outlines, one vermilion red face and one ivory face with black hair, talking across a tiny red four-point star and dancing ink speech marks. Sophisticated independent magazine / linocut poster art, adult, playful, surreal, bold imperfect hand-drawn lines with slight print texture, flat 2-color print. Composition fills central 85%, cropped shoulder portraits, generous background at edges. No words, no letters, no UI, no mockup, no gradients, no 3D, no emoji, no generic cute chat bubble mascots. Original artwork, do not copy any existing brand illustrations.

Dark adaptation prompt:

> Edit this original Yappie illustration into its nocturnal dark-mode version. Preserve the same two profiles, facing each other, expressive linocut lines, red star and speech marks, composition and artwork identity. Replace the entire ivory paper background with nearly black charcoal #111110. Keep the left face vermilion red, keep the right face warm ivory. Render the surrounding hair contours, speech marks and decorative linework in warm ivory so they remain legible on black. Reduce the ivory areas on shoulders to just expressive outlines. The overall image must feel predominantly dark and striking, about 65 percent charcoal background, with red and ivory spot-printed artwork. Original imperfect editorial ink texture, no new objects, no words or text, no gradients, no UI. Landscape 3:2.

## Validation

TypeScript and the existing image parser security check pass. Android production bundle export is checked separately from an installable APK build. Browser review covers 390px and 320px layouts, the five tabs, supporting screens, empty and error states, matching and cancellation, custom interests and the five-interest limit, inbox search and filtering, and composer states using sample data.

The older `Yappie-preview-0.1.3.apk` is a separate, unchanged build. Testing on a physical Android device requires a new native build because this update adds bundled fonts and SVG rendering.
