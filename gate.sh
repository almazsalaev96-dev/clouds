#!/usr/bin/env bash
# The whole gate, in the order the environments change.
#
# Four suites need something different from the rest — two providers, a mock
# with the gap between tokens stretched, a mock that rate-limits once — and
# running them against the wrong one fails in a way that reads like a
# regression and is not. So the server is restarted between phases rather than
# left running and hoped over.
#
#   bash gate.sh            everything
#   bash gate.sh unit       just the ones that need no browser
set -u
cd "$(dirname "$0")"
LOG=${LOG:-/tmp/claude-0/gate}
mkdir -p "$LOG"
ONLY=${1:-all}
FAILED=0

run() { # run <name> <command...>
  local name=$1; shift
  printf '  %-16s ' "$name"
  if "$@" > "$LOG/$name.log" 2>&1; then
    # `audit` ends on its own tally rather than a sentence, and a tally of
    # nought read as "FAIL" in this column — the one word it must never say
    # when nothing failed.
    tail -1 "$LOG/$name.log" | sed 's/^ *//; s/^FAIL (0)$/all passed/'
  else
    FAILED=$((FAILED + 1))
    echo "FAIL"
    grep -m4 '✗' "$LOG/$name.log" | sed 's/^/      /'
  fi
}

serve() { # serve <extra env assignments...>
  pkill -f next-server > /dev/null 2>&1
  sleep 1
  env "$@" ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock \
    nohup npx next start -p 3100 > "$LOG/server.log" 2>&1 &
  for _ in $(seq 1 30); do
    curl -sf -o /dev/null http://localhost:3100/ && return 0
    sleep 1
  done
  echo "  server never came up"; exit 1
}

mock() { # mock <file> [extra env]
  pkill -f "mock-provider|mock-slow" > /dev/null 2>&1
  sleep 1
  env "${@:2}" nohup node "$1" > "$LOG/mock.log" 2>&1 &
  for _ in $(seq 1 20); do
    curl -sf -o /dev/null http://localhost:8787/__last && return 0
    sleep 1
  done
  echo "  mock never came up"; exit 1
}

echo "== unit =="
run test-route npx jiti test-route.ts
run test-web   npx jiti test-web.ts
run test-task  npx jiti test-task.ts
run test-error npx jiti test-error.ts
run test-fuzz  npx jiti test-fuzz.ts
run test-cite  node --experimental-strip-types test-cite.mts
[ "$ONLY" = unit ] && { echo; echo "$([ $FAILED -eq 0 ] && echo "all passed" || echo "$FAILED FAILED")"; exit $FAILED; }

echo
echo "== one provider, ordinary mock =="
mock mock-provider.mjs
serve
for t in e2e e2e-canvas e2e-web e2e-code e2e-agent e2e-sources e2e-auto e2e-command \
         e2e-project e2e-mode e2e-pdf e2e-editor e2e-makes e2e-bar e2e-motion \
         e2e-use e2e-scale e2e-backup e2e-error; do
  run "$t" node "$t.mjs"
done
run test-context node test-context.mjs
run test-fit     node test-fit.mjs

echo
echo "== measured =="
for m in audit contrast touch theme-parity type-scale keys reach widths print shoot-smoke; do
  run "$m" node "$m.mjs"
done

echo
echo "== two providers =="
serve OPENAI_BASE_URL=http://127.0.0.1:8787 OPENAI_API_KEY=sk-mock
for t in e2e-verify e2e-point e2e-whole; do run "$t" node "$t.mjs"; done

echo
echo "== the slow mock =="
mock mock-slow.mjs
serve
for t in e2e-stop e2e-watch; do run "$t" node "$t.mjs"; done

echo
echo "== a mock that rate-limits once =="
mock mock-provider.mjs MOCK_RATE_LIMIT=1
serve
run test-retry node test-retry.mjs

mock mock-provider.mjs
echo
[ $FAILED -eq 0 ] && echo "all passed" || echo "$FAILED FAILED"
exit $FAILED
