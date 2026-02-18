-- 슬라이드별 요약 테이블 생성
CREATE TABLE IF NOT EXISTS slide_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  slide_number integer NOT NULL,
  
  -- AI 생성 요약 (TipTap JSON)
  summary_content jsonb,
  
  -- 사용자 추가 노트 (TipTap JSON, 선택)
  user_notes_content jsonb,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- 제약사항
  CONSTRAINT slide_summaries_slide_number_positive CHECK (slide_number > 0),
  CONSTRAINT slide_summaries_unique_doc_slide UNIQUE(document_id, slide_number)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_slide_summaries_doc ON slide_summaries(document_id);
CREATE INDEX IF NOT EXISTS idx_slide_summaries_slide ON slide_summaries(document_id, slide_number);
CREATE INDEX IF NOT EXISTS idx_slide_summaries_summary_content ON slide_summaries USING gin(summary_content);
CREATE INDEX IF NOT EXISTS idx_slide_summaries_user_notes_content ON slide_summaries USING gin(user_notes_content);

-- RLS 정책
ALTER TABLE slide_summaries ENABLE ROW LEVEL SECURITY;

-- SELECT: 사용자는 자신의 문서 요약만 조회 가능
DROP POLICY IF EXISTS "Users can view their own slide summaries" ON slide_summaries;
CREATE POLICY "Users can view their own slide summaries" ON slide_summaries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM files 
      WHERE files.id = slide_summaries.document_id 
      AND files.user_id = auth.uid()
    )
  );

-- INSERT: 사용자는 자신의 문서 요약만 생성 가능
DROP POLICY IF EXISTS "Users can insert their own slide summaries" ON slide_summaries;
CREATE POLICY "Users can insert their own slide summaries" ON slide_summaries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM files 
      WHERE files.id = slide_summaries.document_id 
      AND files.user_id = auth.uid()
    )
  );

-- UPDATE: 사용자는 자신의 문서 요약만 수정 가능
DROP POLICY IF EXISTS "Users can update their own slide summaries" ON slide_summaries;
CREATE POLICY "Users can update their own slide summaries" ON slide_summaries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM files 
      WHERE files.id = slide_summaries.document_id 
      AND files.user_id = auth.uid()
    )
  );

-- DELETE: 사용자는 자신의 문서 요약만 삭제 가능
DROP POLICY IF EXISTS "Users can delete their own slide summaries" ON slide_summaries;
CREATE POLICY "Users can delete their own slide summaries" ON slide_summaries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM files 
      WHERE files.id = slide_summaries.document_id 
      AND files.user_id = auth.uid()
    )
  );

-- updated_at 자동 업데이트 트리거
DROP TRIGGER IF EXISTS update_slide_summaries_updated_at ON slide_summaries;
CREATE TRIGGER update_slide_summaries_updated_at 
  BEFORE UPDATE ON slide_summaries
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
