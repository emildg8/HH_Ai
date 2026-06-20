-- HR-профиль работодателя и выигрышные паттерны
CREATE TABLE IF NOT EXISTS employer_hr_profile (
  employer_id TEXT PRIMARY KEY,
  stack_primary TEXT,
  stack_confidence REAL,
  auto_screen_strictness TEXT,
  chat_bot_enabled INTEGER,
  typical_response_min INTEGER,
  ghost_rate REAL,
  invite_rate REAL,
  signals_json TEXT,
  playbooks_json TEXT,
  overrides_json TEXT,
  FOREIGN KEY (employer_id) REFERENCES employers(id)
);

CREATE TABLE IF NOT EXISTS winning_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employer_id TEXT,
  pattern_type TEXT,
  pattern_value TEXT,
  invite_count INTEGER DEFAULT 0,
  decline_count INTEGER DEFAULT 0,
  confidence REAL,
  last_seen_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_winning_patterns_employer ON winning_patterns(employer_id);
