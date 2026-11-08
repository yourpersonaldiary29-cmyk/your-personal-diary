#!/bin/sh
# Your Personal Diary - outbound SMTP connectivity probe (HOSTED-IMPL item 2; plan 1.3 precondition).
#
# Run INSIDE the Fly machine (staging app first, then production once):
#   C:\Users\AVI\.fly\bin\flyctl.exe ssh console -a yourpersonaldiary-staging -C "sh /app/smoke-smtp.sh"
#
# Proves - with NO credentials - that the machine can reach the owner's mail provider:
#   1. implicit TLS: connect to <host>:465, complete the TLS handshake, read the "220" banner;
#   2. STARTTLS:     connect to <host>:587, read "220", EHLO, STARTTLS, upgrade to TLS, EHLO again.
# Nothing but QUIT is sent after the handshake. Exit 0 = both paths work (SMTP is not blocked);
# exit 1 = at least one failed (the reason is printed: ECONNREFUSED / ETIMEDOUT = blocked or filtered).
#
# Arguments: [host] [tlsPort] [starttlsPort]   (defaults: smtp.gmail.com 465 587). 10 s timeout per step.
# Test hook (loopback mocks only): SMTP_PROBE_CA_FILE=<pem> trusts that CA in addition to the system store.
# This is an operator diagnostic shipped at /app/smoke-smtp.sh; the server itself never runs it.
set -u
HOST="${1:-smtp.gmail.com}"
TLS_PORT="${2:-465}"
STARTTLS_PORT="${3:-587}"

exec node - "$HOST" "$TLS_PORT" "$STARTTLS_PORT" <<'EOF'
const net = require('node:net');
const tls = require('node:tls');
const fs = require('node:fs');
const [host, tlsPort, starttlsPort] = process.argv.slice(2);
const TIMEOUT_MS = 10_000;
const extraCa = process.env.SMTP_PROBE_CA_FILE ? [fs.readFileSync(process.env.SMTP_PROBE_CA_FILE)] : undefined;

/** Resolves with one complete SMTP reply ("250-..." continuation lines until "250 ..."). */
function readReply(sock) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => done(new Error('timeout waiting for the server reply')), TIMEOUT_MS);
    const onData = (chunk) => {
      buf += chunk.toString('utf8');
      const lines = buf.split('\r\n');
      const complete = lines.slice(0, -1);
      const last = complete[complete.length - 1];
      if (last && /^\d{3} /.test(last)) done(null, complete.join('\n'));
    };
    const onError = (e) => done(e);
    const onEnd = () => done(new Error('connection closed before a reply'));
    function done(err, value) {
      clearTimeout(timer);
      sock.off('data', onData);
      sock.off('error', onError);
      sock.off('end', onEnd);
      err ? reject(err) : resolve(value);
    }
    sock.on('data', onData);
    sock.on('error', onError);
    sock.on('end', onEnd);
  });
}

function expect(reply, code, what) {
  if (!reply.startsWith(code)) throw new Error(`${what}: expected ${code}, got "${reply.split('\n')[0]}"`);
  return reply;
}

function connectPlain(port) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host, port: Number(port) });
    const timer = setTimeout(() => { sock.destroy(); reject(new Error('ETIMEDOUT (connect)')); }, TIMEOUT_MS);
    sock.once('connect', () => { clearTimeout(timer); resolve(sock); });
    sock.once('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

function upgradeTls(socket) {
  return new Promise((resolve, reject) => {
    // SNI only for a host name (an IP address is only ever the loopback test mock).
    const sec = tls.connect({ socket, host, servername: net.isIP(host) ? undefined : host, ca: extraCa });
    const timer = setTimeout(() => { sec.destroy(); reject(new Error('ETIMEDOUT (TLS handshake)')); }, TIMEOUT_MS);
    sec.once('secureConnect', () => { clearTimeout(timer); resolve(sec); });
    sec.once('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

async function quit(sock) {
  try { sock.write('QUIT\r\n'); await readReply(sock).catch(() => {}); } catch {} finally { sock.destroy(); }
}

async function implicitTls() {
  const plain = await connectPlain(tlsPort);
  const sock = await upgradeTls(plain);
  const banner = expect(await readReply(sock), '220', 'banner');
  const info = `${sock.getProtocol()} ${sock.getCipher().name}, banner "${banner.split('\n')[0].slice(0, 60)}"`;
  await quit(sock);
  return info;
}

async function startTls() {
  const sock = await connectPlain(starttlsPort);
  expect(await readReply(sock), '220', 'banner');
  sock.write('EHLO probe.invalid\r\n');
  const ehlo = expect(await readReply(sock), '250', 'EHLO');
  if (!/STARTTLS/i.test(ehlo)) throw new Error('server does not offer STARTTLS');
  sock.write('STARTTLS\r\n');
  expect(await readReply(sock), '220', 'STARTTLS');
  const sec = await upgradeTls(sock);
  sec.write('EHLO probe.invalid\r\n');
  expect(await readReply(sec), '250', 'EHLO after STARTTLS');
  const info = `${sec.getProtocol()} ${sec.getCipher().name}`;
  await quit(sec);
  return info;
}

(async () => {
  let ok = true;
  console.log(`[smtp-probe] host ${host}, node ${process.version}`);
  for (const [label, fn] of [[`${tlsPort} implicit TLS`, implicitTls], [`${starttlsPort} STARTTLS`, startTls]]) {
    try {
      console.log(`[smtp-probe] ${label}: OK (${await fn()})`);
    } catch (e) {
      ok = false;
      const code = e && e.code ? `${e.code}: ` : '';
      console.log(`[smtp-probe] ${label}: FAILED (${code}${e.message})`);
    }
  }
  console.log(ok ? '[smtp-probe] RESULT: outbound SMTP works from this machine' : '[smtp-probe] RESULT: outbound SMTP is blocked or filtered - do not go live on this platform until it works (plan 1.3)');
  process.exit(ok ? 0 : 1);
})();
EOF
