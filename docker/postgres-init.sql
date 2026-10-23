-- The tests run against their own database, so `bun test` never touches dev data.
CREATE DATABASE acme_test OWNER acme;
