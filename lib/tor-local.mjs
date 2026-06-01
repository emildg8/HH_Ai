/**
 * Локальный Tor (SOCKS5 :9050) — бесплатный обход без аккаунтов.
 */

import fs from 'node:fs';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { ROOT } from './paths.mjs';

const TOR_DIR = path.join(ROOT, 'data', 'tor-bundle');
const TOR_DATA = path.join(ROOT, 'data', 'tor-data');
const SOCKS_PORT = 9050;
const TOR_VERSION = '15.0.14';
const TOR_ARCHIVE = `tor-expert-bundle-windows-x86_64-${TOR_VERSION}.tar.gz`;
const TOR_URL = `https://archive.torproject.org/tor-package-archive/torbrowser/${TOR_VERSION}/${TOR_ARCHIVE}`;

/** @type {import('node:child_process').ChildProcess | null} */
let torProc = null;

function torExePath() {
  const direct = path.join(TOR_DIR, 'tor', 'tor.exe');
  if (fs.existsSync(direct)) return direct;
  const nested = path.join(TOR_DIR, 'Tor', 'tor.exe');
  if (fs.existsSync(nested)) return nested;
  return null;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          download(res.headers.location, dest).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`download ${url}: HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', reject);
  });
}

async function ensureTorBundle() {
  if (torExePath()) return torExePath();
  fs.mkdirSync(TOR_DIR, { recursive: true });
  const archive = path.join(TOR_DIR, TOR_ARCHIVE);
  if (!fs.existsSync(archive)) {
    await download(TOR_URL, archive);
  }
  const r = spawnSync('tar', ['-xzf', archive, '-C', TOR_DIR], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`tar extract: ${r.stderr || r.stdout || r.status}`);
  }
  const exe = torExePath();
  if (!exe) throw new Error('tor.exe не найден после распаковки');
  return exe;
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port, timeout: 1500 }, () => {
      s.destroy();
      resolve(true);
    });
    s.on('error', () => resolve(false));
    s.on('timeout', () => {
      s.destroy();
      resolve(false);
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Запустить Tor SOCKS5 на 127.0.0.1:9050 (если ещё не слушает).
 * @returns {Promise<boolean>}
 */
export async function ensureTorRunning() {
  if (await isPortOpen(SOCKS_PORT)) return true;

  const exe = await ensureTorBundle();
  fs.mkdirSync(TOR_DATA, { recursive: true });

  torProc = spawn(
    exe,
    [
      `--SocksPort=${SOCKS_PORT}`,
      `--DataDirectory=${TOR_DATA}`,
      '--Log',
      'notice stdout',
      '--AvoidDiskWrites',
      '1',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
  );

  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (await isPortOpen(SOCKS_PORT)) {
      await sleep(2000);
      return true;
    }
    if (torProc.exitCode != null) break;
    await sleep(1500);
  }
  return false;
}

export function stopTor() {
  if (torProc && !torProc.killed) {
    torProc.kill();
    torProc = null;
  }
}

export function torSocksUrl() {
  return `socks5://127.0.0.1:${SOCKS_PORT}`;
}
