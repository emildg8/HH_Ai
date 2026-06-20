/**
 * Единый реестр настроек HH Ai.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { flattenObjectPaths } from './settings-paths.mjs';

const PREF_BOUNDS = {
  dashboardMinScoreFilter: { min: 0, max: 100 },
  dashboardBatchSize: { min: 1, max: 1000 },
  hhApplyChatMaxPerHour: { min: 1, max: 200 },
  hhApplyChatMaxPerDay: { min: 1, max: 1000 },
  hhApplyChatMaxPerMonth: { min: 1, max: 10000 },
  batchFalsePositiveMax: { min: 0, max: 500 },
  learningAutoApplyMinCount: { min: 2, max: 20 },
  minMonthlyRub: { min: 0, max: 2_000_000 },
  targetMonthlyRub: { min: 0, max: 2_000_000 },
  maxMonthlyRubSearch: { min: 0, max: 5_000_000 },
};

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** @typedef {'system'|'harvest'|'targeting'|'apply'|'letters'|'teleprompter'|'appearance'|'services'|'expert'} SettingsZoneId */

/**
 * @typedef {{
 *   path: string,
 *   type: string,
 *   storage: string,
 *   zone: SettingsZoneId,
 *   visibility: string,
 *   label: string,
 *   keywords?: string[],
 *   exportable?: boolean,
 *   bounds?: { min: number, max: number },
 *   enum?: string[],
 * }} SettingEntry
 */

export const SETTINGS_ZONE_IDS = [
  'system',
  'harvest',
  'targeting',
  'apply',
  'letters',
  'teleprompter',
  'appearance',
  'services',
  'expert',
];

export const SETTINGS_ZONE_ALIASES = {
  system: 'system',
  profile: 'system',
  harvest: 'harvest',
  targeting: 'targeting',
  apply: 'apply',
  letters: 'letters',
  teleprompter: 'teleprompter',
  copilot: 'teleprompter',
  appearance: 'appearance',
  services: 'services',
  expert: 'expert',
};

/** @param {string} tab */
export function normalizeSettingsZone(tab) {
  const id = String(tab || '').trim().toLowerCase();
  return SETTINGS_ZONE_ALIASES[id] || (SETTINGS_ZONE_IDS.includes(id) ? id : 'system');
}

/** @param {Partial<SettingEntry> & Pick<SettingEntry, 'path'|'type'|'zone'|'label'>} e */
function entry(e) {
  return {
    storage: 'file',
    visibility: 'simple',
    exportable: true,
    keywords: [],
    ...e,
  };
}

