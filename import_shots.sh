#!/bin/zsh
# Copies app screenshots for one update into the site, resized to 720 px wide WebP.
# Usage: ./import_shots.sh 2026-10-13 [feature ...]   (no features = all)
# Source: ../pazarlama/gorseller/<date>/<feature>-light.png and -dark.png (Turkish, emulator, sample data only)
#         ../pazarlama/gorseller/<date>/<lang>/<feature>-light.png and -dark.png (the app in that language; optional)
# Output: static/assets/news/<date>-<feature>[-<lang>]-<light|dark>.webp ; reference it in texts/xx.json news[].images as "<date>-<feature>"
set -e
cd "${0:A:h}"
d=$1; src="../pazarlama/gorseller/$d"; out="static/assets/news"
mkdir -p "$out"
shift
feats=("$@")
for f in "$src"/*-light.png(N) "$src"/*-dark.png(N) "$src"/[a-z][a-z]/*-light.png(N) "$src"/[a-z][a-z]/*-dark.png(N); do
  name=${f:t:r}
  base=${name%-light}; base=${base%-dark}
  variant=${name#$base-}
  if (( $#feats )) && (( ! ${feats[(Ie)$base]} )); then continue; fi
  lang=""; [[ ${f:h} != $src ]] && lang="-${f:h:t}"
  cwebp -quiet -q 80 -resize 720 0 "$f" -o "$out/$d-$base$lang-$variant.webp"
  echo "$out/$d-$base$lang-$variant.webp"
done
