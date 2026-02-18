"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import AuthGuard from "@/components/auth/AuthGuard";
import { useFolders, FolderNode } from "@/contexts/FolderContext";
import { Trash2, RotateCcw, X, Folder, File, ChevronRight, ChevronDown } from "lucide-react";

function TrashContent() {
  const router = useRouter();
  const { 
    getDeletedFolders, 
    restoreFolder, 
    permanentlyDeleteFolder,
    restoreFile,
    permanentlyDeleteFile,
    loading: contextLoading 
  } = useFolders();
  const [deletedFolders, setDeletedFolders] = useState<FolderNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    // FolderContext의 로딩이 완료된 후에만 데이터 로드
    if (!contextLoading) {
      loadDeletedFolders();
    }
  }, [contextLoading]);

  const loadDeletedFolders = async () => {
    try {
      setLoading(true);
      setError(null);
      const folders = await getDeletedFolders();
      setDeletedFolders(folders);
    } catch (err: any) {
      console.error("Error loading deleted folders:", err);
      setError(err.message || "삭제된 폴더를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (item: FolderNode) => {
    try {
      if (item.type === 'folder') {
        await restoreFolder(item.id);
      } else {
        await restoreFile(item.id);
      }
      await loadDeletedFolders();
      setSelectedItems(new Set());
    } catch (err: any) {
      alert("복구에 실패했습니다: " + err.message);
    }
  };

  const handlePermanentlyDelete = async (item: FolderNode) => {
    if (!confirm("정말 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
      return;
    }

    try {
      if (item.type === 'folder') {
        await permanentlyDeleteFolder(item.id);
      } else {
        await permanentlyDeleteFile(item.id);
      }
      await loadDeletedFolders();
      setSelectedItems(new Set());
    } catch (err: any) {
      alert("영구 삭제에 실패했습니다: " + err.message);
    }
  };

  // 모든 항목 ID 수집 (재귀적으로)
  const getAllItemIds = (items: FolderNode[]): string[] => {
    const ids: string[] = [];
    items.forEach(item => {
      ids.push(item.id);
      if (item.children && item.children.length > 0) {
        ids.push(...getAllItemIds(item.children));
      }
    });
    return ids;
  };

  const handleSelectAll = () => {
    const allIds = getAllItemIds(deletedFolders);
    if (selectedItems.size === allIds.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(allIds));
    }
  };

  // 선택된 항목들의 타입 확인
  const getItemById = (id: string): FolderNode | null => {
    const findInTree = (items: FolderNode[]): FolderNode | null => {
      for (const item of items) {
        if (item.id === id) return item;
        if (item.children) {
          const found = findInTree(item.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findInTree(deletedFolders);
  };

  const handleBulkRestore = async () => {
    if (selectedItems.size === 0) return;

    try {
      await Promise.all(
        Array.from(selectedItems).map(id => {
          const item = getItemById(id);
          if (!item) return Promise.resolve();
          return item.type === 'folder' ? restoreFolder(id) : restoreFile(id);
        })
      );
      await loadDeletedFolders();
      setSelectedItems(new Set());
    } catch (err: any) {
      alert("복구에 실패했습니다: " + err.message);
    }
  };

  const handleBulkPermanentlyDelete = async () => {
    if (selectedItems.size === 0) return;

    if (!confirm(`선택한 ${selectedItems.size}개 항목을 정말 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      await Promise.all(
        Array.from(selectedItems).map(id => {
          const item = getItemById(id);
          if (!item) return Promise.resolve();
          return item.type === 'folder' 
            ? permanentlyDeleteFolder(id) 
            : permanentlyDeleteFile(id);
        })
      );
      await loadDeletedFolders();
      setSelectedItems(new Set());
    } catch (err: any) {
      alert("영구 삭제에 실패했습니다: " + err.message);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  // 모든 항목 개수 계산 (재귀적으로)
  const countAllItems = (items: FolderNode[]): number => {
    let count = items.length;
    items.forEach(item => {
      if (item.children && item.children.length > 0) {
        count += countAllItems(item.children);
      }
    });
    return count;
  };

  // 트리 구조로 항목 렌더링
  const renderTrashItem = (item: FolderNode, level: number = 0): JSX.Element => {
    const isExpanded = expandedFolders.has(item.id);
    const hasChildren = item.children && item.children.length > 0;
    const isSelected = selectedItems.has(item.id);

    return (
      <div key={item.id} className="relative">
        <div
          className={`
            bg-surface rounded-xl border border-border p-4 hover:border-primary/50 transition-all mb-2
            ${isSelected ? 'ring-2 ring-primary' : ''}
          `}
          style={{ marginLeft: `${level * 24}px` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelect(item.id)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 text-primary border-border rounded focus:ring-primary bg-background"
              />
              
              {item.type === 'folder' ? (
                <>
                  <button
                    onClick={() => toggleFolder(item.id)}
                    className="p-0.5 hover:bg-white/10 rounded flex-shrink-0"
                  >
                    {hasChildren ? (
                      isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )
                    ) : (
                      <div className="w-4 h-4" />
                    )}
                  </button>
                  <Folder className="w-5 h-5 text-[#fbc02d]" />
                </>
              ) : (
                <>
                  <div className="w-5 flex-shrink-0" />
                  <File className="w-5 h-5 text-primary" />
                </>
              )}
              
              <div className="flex-1">
                <h3 className="font-medium text-white">{item.name}</h3>
                <p className="text-sm text-gray-500">
                  {item.type === 'folder' ? '폴더' : '문서'}
                  {item.updated_at && ` • 삭제됨: ${new Date(item.updated_at).toLocaleString('ko-KR')}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRestore(item)}
                className="px-3 py-2 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                복구
              </button>
              <button
                onClick={() => handlePermanentlyDelete(item)}
                className="px-3 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                영구 삭제
              </button>
            </div>
          </div>
        </div>

        {/* 하위 항목들 렌더링 */}
        {item.type === 'folder' && isExpanded && hasChildren && (
          <div>
            {item.children!.map(child => renderTrashItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const handleSelectItem = (item: FolderNode) => {
    if (item.type === "document") {
      // 문서 클릭 시 상세 페이지로 이동
      router.push(`/document/${item.id}`);
    } else {
      // 폴더 클릭 시 대시보드로 이동 (폴더 선택 상태로)
      router.push(`/dashboard?folder=${item.id}`);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        onSelectItem={handleSelectItem}
        selectedItemId={undefined}
        isCollapsed={isCollapsed}
        toggleSidebar={() => setIsCollapsed((c) => !c)}
      />

      <div className="flex-1 flex flex-col">
        <Header title="휴지통" showSearch={false} />

        <main className="flex-1 overflow-auto bg-background p-8">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-500">로딩 중...</p>
              </div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-red-400 mb-4">{error}</p>
                <button
                  onClick={loadDeletedFolders}
                  className="px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90"
                >
                  다시 시도
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 헤더 */}
              <div className="bg-surface rounded-3xl border border-border p-6 mb-6 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
                      <Trash2 className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">휴지통</h2>
                      <p className="text-gray-400 text-sm">
                        {countAllItems(deletedFolders)}개의 삭제된 항목
                      </p>
                    </div>
                  </div>

                  {deletedFolders.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSelectAll}
                        className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-white/5 text-gray-400"
                      >
                        {selectedItems.size === getAllItemIds(deletedFolders).length ? "전체 해제" : "전체 선택"}
                      </button>
                      {selectedItems.size > 0 && (
                        <>
                          <button
                            onClick={handleBulkRestore}
                            className="px-4 py-2 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 flex items-center gap-2"
                          >
                            <RotateCcw className="w-4 h-4" />
                            복구 ({selectedItems.size})
                          </button>
                          <button
                            onClick={handleBulkPermanentlyDelete}
                            className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center gap-2"
                          >
                            <X className="w-4 h-4" />
                            영구 삭제 ({selectedItems.size})
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 삭제된 항목 목록 (트리 구조) */}
              {deletedFolders.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                  <Trash2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">휴지통이 비어있습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {deletedFolders.map((item) => renderTrashItem(item, 0))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function TrashPage() {
  return (
    <AuthGuard>
      <TrashContent />
    </AuthGuard>
  );
}

