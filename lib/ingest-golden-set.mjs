export const INGEST_GOLDEN = [
  {
    url: 'https://hh.ru/vacancy/12345678',
    expect: { source: 'hh', applyMode: 'hh_auto', externalKey: 'hh:12345678' },
  },
  {
    url: 'https://career.habr.com/vacancies/999',
    expect: { source: 'habr', applyMode: 'manual_link', externalKey: 'habr:999' },
  },
  {
    url: 'https://boards.greenhouse.io/acme/jobs/42',
    expect: { source: 'ats', applyMode: 'ats_form', externalKey: 'greenhouse:42' },
  },
];
