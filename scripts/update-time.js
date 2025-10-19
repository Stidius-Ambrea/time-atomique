// scripts/update-time.js
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const SOURCES = [
  { name: 'quelle-heure-est-il.com', url: 'https://quelle-heure-est-il.com/fr/heure/paris' },
  { name: 'time.is',                url: 'https://time.is/Paris' },
  { name: 'timeanddate.com',        url: 'https://www.timeanddate.com/worldclock/france/paris' },
];

const TZ = 'Europe/Paris';
const TIMEOUT_MS = 6000;

function timeout(promise, ms, label = 'timeout') {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(label)), ms);
    promise.then(v => { clearTimeout(id); resolve(v); },
                 e => { clearTimeout(id); reject(e); });
  });
}

async function getDateHeader(url) {
  try {
    let res = await timeout(fetch(url, { method: 'HEAD' }), TIMEOUT_MS, 'head-timeout');
    let date = res.headers.get('date');
    if (!date) {
      res = await timeout(fetch(url, { method: 'GET' }), TIMEOUT_MS, 'get-timeout');
      date = res.headers.get('date');
    }
    return date || null;
  } catch {
    return null;
  }
}

function httpDateToEpochMs(dstr) {
  try {
    const t = Date.parse(dstr);
    return Number.isFinite(t) ? t : null;
  } catch { return null; }
}

function avg(nums) {
  if (!nums.length) return NaN;
  return Math.round(nums.reduce((a,b)=>a+b,0) / nums.length);
}

function formatIsoLocalWithTZ(dateUTC, tz) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const parts = {};
  for (const p of fmt.formatToParts(dateUTC)) parts[p.type] = p.value;
  const localStr = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;

  const tzStr = fmt.format(dateUTC).replace(',', '').replace(' ', 'T');
  const tzDate = new Date(tzStr);
  const offsetMin = Math.round((tzDate.getTime() - dateUTC.getTime())/60000);
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const off = `${sign}${String(Math.floor(abs/60)).padStart(2,'0')}:${String(abs%60).padStart(2,'0')}`;
  return `${localStr}${off}`;
}

(async () => {
  const rows = [];
  for (const s of SOURCES) {
    const d = await getDateHeader(s.url);
    const t = d ? httpDateToEpochMs(d) : null;
    rows.push({ name: s.name, url: s.url, date: d, unix_ms: t });
  }

  const valids = rows.filter(r => Number.isFinite(r.unix_ms));
  if (!valids.length) {
    console.error('No valid Date headers from sources');
    process.exit(1);
  }

  const avgMs = avg(valids.map(r => r.unix_ms));
  const avgDateUTC = new Date(avgMs);
  const isoUTC = avgDateUTC.toISOString();

  const isoParis = formatIsoLocalWithTZ(avgDateUTC, TZ);

  let spread = 0;
  for (const r of valids) spread = Math.max(spread, Math.abs(r.unix_ms - avgMs));

  const body = {
    tz: TZ,
    avg_utc_iso: isoUTC,
    now_iso: isoParis,
    now_unix_ms: avgMs,
    sources: rows,
    delta_between_sources_ms: spread,
    status: valids.length >= 2 ? 'ok' : 'degraded'
  };

  console.log('DIAG:', JSON.stringify(body, null, 2));

  const outDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'time.json'), JSON.stringify(body, null, 2), 'utf8');
})();