const FILE_ENTRIES = [
  entry({ path: 'dashboardPlaywrightDisplayMode', type: 'enum', zone: 'system', label: 'Режим окна браузера', enum: ['hidden-captcha', 'visible', 'headless'] }),
  entry({ path: 'hideSideJobConsole', type: 'boolean', zone: 'system', label: 'Скрывать окно консоли фоновых скриптов', keywords: ['cmd', 'консоль', 'фон'] }),
  entry({ path: 'sideJobsHeadless', type: 'boolean', zone: 'system', label: 'Браузер без окна для фоновых задач', keywords: ['headless', 'фон', 'playwright'] }),
  entry({ path: 'marketSkillsEnabled', type: 'boolean', zone: 'system', label: 'Анализ навыков рынка' }),
  entry({ path: 'resumeEditMaxPerDay', type: 'number', zone: 'system', visibility: 'expert', label: 'Правок резюме в день', bounds: { min: 0, max: 100 } }),
  entry({ path: 'minMonthlyUsd', type: 'number', zone: 'expert', visibility: 'internal', label: 'Минимум USD', exportable: false }),
  entry({ path: 'rubPerUsd', type: 'number', zone: 'expert', visibility: 'internal', label: 'Курс руб/доллар', exportable: false }),
  entry({ path: 'ingestMaxTierCPerDay', type: 'number', zone: 'harvest', visibility: 'expert', label: 'Лимит вакансий уровня C в день', bounds: { min: 0, max: 500 } }),
  entry({ path: 'llmScoreWeights.vacancy', type: 'number', zone: 'harvest', visibility: 'expert', label: 'Вес оценки вакансии', bounds: { min: 0, max: 1 } }),
  entry({ path: 'llmScoreWeights.cvMatch', type: 'number', zone: 'harvest', visibility: 'expert', label: 'Вес совпадения с резюме', bounds: { min: 0, max: 1 } }),
  entry({ path: 'requireRemote', type: 'boolean', zone: 'targeting', label: 'Только удалёнка глобально' }),
  entry({ path: 'allowHybrid', type: 'boolean', zone: 'targeting', label: 'Разрешить гибрид' }),
  entry({ path: 'allowOfficeMoscow', type: 'boolean', zone: 'targeting', label: 'Офис в Москве' }),
  entry({ path: 'hybridMoscowOnly', type: 'boolean', zone: 'targeting', label: 'Гибрид только Москва' }),
  entry({ path: 'blockSpokenEnglishRequired', type: 'boolean', zone: 'targeting', label: 'Блокировать устный английский' }),
  entry({ path: 'blockNightShiftOnly', type: 'boolean', zone: 'targeting', label: 'Блокировать ночные смены' }),
  entry({ path: 'allowUnknownSalary', type: 'boolean', zone: 'targeting', label: 'Без зарплаты в объявлении' }),
  entry({ path: 'minMonthlyRub', type: 'number', zone: 'targeting', label: 'Минимальная зарплата', bounds: PREF_BOUNDS.minMonthlyRub }),
  entry({ path: 'targetMonthlyRub', type: 'number', zone: 'targeting', label: 'Целевая зарплата', bounds: PREF_BOUNDS.targetMonthlyRub }),
  entry({ path: 'maxMonthlyRubSearch', type: 'number', zone: 'targeting', label: 'Максимум в поиске', bounds: PREF_BOUNDS.maxMonthlyRubSearch }),
  entry({ path: 'excludeSeniorRoles', type: 'boolean', zone: 'targeting', label: 'Исключать руководителей' }),
  entry({ path: 'exclude1CRoles', type: 'boolean', zone: 'targeting', label: 'Исключать 1С' }),
  entry({ path: 'excludeDeveloperRoles', type: 'boolean', zone: 'targeting', label: 'Исключать разработчиков' }),
  entry({ path: 'excludeIrrelevantTitles', type: 'boolean', zone: 'targeting', label: 'Исключать нерелевантные роли' }),
  entry({ path: 'remotePositivePatterns', type: 'string[]', zone: 'expert', visibility: 'expert', label: 'Паттерны удалёнки' }),
  entry({ path: 'hybridPatterns', type: 'string[]', zone: 'expert', visibility: 'expert', label: 'Паттерны гибрида' }),
  entry({ path: 'officeOnlyPatterns', type: 'string[]', zone: 'expert', visibility: 'expert', label: 'Паттерны только офис' }),
  entry({ path: 'excludeSeniorRolePatterns', type: 'string[]', zone: 'expert', visibility: 'expert', label: 'Паттерны руководителей' }),
  entry({ path: 'exclude1CRolePatterns', type: 'string[]', zone: 'expert', visibility: 'expert', label: 'Паттерны 1С' }),
  entry({ path: 'excludeDeveloperRolePatterns', type: 'string[]', zone: 'expert', visibility: 'expert', label: 'Паттерны разработчиков' }),
  entry({ path: 'excludeIrrelevantTitlePatterns', type: 'string[]', zone: 'expert', visibility: 'expert', label: 'Паттерны нерелевантных ролей' }),
  entry({ path: 'dashboardMinScoreFilter', type: 'number', zone: 'apply', label: 'Порог «Авто»', bounds: PREF_BOUNDS.dashboardMinScoreFilter }),
  entry({ path: 'dashboardBatchSize', type: 'number', zone: 'apply', label: 'Размер серии', bounds: PREF_BOUNDS.dashboardBatchSize }),
  entry({ path: 'batchRequireRemote', type: 'boolean', zone: 'apply', label: 'Только удалёнка в серии' }),
  entry({ path: 'hhApplyChatMaxPerHour', type: 'number', zone: 'apply', label: 'Лимит откликов в час', bounds: PREF_BOUNDS.hhApplyChatMaxPerHour }),
  entry({ path: 'hhApplyChatMaxPerDay', type: 'number', zone: 'apply', label: 'Лимит откликов в сутки', bounds: PREF_BOUNDS.hhApplyChatMaxPerDay }),
  entry({ path: 'hhApplyChatMaxPerMonth', type: 'number', zone: 'apply', label: 'Лимит откликов за 30 дней', bounds: PREF_BOUNDS.hhApplyChatMaxPerMonth }),
  entry({ path: 'minKeywordGapScore', type: 'number', zone: 'apply', visibility: 'expert', label: 'Порог пробела по ключевым словам', bounds: { min: 0, max: 100 } }),
  entry({ path: 'conversionGlueEnabled', type: 'boolean', zone: 'apply', visibility: 'expert', label: 'Склейка воронки (glue emit)', keywords: ['glue', 'conversion'] }),
  entry({ path: 'observability.enabled', type: 'boolean', zone: 'apply', visibility: 'expert', label: 'Журнал наблюдаемости (JSONL)', keywords: ['observability', 'jsonl'] }),
  entry({ path: 'applyIntelligence.enabled', type: 'boolean', zone: 'apply', label: 'PreApplyGate включён', keywords: ['gate', 'отбор', 'конверсия'] }),
  entry({ path: 'applyIntelligence.minGateScore', type: 'number', zone: 'apply', label: 'Мин. gateScore', bounds: { min: 0, max: 100 }, keywords: ['gate', 'порог'] }),
  entry({ path: 'applyIntelligence.minGateScoreDream', type: 'number', zone: 'apply', label: 'Мин. gateScore (dream)', bounds: { min: 0, max: 100 }, keywords: ['gate', 'dream'] }),
  entry({ path: 'applyIntelligence.dreamEmployers', type: 'string[]', zone: 'apply', visibility: 'expert', label: 'Dream-работодатели', keywords: ['dream', 'компания'] }),
  entry({ path: 'applyIntelligence.useEmployerScore', type: 'boolean', zone: 'apply', label: 'Учитывать историю работодателя', keywords: ['employer', 'gate'] }),
  entry({
    path: 'applyIntelligence.knowledgeStoreEnabled',
    type: 'boolean',
    zone: 'apply',
    visibility: 'expert',
    label: 'База знаний (SQLite)',
    keywords: ['knowledge', 'sqlite', 'employer', 'паттерны'],
  }),
  entry({ path: 'applyIntelligence.weights.keywordFit', type: 'number', zone: 'expert', visibility: 'expert', label: 'Вес: ключевые слова', bounds: { min: 0, max: 1 } }),
  entry({ path: 'applyIntelligence.weights.resumeFit', type: 'number', zone: 'expert', visibility: 'expert', label: 'Вес: resume-fit', bounds: { min: 0, max: 1 } }),
  entry({ path: 'applyIntelligence.weights.letterQuality', type: 'number', zone: 'expert', visibility: 'expert', label: 'Вес: качество письма', bounds: { min: 0, max: 1 } }),
  entry({ path: 'applyIntelligence.weights.employerHistory', type: 'number', zone: 'expert', visibility: 'expert', label: 'Вес: история работодателя', bounds: { min: 0, max: 1 } }),
  entry({ path: 'applyIntelligence.weights.freshness', type: 'number', zone: 'expert', visibility: 'expert', label: 'Вес: свежесть вакансии', bounds: { min: 0, max: 1 } }),
  entry({ path: 'applyIntelligence.weights.hrStackMatch', type: 'number', zone: 'expert', visibility: 'expert', label: 'Вес: HR-стек', bounds: { min: 0, max: 1 } }),
  entry({ path: 'batchAutoPrepareLetters', type: 'boolean', zone: 'letters', label: 'Автоподготовка писем' }),
  entry({ path: 'batchLetterRequireMetric', type: 'boolean', zone: 'letters', label: 'Цифры в письме обязательны' }),
  entry({ path: 'batchAutoApproveBestLetter', type: 'boolean', zone: 'letters', label: 'Авто-утверждение лучшего письма' }),
  entry({ path: 'batchFalsePositiveMax', type: 'number', zone: 'letters', label: 'Порог ложных отказов', bounds: PREF_BOUNDS.batchFalsePositiveMax }),
  entry({ path: 'learningAutoApplyPatterns', type: 'boolean', zone: 'letters', label: 'Авто-правила из ложных отказов' }),
  entry({ path: 'learningAutoApplyMinCount', type: 'number', zone: 'letters', label: 'Мин. повторов паттерна', bounds: PREF_BOUNDS.learningAutoApplyMinCount }),
  entry({ path: 'batchLetterMinScore10', type: 'number', zone: 'letters', label: 'Мин. оценка письма (из 10)', bounds: { min: 1, max: 10 } }),
  entry({ path: 'batchLetterMaxAiScore', type: 'number', zone: 'letters', label: 'Макс. похожесть на нейросеть', bounds: { min: 0, max: 100 } }),
  entry({ path: 'letterHumanizeTwoPass', type: 'boolean', zone: 'letters', visibility: 'expert', label: 'Двухпроходная правка писем' }),
  entry({ path: 'interviewCopilot.wasapiDevice', type: 'string', zone: 'teleprompter', label: 'Звук с созвона' }),
  entry({ path: 'interviewCopilot.micDevice', type: 'string', zone: 'teleprompter', label: 'Ваш микрофон' }),
  entry({ path: 'interviewCopilot.interviewStage', type: 'enum', zone: 'teleprompter', label: 'Этап собеседования', enum: ['screening', 'hr', 'tech', 'negotiation', 'final'] }),
  entry({ path: 'interviewCopilot.liveFontSize', type: 'number', zone: 'teleprompter', label: 'Размер текста', bounds: { min: 14, max: 32 } }),
  entry({ path: 'interviewCopilot.liveBarMaxLines', type: 'number', zone: 'teleprompter', label: 'Строк в полоске', bounds: { min: 1, max: 6 } }),
  entry({ path: 'interviewCopilot.listenMic', type: 'boolean', zone: 'teleprompter', label: 'Слушать микрофон' }),
  entry({ path: 'interviewCopilot.scriptOnlyOverlay', type: 'boolean', zone: 'teleprompter', label: 'Только речь в подсказке' }),
  entry({ path: 'interviewCopilot.learnFromSpoken', type: 'boolean', zone: 'teleprompter', label: 'Запоминать сказанное' }),
  entry({ path: 'interviewCopilot.answerFormat', type: 'enum', zone: 'teleprompter', label: 'Формат ответа', enum: ['scaffold', 'full'] }),
  entry({ path: 'interviewCopilot.dockPreset', type: 'enum', zone: 'teleprompter', visibility: 'expert', label: 'Положение окна', enum: ['above-meeting', 'side'] }),
  entry({ path: 'interviewCopilot.eyeContact', type: 'enum', zone: 'teleprompter', label: 'Подсказки по взгляду', enum: ['on', 'off'] }),
  entry({ path: 'interviewCopilot.eyeContactRemind', type: 'boolean', zone: 'teleprompter', label: 'Напоминать о взгляде' }),
  entry({ path: 'dashboardUiMode', type: 'enum', zone: 'appearance', label: 'Режим интерфейса', enum: ['simple', 'expert'] }),
  entry({ path: 'dashboardSidebarLayout', type: 'enum', zone: 'appearance', label: 'Плотность панели', enum: ['full', 'compact'] }),
];

