#!/usr/bin/env node
/**
 * Дневной оркестратор охоты — срезы 1–2 (Emil + Anastasia).
 *
 *   npm run devops:hunt-day:emil -- status --mode=point
 *   npm run devops:hunt-day:emil -- plan --mode=point --dry-run
 *   npm run devops:hunt-day:emil -- assess --limit=20
 *   npm run devops:hunt-day:emil -- prep --limit=8
 *   npm run devops:hunt-day:emil -- ship --mode=point --dry-run --limit=1
 *   npm run devops:hunt-day:emil -- ship --mode=point --go --limit=1 --after-ship=watch
 *   npm run devops:hunt-day:emil -- repair --id=<uuid>
 *
 *   npm run devops:hunt-day:anastasia -- status --mode=basket
 *   npm run devops:hunt-day:anastasia -- plan --mode=basket --dry-run
 *   npm run devops:hunt-day:anastasia -- ship --mode=basket --dry-run --limit=1
 *   npm run devops:hunt-day:anastasia -- ship --mode=basket --go --only=<uuid>
 *   npm run devops:hunt-day:anastasia -- repair --id=<uuid>
 *
 * Live ship только с --go. Авто-repair в ship запрещён → отдельный repair.
 * Настя: live по умолчанию --mode=basket (point — только после ручного plan).
 * --after-ship=watch: после ok — robot watchdog по id (поверхность 3).
 * --after-ship=chat-ai: после ok — очередь ИИ-помощника /chat (поверхность 4, без авто-send).
 */
import {
  buildHuntDayStatus,
  buildHuntDayPlan,
  runHuntDayShip,
  runHuntDayRepair,
  runHuntDayPrep,
  runHuntDayAfterShipWatch,
  runHuntDayAfterShipChatAi,
  writeHuntDayJson,
  normalizeHuntDayMode,
  ApplyLaneBusyError,
} from '../lib/hunt-day-orchestrator.mjs';
import { buildHuntDayAssess, formatHuntDayAssessRu } from '../lib/hunt-day-assess.mjs';
import { getPointApplyAutoTracks } from '../lib/point-apply-track-quotas.mjs';
import { loadPreferences } from '../lib/preferences.mjs';

function usage() {
  console.log(`Usage: node scripts/devops-hunt-day.mjs -- <command> [options]

Инстанс: npm run devops:hunt-day:emil | devops:hunt-day:anastasia

Команды:
  status [--mode=point|basket] [--sync|--no-sync]
  plan   [--mode=point|basket] [--dry-run] [--limit=10] [--skip-id=] [--only=] [--pack=]
         [--sync|--no-sync]
  assess [--limit=20] [--full-tracks] [--tracks=…] [--skip-id=] [--only=]
         [--sync|--no-sync]
         Комплексная оценка до ship (gate + site + письмо + квота + pack state). Без --force-only.
         --full-tracks: все pending в выбранных маршрутах (не весь harvest).
  prep   [--limit=8] [--tracks=…] [--with-probe] [--probe-limit=N]
  ship   [--mode=point|basket] [--dry-run|--go] [--limit=1] [--skip-id=] [--only=] [--pack=]
         [--no-prepare-letters|--prepare-letters] [--force-only]
         [--after-ship=watch|chat-ai] [--after-ship-wait=сек]
         Live --go: sync обязателен; --no-sync запрещён (отладка: --force-no-sync)
  repair --id=<uuid>

Перед status/plan/assess/ship(--go): merge кэша переговоров; live sync если кэш старше 12ч
(или --sync). --no-sync на ship --go — только с --force-no-sync.

Без --go ship всегда dry-run. Repair — отдельная фаза (не из ship).
Настя: live basket (--mode=basket); --pack= не поддержан (только --from-day / --only=).
--after-ship=watch: после status=ok — robot-recruiter-watch по id (--send-auto, без чипов).
--after-ship=chat-ai: после status=ok — enqueue + пауза (~25с×2) + hh-chat-ai-queue process --go (ИИ в первую минуту).
`);
}

