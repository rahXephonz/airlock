#!/usr/bin/env bash
# Deploys all four origins to the one Netlify account they share.
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm --filter @airlock/console build

netlify deploy --prod --no-build --filter @airlock/console \
  --dir apps/console/dist --site 124e8668-c8f1-42cf-aa47-443efc787f70
netlify deploy --prod --dir apps/vault    --site 1f241ef9-0987-47f5-8bb4-40d69941a55e
netlify deploy --prod --dir apps/dispatch --site be40fc82-96e2-4047-adfa-7706861f96e2
netlify deploy --prod --dir apps/bazaar   --site a0ec6461-5adf-4ee9-864a-85719bd32599
