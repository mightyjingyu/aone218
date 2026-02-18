import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export interface FolderQuestionsHistoryEntry {
  id: string;
  created_at: string;
  questions: any[];
  jokbo_text?: string;
}

export interface FolderQuestionsRecord {
  folder_id: string;
  history: FolderQuestionsHistoryEntry[];
}

function normalizeHistory(raw: unknown): FolderQuestionsHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => ({
    id: item?.id ?? '',
    created_at: item?.created_at ?? new Date().toISOString(),
    questions: Array.isArray(item?.questions) ? item.questions : [],
    jokbo_text: item?.jokbo_text,
  }));
}

export async function fetchFolderQuestions(folderId: string): Promise<FolderQuestionsRecord | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('folder_questions')
    .select('folder_id, history')
    .eq('user_id', user.id)
    .eq('folder_id', folderId)
    .maybeSingle();
  if (error || !data) return null;
  const raw = data as { folder_id: string; history: unknown };
  const history = normalizeHistory(raw.history);
  return { folder_id: raw.folder_id, history };
}

export async function saveFolderQuestions(record: FolderQuestionsRecord): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');
  const { error } = await supabase.from('folder_questions').upsert(
    {
      user_id: user.id,
      folder_id: record.folder_id,
      history: record.history,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,folder_id' }
  );
  if (error) throw new Error(`폴더 족보 저장 실패: ${error.message}`);
}

export async function appendFolderQuestions(
  folderId: string,
  entry: FolderQuestionsHistoryEntry
): Promise<FolderQuestionsRecord> {
  const existing = await fetchFolderQuestions(folderId);
  const history = existing?.history ?? [];
  const next: FolderQuestionsRecord = {
    folder_id: folderId,
    history: [...history, entry],
  };
  await saveFolderQuestions(next);
  return next;
}
