#!/bin/sh
set -eu

test "$POSTGRES_DB" = train_test119
test -n "$TRAINING_DB_PASSWORD"

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --set app_password="$TRAINING_DB_PASSWORD" <<'SQL'
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE zz_train_test LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'app_password';
ALTER DATABASE train_test119 OWNER TO zz_train_test;
GRANT ALL ON SCHEMA public TO zz_train_test;
CREATE DATABASE training_phase_one OWNER zz_train_test;
SQL
