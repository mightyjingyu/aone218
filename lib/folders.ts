import { supabase } from './supabase';
import { FolderNode } from '@/contexts/FolderContext';

/**
 * DB에서 폴더 목록을 조회합니다.
 */
export async function fetchFolders(userId: string): Promise<FolderNode[]> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching folders:', error);
    throw error;
  }

  return (data || []).map(folder => ({
    id: folder.id,
    name: folder.name,
    type: 'folder' as const,
    parent_id: folder.parent_id,
    created_at: folder.created_at,
    updated_at: folder.updated_at,
    children: [],
  }));
}

/**
 * DB에서 파일 목록을 조회합니다 (삭제되지 않은 파일만).
 */
export async function fetchFiles(userId: string): Promise<FolderNode[]> {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null) // 삭제되지 않은 파일만 조회
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching files:', error);
    throw error;
  }

  return (data || []).map(file => ({
    id: file.id,
    name: file.name,
    type: 'document' as const,
    parent_id: file.folder_id,
    created_at: file.created_at,
  }));
}

/**
 * 폴더와 파일을 트리 구조로 변환합니다.
 */
export function buildFolderTree(folders: FolderNode[], files: FolderNode[]): FolderNode[] {
  // 모든 아이템을 하나의 배열로 합치기
  const allItems: FolderNode[] = [...folders, ...files];

  // ID로 빠르게 찾기 위한 Map
  const itemMap = new Map<string, FolderNode>();
  allItems.forEach(item => {
    itemMap.set(item.id, { ...item, children: [] });
  });

  // 루트 아이템들 (parent_id가 null인 것들)
  const rootItems: FolderNode[] = [];

  // 각 아이템을 부모의 children에 추가
  allItems.forEach(item => {
    const node = itemMap.get(item.id)!;
    
    if (!item.parent_id) {
      // parent_id가 없는 경우 루트에 추가
      rootItems.push(node);
    } else {
      const parent = itemMap.get(item.parent_id);
      if (parent) {
        // 부모가 있으면 부모의 children에 추가
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(node);
      } else {
        // 부모를 찾을 수 없으면 (삭제되지 않은 폴더의 파일인 경우) 루트에 추가
        rootItems.push(node);
      }
    }
  });

  // children 정렬 (폴더가 먼저, 그 다음 이름순)
  const sortChildren = (items: FolderNode[]) => {
    items.forEach(item => {
      if (item.children) {
        item.children.sort((a, b) => {
          if (a.type === 'folder' && b.type === 'document') return -1;
          if (a.type === 'document' && b.type === 'folder') return 1;
          return a.name.localeCompare(b.name);
        });
        sortChildren(item.children);
      }
    });
  };

  sortChildren(rootItems);

  return rootItems;
}

/**
 * DB에 폴더를 생성합니다.
 */
