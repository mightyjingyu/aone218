import { fetchFiles } from '@/lib/files';
import { getCurrentUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { FolderNode } from '@/contexts/FolderContext';

export interface FolderSummaryRecord {
  folder_id: string;
  content: any;
  updated_at: string;
  included_document_ids: string[];
  skipped_document_ids: string[];
}

function getStoredItems(key: string): any[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
}

export async function fetchFolderSummary(folderId: string): Promise<FolderSummaryRecord | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('folder_summaries')
    .select('folder_id, content, updated_at, included_document_ids, skipped_document_ids')
    .eq('user_id', user.id)
    .eq('folder_id', folderId)
    .maybeSingle();
  if (error || !data) return null;
  const raw = data as {
    folder_id: string;
    content: any;
    updated_at: string;
    included_document_ids: unknown;
    skipped_document_ids: unknown;
  };
  return {
    folder_id: raw.folder_id,
    content: raw.content,
    updated_at: raw.updated_at,
    included_document_ids: Array.isArray(raw.included_document_ids) ? raw.included_document_ids : [],
    skipped_document_ids: Array.isArray(raw.skipped_document_ids) ? raw.skipped_document_ids : [],
  };
}

export async function saveFolderSummary(record: FolderSummaryRecord): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');
  const { error } = await supabase.from('folder_summaries').upsert(
    {
      user_id: user.id,
      folder_id: record.folder_id,
      content: record.content,
      included_document_ids: record.included_document_ids,
      skipped_document_ids: record.skipped_document_ids,
      updated_at: record.updated_at,
    },
    { onConflict: 'user_id,folder_id' }
  );
  if (error) throw new Error(`폴더 요약 저장 실패: ${error.message}`);
}

export function tiptapToText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node.text === 'string') return node.text;
  const content = Array.isArray(node.content) ? node.content : [];
  const parts = content.map(tiptapToText).filter(Boolean);
  return parts.join(' ');
}

function isValidTipTapDoc(doc: any): boolean {
  return !!doc && doc.type === 'doc' && Array.isArray(doc.content) && doc.content.length > 0;
}

function collectFolderIdsFromNode(node: FolderNode): string[] {
  const ids: string[] = [];
  const walk = (n: FolderNode) => {
    if (n.type === 'folder') ids.push(n.id);
    (n.children || []).forEach(walk);
  };
  walk(node);
  return ids;
}

function collectAllFolderIdsFromTree(tree: FolderNode[]): string[] {
  const ids: string[] = [];
  const walk = (n: FolderNode) => {
    if (n.type === 'folder') ids.push(n.id);
    (n.children || []).forEach(walk);
  };
  tree.forEach(walk);
  return ids;
}

function getFullSummaryContentMap(): Map<string, any> {
  const fullSummariesV2 = getStoredItems('aone_full_summaries_v2');
  const map = new Map<string, any>();
  for (const s of fullSummariesV2) {
    if (s?.document_id && s?.content) map.set(String(s.document_id), s.content);
  }
  const fullSummaries = getStoredItems('aone_full_summaries');
  for (const s of fullSummaries) {
    if (s?.document_id && !map.has(String(s.document_id))) map.set(String(s.document_id), s.content);
  }
  return map;
}

function contentToText(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (content.overview?.summary) {
    const parts: string[] = [content.overview.summary];
    if (content.topics && Array.isArray(content.topics)) {
      for (const t of content.topics) {
        if (t.topic_title) parts.push(t.topic_title);
        if (t.slide_notes) parts.push(t.slide_notes.join(' '));
      }
    }
    return parts.join('\n');
  }
  return tiptapToText(content);
}

export interface FolderSummaryInputStats {
  totalDocuments: number;
  includedDocuments: number;
  skippedDocuments: number;
}

export async function summarizeFolderWithAI(opts: {
  folderId: string;
  folderName: string;
  folderNode: FolderNode | null;
  fullTree: FolderNode[];
}): Promise<{ content: any; record: FolderSummaryRecord; stats: FolderSummaryInputStats }> {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const fullMap = getFullSummaryContentMap();

  const folderIds =
    opts.folderNode
      ? collectFolderIdsFromNode(opts.folderNode)
      : collectAllFolderIdsFromTree(opts.fullTree);

  const folderIdsToFetch: Array<string | null> = opts.folderNode ? folderIds : [null, ...folderIds];

  const seen = new Set<string>();
  const docIds: string[] = [];

  for (const fid of folderIdsToFetch) {
    const files = await fetchFiles(user.id, fid);
    for (const f of files) {
      if (f.type !== 'pdf') continue;
      if (!seen.has(f.id)) {
        seen.add(f.id);
        docIds.push(f.id);
      }
    }
  }

  const included: string[] = [];
  const skipped: string[] = [];
  const sections: string[] = [];

  for (const id of docIds) {
    const content = fullMap.get(id);
    const txt = contentToText(content).trim();
    if (!txt) {
      skipped.push(id);
      continue;
    }
    included.push(id);
    sections.push(`Document ${id}:\n${txt}`);
  }

  if (included.length === 0) {
    throw new Error('이 폴더(및 하위 폴더)에서 전체요약이 존재하는 문서가 없습니다. 먼저 각 문서에서 전체요약을 생성해 주세요.');
  }

  const summariesText = sections.join('\n\n---\n\n');

  const res = await fetch('/api/summarize/folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      folderName: opts.folderName,
      summariesText,
      includedCount: included.length,
      skippedCount: skipped.length,
    }),
  });

  if (!res.ok) {
    let message = `폴더 전체 요약에 실패했습니다. (HTTP ${res.status})`;
    try {
      const j = await res.json();
      const err = j?.error;
      const details = j?.details;
      message = err && details ? `${err} (${details})` : (err || details || message);
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const data = await res.json();
  const content = data?.summary;

  if (!isValidTipTapDoc(content)) {
    throw new Error('폴더 요약 결과가 비어있습니다. 다시 시도해 주세요.');
  }

  const now = new Date().toISOString();
  const record: FolderSummaryRecord = {
    folder_id: opts.folderId,
    content,
    updated_at: now,
    included_document_ids: included,
    skipped_document_ids: skipped,
  };

  await saveFolderSummary(record);

  return {
    content,
    record,
    stats: {
      totalDocuments: docIds.length,
      includedDocuments: included.length,
      skippedDocuments: skipped.length,
    },
  };
}
