-- Knowledge Store v1: работодатели, отклики, исходы
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hh_employer_id TEXT,
  sector TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS apply_attempts (
  id TEXT PRIMARY KEY,
  employer_id TEXT,
  vacancy_id TEXT,
  record_id TEXT,
  applied_at TEXT,
  source TEXT,
  resume_variant TEXT,
  letter_hash TEXT,
  keyword_gap_score INTEGER,
  letter_score10 REAL,
  gate_score INTEGER,
  resume_snapshot_path TEXT,
  letter_snapshot_path TEXT,
  jd_snapshot_path TEXT,
  meta_json TEXT,
  FOREIGN KEY (employer_id) REFERENCES employers(id)
);

CREATE INDEX IF NOT EXISTS idx_apply_attempts_employer ON apply_attempts(employer_id);
CREATE INDEX IF NOT EXISTS idx_apply_attempts_vacancy ON apply_attempts(vacancy_id);
CREATE INDEX IF NOT EXISTS idx_apply_attempts_applied_at ON apply_attempts(applied_at);

CREATE TABLE IF NOT EXISTS apply_outcomes (
  attempt_id TEXT PRIMARY KEY,
  bucket TEXT,
  hh_site_state TEXT,
  time_to_first_response_min INTEGER,
  questionnaire_deferred INTEGER,
  offer_received INTEGER,
  updated_at TEXT,
  outcome_class TEXT,
  closure_evidence_json TEXT,
  FOREIGN KEY (attempt_id) REFERENCES apply_attempts(id)
);
