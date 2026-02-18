"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Image from "next/image";
import {
  Plus, Upload, FolderPlus, File, Trash2, Sparkles, Eye, BookOpen,
  Grid, List, MoreVertical, Search, ArrowUpRight
} from "lucide-react";
import { useFolders, FolderNode } from "@/contexts/FolderContext";
import CreateFolderModal from "@/components/modals/CreateFolderModal";
import FolderSummaryModal from "@/components/modals/FolderSummaryModal";
import FolderQuestionsModal from "@/components/modals/FolderQuestionsModal";
import AuthGuard from "@/components/auth/AuthGuard";
import { uploadFile, fetchFiles, deleteFile, moveFile, FileMetadata } from "@/lib/files";
import { getCurrentUser } from "@/lib/auth";
import { fetchFolderSummary, summarizeFolderWithAI } from "@/lib/folderSummaries";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { folders, loading, error, findItemById, createFolder, refreshFolders } = useFolders();
  const [selectedItem, setSelectedItem] = useState<FolderNode | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [isFolderSummarizing, setIsFolderSummarizing] = useState(false);
  const [folderSummaryModalOpen, setFolderSummaryModalOpen] = useState(false);
  const [folderSummaryContent, setFolderSummaryContent] = useState<any>(null);
  const [folderSummaryUpdatedAt, setFolderSummaryUpdatedAt] = useState<string | null>(null);
  const [folderSummaryStats, setFolderSummaryStats] = useState<{ totalDocuments: number; includedDocuments: number; skippedDocuments: number } | null>(null);
  const [folderQuestionsModalOpen, setFolderQuestionsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [hasMounted, setHasMounted] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showExpandButton, setShowExpandButton] = useState(false);
  const dragDataRef = useRef<string | null>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Delay showing the expand button until sidebar transition is complete (200ms)
  useEffect(() => {
    if (isSidebarCollapsed) {
      const timer = setTimeout(() => setShowExpandButton(true), 200);
      return () => clearTimeout(timer);
    } else {
      setShowExpandButton(false);
    }
  }, [isSidebarCollapsed]);

  const currentFolderId = selectedItem?.id || "root";
  const currentFolderName = selectedItem?.name || "모든 문서";

  const loadExistingFolderSummary = async (): Promise<boolean> => {
    const existing = await fetchFolderSummary(currentFolderId);
    if (existing?.content) {
      setFolderSummaryContent(existing.content);
      setFolderSummaryUpdatedAt(existing.updated_at);
      setFolderSummaryStats({
        totalDocuments: existing.included_document_ids.length + existing.skipped_document_ids.length,
        includedDocuments: existing.included_document_ids.length,
        skippedDocuments: existing.skipped_document_ids.length,
      });
      return true;
    }
    return false;
  };

  const handleFolderSummarize = async () => {
    try {
      setIsFolderSummarizing(true);
      const { record, stats } = await summarizeFolderWithAI({
        folderId: currentFolderId,
        folderName: currentFolderName,
        folderNode: selectedItem?.type === "folder" ? selectedItem : null,
        fullTree: folders,
      });
      setFolderSummaryContent(record.content);
      setFolderSummaryUpdatedAt(record.updated_at);
      setFolderSummaryStats(stats);
      setFolderSummaryModalOpen(true);
    } catch (err: any) {
      console.error("폴더 전체 요약 실패:", err);
      alert(err.message || "폴더 전체 요약에 실패했습니다.");
    } finally {
      setIsFolderSummarizing(false);
    }
  };

  const handleFolderSummaryView = async () => {
    const ok = await loadExistingFolderSummary();
    if (!ok) alert("요약 내용이 없습니다. 먼저 분석을 진행해주세요.");
    else setFolderSummaryModalOpen(true);
  };

  const handleFolderQuestions = async () => {
    const ok = await loadExistingFolderSummary();
    if (!ok) alert("퀴즈를 생성하려면 먼저 폴더 분석을 완료해주세요.");
    setFolderQuestionsModalOpen(true);
  };

  const refreshFilesForCurrentFolder = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user) return;
    const folderId = selectedItem?.id || null;
    const folderFiles = await fetchFiles(user.id, folderId);
    setFiles(folderFiles);
  }, [selectedItem?.id]);

  const handleDropToFolder = useCallback(
    async (folderId: string | null, e?: React.DragEvent) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      const fileId = dragDataRef.current || e?.dataTransfer?.getData("text/plain");
      dragDataRef.current = null;
      if (!fileId) return;
      try {
        await moveFile(fileId, folderId);
        await refreshFolders();
        await refreshFilesForCurrentFolder();
      } catch (err: any) {
        alert(err?.message || "Move failed.");
      }
    },
    [refreshFolders, refreshFilesForCurrentFolder]
  );

  useEffect(() => {
    const folderId = searchParams.get('folder');
    if (folderId && !loading && folders.length > 0) {
      const folder = findItemById(folderId);
      if (folder && folder.type === 'folder') {
        setSelectedItem(folder);
      }
    } else if (!folderId) {
      setSelectedItem(null);
    }
  }, [searchParams, loading, folders, findItemById]);

  useEffect(() => {
    const loadFiles = async () => {
      if (selectedItem && selectedItem.type !== 'folder') {
        setFiles([]);
        return;
      }
      try {
        setFilesLoading(true);
        const user = await getCurrentUser();
        if (!user) return;
        const folderId = selectedItem?.id || null;
        const folderFiles = await fetchFiles(user.id, folderId);
        setFiles(folderFiles);
      } catch (err: any) {
        console.error("File load error:", err);
      } finally {
        setFilesLoading(false);
      }
    };
    loadFiles();
  }, [selectedItem]);

  const handleCreateFolder = async (name: string) => {
    try {
      await createFolder(name, selectedItem?.id || null);
      setShowCreateModal(false);
      await refreshFolders();
    } catch (err: any) {
      alert("폴더 생성 실패: " + err.message);
    }
  };

  const handleFileUpload = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.mp3,.wav,.m4a,.mp4";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const fileMetadata = await uploadFile(file, selectedItem?.id || null);
        await refreshFolders();
        const user = await getCurrentUser();
        if (user) {
          const folderFiles = await fetchFiles(user.id, selectedItem?.id || null);
          setFiles(folderFiles);
        }
        router.push(`/document/${fileMetadata.id}`);
      } catch (err: any) {
        alert("업로드 실패: " + err.message);
      }
    };
    input.click();
  };

  const handleSelectItem = (item: FolderNode) => {
    if (item.type === "document") {
      router.push(`/document/${item.id}`);
    } else {
      router.push(`/dashboard?folder=${item.id}`);
      setSelectedItem(item);
    }
  };

  // Helper to get items
  const folderTreeItems = selectedItem?.children ||
    (selectedItem === null ? folders.filter(f => f.parent_id == null || f.parent_id === "") : []);

  const subFolders = folderTreeItems.filter(item => item.type === 'folder');

  const subDocuments = folderTreeItems.filter(doc => doc.type === 'document').map(doc => {
    const fileMeta = files.find(f => f.id === doc.id);
    // fileMeta가 있을 때만 표시 (로딩 완료 후)
    return {
      ...doc,
      size: fileMeta?.size,
      mimeType: fileMeta?.type,
      _hasMetadata: !!fileMeta
    };
  });

  const hasItems = subFolders.length > 0 || subDocuments.length > 0;

  return (
    <div className={`flex h-screen overflow-hidden bg-[#F4F6F8] p-3 transition-all duration-500 ease-in-out ${isSidebarCollapsed ? 'gap-0' : 'gap-3'}`}>
      <Sidebar
        onSelectItem={handleSelectItem}
        selectedItemId={selectedItem?.id}
        isCollapsed={isSidebarCollapsed}
        toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <div className="flex-1 flex flex-col relative z-10 w-full overflow-hidden min-w-0">
        <Header
          title=""
          showSearch={true}
          isSidebarCollapsed={showExpandButton}
          onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        <main className="flex-1 overflow-hidden flex flex-col pb-0">
          {/* Main Glass Panel */}
          <div className="glass-panel w-full h-full rounded-[32px] overflow-hidden flex flex-col shadow-xl relative">
            <div className="absolute inset-0 bg-white/40 pointer-events-none" />

            {/* Toolbar / Header of the Panel */}
            <div className="px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-100 z-10">
              <div className="space-y-1">
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                  {currentFolderName}
                </h1>
                <p className="text-sm text-gray-500 font-medium">
                  폴더 {subFolders.length}개, 파일 {subDocuments.length}개
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                {/* AI Tools Group */}
                <div className="flex items-center gap-1 p-1.5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <button
                    onClick={handleFolderSummarize}
                    disabled={isFolderSummarizing}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 transition-all"
                    title="폴더 전체 내용 분석"
                  >
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    <span className="hidden lg:inline">{isFolderSummarizing ? "분석 중..." : "분석"}</span>
                  </button>
                  <button
                    onClick={() => setFolderQuestionsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all"
                    title="퀴즈 생성"
                  >
                    <BookOpen className="w-4 h-4 text-pink-500" />
                    <span className="hidden lg:inline">퀴즈</span>
                  </button>
                  <button
                    onClick={handleFolderSummaryView}
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-blue-500 hover:bg-blue-50 transition-all"
                    title="요약 보기"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>

                <div className="w-[1px] h-8 bg-gray-200 mx-1 hidden md:block"></div>

                {/* Main Actions */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleFileUpload}
                    className="glass-button bg-primary/80 hover:bg-primary border-primary/50 flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold shadow-lg shadow-primary/20"
                  >
                    <Upload className="w-4 h-4" />
                    <span>업로드</span>
                  </button>
                </div>

                {/* View Toggle */}
                <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-gray-100 shadow-sm hidden sm:flex">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 z-10 scrollbar-hide">
              {!hasMounted || loading || filesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : !hasItems ? (
                <div className="flex flex-col items-center justify-center h-full text-center pb-20 opacity-0 animate-in fade-in duration-700">
                  <div className="w-24 h-24 bg-gray-50 rounded-full border border-gray-100 flex items-center justify-center mb-6 shadow-sm">
                    <FolderPlus className="w-10 h-10 text-gray-300" />
                  </div>
                  <h3 className="text-xl font-medium text-gray-900 mb-2">이 폴더는 비어 있습니다</h3>
                  <p className="text-gray-500 max-w-xs mb-8">파일을 업로드하거나 새 폴더를 만들어보세요.</p>
                  <div className="flex gap-4">
                    <button onClick={handleFileUpload} className="px-6 py-2.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition-all font-medium">
                      파일 업로드
                    </button>
                  </div>
                </div>
              ) : (
                <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-7 gap-5" : "flex flex-col gap-3"}>
                  {/* 새 폴더 만들기 카드 */}
                  <div
                    onClick={() => setShowCreateModal(true)}
                    className={`
                      group relative glass-card border-2 border-dashed border-gray-300
                      rounded-2xl cursor-pointer !transition-none
                      hover:border-primary hover:bg-primary/5
                      ${viewMode === 'grid' ? 'p-5 flex flex-col aspect-[4/3] justify-center items-center' : 'p-3 flex items-center gap-4'}
                    `}
                  >
                    <div className={`rounded-xl bg-primary/10 flex items-center justify-center ${viewMode === 'grid' ? 'w-12 h-12 mb-3' : 'w-10 h-10'}`}>
                      <Plus className={`${viewMode === 'grid' ? 'w-6 h-6' : 'w-5 h-5'} text-primary`} />
                    </div>
                    <div className={viewMode === 'grid' ? 'text-center' : ''}>
                      <h3 className="font-semibold text-gray-700 group-hover:text-primary transition-colors">
                        새 폴더
                      </h3>
                      {viewMode === 'grid' && (
                        <p className="text-xs text-gray-500 mt-1">폴더 만들기</p>
                      )}
                    </div>
                  </div>

                  {/* Folders */}
                  {subFolders.map((child: any) => (
                    <div
                      key={child.id}
                      onClick={() => router.push(`/dashboard?folder=${child.id}`)}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                      onDrop={async (e) => await handleDropToFolder(child.id, e)}
                      className={`
                               group relative glass-card border-none overflow-hidden
                               rounded-2xl transition-all duration-300 cursor-pointer
                               ${viewMode === 'grid' ? 'flex flex-col aspect-[4/3] hover:-translate-y-1 hover:shadow-lg' : 'p-3 flex items-center gap-4 hover:bg-white'}
                            `}
                    >
                      {viewMode === 'grid' ? (
                        <>
                          {/* 상단 아이콘 영역 */}
                          <div className="flex-[3] flex items-center justify-center bg-white relative overflow-hidden">
                            <div className="relative w-full h-full flex items-center justify-center scale-[2.2]">
                              <Image
                                src={child.children && child.children.length > 0 
                                  ? "/assets/icons/글래스모피즘_찬폴더.png" 
                                  : "/assets/icons/글래스모피즘_빈폴더.png"}
                                alt="Folder"
                                layout="fill"
                                objectFit="cover"
                                className="drop-shadow-lg"
                                priority={subFolders.indexOf(child) < 6}
                              />
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); }}
                              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/80 rounded-lg text-gray-400 hover:text-gray-900 transition-all z-20"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                          {/* 구분선 */}
                          <div className="h-px bg-gray-100"></div>
                          {/* 하단 텍스트 영역 */}
                          <div className="px-4 py-3 bg-white/40 backdrop-blur-sm">
                            <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-primary transition-colors">
                              {child.name}
                            </h3>
                            <p className="text-[10px] text-gray-500 mt-0.5 font-medium">
                              {child.created_at ? new Date(child.created_at).toISOString().split('T')[0] : ''}
                            </p>
                          </div>
                          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity pointer-events-none" />
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 flex items-center justify-center shrink-0">
                            <Image
                              src={child.children && child.children.length > 0 
                                ? "/assets/icons/글래스모피즘_찬폴더.png" 
                                : "/assets/icons/글래스모피즘_빈폴더.png"}
                              alt="Folder"
                              width={44}
                              height={44}
                              className="object-contain drop-shadow-sm"
                            />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 truncate group-hover:text-primary transition-colors">{child.name}</h3>
                            <p className="text-xs text-gray-500 mt-1">
                              {child.created_at ? new Date(child.created_at).toISOString().split('T')[0] : ''}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Files */}
                  {subDocuments.map((doc) => {
                    const fileMeta = files.find(f => f.id === doc.id);
                    const isLoading = !fileMeta || filesLoading;
                    const isPdfWithThumbnail = !isLoading && doc.mimeType === "pdf" && fileMeta?.thumbnail_url;
                    
                    return (
                      <div
                        key={doc.id}
                        onClick={() => router.push(`/document/${doc.id}`)}
                        draggable
                        onDragStart={(e) => {
                          dragDataRef.current = doc.id;
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", doc.id);
                        }}
                        className={`
                                 group relative glass-card border-none overflow-hidden
                                 rounded-2xl transition-all duration-300 cursor-pointer
                                 ${viewMode === 'grid' ? 'flex flex-col aspect-[4/3] hover:-translate-y-1 hover:shadow-lg' : 'p-3 flex items-center gap-4 hover:bg-white'}
                              `}
                      >
                        {viewMode === 'grid' ? (
                          <>
                            {/* 상단 아이콘 영역 */}
                            <div className="flex-[3] flex items-center justify-center relative overflow-hidden bg-white">
                              {!isLoading && (
                                <div className="relative w-full h-full flex items-center justify-center">
                                  <Image
                                    src={
                                      isPdfWithThumbnail
                                        ? fileMeta.thumbnail_url!
                                        : fileMeta?.type === "pdf"
                                        ? "/assets/icons/pdf-glass.png"
                                        : "/assets/icons/audio-glass.png"
                                    }
                                    alt={fileMeta?.type || "file"}
                                    fill
                                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                    style={{
                                      objectFit: isPdfWithThumbnail ? "contain" : "cover",
                                    }}
                                    className={isPdfWithThumbnail ? "p-2 scale-150" : "drop-shadow-lg scale-[2]"}
                                    unoptimized={!!isPdfWithThumbnail}
                                    priority={subDocuments.indexOf(doc) < 4}
                                  />
                                </div>
                              )}
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm("이 파일을 삭제하시겠습니까?")) {
                                    await deleteFile(doc.id);
                                    await refreshFolders();
                                  }
                                }}
                                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/80 rounded-lg text-gray-400 hover:text-red-500 transition-all z-20"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            {/* 구분선 */}
                            <div className="h-px bg-gray-100"></div>
                            {/* 하단 텍스트 영역 */}
                            <div className="px-4 py-3 bg-white/40 backdrop-blur-sm">
                              <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-primary transition-colors">
                                {doc.name}
                              </h3>
                              <div className="flex items-center mt-0.5 gap-1.5">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${fileMeta?.type === "pdf" ? "text-red-500/80" : "text-blue-500/80"
                                  }`}>
                                  {fileMeta?.type === "pdf" ? "PDF" : "AUDIO"}
                                </span>
                                {fileMeta?.created_at && (
                                  <>
                                    <span className="text-[10px] text-gray-300">•</span>
                                    <span className="text-[10px] text-gray-500">
                                      {new Date(fileMeta.created_at).toISOString().split('T')[0]}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 text-primary">
                              <ArrowUpRight className="w-4 h-4" />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-12 h-12 flex items-center justify-center shrink-0 relative">
                              {!isLoading && (
                                <Image
                                  src={
                                    isPdfWithThumbnail
                                      ? fileMeta.thumbnail_url!
                                      : fileMeta?.type === "pdf"
                                      ? "/assets/icons/pdf-glass.png"
                                      : "/assets/icons/audio-glass.png"
                                  }
                                  alt={fileMeta?.type || "file"}
                                  fill
                                  className="object-contain drop-shadow-sm p-1"
                                />
                              )}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 truncate group-hover:text-primary transition-colors">{doc.name}</h3>
                              <div className="flex items-center mt-1 gap-2">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  {fileMeta?.type === "pdf" ? "PDF" : "AUDIO"}
                                </span>
                                {fileMeta?.created_at && (
                                  <>
                                    <span className="text-xs text-gray-400">•</span>
                                    <span className="text-xs text-gray-500">
                                      {new Date(fileMeta.created_at).toISOString().split('T')[0]}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (confirm("이 파일을 삭제하시겠습니까?")) {
                                  await deleteFile(doc.id);
                                  await refreshFolders();
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <CreateFolderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateFolder}
        parentId={selectedItem?.id}
      />

      <FolderSummaryModal
        isOpen={folderSummaryModalOpen}
        onClose={() => setFolderSummaryModalOpen(false)}
        title={`${currentFolderName} · 분석 결과`}
        summaryContent={folderSummaryContent}
        stats={folderSummaryStats || undefined}
        updatedAt={folderSummaryUpdatedAt || undefined}
      />

      <FolderQuestionsModal
        isOpen={folderQuestionsModalOpen}
        onClose={() => setFolderQuestionsModalOpen(false)}
        folderId={currentFolderId}
        folderName={currentFolderName}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <Suspense fallback={
        <div className="h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-500 font-medium">워크스페이스 로딩 중...</p>
          </div>
        </div>
      }>
        <DashboardContent />
      </Suspense>
    </AuthGuard>
  );
}
