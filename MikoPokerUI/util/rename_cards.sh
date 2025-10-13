#!/usr/bin/env bash
# rename_deck4.sh
# Converts deck4 naming (suit_rank.png) to deck1 style (rank_of_suit.png)

for f in *.{png,png.meta}; do
    # Skip if not a file
    [[ -f "$f" ]] || continue

    base="${f%.*}"      # remove extension (.png or .png.meta)
    ext="${f##*.}"      # get extension only

    # Split on underscore: suit_rank
    suit="${base%%_*}"
    rank="${base#*_}"

    # Normalize ranks (A→ace, J→jack, Q→queen, K→king)
    case "$rank" in
        A) rank="ace" ;;
        J) rank="jack" ;;
        Q) rank="queen" ;;
        K) rank="king" ;;
        10|9|8|7|6|5|4|3|2) ;; # leave numbers as is
        *) echo "Skipping unexpected rank: $rank"; continue ;;
    esac

    # Build new name (rank_of_suit)
    new="${rank}_of_${suit}.${ext}"

    echo "Renaming: $f → $new"
    mv -f -- "$f" "$new"
done

echo "✅ All deck4 cards renamed to deck1 format."

