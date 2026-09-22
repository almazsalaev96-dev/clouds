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
run test-refuse npx jiti test-refuse.ts
run test-identity npx jiti test-identity.ts
run test-lint  npx jiti test-lint.ts
run test-predict npx jiti test-predict.ts
run test-rows  npx jiti test-rows.ts
run test-lang  npx jiti test-lang.ts
run test-mode  npx jiti test-mode.ts
run test-turns npx jiti test-turns.ts
run test-decide npx jiti test-decide.ts
run test-compute npx jiti test-compute.ts
run test-register npx jiti test-register.ts
run test-presets npx jiti test-presets.ts
run test-wire  npx jiti test-wire.ts
run test-callout npx jiti test-callout.ts
run test-study npx jiti test-study.ts
run test-topics npx jiti test-topics.ts
run test-tokens npx jiti test-tokens.ts
run test-find  npx jiti test-find.ts
run test-table npx jiti test-table.ts
run test-chart npx jiti test-chart.ts
run test-tools npx jiti test-tools.ts
run test-slash npx jiti test-slash.ts
run test-actions npx jiti test-actions.ts
run test-recap npx jiti test-recap.ts
run test-plain npx jiti test-plain.ts
run test-revision npx jiti test-revision.ts
run test-grade npx jiti test-grade.ts
run test-retrieve npx jiti test-retrieve.ts
run test-exam npx jiti test-exam.ts
run test-plan npx jiti test-plan.ts
run test-health npx jiti test-health.ts
run test-memory npx jiti test-memory.ts
run test-voice npx jiti test-voice.ts
run test-built npx jiti test-built.ts
run test-fuzz  npx jiti test-fuzz.ts
run test-cite  node --experimental-strip-types test-cite.mts
[ "$ONLY" = unit ] && { echo; echo "$([ $FAILED -eq 0 ] && echo "all passed" || echo "$FAILED FAILED")"; exit $FAILED; }

echo
echo "== one provider, ordinary mock =="
mock mock-provider.mjs
serve
for t in e2e e2e-rest e2e-canvas e2e-web e2e-code e2e-follow e2e-agent e2e-sources e2e-auto e2e-command \
         e2e-project e2e-mode e2e-pdf e2e-editor e2e-makes e2e-bar e2e-motion \
         e2e-use e2e-scale e2e-backup e2e-error e2e-storage e2e-shape e2e-point-at e2e-draw \
         e2e-ask e2e-crash e2e-dir e2e-keep e2e-made e2e-recover e2e-compute e2e-register e2e-study e2e-mastery e2e-tutor e2e-comfort e2e-find e2e-table e2e-chart e2e-research e2e-slash e2e-actions e2e-recap e2e-rooms e2e-notebook e2e-plan e2e-look e2e-presets e2e-pack e2e-phone e2e-ink e2e-rules e2e-refresh e2e-shell; do
  run "$t" node "$t.mjs"
done
run test-context node test-context.mjs
run test-fit     node test-fit.mjs
# The adapter driven against the mock rather than against a captured body:
# needs the mock up, which it is here, and no browser.
run test-responses npx jiti test-responses.ts

echo
echo "== measured =="
for m in audit contrast touch theme-parity type-scale shell keys reach widths overlap print depth shoot-smoke; do
  run "$m" node "$m.mjs"
done

echo
echo "== two providers =="
serve OPENAI_BASE_URL=http://127.0.0.1:8787 OPENAI_API_KEY=sk-mock
for t in e2e-verify e2e-learn e2e-point e2e-whole e2e-cast e2e-elsewhere e2e-actions2; do run "$t" node "$t.mjs"; done

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

echo
echo "== a mock that holds its first event =="
mock mock-provider.mjs MOCK_STALL=4000
serve
run e2e-stall node e2e-stall.mjs

mock mock-provider.mjs
echo
[ $FAILED -eq 0 ] && echo "all passed" || echo "$FAILED FAILED"
exit $FAILED