/** @type {Map<string, SettingEntry>} */
let registryMap = null;

function buildRegistryMap() {
  if (registryMap) return registryMap;
  registryMap = new Map();
  for (const e of FILE_ENTRIES) registryMap.set(e.path, e);
  return registryMap;
}

export function getAllSettingEntries() {
  return [...buildRegistryMap().values()];
}

export function getSettingMeta(path) {
  return buildRegistryMap().get(path) || null;
}

export function listSettingsByZone(zone) {
  return getAllSettingEntries().filter((e) => e.zone === zone);
}

function searchKeywordsForEntry(entry) {
  if (entry.keywords?.length) return entry.keywords;
  const fromLabel = String(entry.label || '')
    .toLowerCase()
    .split(/[\s,·—–-]+/)
    .filter((w) => w.length > 2);
  const fromPath = String(entry.path || '')
    .split('.')
    .pop()
    ?.replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[\s._]+/)
    .filter(Boolean);
  return [...new Set([...fromLabel, ...(fromPath || [])])];
}

export function getRegistryMetaForClient() {
  const zones = {};
  for (const id of SETTINGS_ZONE_IDS) {
    zones[id] = listSettingsByZone(id).map((e) => ({
      path: e.path,
      type: e.type,
      label: e.label,
      visibility: e.visibility,
      bounds: e.bounds,
      enum: e.enum,
      keywords: searchKeywordsForEntry(e),
      storage: e.storage,
    }));
  }
  return { zones, zoneIds: SETTINGS_ZONE_IDS };
}

