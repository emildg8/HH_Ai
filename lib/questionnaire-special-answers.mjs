/**
 * Ответы на нестандартные вопросы анкеты: код, поведенческие, SDET.
 */

/** @param {string} label */
export function isCodingQuestionnaireQuestion(label) {
  const t = String(label || '');
  return (
    /напишите\s+функци|написать\s+функци|реализовать\s+функци|compress_numbers/i.test(t) ||
    (/автотест|unit[\s-]?test|pytest|юнит[\s-]?тест/i.test(t) && /функци|код|программ/i.test(t)) ||
    (/массив\s+чисел|удален\w*\s+подряд|дубликат/i.test(t) && /функци|напишите/i.test(t))
  );
}

/** @param {string} label */
export function isRoleInterestQuestionLabel(label) {
  return /заинтересовало|предстоящих\s+обязанност|понимаете\s+роль|как\s+понимаете\s+роль/i.test(
    String(label || '')
  );
}

/** @param {string} label */
export function isRtsGamesQuestionLabel(label) {
  return /rts|жанра\s+rts|warcraft|starcraft/i.test(String(label || ''));
}

/**
 * Текст для textarea «роль / обязанности» (на hh.ru часто textarea, в JSON мог остаться radio).
 * @param {{ vacancyTitle?: string }} [ctx]
 */
export function answerRoleInterestTextarea(ctx = {}) {
  const title = String(ctx.vacancyTitle || '').toLowerCase();
  if (/sdet|test|qa|quality|автотест/i.test(title)) {
    return (
      'Меня заинтересовали автотесты на Python, проверка игровой аналитики и базовый CI/CD в QA-команде. ' +
      'Роль вижу как SDET: писать код тестов, разбирать логи/метрики и ускорять рутину с AI-инструментами под продукт RTS.'
    );
  }
  if (/devops|sre|platform/i.test(title)) {
    return (
      'Интересны автоматизация рутины, CI/CD и стабильность сервисов; роль понимаю как инженер эксплуатации с фокусом на наблюдаемость и надёжность релизов.'
    );
  }
  return (
    'Заинтересовали задачи из описания вакансии и возможность применить опыт автоматизации и разбора инцидентов; детали роли готов уточнить на собеседовании.'
  );
}

/** @param {string} label */
export function isBehavioralAmbiguousQuestion(label) {
  const t = String(label || '');
  return (
    /неясн\w*\s+задач|непонятн\w*\s+задач|размыт\w*\s+задач/i.test(t) ||
    /ваши\s+первые\s+действ/i.test(t) ||
    (/первые\s+действ|ваши\s+действ|что\s+сделаете\s+перв/i.test(t) &&
      /задач|требован|матчмейкинг|улучш/i.test(t)) ||
    /матчмейкинг\s+лучше|сделать\s+.*\s+лучше/i.test(t)
  );
}

const COMPRESS_NUMBERS_ANSWER = `def compress_numbers(nums):
    if not nums:
        return []
    out = [nums[0]]
    for x in nums[1:]:
        if x != out[-1]:
            out.append(x)
    return out

# pytest
import pytest

@pytest.mark.parametrize("inp,expected", [
    ([1, 1, 2, 2, 3], [1, 2, 3]),
    ([0, 0, 1, 1, 0], [0, 1, 0]),
    ([], []),
    ([7], [7]),
    ([1, 2, 2, 2, 1], [1, 2, 1]),
])
def test_compress_numbers(inp, expected):
    assert compress_numbers(inp) == expected`;

const GENERIC_CODE_STUB = `def solve(input_data):
    # TODO: уточнить контракт по ТЗ вакансии
    raise NotImplementedError

# pytest — скелет; дополняю кейсами после уточнения требований
def test_solve_smoke():
    assert True`;

/**
 * @param {string} label
 * @param {'qa'|'devops'|'ml'|'general'} [focus]
 */
export function answerCodingQuestionnaire(label, focus = 'qa') {
  if (/compress_numbers|подряд\s+идущ|удален\w*\s+подряд\s+идущ/i.test(label)) {
    return COMPRESS_NUMBERS_ANSWER;
  }
  if (focus === 'qa') {
    return (
      GENERIC_CODE_STUB +
      '\n\n# На собеседовании допишу полное решение и граничные кейсы под ваш стек (Python/pytest).'
    );
  }
  return COMPRESS_NUMBERS_ANSWER;
}

/**
 * @param {'qa'|'devops'|'ml'|'general'} [focus]
 */
export function answerBehavioralAmbiguousTask(focus = 'qa') {
  if (focus === 'qa') {
    return (
      '1) Уточняю цель и метрики: что значит «лучше» (время подбора, качество пар, конверсия, отказы).\n' +
      '2) Собираю текущий baseline: логи, метрики, примеры инцидентов; фиксирую воспроизводимые сценарии.\n' +
      '3) Формулирую гипотезы и критерии приёмки с продактом/аналитикой; согласую MVP.\n' +
      '4) План проверки: автотесты API/бизнес-логики, регресс, мониторинг после выката.\n' +
      '5) Итерации по измеримому результату, документирую риски и откат.'
    );
  }
  return (
    '1) Уточняю ожидаемый результат и ограничения у постановщика.\n' +
    '2) Смотрю текущие метрики и узкие места.\n' +
    '3) Предлагаю пошаговый план с измеримыми критериями успеха.'
  );
}

/** Ответ — только список технологий без кода/смысла. */
export function looksLikeToolListOnlyAnswer(answer) {
  const a = String(answer || '').trim();
  if (!a || a.length > 120) return false;
  if (/def\s+\w+|import\s+pytest|@pytest/i.test(a)) return false;
  return /^[A-Za-zА-Яа-я0-9\s,.\/\-+]+$/i.test(a) && /,/.test(a) && a.split(',').length >= 2;
}
