// Commute Push Worker — Cloudflare Workers
// Pure Web Crypto implementation (RFC 8291 + RFC 8292). Zero npm dependencies.

const APP_URL = 'https://neildoughty.github.io/sio-commute-app/commute-dashboard.html';

// ── Base64url helpers ──────────────────────────────────────────
function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - s.length % 4) % 4);
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}
function bytesToB64url(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function concat(...arrs) {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let i = 0; for (const a of arrs) { out.set(a, i); i += a.length; }
  return out;
}

// ── HKDF (single-block) ────────────────────────────────────────
async function hkdf(salt, ikm, info, len) {
  const sk = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', sk, ikm));
  const pk = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', pk, concat(info, new Uint8Array([1])))).slice(0, len);
}

// ── VAPID JWT (RFC 8292) ───────────────────────────────────────
async function vapidJWT(endpoint, pubB64url, privB64url) {
  const pub = b64urlToBytes(pubB64url);
  const privKey = await crypto.subtle.importKey('jwk',
    { kty: 'EC', crv: 'P-256', x: bytesToB64url(pub.slice(1, 33)), y: bytesToB64url(pub.slice(33, 65)), d: privB64url, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const hdr = bytesToB64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const pay = bytesToB64url(new TextEncoder().encode(JSON.stringify({
    aud: new URL(endpoint).origin, exp: now + 43200, sub: 'mailto:neil@neildoughty.com'
  })));
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, privKey, new TextEncoder().encode(`${hdr}.${pay}`)
  ));
  return `${hdr}.${pay}.${bytesToB64url(sig)}`;
}

// ── RFC 8291 payload encryption (aes128gcm) ────────────────────
async function encrypt(payload, sub) {
  const uaPub = b64urlToBytes(sub.keys.p256dh);
  const auth  = b64urlToBytes(sub.keys.auth);
  const salt  = crypto.getRandomValues(new Uint8Array(16));

  const serverKP  = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPub = new Uint8Array(await crypto.subtle.exportKey('raw', serverKP.publicKey));
  const clientKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret    = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, serverKP.privateKey, 256));

  const prk   = await hkdf(auth, secret, concat(new TextEncoder().encode('WebPush: info\x00'), uaPub, serverPub), 32);
  const cek   = await hkdf(salt, prk, new TextEncoder().encode('Content-Encoding: aes128gcm\x00'), 16);
  const nonce = await hkdf(salt, prk, new TextEncoder().encode('Content-Encoding: nonce\x00'), 12);

  const aesKey     = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, aesKey,
    concat(new TextEncoder().encode(payload), new Uint8Array([2]))
  ));

  // RFC 8291 binary header: salt(16) + rs(4) + idlen(1) + serverPub(65)
  const header = new Uint8Array(21 + serverPub.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false);
  header[20] = serverPub.length;
  header.set(serverPub, 21);

  return concat(header, ciphertext);
}

// ── Send push ──────────────────────────────────────────────────
async function sendPush(env, data) {
  const sub  = JSON.parse(env.PUSH_SUBSCRIPTION.trim());
  const body = await encrypt(JSON.stringify({ ...data, url: APP_URL }), sub);
  const jwt  = await vapidJWT(sub.endpoint, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  const res  = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'Authorization': `vapid t=${jwt},k=${env.VAPID_PUBLIC_KEY}`,
      'TTL': '86400',
    },
    body,
  });
  if (!res.ok) throw new Error(`Push failed ${res.status}: ${await res.text()}`);
  console.log(`Sent: ${data.title} — ${data.body}`);
}

// ── UK time helpers ────────────────────────────────────────────
function isUKSummerTime(d) {
  const y = d.getUTCFullYear();
  const lsm = new Date(Date.UTC(y, 2, 31)); lsm.setUTCDate(31 - lsm.getUTCDay());
  const lso = new Date(Date.UTC(y, 9, 31)); lso.setUTCDate(31 - lso.getUTCDay());
  return d >= new Date(lsm.getTime() + 3600000) && d < new Date(lso.getTime() + 3600000);
}
function ukHour(d) { return (d.getUTCHours() + (isUKSummerTime(d) ? 1 : 0)) % 24; }

// ── TfL / Darwin fetchers ──────────────────────────────────────
async function getTflLine(line, env) {
  try {
    const r = await fetch(`https://api.tfl.gov.uk/Line/${line}/Status?app_key=${env.TFL_API_KEY}`);
    return (await r.json())[0]?.lineStatuses[0]?.statusSeverityDescription || 'Unknown';
  } catch { return 'Unknown'; }
}
async function getNextTrain(crs, env) {
  try {
    const r = await fetch(`https://huxley2.azurewebsites.net/departures/${crs}/5?accessToken=${env.DARWIN_API_KEY}`);
    const next = ((await r.json()).trainServices || [])[0];
    if (!next) return 'No trains';
    return `${next.std} ${next.etd === 'On time' ? 'on time' : next.etd || 'check app'}`;
  } catch { return 'Check app'; }
}

// ── Notification builders ──────────────────────────────────────
async function morning(env) {
  const [train, picc] = await Promise.all([getNextTrain('BOP', env), getTflLine('piccadilly', env)]);
  return { title: 'Time to leave', body: `${train} · Piccadilly: ${picc}` };
}
async function evening(env) {
  const [vic, picc, circle] = await Promise.all([
    getTflLine('victoria', env), getTflLine('piccadilly', env), getTflLine('circle', env)
  ]);
  return { title: 'Head for home', body: `Vic: ${vic} · Pic: ${picc} · Circle: ${circle}` };
}

// ── Worker export ──────────────────────────────────────────────
export default {
  async scheduled(event, env, ctx) {
    const hour = ukHour(new Date());
    if      (hour === 7)  await sendPush(env, await morning(env));
    else if (hour === 17) await sendPush(env, await evening(env));
    else console.log(`Not a scheduled UK hour (${hour}). Skipping.`);
  },

  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    try {
      if (path === '/test/morning') { await sendPush(env, await morning(env)); return new Response('Morning sent'); }
      if (path === '/test/evening') { await sendPush(env, await evening(env)); return new Response('Evening sent'); }
      return new Response('Commute push worker — running');
    } catch (e) {
      return new Response(e.message, { status: 500 });
    }
  }
};