function parseArgs(argv) {
  const args = argv.filter((a) => a !== '--');
  const command = String(args[0] || '').trim().toLowerCase();
  const rest = args.slice(1);
  /** @type {Record<string, string | boolean>} */
  const opts = {};
  /** @type {string[]} */
  const skipIds = [];
  for (const a of rest) {
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--go') opts.go = true;
    else if (a === '--sync') opts.sync = true;
    else if (a === '--no-sync') opts.noSync = true;
    else if (a === '--force-no-sync') opts.forceNoSync = true;
    else if (a === '--no-prepare-letters') opts.noPrepareLetters = true;
    else if (a === '--prepare-letters') opts.prepareLetters = true;
    else if (a === '--force-only') opts.forceOnly = true;
    else if (a === '--full-tracks') opts.fullTracks = true;
    else if (a === '--with-probe') opts.withProbe = true;
    else if (a.startsWith('--probe-limit=')) opts.probeLimit = a.slice('--probe-limit='.length);
    else if (a.startsWith('--mode=')) opts.mode = a.slice('--mode='.length);
    else if (a.startsWith('--limit=')) opts.limit = a.slice('--limit='.length);
    else if (a.startsWith('--after-ship=')) opts.afterShip = a.slice('--after-ship='.length).trim();
    else if (a.startsWith('--after-ship-wait=')) {
      opts.afterShipWait = a.slice('--after-ship-wait='.length);
    } else if (a.startsWith('--skip-id=')) {
      skipIds.push(
        ...a
          .slice('--skip-id='.length)
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
      );
    } else if (a.startsWith('--tracks=')) opts.tracks = a.slice('--tracks='.length);
    else if (a.startsWith('--id=')) opts.id = a.slice('--id='.length).trim();
    else if (a.startsWith('--only=')) opts.onlyId = a.slice('--only='.length).trim();
    else if (a.startsWith('--pack=')) opts.packId = a.slice('--pack='.length).trim();
    else if (a === '--help' || a === '-h') opts.help = true;
  }
  return { command, opts, skipIds };
}

