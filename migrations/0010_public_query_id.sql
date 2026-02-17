ALTER TABLE guidance_request ADD COLUMN public_id TEXT;

UPDATE guidance_request
SET public_id = (
  lower(hex(randomblob(4))) || '-' ||
  lower(hex(randomblob(2))) || '-' ||
  '4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6)))
)
WHERE public_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_guidance_request_public_id
ON guidance_request (public_id);
