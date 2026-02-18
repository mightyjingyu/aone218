import { supabase } from './supabase';
import { getCurrentUser } from './auth';
import { generatePdfThumbnail, blobToFile } from './pdfThumbnail';

export interface FileMetadata {
  id: string;
  folder_id: string;
  type: 'pdf' | 'audio';
  storage_path: string;
  name: string;
  size?: number;
  duration?: number;
  page_count?: number;
  user_id: string;
  created_at: string;
  deleted_at?: string | null;
  thumbnail_path?: string | null;
  thumbnail_url?: string | null; // Signed URL for thumbnail
}

/**
 * 파일을 Supabase Storage에 업로드합니다.
 */
export async function uploadFileToStorage(
  file: File,
  userId: string,
  folderId: string | null
): Promise<string> {
  // 파일 타입 확인
  const fileType = file.type;
  let type: 'pdf' | 'audio';
  let bucketName: string;

  if (fileType === 'application/pdf') {
    type = 'pdf';
    bucketName = 'files';
  } else if (fileType.startsWith('audio/')) {
    type = 'audio';
    bucketName = 'files';
  } else {
    throw new Error('지원하지 않는 파일 형식입니다. PDF 또는 오디오 파일만 업로드 가능합니다.');
  }

  // 파일명 생성 (중복 방지: userId/timestamp-filename)
  const timestamp = Date.now();
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `${userId}/${folderId || 'root'}/${timestamp}-${sanitizedFileName}`;

  // Storage에 업로드
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Error uploading file to storage:', error);
    throw new Error(`파일 업로드 실패: ${error.message}`);
  }

  return storagePath;
}

/**
 * 썸네일 이미지를 Supabase Storage에 업로드합니다.
 */
export async function uploadThumbnailToStorage(
  thumbnailBlob: Blob,
  userId: string,
  folderId: string | null,
  originalFileName: string
): Promise<string> {
  const timestamp = Date.now();
  const sanitizedFileName = originalFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  // PNG 파일로 저장
  const thumbnailPath = `${userId}/${folderId || 'root'}/thumbnails/${timestamp}-${sanitizedFileName}_thumb.png`;

  // Blob을 File 객체로 변환
  const thumbnailFile = new File([thumbnailBlob], `${sanitizedFileName}_thumb.png`, {
    type: 'image/png',
  });

  const { data, error } = await supabase.storage
    .from('files')
    .upload(thumbnailPath, thumbnailFile, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Error uploading thumbnail:', error);
    throw new Error(`썸네일 업로드 실패: ${error.message}`);
  }

  return thumbnailPath;
}

/**
 * 파일 메타데이터를 DB에 저장합니다.
 */
export async function saveFileMetadata(
  file: File,
  storagePath: string,
  folderId: string | null,
  userId: string,
  additionalMetadata?: {
    duration?: number;
    page_count?: number;
    thumbnail_path?: string;
  }
): Promise<FileMetadata> {
  // 파일 타입 확인
  const fileType = file.type;
  let type: 'pdf' | 'audio';

  if (fileType === 'application/pdf') {
    type = 'pdf';
  } else if (fileType.startsWith('audio/')) {
    type = 'audio';
  } else {
    throw new Error('지원하지 않는 파일 형식입니다.');
  }

  // 파일명에서 확장자 제거
  const fileName = file.name.replace(/\.[^/.]+$/, '');

  const { data, error } = await supabase
    .from('files')
    .insert({
      folder_id: folderId,
      type: type,
      storage_path: storagePath,
      name: fileName,
      size: file.size,
      duration: additionalMetadata?.duration,
      page_count: additionalMetadata?.page_count,
      thumbnail_path: additionalMetadata?.thumbnail_path,
      user_id: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving file metadata:', error);
    throw new Error(`파일 메타데이터 저장 실패: ${error.message}`);
  }

  return data;
}

/**
 * 파일 업로드 (Storage + DB 저장)
 */
export async function uploadFile(
  file: File,
  folderId: string | null
): Promise<FileMetadata> {
  // 현재 사용자 확인
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('로그인이 필요합니다.');
  }

  // Storage에 업로드
  const storagePath = await uploadFileToStorage(file, user.id, folderId);

  // PDF인 경우 썸네일 생성 및 업로드
  let thumbnailPath: string | undefined;
  if (file.type === 'application/pdf') {
    try {
      const thumbnailBlob = await generatePdfThumbnail(file);
      thumbnailPath = await uploadThumbnailToStorage(
        thumbnailBlob,
        user.id,
        folderId,
        file.name
      );
      console.log('PDF 썸네일 생성 완료:', thumbnailPath);
    } catch (error) {
      console.error('PDF 썸네일 생성 실패 (파일 업로드는 계속 진행):', error);
      // 썸네일 생성 실패해도 파일 업로드는 계속 진행
    }
  }

  // DB에 메타데이터 저장
  const fileMetadata = await saveFileMetadata(file, storagePath, folderId, user.id, {
    thumbnail_path: thumbnailPath,
  });

  return fileMetadata;
}

/**
 * 파일 목록을 조회합니다 (삭제되지 않은 파일만).
 */
