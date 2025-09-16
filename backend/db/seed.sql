INSERT INTO users (email, password_hash, display_name, provider)
VALUES ('demo@crossings.app', NULL, 'Demo Explorer', 'demo')
ON CONFLICT(email) DO NOTHING;

INSERT INTO scores (user_id, mode, score, duration_seconds, correct_count, avg_time_per_correct)
SELECT id, 'easy', 5, 45, 5, 3.2 FROM users WHERE email = 'demo@crossings.app';
