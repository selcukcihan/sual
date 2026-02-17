ALTER TABLE guidance_request ADD COLUMN moderation_status TEXT;
ALTER TABLE guidance_request ADD COLUMN moderation_flagged INTEGER;
ALTER TABLE guidance_request ADD COLUMN moderation_input TEXT;
ALTER TABLE guidance_request ADD COLUMN moderation_output TEXT;
ALTER TABLE guidance_request ADD COLUMN moderation_error TEXT;
