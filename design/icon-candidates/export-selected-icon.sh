#!/bin/bash
# Build reviewable platform icons after choosing a candidate; never edit an installed app or production default.
set -euo pipefail
if [[ $# -ne 2 || ! "$1" =~ ^I(0[1-9]|[1-5][0-9]|6[0-4])$ ]]; then
  echo "Usage: bash design/icon-candidates/export-selected-icon.sh I17 /absolute/new-output-directory" >&2
  exit 1
fi
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/../.." && pwd)"
candidate="$1"
output="$2"
if [[ "$output" != /* || -e "$output" ]]; then
  echo "Output must be an absolute path that does not yet exist." >&2
  exit 1
fi
source_png="$repo_root/apps/desktop/public/icon-candidates/$candidate.png"
mkdir -p "$output/icon.iconset" "$output/linux"
# macOS requires both base and Retina representations, including 1024px artwork.
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$source_png" --out "$output/icon.iconset/icon_${size}x${size}.png" >/dev/null
  retina=$((size * 2))
  sips -z "$retina" "$retina" "$source_png" --out "$output/icon.iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$output/icon.iconset" -o "$output/icon.icns"
# Linux desktop environments choose a size from this standard raster icon set.
for size in 16 24 32 48 64 128 256 512 1024; do
  sips -z "$size" "$size" "$source_png" --out "$output/linux/${size}x${size}.png" >/dev/null
done
cp "$source_png" "$output/source-$candidate.png"
shasum -a 256 "$source_png" > "$output/source.sha256"
echo "Exported $candidate into $output; application defaults remain unchanged."
