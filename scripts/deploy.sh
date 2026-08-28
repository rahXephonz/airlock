#!/usr/bin/env bash
# Deploys all four origins to the one Netlify account they share.
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm --filter @airlock/console build

# --filter is required on every deploy, including the static fixtures that are
# not workspace packages: the CLI detects the pnpm workspace and otherwise stops
# to ask which project it is deploying. --dir still decides what is uploaded.
deploy() {
  netlify deploy --prod --no-build --filter @airlock/console --dir "$1" --site "$2"
}

# Netlify injects a "Powered by Netlify" badge at the edge, after </html>, so it
# cannot be removed from source. It is disabled per site with:
#   netlify api updateSite --data \
#     '{"site_id":"<id>","body":{"built_with_badge_enabled":false}}'
# Already applied to all four; recorded here because it survives deploys but not
# a site being recreated.

deploy apps/console/dist 124e8668-c8f1-42cf-aa47-443efc787f70
deploy apps/vault        1f241ef9-0987-47f5-8bb4-40d69941a55e
deploy apps/dispatch     be40fc82-96e2-4047-adfa-7706861f96e2
deploy apps/bazaar       a0ec6461-5adf-4ee9-864a-85719bd32599
