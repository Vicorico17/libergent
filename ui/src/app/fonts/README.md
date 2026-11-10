# Bundled fonts

The root layout uses `next/font/local` so production builds do not fetch Google
Fonts. Preserve these files and their accompanying SIL Open Font License notices.

Google Fonts source revision: `5bb28733cec313b63fbd415b574b5ae35c8aa8b8`
Source: https://github.com/google/fonts/tree/5bb28733cec313b63fbd415b574b5ae35c8aa8b8/ofl

Each family directory contains the upstream font and its `OFL.txt` license.
JetBrains Mono was already bundled separately in this directory.

When updating fonts, download from the official source, preserve the license,
and run the production UI build. Keep CSS variable names in layout.tsx stable.

# JetBrains Mono

Variable font from the Google Fonts repository:
https://github.com/google/fonts/tree/main/ofl/jetbrainsmono

Downloaded September 25, 2026 from `JetBrainsMono[wght].ttf`.
Licensed under the SIL Open Font License 1.1; see `JetBrainsMono-OFL.txt`.

Bundled locally to avoid the Turbopack Google-font resolution failure observed
in GitHub Actions run 36146894284. The existing CSS variable and font family
are preserved.
