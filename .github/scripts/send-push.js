// Commute push notifications — morning and evening
const webpush = require('web-push');

const APP_URL = 'https://neildoughty.github.io/sio-commute-app/commute-dashboard.html';
const TFL_KEY = process.env.TFL_API_KEY;
const DARWIN_KEY = process.env.DARWIN_API_KEY;

webpush.setVapidDetails(
  'mailto:neil@neildoughty.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// ── UK time helpers (handles BST/GMT automatically) ───────────
function isUKSummerTime(date) {
  const y = date.getUTCFullYear();
  const lastSunMar = new Date(Date.UTC(y, 2, 31));
  lastSunMar.setUTCDate(31 - lastSunMar.getUTCDay());
  const lastSunOct = new Date(Date.UTC(y, 9, 31));
  lastSunOct.setUTCDate(31 - lastSunOct.getUTCDay());
  const bstStart  = new Date(lastSunMar.getTime() + 3600000); // 1am UTC
  const gmtReturn = new Date(lastSunOct.getTime() + 3600000); // 1am UTC
  return date >= bstStart && date < gmtReturn;
}

function ukTime(date) {
  const offset = isUKSummerTime(date) ? 1 : 0;
  return { hour: (date.getUTCHours() + offset) % 24, minute: date.getUTCMinutes() };
}

// ── Data fetchers ─────────────────────────────────────────────
async function getTflLine(line) {
  try {
    const res = await fetch(`https://api.tfl.gov.uk/Line/${line}/Status?app_key=${TFL_KEY}`);
    const data = await res.json();
    return data[0]?.lineStatuses[0]?.statusSeverityDescription || 'Unknown';
  } catch { return 'Unknown'; }
}

const MORNING_TARGET = '07:25';

async function getNextTrain(crs) {
  try {
    const res = await fetch(`https://huxley2.azurewebsites.net/departures/${crs}/10?accessToken=${DARWIN_KEY}`);
    const data = await res.json();
    const services = data.trainServices || [];
    // For morning from BOP, prefer the target train; otherwise fall back to next departure
    const svc = services.find(s => s.std === MORNING_TARGET) || services[0];
    if (!svc) return 'No trains found';
    const eta = svc.isCancelled ? 'CANCELLED' : (svc.etd === 'On time' ? 'on time' : (svc.etd || 'check app'));
    return `${svc.std} ${eta}`;
  } catch { return 'Check app for trains'; }
}

// ── Notification builders ─────────────────────────────────────
async function morning() {
  const [train, piccadilly, victoria] = await Promise.all([
    getNextTrain('BOP'),
    getTflLine('piccadilly'),
    getTflLine('victoria'),
  ]);
  return { title: 'Time to leave', body: `${train} · Pic: ${piccadilly} · Vic: ${victoria}` };
}

async function evening() {
  const [train, victoria, piccadilly] = await Promise.all([
    getNextTrain('HHY'),
    getTflLine('victoria'),
    getTflLine('piccadilly'),
  ]);
  return { title: 'Head for home', body: `${train} · Vic: ${victoria} · Pic: ${piccadilly}` };
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const now = new Date();
  const { hour, minute } = ukTime(now);
  const hhmm = `${hour}:${String(minute).padStart(2, '0')}`;

  // FORCE_TYPE env var allows manual testing: set to 'morning' or 'evening'
  // Hour-only check gives ~55 min tolerance for GitHub Actions scheduling delays
  const force = process.env.FORCE_TYPE;
  let payload;
  if      (force === 'morning' || (!force && hour === 7))  payload = await morning();
  else if (force === 'evening' || (!force && hour === 17)) payload = await evening();
  else {
    console.log(`Not a scheduled UK hour (currently ${hhmm}). Skipping.`);
    process.exit(0);
  }

  console.log(`Sending [${hhmm} UK]: "${payload.title}" — ${payload.body}`);
  const subscription = JSON.parse(process.env.PUSH_SUBSCRIPTION);
  await webpush.sendNotification(subscription, JSON.stringify({ ...payload, url: APP_URL }));
  console.log('Push sent.');
}

main().catch(e => { console.error(e); process.exit(1); });