export async function createFolderInDB(name: string, parentId: string | null, userId: string): Promise<FolderNode> {
  const { data, error } = await supabase
    .from('folders')
    .insert({
      name: name.trim(),
      parent_id: parentId,
      user_id: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating folder:', error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    type: 'folder',
    parent_id: data.parent_id,
    children: [],
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * DB에서 폴더를 수정합니다.
 */
export async function updateFolderInDB(id: string, newName: string): Promise<void> {
  const { error } = await supabase
    .from('folders')
    .update({
      name: newName.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating folder:', error);
    throw error;
  }
}

/**
 * DB에서 폴더를 소프트 삭제합니다.
 * 폴더 내부의 모든 파일도 함께 소프트 삭제됩니다.
 */
export async function deleteFolderInDB(id: string): Promise<void> {
  // 폴더 소프트 삭제
  const { error: folderError } = await supabase
    .from('folders')
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (folderError) {
    console.error('Error deleting folder:', folderError);
    throw folderError;
  }

  // 폴더 내부의 모든 파일도 소프트 삭제
  // 재귀적으로 하위 폴더의 파일들도 처리하기 위해 먼저 하위 폴더 ID들을 가져옴
  const getAllChildFolderIds = async (parentId: string): Promise<string[]> => {
    const { data: childFolders, error } = await supabase
      .from('folders')
      .select('id')
      .eq('parent_id', parentId);

    if (error) {
      console.error('Error fetching child folders:', error);
      return [];
    }

    const childIds = (childFolders || []).map(f => f.id);
    const allChildIds = [...childIds];

    // 재귀적으로 하위 폴더들의 ID도 가져오기
    for (const childId of childIds) {
      const nestedIds = await getAllChildFolderIds(childId);
      allChildIds.push(...nestedIds);
    }

    return allChildIds;
  };

  const allFolderIds = [id, ...(await getAllChildFolderIds(id))];

  // 모든 하위 폴더의 파일들 소프트 삭제
  const { error: filesError } = await supabase
    .from('files')
    .update({
      deleted_at: new Date().toISOString(),
    })
    .in('folder_id', allFolderIds)
    .is('deleted_at', null); // 이미 삭제된 파일은 제외

  if (filesError) {
    console.error('Error deleting files in folder:', filesError);
    // 파일 삭제 실패해도 폴더 삭제는 완료된 상태이므로 에러를 던지지 않음
  }
}

/**
 * DB에서 파일을 소프트 삭제합니다.
 */
export async function deleteFileInDB(id: string): Promise<void> {
  const { error } = await supabase
    .from('files')
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}

/**
 * DB에서 파일 이름을 수정합니다.
 */
export async function updateFileInDB(id: string, newName: string): Promise<void> {
  const { error } = await supabase
    .from('files')
    .update({
      name: newName.trim(),
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating file:', error);
    throw error;
  }
}

/**
 * DB에서 폴더의 parent_id를 업데이트합니다 (이동).
 */
export async function moveFolderInDB(id: string, newParentId: string | null): Promise<void> {
  const { error } = await supabase
    .from('folders')
    .update({
      parent_id: newParentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('Error moving folder:', error);
    throw error;
  }
}

/**
 * DB에서 파일의 folder_id를 업데이트합니다 (이동).
 */
export async function moveFileInDB(id: string, newFolderId: string | null): Promise<void> {
  const { error } = await supabase
    .from('files')
    .update({
      folder_id: newFolderId,
    })
    .eq('id', id);

  if (error) {
    console.error('Error moving file:', error);
    throw error;
  }
}

/**
 * 삭제된 폴더의 모든 하위 항목을 재귀적으로 가져옵니다.
 */
async function fetchDeletedFolderChildren(
  deletedFolderIds: string[],
  userId: string
): Promise<{ folders: FolderNode[]; files: FolderNode[] }> {
  if (deletedFolderIds.length === 0) {
    return { folders: [], files: [] };
  }

  // 하위 폴더들 가져오기 (부모가 삭제된 폴더인 경우, 삭제 여부와 관계없이)
  const { data: childFolders, error: foldersError } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .in('parent_id', deletedFolderIds);

  if (foldersError) {
    console.error('Error fetching child folders:', foldersError);
    throw foldersError;
  }

  // 하위 파일들 가져오기 (삭제된 파일 포함)
  const { data: childFiles, error: filesError } = await supabase
    .from('files')
    .select('*')
    .eq('user_id', userId)
    .in('folder_id', deletedFolderIds);

  if (filesError) {
    console.error('Error fetching child files:', filesError);
    throw filesError;
  }

  const folders = (childFolders || []).map(folder => ({
    id: folder.id,
    name: folder.name,
    type: 'folder' as const,
    parent_id: folder.parent_id,
    created_at: folder.created_at,
    updated_at: folder.updated_at,
    children: [],
  }));

  const files = (childFiles || []).map(file => ({
    id: file.id,
    name: file.name,
    type: 'document' as const,
    parent_id: file.folder_id,
    created_at: file.created_at,
    updated_at: file.deleted_at, // 삭제 시간을 updated_at으로 표시
  }));

  // 재귀적으로 하위 폴더의 하위 항목들도 가져오기
  if (folders.length > 0) {
    const childFolderIds = folders.map(f => f.id);
    const nested = await fetchDeletedFolderChildren(childFolderIds, userId);
    folders.push(...(nested.folders as typeof folders));
    files.push(...(nested.files as typeof files));
  }

  return { folders, files };
}

/**
 * DB에서 삭제된 폴더 목록을 조회합니다 (하위 항목 포함).
 */
export async function fetchDeletedFolders(userId: string): Promise<FolderNode[]> {
  // 먼저 직접 삭제된 폴더들만 가져오기 (루트 삭제된 폴더)
  const { data: deletedFolders, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) {
    console.error('Error fetching deleted folders:', error);
    throw error;
  }

  // 삭제된 폴더의 하위 항목들
  let allChildFolders: FolderNode[] = [];
  let allChildFiles: FolderNode[] = [];

  if (deletedFolders && deletedFolders.length > 0) {
    // 삭제된 폴더들의 ID 목록
    const deletedFolderIds = deletedFolders.map(f => f.id);

    // 모든 하위 항목들 가져오기
    const childItems = await fetchDeletedFolderChildren(deletedFolderIds, userId);
    allChildFolders = childItems.folders;
    allChildFiles = childItems.files;
  }

  // 삭제된 파일들도 가져오기 (폴더에 속하지 않은 독립적으로 삭제된 파일)
  const deletedFiles = await fetchDeletedFiles(userId);

  // 삭제된 폴더가 없고 삭제된 파일도 없으면 빈 배열 반환
  if ((!deletedFolders || deletedFolders.length === 0) && deletedFiles.length === 0) {
    return [];
  }

  // 모든 폴더와 파일을 합쳐서 트리 구조로 빌드
  const allFolders = [
    ...(deletedFolders || []).map(folder => ({
      id: folder.id,
      name: folder.name,
      type: 'folder' as const,
      parent_id: folder.parent_id,
      created_at: folder.created_at,
      updated_at: folder.updated_at,
      deleted_at: folder.deleted_at,
      children: [],
    })),
    ...allChildFolders,
  ];

  // 삭제된 파일들을 폴더 트리에 추가
  const allFiles = [...allChildFiles, ...deletedFiles];

  return buildFolderTree(allFolders, allFiles);
}

/**
 * DB에서 폴더를 복구합니다 (deleted_at을 null로 설정).
 * 폴더 내부의 모든 하위 폴더와 파일도 함께 복구됩니다.
 */
export async function restoreFolderInDB(id: string): Promise<void> {
  // 재귀적으로 하위 폴더 ID들을 가져오는 함수
  const getAllChildFolderIds = async (parentId: string): Promise<string[]> => {
    const { data: childFolders, error } = await supabase
      .from('folders')
      .select('id')
      .eq('parent_id', parentId);

    if (error) {
      console.error('Error fetching child folders:', error);
      return [];
    }

    const childIds = (childFolders || []).map(f => f.id);
    const allChildIds = [...childIds];

    // 재귀적으로 하위 폴더들의 ID도 가져오기
    for (const childId of childIds) {
      const nestedIds = await getAllChildFolderIds(childId);
      allChildIds.push(...nestedIds);
    }

    return allChildIds;
  };

  const allFolderIds = [id, ...(await getAllChildFolderIds(id))];

  // 모든 폴더들 복구 (부모 폴더 + 모든 하위 폴더)
  const { error: foldersError } = await supabase
    .from('folders')
    .update({
      deleted_at: null,
      updated_at: new Date().toISOString(),
    })
    .in('id', allFolderIds);

  if (foldersError) {
    console.error('Error restoring folders:', foldersError);
    throw foldersError;
  }

  // 모든 하위 폴더의 파일들도 복구
  const { error: filesError } = await supabase
    .from('files')
    .update({
      deleted_at: null,
    })
    .in('folder_id', allFolderIds)
    .not('deleted_at', 'is', null); // 삭제된 파일만 복구

  if (filesError) {
    console.error('Error restoring files in folder:', filesError);
    // 파일 복구 실패해도 폴더 복구는 완료된 상태이므로 에러를 던지지 않음
  }
}

/**
 * DB에서 폴더를 영구 삭제합니다 (실제 DELETE).
 * 폴더 내부의 모든 파일도 Storage와 DB에서 완전히 삭제됩니다.
 */
export async function permanentlyDeleteFolderInDB(id: string): Promise<void> {
  // 재귀적으로 하위 폴더 ID들을 가져오는 함수
  const getAllChildFolderIds = async (parentId: string): Promise<string[]> => {
    const { data: childFolders, error } = await supabase
      .from('folders')
      .select('id')
      .eq('parent_id', parentId);

    if (error) {
      console.error('Error fetching child folders:', error);
      return [];
    }

    const childIds = (childFolders || []).map(f => f.id);
    const allChildIds = [...childIds];

    // 재귀적으로 하위 폴더들의 ID도 가져오기
    for (const childId of childIds) {
      const nestedIds = await getAllChildFolderIds(childId);
      allChildIds.push(...nestedIds);
    }

    return allChildIds;
  };

  // 모든 폴더 ID (부모 + 모든 하위 폴더)
  const allFolderIds = [id, ...(await getAllChildFolderIds(id))];

  // 모든 폴더에 속한 파일들의 메타데이터 조회 (storage_path 포함)
  const { data: files, error: filesError } = await supabase
    .from('files')
    .select('id, storage_path')
    .in('folder_id', allFolderIds);

  if (filesError) {
    console.error('Error fetching files for deletion:', filesError);
    // 파일 조회 실패해도 폴더 삭제는 진행
  }

  // Storage에서 파일들 삭제
  if (files && files.length > 0) {
    const storagePaths = files.map(f => f.storage_path).filter(Boolean);
    
    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('files')
        .remove(storagePaths);

      if (storageError) {
        console.error('Error deleting files from storage:', storageError);
        // Storage 삭제 실패해도 DB 삭제는 진행
      }
    }

    // DB에서 파일들 삭제
    const { error: deleteFilesError } = await supabase
      .from('files')
      .delete()
      .in('folder_id', allFolderIds);

    if (deleteFilesError) {
      console.error('Error deleting files from DB:', deleteFilesError);
      // 파일 삭제 실패해도 폴더 삭제는 진행
    }
  }

  // DB에서 모든 하위 폴더 삭제
  if (allFolderIds.length > 1) {
    const childFolderIds = allFolderIds.slice(1); // 부모 폴더 제외
    const { error: childFoldersError } = await supabase
      .from('folders')
      .delete()
      .in('id', childFolderIds);

    if (childFoldersError) {
      console.error('Error deleting child folders:', childFoldersError);
      throw childFoldersError;
    }
  }

  // DB에서 부모 폴더 삭제
  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error permanently deleting folder:', error);
    throw error;
  }
}

/**
 * DB에서 삭제된 파일 목록을 조회합니다.
 */
export async function fetchDeletedFiles(userId: string): Promise<FolderNode[]> {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) {
    console.error('Error fetching deleted files:', error);
    throw error;
  }

  return (data || []).map(file => ({
    id: file.id,
    name: file.name,
    type: 'document' as const,
    parent_id: file.folder_id,
    created_at: file.created_at,
    updated_at: file.deleted_at, // 삭제 시간을 updated_at으로 표시
  }));
}

/**
 * DB에서 파일을 복구합니다 (deleted_at을 null로 설정).
 */
export async function restoreFileInDB(id: string): Promise<void> {
  const { error } = await supabase
    .from('files')
    .update({
      deleted_at: null,
    })
    .eq('id', id);

  if (error) {
    console.error('Error restoring file:', error);
    throw error;
  }
}

/**
 * DB에서 파일을 영구 삭제합니다 (실제 DELETE).
 */
export async function permanentlyDeleteFileInDB(id: string): Promise<void> {
  // 파일 메타데이터 조회 (Storage 경로 확인용)
  const { data: file, error: fetchError } = await supabase
    .from('files')
    .select('storage_path')
    .eq('id', id)
    .single();

  if (fetchError) {
    console.error('Error fetching file for permanent delete:', fetchError);
    throw fetchError;
  }

  // Storage에서 파일 삭제
  if (file?.storage_path) {
    const { error: storageError } = await supabase.storage
      .from('files')
      .remove([file.storage_path]);

    if (storageError) {
      console.error('Error deleting file from storage:', storageError);
      // Storage 삭제 실패해도 DB는 삭제 진행
    }
  }

  // DB에서 메타데이터 완전 삭제 (CASCADE로 관련 데이터도 함께 삭제됨)
  const { error: dbError } = await supabase
    .from('files')
    .delete()
    .eq('id', id);

  if (dbError) {
    console.error('Error permanently deleting file:', dbError);
    throw dbError;
  }
}