export async function fetchFiles(userId: string, folderId?: string | null): Promise<FileMetadata[]> {
  let query = supabase
    .from('files')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null) // 삭제되지 않은 파일만 조회
    .order('created_at', { ascending: false });

  if (folderId !== undefined) {
    if (folderId === null) {
      query = query.is('folder_id', null);
    } else {
      query = query.eq('folder_id', folderId);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching files:', error);
    throw error;
  }

  // 썸네일이 있는 파일들에 대해 signed URL 생성
  const filesWithThumbnails = await Promise.all(
    (data || []).map(async (file) => {
      if (file.thumbnail_path) {
        try {
          const { data: signedData } = await supabase.storage
            .from('files')
            .createSignedUrl(file.thumbnail_path, 86400); // 24시간 유효
          
          return {
            ...file,
            thumbnail_url: signedData?.signedUrl || null,
          };
        } catch (err) {
          console.error('Error creating signed URL for thumbnail:', err);
          return { ...file, thumbnail_url: null };
        }
      }
      return file;
    })
  );

  return filesWithThumbnails;
}

/**
 * 파일을 소프트 삭제합니다 (휴지통으로 이동).
 * Storage 파일은 유지하고 DB에서만 deleted_at을 설정합니다.
 */
export async function deleteFile(fileId: string): Promise<void> {
  // 현재 사용자 확인
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('로그인이 필요합니다.');
  }

  // 파일 메타데이터 조회
  const { data: file, error: fetchError } = await supabase
    .from('files')
    .select('user_id, deleted_at')
    .eq('id', fileId)
    .single();

  if (fetchError || !file) {
    throw new Error('파일을 찾을 수 없습니다.');
  }

  // 권한 확인
  if (file.user_id !== user.id) {
    throw new Error('파일을 삭제할 권한이 없습니다.');
  }

  // 이미 삭제된 파일인지 확인
  if (file.deleted_at) {
    throw new Error('이미 삭제된 파일입니다.');
  }

  // DB에서 소프트 삭제 (deleted_at 설정)
  const { error: dbError } = await supabase
    .from('files')
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq('id', fileId);

  if (dbError) {
    console.error('Error deleting file metadata:', dbError);
    throw new Error(`파일 삭제 실패: ${dbError.message}`);
  }
}

/**
 * 파일을 복구합니다 (deleted_at을 null로 설정).
 */
export async function restoreFile(fileId: string): Promise<void> {
  // 현재 사용자 확인
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('로그인이 필요합니다.');
  }

  // 파일 메타데이터 조회
  const { data: file, error: fetchError } = await supabase
    .from('files')
    .select('user_id, deleted_at')
    .eq('id', fileId)
    .single();

  if (fetchError || !file) {
    throw new Error('파일을 찾을 수 없습니다.');
  }

  // 권한 확인
  if (file.user_id !== user.id) {
    throw new Error('파일을 복구할 권한이 없습니다.');
  }

  // 삭제되지 않은 파일인지 확인
  if (!file.deleted_at) {
    throw new Error('삭제되지 않은 파일입니다.');
  }

  // DB에서 복구 (deleted_at을 null로 설정)
  const { error: dbError } = await supabase
    .from('files')
    .update({
      deleted_at: null,
    })
    .eq('id', fileId);

  if (dbError) {
    console.error('Error restoring file:', dbError);
    throw new Error(`파일 복구 실패: ${dbError.message}`);
  }
}

/**
 * 파일을 영구 삭제합니다 (Storage + DB 완전 삭제).
 */
export async function permanentlyDeleteFile(fileId: string): Promise<void> {
  // 현재 사용자 확인
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('로그인이 필요합니다.');
  }

  // 파일 메타데이터 조회
  const { data: file, error: fetchError } = await supabase
    .from('files')
    .select('storage_path, user_id')
    .eq('id', fileId)
    .single();

  if (fetchError || !file) {
    throw new Error('파일을 찾을 수 없습니다.');
  }

  // 권한 확인
  if (file.user_id !== user.id) {
    throw new Error('파일을 삭제할 권한이 없습니다.');
  }

  // Storage에서 파일 삭제
  const { error: storageError } = await supabase.storage
    .from('files')
    .remove([file.storage_path]);

  if (storageError) {
    console.error('Error deleting file from storage:', storageError);
    // Storage 삭제 실패해도 DB는 삭제 진행
  }

  // DB에서 메타데이터 완전 삭제 (CASCADE로 관련 데이터도 함께 삭제됨)
  const { error: dbError } = await supabase
    .from('files')
    .delete()
    .eq('id', fileId);

  if (dbError) {
    console.error('Error permanently deleting file metadata:', dbError);
    throw new Error(`파일 영구 삭제 실패: ${dbError.message}`);
  }
}

/**
 * Storage에서 파일 URL을 가져옵니다.
 */
export async function getFileUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('files')
    .createSignedUrl(storagePath, 3600); // 1시간 유효

  if (error) {
    console.error('Error creating signed URL:', error);
    throw new Error(`파일 URL 생성 실패: ${error.message}`);
  }

  if (!data) {
    throw new Error('파일 URL을 생성할 수 없습니다.');
  }

  return data.signedUrl;
}


/**
 * 삭제된 파일 목록을 조회합니다.
 */
export async function fetchDeletedFiles(userId: string): Promise<FileMetadata[]> {
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

  return data || [];
}

/**
 * 파일을 다른 폴더로 이동합니다.
 */
export async function moveFile(fileId: string, targetFolderId: string | null): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const { data: file, error: fetchError } = await supabase
    .from('files')
    .select('user_id')
    .eq('id', fileId)
    .single();

  if (fetchError || !file) {
    throw new Error('파일을 찾을 수 없습니다.');
  }
  if (file.user_id !== user.id) {
    throw new Error('권한이 없습니다.');
  }

  const { error: updateError } = await supabase
    .from('files')
    .update({ folder_id: targetFolderId })
    .eq('id', fileId);

  if (updateError) {
    console.error('Error moving file:', updateError);
    throw new Error(`파일 이동 실패: ${updateError.message}`);
  }
}

