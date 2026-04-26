-- Migration number: 0005    2026-04-26
-- Public/private spaces with owner and member allow-list.

ALTER TABLE project_spaces ADD COLUMN owner_email TEXT;
ALTER TABLE project_spaces ADD COLUMN is_private   INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS space_members (
  space_slug TEXT NOT NULL REFERENCES project_spaces(slug) ON DELETE CASCADE ON UPDATE CASCADE,
  email      TEXT NOT NULL,
  PRIMARY KEY (space_slug, email)
);
