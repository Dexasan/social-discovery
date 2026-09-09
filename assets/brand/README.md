# YAPPIE / little loudmouth

Original vector artwork: a vermilion speech bubble, winking eye, laughing mouth,
and chalk spark. Drawn for YAPPIE's charcoal editorial interface; no stock art or
third-party logo assets.

`yappie-mark.svg` is the editable source. Its transparent PNG is used by the
shared wordmark, Yap intro, and splash screen. The opaque icon has a charcoal
background; Android gets a separate transparent adaptive foreground and a
monochrome silhouette with transparent facial cutouts. Adaptive variants keep
the artwork within the central circular safe area.

Regenerate the four 1024-pixel PNGs with `scripts/render-brand.cjs` and
`@resvg/resvg-js` 2.6.2. The script accepts an absolute path to that package as
its first argument when the renderer is installed outside the project.

Launcher and splash changes require a new native build. The previously shared
0.1.4/build 9 APK retains the previous icon.
