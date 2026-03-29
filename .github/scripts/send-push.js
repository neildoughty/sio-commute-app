// Morning commute push — fetches live data then sends Web Push
const webpush = require('web-push');

const APP_URL = 'https://neildoughty.github.io/sio-commute-app/commute-dashboard.html';
const TFL_KEY = process.env.TFL_API_KEY;
const DARWIN_KEY = process.env.DARWIN_API_KEY;

webpush.setVapidDetails(
  'mailto:neil@neildoughty.com', // update if needed
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function getTrain() {
  try {
    const res = await fetch(
      `https://huxley2.azurewebsites.net/departures/BOP/5?accessToken=${DARWIN_KEY}`
    );
    const data = await res.json();
    const services = data.trainServices || [];
    if (!services.length) return 'No trains found';

    const next = services[0];
    const time = next.std || '?';
    const eta  = next.etd === 'On time' ? 'on time' : (next.etd || 'check app');
    return `${time} ${eta}`;
  } catch {
    return 'Check app for trains';
  }
}

async function getPiccadillyStatus() {
  try {
    const res = await fetch(
      `https://api.tfl.gov.uk/Line/piccadilly/Status?app_key=${TFL_KEY}`
    );
    const data = await res.json();
    return data[0]?.lineStatuses[0]?.statusSeverityDescription || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

async function main() {
  const [train, piccadilly] = await Promise.all([getTrain(), getPiccadillyStatus()]);

  const title = 'Time to leave';
  const body  = `${train} · Piccadilly: ${piccadilly}`;

  console.log(`Sending: "${title}" — ${body}`);

  const subscription = JSON.parse(process.env.PUSH_SUBSCRIPTION);
  await webpush.sendNotification(subscription, JSON.stringify({ title, body, url: APP_URL }));
  console.log('Push sent.');
}

main().catch(e => { console.error(e); process.exit(1); });
