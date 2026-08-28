#!/usr/bin/env bash
# Compiles the fixtures' Tailwind stylesheet ahead of time.
#
# The fixtures are static HTML with no build step of their own, and they sit
# frozen for three weeks after submission — so the CSS ships with them rather
# than being fetched from a CDN at runtime.
set -euo pipefail
cd "$(dirname "$0")/.."

out=$(mktemp -t airlock-fixture-css)
./node_modules/.bin/tailwindcss -i apps/fixtures.css -o "$out" --minify
for app in vault dispatch bazaar; do
  cp "$out" "apps/$app/fixture.css"
done

# The day-one probes share the same sheet so they match the rest of the project.
cp "$out" spike/provider/probe.css
cp "$out" spike/consumer/probe.css
rm -f "$out"
echo "stylesheet written for vault, dispatch, bazaar and the spike probes"