function parseTracks(raw, prefs) {
  if (!raw) return getPointApplyAutoTracks(prefs);
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function exitFromOutcomes(outcomes, dryRun) {
  if (dryRun) return 0;
  if ((outcomes || []).some((o) => o.status === 'ok')) return 0;
  if ((outcomes || []).some((o) => o.status === 'naked' || o.status === 'verify_fail')) return 1;
  if ((outcomes || []).some((o) => o.status === 'fail' || o.status === 'partial')) return 1;
  return 0;
}

async function main() {
  const { command, opts, skipIds } = parseArgs(process.argv.slice(2));
  if (!command || opts.help) {
    usage();
    process.exit(command ? 0 : 1);
  }

  const prefs = loadPreferences();
  const mode = normalizeHuntDayMode(opts.mode || 'point');
  const huntTracks = parseTracks(opts.tracks, prefs);

  try {
    if (command === 'status') {
      const status = await buildHuntDayStatus({
        mode,
        prefs,
        huntTracks,
        skipIds,
        sync: Boolean(opts.sync),
        noSync: Boolean(opts.noSync),
      });
      const outPath = writeHuntDayJson('hunt-day-status-latest.json', status);
      console.log(JSON.stringify(status, null, 2));
      console.log(`[hunt-day] status → ${outPath}`);
      return;
    }

    if (command === 'plan') {
      const plan = await buildHuntDayPlan({
        mode,
        prefs,
        huntTracks,
        skipIds,
        limit: Number(opts.limit) || 10,
        dryRun: opts.dryRun !== false,
        checkLane: true,
        onlyId: opts.onlyId || '',
        packId: opts.packId || '',
        sync: Boolean(opts.sync),
        noSync: Boolean(opts.noSync),
      });
      const outPath = writeHuntDayJson('hunt-day-plan-latest.json', plan);
      console.log(JSON.stringify(plan, null, 2));
      console.log(`[hunt-day] plan → ${outPath}`);
      return;
    }

    if (command === 'assess') {
      const report = await buildHuntDayAssess({
        prefs,
        huntTracks,
        skipIds,
        limit: Number(opts.limit) || (opts.fullTracks ? 5000 : 20),
        onlyId: opts.onlyId || '',
        fullTracks: Boolean(opts.fullTracks),
        sync: Boolean(opts.sync),
        noSync: Boolean(opts.noSync),
      });
      const outPath = writeHuntDayJson('hunt-day-assess-latest.json', report);
      console.log(formatHuntDayAssessRu(report));
      console.log('');
      console.log(JSON.stringify({ counts: report.counts, byTrack: report.byTrack, scope: report.scope, go: report.go, conditional: report.conditional, negotiationsPrep: report.negotiationsPrep }, null, 2));
      console.log(`[hunt-day] assess → ${outPath}`);
      return;
    }

    if (command === 'prep') {
      const prep = await runHuntDayPrep({
        prefs,
        huntTracks,
        limit: Number(opts.limit) || 8,
        withProbe: Boolean(opts.withProbe),
        probeLimit: opts.probeLimit != null ? Number(opts.probeLimit) : undefined,
        log: console.log,
      });
      console.log(JSON.stringify(prep, null, 2));
      console.log(`[hunt-day] prep → ${prep.outPath || 'hunt-day-prep-latest.json'}`);
      return;
    }

    if (command === 'ship') {
      const go = Boolean(opts.go);
      const dryRun = !go;
      if (!go) {
        console.log('[hunt-day] ship без --go → dry-run (live только с --go)');
      }
      const result = await runHuntDayShip({
        mode,
        prefs,
        huntTracks,
        skipIds,
        limit: Number(opts.limit) || 1,
        go,
        dryRun,
        onlyId: opts.onlyId || '',
        packId: opts.packId || '',
        noPrepareLetters: Boolean(opts.noPrepareLetters),
        prepareLetters: Boolean(opts.prepareLetters),
        forceOnly: Boolean(opts.forceOnly),
        noSync: Boolean(opts.noSync),
        forceNoSync: Boolean(opts.forceNoSync),
        sync: Boolean(opts.sync),
      });
      console.log(JSON.stringify(result, null, 2));
      console.log(`[hunt-day] ship → ${result.outPath}`);

      const afterShip = String(opts.afterShip || '').toLowerCase();
      if (go && afterShip === 'watch') {
        const watch = await runHuntDayAfterShipWatch({
          outcomes: result.outcomes,
          waitSec: Number(opts.afterShipWait) || 45,
          sendAuto: true,
          log: console.log,
        });
        result.afterShipWatch = watch;
        console.log(JSON.stringify({ afterShipWatch: watch }, null, 2));
        if (watch.outPath) console.log(`[hunt-day] after-ship watch → ${watch.outPath}`);
      } else if (go && afterShip === 'chat-ai') {
        const chatAi = await runHuntDayAfterShipChatAi({
          outcomes: result.outcomes,
          waitSec: Number(opts.afterShipWait) || 25,
          processGo: true,
          log: console.log,
        });
        result.afterShipChatAi = chatAi;
        console.log(JSON.stringify({ afterShipChatAi: chatAi }, null, 2));
        if (chatAi.outPath) console.log(`[hunt-day] after-ship chat-ai → ${chatAi.outPath}`);
      } else if (afterShip && afterShip !== 'off' && afterShip !== 'none') {
        console.warn(`[hunt-day] неизвестный --after-ship=${afterShip} (ожидается watch|chat-ai|off)`);
      }

      process.exit(exitFromOutcomes(result.outcomes, dryRun));
    }

    if (command === 'repair') {
      const id = opts.id || opts.onlyId;
      if (!id) {
        console.error('[hunt-day] repair: нужен --id=<uuid>');
        process.exit(1);
      }
      const result = await runHuntDayRepair({ id, log: console.log });
      console.log(JSON.stringify(result, null, 2));
      console.log(`[hunt-day] repair → ${result.outPath}`);
      process.exit(result.status === 'ok_repaired' ? 0 : 1);
    }

    if (['watch', 'report'].includes(command)) {
      if (command === 'watch') {
        console.error(
          '[hunt-day] отдельная команда watch — позже; сейчас: ship --go --after-ship=watch'
        );
      } else {
        console.error(`[hunt-day] «${command}» — позже. Сейчас: status|plan|prep|ship|repair`);
      }
      process.exit(3);
    }

    console.error(`[hunt-day] неизвестная команда: ${command}`);
    usage();
    process.exit(1);
  } catch (e) {
    if (e instanceof ApplyLaneBusyError) {
      console.error(`[hunt-day] ${e.message}`);
      process.exit(e.exitCode || 2);
    }
    throw e;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