export function coverageReportForPreferences(prefs) {
  const paths = flattenObjectPaths(prefs);
  const map = buildRegistryMap();
  const missing = paths.filter((p) => !map.has(p) && !isAcceptableMissingPath(p));
  return { total: paths.length, covered: paths.length - missing.length, missing };
}

export function validateSettingsPatch(patch) {
  const map = buildRegistryMap();
  const errors = [];
  for (const [path, value] of Object.entries(patch)) {
    if (isAcceptableMissingPath(path)) continue;
    const meta = map.get(path);
    if (!meta) {
      errors.push(`неизвестный ключ: ${path}`);
      continue;
    }
    if (meta.type === 'boolean' && typeof value !== 'boolean') errors.push(`${path}: нужен да/нет`);
    if (meta.type === 'number') {
      const n = Number(value);
      if (!Number.isFinite(n)) errors.push(`${path}: нужно число`);
      else if (meta.bounds) {
        if (n < meta.bounds.min || n > meta.bounds.max) {
          errors.push(`${path}: допустимо ${meta.bounds.min}–${meta.bounds.max}`);
        }
      }
    }
    if (meta.enum && !meta.enum.includes(String(value))) {
      errors.push(`${path}: недопустимое значение`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function getExportableFilePaths() {
  return getAllSettingEntries()
    .filter((e) => e.storage === 'file' && e.exportable !== false)
    .map((e) => e.path);
}

export function loadCanonicalPreferencePaths() {
  const prefsPath = join(root, 'config', 'preferences.json');
  return flattenObjectPaths(JSON.parse(readFileSync(prefsPath, 'utf8')));
}

export function isAcceptableMissingPath(path) {
  return (
    path.startsWith('dashboardSidebarPanels.') ||
    path.startsWith('dashboardSidebarPanelSides.') ||
    path === 'dashboardSidebarPanelOrder'
  );
}
