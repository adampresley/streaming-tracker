--
-- users
--
CREATE TABLE IF NOT EXISTS "users" (
   id serial PRIMARY KEY,
   created_at timestamp NOT NULL,
   active boolean NOT NULL,
   email text UNIQUE NOT NULL,
   password text NOT NULL,
   auth_token text NOT NULL,
   account_id integer,
   activation_code text 
);

CREATE INDEX IF NOT EXISTS idx_users_email_active ON users (email, active);
CREATE INDEX IF NOT EXISTS idx_users_activation_code ON users (activation_code);

--
-- accounts 
-- 
CREATE TABLE IF NOT EXISTS "accounts" (
   id serial PRIMARY KEY,
   owner integer REFERENCES users(id) NOT NULL,
   join_token text UNIQUE NOT NULL
);

--
-- watchers 
-- 
CREATE TABLE IF NOT EXISTS "watchers" (
   id serial PRIMARY KEY,
   user_id integer,
   name text NOT NULL,
   account_id integer REFERENCES accounts(id) NOT NULL
);

--
-- platforms
--
CREATE TABLE IF NOT EXISTS "platforms" (
   id serial PRIMARY KEY,
   created_at timestamp NOT NULL,
   updated_at timestamp NOT NULL,
   name text UNIQUE NOT NULL,
   icon text
);

--
-- watch status
-- 
CREATE TABLE IF NOT EXISTS "watch_status" (
   id integer PRIMARY KEY,
   status text NOT NULL
);

--
-- shows
--
CREATE TABLE If NOT EXISTS "shows" (
   id serial PRIMARY KEY,
   created_at timestamp NOT NULL,
   updated_at timestamp NOT NULL,
   account_id integer REFERENCES accounts(id) NOT NULL,
   name text NOT NULL,
   num_seasons integer NOT NULL,
   platform_id integer REFERENCES platforms(id) NOT NULL,
   cancelled boolean NOT NULL DEFAULT false,
   date_cancelled timestamp
);

CREATE INDEX IF NOT EXISTS idx_shows_name ON shows (name);

--
-- show status
--
CREATE TABLE IF NOT EXISTS "show_status" (
   id serial PRIMARY KEY,
   account_id integer REFERENCES accounts(id) NOT NULL,
   show_id integer REFERENCES shows(id) NOT NULL,
   watch_status_id integer REFERENCES watch_status(id) NOT NULL,
   current_season integer NOT NULL DEFAULT 0,
   finished_at timestamp
);

--
-- watchers to shows
--
CREATE TABLE IF NOT EXISTS "watchers_to_show_statuses" (
   watcher_id integer REFERENCES watchers(id) NOT NULL,
   show_status_id integer REFERENCES show_status(id) NOT NULL
);

--
-- Seed data
--
INSERT INTO platforms (created_at, updated_at, name, icon) VALUES
   (now(), now(), 'Netflix', 'netflix'),
   (now(), now(), 'Hulu', 'hulu'),
   (now(), now(), 'Disney+', 'disney'),
   (now(), now(), 'Amazon Prime', 'amazon'),
   (now(), now(), 'HBO Max', 'hbo'),
   (now(), now(), 'Apple TV+', 'apple'),
   (now(), now(), 'Paramount+', 'paramount'),
   (now(), now(), 'Peacock', 'peacock'),
   (now(), now(), 'AMC+', 'amc'),
   (now(), now(), 'Acorn TV', 'acorn'),
   (now(), now(), 'BritBox', 'britbox'),
   (now(), now(), 'Cruncyroll', 'cruncyroll'),
   (now(), now(), 'Fubo', 'fubo'),
   (now(), now(), 'Tubi', 'tubi'),
   (now(), now(), 'Other', 'tv')
;

INSERT INTO watch_status (id, status) VALUES
   (1, 'Want To Watch'),
   (2, 'Watching'),
   (3, 'Finished Watching')
;

