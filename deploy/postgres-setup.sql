-- =============================================================================
--  EduSkill Center — dedicated PostgreSQL database + user
-- =============================================================================
--
--  This creates a NEW database and a NEW role. It does not read, modify or drop
--  anything belonging to the existing website. Nothing here touches any other
--  database on this server.
--
--  BEFORE RUNNING — replace <DB_PASSWORD> with a strong password you generate:
--      openssl rand -base64 32 | tr -d '/+=' | cut -c1-32
--  Keep it free of  $  `  #  '  @  :  /  ?  and spaces: $ ` # break the systemd
--  EnvironmentFile, and @ : / ? must be percent-encoded inside DATABASE_URL.
--
--  HOW TO RUN (as the postgres superuser):
--      sudo -u postgres psql -f deploy/postgres-setup.sql
--  or interactively:
--      sudo -u postgres psql
--      \i deploy/postgres-setup.sql
--
--  VERIFY afterwards (this must connect and print the database name):
--      psql "postgresql://eduskill_center:<DB_PASSWORD>@127.0.0.1:5432/eduskill_center" -c "select current_database(), current_user;"
--
--  If that fails with "Peer authentication failed", PostgreSQL is not accepting
--  password logins over TCP yet. Add this line to pg_hba.conf ABOVE the existing
--  host lines, then `sudo systemctl reload postgresql`:
--      host    eduskill_center    eduskill_center    127.0.0.1/32    scram-sha-256
--  (Adding one host line does not change how the existing site authenticates.)
-- =============================================================================

-- 1. The application role. Plain LOGIN only: no SUPERUSER, no CREATEDB, no
--    CREATEROLE, so this user can never reach the existing website's database.
CREATE ROLE eduskill_center WITH LOGIN PASSWORD '<DB_PASSWORD>';

-- 2. The database, owned by that role. Prisma migrations need ownership to
--    create tables, enums and indexes.
CREATE DATABASE eduskill_center
    WITH OWNER = eduskill_center
         ENCODING = 'UTF8'
         LC_COLLATE = 'en_US.UTF-8'
         LC_CTYPE   = 'en_US.UTF-8'
         TEMPLATE   = template0;
-- If the server has no en_US.UTF-8 locale, psql errors here. Re-run this
-- statement without the two LC_ lines — the default locale is fine.

-- 3. Schema privileges. On PostgreSQL 15+ the `public` schema is no longer
--    writable by everyone, so grant it explicitly or `prisma migrate deploy`
--    fails with "permission denied for schema public".
\connect eduskill_center

GRANT ALL ON SCHEMA public TO eduskill_center;
ALTER SCHEMA public OWNER TO eduskill_center;

-- 4. Confirmation.
\echo ''
\echo '  Database "eduskill_center" and role "eduskill_center" are ready.'
\echo '  Put this in <APP_DIR>/.env (percent-encode special characters):'
\echo '    DATABASE_URL="postgresql://eduskill_center:<DB_PASSWORD>@127.0.0.1:5432/eduskill_center?schema=public"'
\echo ''

-- =============================================================================
--  ROLLBACK (only if you are abandoning this deployment — destroys all data):
--      sudo -u postgres psql -c 'DROP DATABASE IF EXISTS eduskill_center;'
--      sudo -u postgres psql -c 'DROP ROLE IF EXISTS eduskill_center;'
--  Never run `prisma migrate reset` on this server — it drops and recreates the
--  schema. Use the two commands above if you really mean it.
-- =============================================================================
