#!/bin/sh
# Files a phone export (the zip from the judge prototype's Takes tab) into testset/. Existing files are kept.
set -e
[ -f "$1" ] || { echo "usage: npm run import -- <beatbox-takes-....zip>"; exit 1; }
unzip -n "$1" -d testset
echo "Imported into testset/. Run npm run report to score the judge."
