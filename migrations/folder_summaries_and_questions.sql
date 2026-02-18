-- 폴더 전체 요약 테이블
CREATE TABLE IF NOT EXISTS folder_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id text NOT NULL,
  content jsonb NOT NULL,
  included_document_ids jsonb NOT NULL DEFAULT '[]',
  skipped_document_ids jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, folder_id)
);

CREATE INDEX IF NOT EXISTS idx_folder_summaries_user_folder ON folder_summaries(user_id, folder_id);

ALTER TABLE folder_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own folder_summaries" ON folder_summaries;
CREATE POLICY "Users can manage own folder_summaries" ON folder_summaries
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 폴더 족보(문제) 테이블
CREATE TABLE IF NOT EXISTS folder_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id text NOT NULL,
  history jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, folder_id)
);

CREATE INDEX IF NOT EXISTS idx_folder_questions_user_folder ON folder_questions(user_id, folder_id);

ALTER TABLE folder_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own folder_questions" ON folder_questions;
CREATE POLICY "Users can manage own folder_questions" ON folder_questions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
