/** Softline SLA-дуга (партнёр 20.07) — для l2l3/support; не ведущий крючок DevOps. */
export const SOFTLINE_SLA_ARC =
  'В Softline вывел SLA линии поддержки с ~78% до ~93% (процессы, KPI, база знаний).';

/** Safe-шаблоны писем (day / me-close). Метрики — разные, без копипаста «15%» на оба. */
export function buildL2l3SafeLetter(rec) {
  const title = String(rec.title || 'позицию').trim();
  const company = String(rec.company || 'вашу команду').trim();
  return [
    `Здравствуйте! Откликаюсь на «${title}» в ${company}.`,
    `До июня 2026 на проекте СБП в IT_One вёл вторую линию: инциденты, логи и SQL, эскалации в разработку, мониторинг Grafana/Kibana.`,
    SOFTLINE_SLA_ARC,
    `Опираюсь на Linux, сетевую диагностику, Windows Server/AD и понятные регламенты изменений.`,
    `Готов обсудить формат смен и ваш стек.`,
  ].join(' ');
}

export function buildDevopsSafeLetter(rec) {
  const title = String(rec.title || 'DevOps').trim();
  const company = String(rec.company || 'вашу команду').trim();
  return [
    `Здравствуйте! Откликаюсь на «${title}» в ${company}.`,
    `До июня 2026 сопровождал контуры СБП в IT_One: релизы, Docker/OpenShift, Grafana/Kibana, инциденты и CI/CD в закрытом контуре.`,
    `Linux, Git, PostgreSQL и автоматизация рутины — из эксплуатации; готов усилить наблюдаемость и пайплайны под ваш стек.`,
    `Готов обсудить задачи по автоматизации и формат работы.`,
  ].join(' ');
}
