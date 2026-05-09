// Upserts all required env vars into the Vercel project before each deploy.
import { createRequire } from 'module';

const TOKEN  = process.env.VERCEL_TOKEN;
const PROJECT = 'prj_cG2RSusP9gA7KHXgSE7E0aWzogAc';
const TEAM    = 'team_kAEHWEKTqPvlEN7ZzklwIEOr';
const BASE    = `https://api.vercel.com/v10/projects/${PROJECT}/env?teamId=${TEAM}`;
const HEADERS = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const TARGET  = ['production', 'preview'];

const VARS = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL',  value: process.env.NEXT_PUBLIC_SUPABASE_URL,  type: 'plain' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, type: 'plain' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', value: process.env.SUPABASE_SERVICE_ROLE_KEY, type: 'encrypted' },
  { key: 'ADMIN_PASSWORD',            value: process.env.ADMIN_PASSWORD,            type: 'encrypted' },
];

async function upsert({ key, value, type }) {
  if (!value) { console.log(`SKIP  ${key} (no value)`); return; }

  const list = await fetch(BASE, { headers: HEADERS }).then(r => r.json());
  const existing = list.envs?.find(e => e.key === key);

  let res;
  if (existing) {
    res = await fetch(
      `https://api.vercel.com/v10/projects/${PROJECT}/env/${existing.id}?teamId=${TEAM}`,
      { method: 'PATCH', headers: HEADERS,
        body: JSON.stringify({ value, type, target: TARGET }) }
    );
    console.log(`PATCH ${key} → ${res.status}`);
  } else {
    res = await fetch(BASE, {
      method: 'POST', headers: HEADERS,
      body: JSON.stringify({ key, value, type, target: TARGET })
    });
    console.log(`POST  ${key} → ${res.status}`);
  }

  if (!res.ok) {
    const body = await res.text();
    console.error(`ERROR ${key}:`, body);
    process.exit(1);
  }
}

for (const v of VARS) await upsert(v);
console.log('All env vars synced.');
