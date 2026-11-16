CREATE TABLE users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  display_name text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE TABLE accounts (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('instagram','facebook','x')),
  handle text NOT NULL,
  display_name text NOT NULL,
  connection_status text NOT NULL DEFAULT 'demo' CHECK (connection_status IN ('demo','disconnected')),
  is_sample boolean NOT NULL DEFAULT true,
  UNIQUE(user_id, platform, handle),
  UNIQUE(id, user_id)
);
CREATE TABLE activity (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  seed_key text UNIQUE,
  type text NOT NULL CHECK (type IN ('post','comment','message','notification')),
  actor text NOT NULL,
  content text NOT NULL,
  occurred_at timestamptz NOT NULL,
  is_sample boolean NOT NULL DEFAULT true
);
CREATE TABLE scheduled_posts (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id integer NOT NULL,
  seed_key text UNIQUE,
  content text NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 2200),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled')),
  scheduled_at timestamptz,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(account_id, user_id) REFERENCES accounts(id, user_id) ON DELETE CASCADE,
  CHECK (status <> 'scheduled' OR scheduled_at IS NOT NULL)
);
CREATE TABLE metric_snapshots (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  followers integer NOT NULL CHECK (followers >= 0),
  impressions integer NOT NULL CHECK (impressions >= 0),
  engagements integer NOT NULL CHECK (engagements >= 0),
  is_sample boolean NOT NULL DEFAULT true,
  UNIQUE(account_id, snapshot_date)
);
CREATE INDEX activity_account_date ON activity(account_id, occurred_at DESC);
CREATE INDEX scheduled_posts_owner ON scheduled_posts(user_id, updated_at DESC);
CREATE INDEX sessions_expiry ON sessions(expires_at);
