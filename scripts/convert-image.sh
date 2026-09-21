#!/bin/bash
# Convert image to 4:5 portrait WebP for reel cards
# Usage: ./convert-image.sh <input> <output> [max_width] [max_height]
#   input: local file path OR URL
#   output: target WebP path
#   max_width: default 720
#   max_height: default 900

set -e

INPUT="$1"
OUTPUT="$2"
MAX_W="${3:-720}"
MAX_H="${4:-900}"
QUALITY="${5:-78}"

if [ -z "$INPUT" ] || [ -z "$OUTPUT" ]; then
    echo "Usage: $0 <input> <output> [max_width] [max_height]"
    exit 1
fi

# Create temp directory
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# Download if URL
if [[ "$INPUT" == http* ]]; then
    echo "Downloading: $INPUT"
    TMPFILE="$TMPDIR/downloaded"
    # Try wget, timeout 15s
    if ! wget -q --timeout=15 -O "$TMPFILE" "$INPUT" 2>/dev/null; then
        # Try curl
        if ! curl -sL --connect-timeout 15 -o "$TMPFILE" "$INPUT" 2>/dev/null; then
            echo "Failed to download: $INPUT"
            exit 1
        fi
    fi
    INPUT="$TMPFILE"
fi

# Check if file exists
if [ ! -f "$INPUT" ]; then
    echo "Input file not found: $INPUT"
    exit 1
fi

# Get source dimensions
DIMS=$(identify -format "%w %h" "$INPUT" 2>/dev/null || echo "0 0")
SRC_W=$(echo $DIMS | cut -d' ' -f1)
SRC_H=$(echo $DIMS | cut -d' ' -f2)

if [ "$SRC_W" -eq 0 ] || [ "$SRC_H" -eq 0 ]; then
    echo "Failed to read image dimensions: $INPUT"
    exit 1
fi

echo "Source: ${SRC_W}x${SRC_H}"

# Target aspect ratio: 4:5 (width:height = 0.8)
TARGET_RATIO=0.8
SRC_RATIO=$(echo "scale=4; $SRC_W / $SRC_H" | bc)

# Determine crop geometry for center crop to 4:5
if (( $(echo "$SRC_RATIO > $TARGET_RATIO" | bc -l) )); then
    # Source is wider (landscape) - crop sides
    NEW_W=$(echo "scale=0; $SRC_H * $TARGET_RATIO / 1" | bc)
    NEW_H=$SRC_H
    X_OFF=$(echo "scale=0; ($SRC_W - $NEW_W) / 2" | bc)
    Y_OFF=0
else
    # Source is taller or exact - crop top/bottom
    NEW_W=$SRC_W
    NEW_H=$(echo "scale=0; $SRC_W / $TARGET_RATIO / 1" | bc)
    X_OFF=0
    Y_OFF=$(echo "scale=0; ($SRC_H - $NEW_H) / 2" | bc)
fi

# Make sure offsets are positive integers
X_OFF=${X_OFF#-}
Y_OFF=${Y_OFF#-}
[ -z "$X_OFF" ] && X_OFF=0
[ -z "$Y_OFF" ] && Y_OFF=0

echo "Crop: ${NEW_W}x${NEW_H}+${X_OFF}+${Y_OFF}"

# Create output directory
mkdir -p "$(dirname "$OUTPUT")"

# Perform center crop and resize
INTERMEDIATE="$TMPDIR/cropped.png"

# First crop to 4:5, then resize to target dimensions
convert "$INPUT" \
    -crop "${NEW_W}x${NEW_H}+${X_OFF}+${Y_OFF}" \
    +repage \
    -resize "${MAX_W}x${MAX_H}!" \
    -colorspace sRGB \
    -strip \
    "$INTERMEDIATE"

# Convert to WebP
cwebp -q $QUALITY "$INTERMEDIATE" -o "$OUTPUT" 2>/dev/null

# Get final file size
FILESIZE=$(stat -c%s "$OUTPUT" 2>/dev/null || stat -f%z "$OUTPUT" 2>/dev/null)
FILESIZE_KB=$((FILESIZE / 1024))

# Verify dimensions
FINAL_DIMS=$(identify -format "%w %h" "$OUTPUT" 2>/dev/null || echo "? ?")

echo "Output: $FINAL_DIMS px, ${FILESIZE_KB} KB -> $OUTPUT"

# Warn if over 150KB
if [ "$FILESIZE_KB" -gt 150 ]; then
    echo "WARNING: File size ${FILESIZE_KB} KB exceeds 150 KB cap"
fi
