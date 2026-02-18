-- Add thumbnail_path column to files table for PDF thumbnails
-- This will store the Supabase Storage path to the first page thumbnail image

ALTER TABLE files
ADD COLUMN thumbnail_path text;

-- Add index for faster thumbnail lookups
CREATE INDEX idx_files_thumbnail ON files(thumbnail_path) WHERE thumbnail_path IS NOT NULL;

-- Add comment
COMMENT ON COLUMN files.thumbnail_path IS 'Supabase Storage path to PDF first page thumbnail (PNG)';
