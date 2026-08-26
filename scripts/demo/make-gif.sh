#!/usr/bin/env bash
# m15b / AC-12.8 / D20: builds the README's demo GIF from a Playwright screen recording.
#
# Two passes, because a one-pass GIF encode picks a generic 256-colour palette and this app is a
# dark near-monochrome UI with a few saturated accents — exactly the case where a generated
# palette (`palettegen`) is dramatically better per byte than the default one. `stats_mode=diff`
# weights the palette toward pixels that actually change between frames, which here means the
# moving value boxes rather than the large static background.
#
# Usage:  scripts/demo/make-gif.sh
# Output: docs/images/demo-bubble-sort.gif
#
# Requires ffmpeg (`brew install ffmpeg`).

set -euo pipefail

cd "$(dirname "$0")/../.."

OUT="docs/images/demo-bubble-sort.gif"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Crop to the hero — title, code panel, animation, and the caption line. The lesson grid below it
# is not what the GIF is for, and at README width its card text would be unreadable anyway.
#
# Measured at the 1100x620 capture viewport, not guessed: h1 occupies y 24-52, the hero row
# y 84-308, the caption y 340-360, and the content column runs x 24-1076. The values below are
# that span plus 8px of breathing room top and bottom. Re-measure if the landing layout changes.
CROP_W="${CROP_W:-1052}"
CROP_H="${CROP_H:-352}"
CROP_X="${CROP_X:-24}"
CROP_Y="${CROP_Y:-16}"

# GIF output width. 900px is about the rendered width of a README image on GitHub.
GIF_W="${GIF_W:-900}"
FPS="${FPS:-12}"

echo "==> Recording (Playwright, separate config so the normal suite is untouched)"
rm -rf test-results/demo
npx playwright test --config=playwright.demo.config.ts --output=test-results/demo

VIDEO="$(find test-results/demo -name '*.webm' | head -1)"
if [ -z "$VIDEO" ]; then
  echo "No video produced — check the Playwright run above." >&2
  exit 1
fi
echo "==> Source video: $VIDEO"

# Keep only the tail of the recording. The video necessarily includes page load and the spec's
# fast-forward through the four setup steps; `-sseof` (seek relative to end) drops all of it
# without needing to know how long the page took to load, which varies run to run in a way a
# fixed front trim (`-ss`) would get wrong. Must match WINDOW_MS in gif.spec.ts.
TAIL_SECONDS="${TAIL_SECONDS:-7.0}"

FILTERS="crop=${CROP_W}:${CROP_H}:${CROP_X}:${CROP_Y},fps=${FPS},scale=${GIF_W}:-1:flags=lanczos"

echo "==> Pass 1: generating a palette from the frames that actually move"
ffmpeg -loglevel error -y -sseof "-${TAIL_SECONDS}" -i "$VIDEO" \
  -vf "${FILTERS},palettegen=stats_mode=diff" \
  "$WORK/palette.png"

echo "==> Pass 2: encoding with that palette"
ffmpeg -loglevel error -y -sseof "-${TAIL_SECONDS}" -i "$VIDEO" -i "$WORK/palette.png" \
  -lavfi "${FILTERS}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle" \
  -loop 0 \
  "$OUT"

SIZE_BYTES=$(wc -c <"$OUT" | tr -d ' ')
SIZE_H=$(du -h "$OUT" | cut -f1 | tr -d ' ')
echo "==> Wrote $OUT ($SIZE_H)"

# D20's budget. A hard gate rather than a note, so this can't silently ship oversized.
if [ "$SIZE_BYTES" -gt 5242880 ]; then
  echo "FAIL: over D20's ~5MB budget. Lower FPS or GIF_W and re-run." >&2
  exit 1
fi
echo "==> Under D20's 5MB budget."
