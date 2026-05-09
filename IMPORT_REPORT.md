# Flormar Tunisia — Catalog Import Report

Status: **failed**  
Reason: Seed script did not write a report. Captured logs below.

## npm_ci.log

```

added 68 packages, and audited 69 packages in 8s

15 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

## seed.log

```
+ node --version
v20.20.2
+ ls -la node_modules/@supabase
total 36
drwxr-xr-x  9 runner runner 4096 May  9 13:36 .
drwxr-xr-x 49 runner runner 4096 May  9 13:36 ..
drwxr-xr-x  4 runner runner 4096 May  9 13:36 auth-js
drwxr-xr-x  4 runner runner 4096 May  9 13:36 functions-js
drwxr-xr-x  4 runner runner 4096 May  9 13:36 phoenix
drwxr-xr-x  4 runner runner 4096 May  9 13:36 postgrest-js
drwxr-xr-x  4 runner runner 4096 May  9 13:36 realtime-js
drwxr-xr-x  4 runner runner 4096 May  9 13:36 storage-js
drwxr-xr-x  4 runner runner 4096 May  9 13:36 supabase-js
+ ls -la node_modules/.bin/tsx
lrwxrwxrwx 1 runner runner 19 May  9 13:36 node_modules/.bin/tsx -> ../tsx/dist/cli.mjs
+ npx tsx scripts/seed-catalog.ts
/home/runner/work/pile/pile/node_modules/@supabase/realtime-js/src/lib/websocket-factory.ts:178
    throw new Error(errorMessage)
          ^


Error: Node.js 20 detected without native WebSocket support.

Suggested solution: For Node.js < 22, install "ws" package and provide it via the transport option:
import ws from "ws"
new RealtimeClient(url, { transport: ws })
    at Function.getWebSocketConstructor (/home/runner/work/pile/pile/node_modules/@supabase/realtime-js/src/lib/websocket-factory.ts:178:11)
    at RealtimeClient._initializeOptions (/home/runner/work/pile/pile/node_modules/@supabase/realtime-js/src/RealtimeClient.ts:805:63)
    at new RealtimeClient (/home/runner/work/pile/pile/node_modules/@supabase/realtime-js/src/RealtimeClient.ts:284:39)
    at SupabaseClient._initRealtimeClient (/home/runner/work/pile/pile/node_modules/@supabase/supabase-js/src/SupabaseClient.ts:595:12)
    at new SupabaseClient (/home/runner/work/pile/pile/node_modules/@supabase/supabase-js/src/SupabaseClient.ts:329:26)
    at createClient (/home/runner/work/pile/pile/node_modules/@supabase/supabase-js/src/index.ts:65:10)
    at <anonymous> (/home/runner/work/pile/pile/scripts/seed-catalog.ts:24:18)
    at Object.<anonymous> (/home/runner/work/pile/pile/scripts/seed-catalog.ts:245:2)
    at Module._compile (node:internal/modules/cjs/loader:1521:14)
    at Object.transformer (/home/runner/work/pile/pile/node_modules/tsx/dist/register-D46fvsV_.cjs:3:1104)

Node.js v20.20.2
+ echo 'SEED EXIT: 1'
SEED EXIT: 1
```
