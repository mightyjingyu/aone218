"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  ChevronRight,
  ChevronLeft,
  Folder,
  FolderOpen,
  File,
  Plus,
  MoreHorizontal,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";
import { useFolders, FolderNode } from "@/contexts/FolderContext";
import CreateFolderModal from "@/components/modals/CreateFolderModal";
import ConfirmDeleteModal from "@/components/modals/ConfirmDeleteModal";
import FolderMenu from "@/components/layout/FolderMenu";

interface SidebarProps {
  onSelectItem: (item: FolderNode) => void;
  selectedItemId?: string;
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

export default function Sidebar({ onSelectItem, selectedItemId, isCollapsed, toggleSidebar }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { folders, createFolder, deleteFolder, updateFolder, createDocument, deleteDocument, updateDocument, moveItem, moveItemBefore } = useFolders();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [menuState, setMenuState] = useState<{
    item: FolderNode | null;
    position: { x: number; y: number };
  } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalParentId, setCreateModalParentId] = useState<string | null | undefined>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<FolderNode | null>(null);
  const [editingItem, setEditingItem] = useState<FolderNode | null>(null);
  const [editName, setEditName] = useState("");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [isDocumentsExpanded, setIsDocumentsExpanded] = useState(true);

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

  const handleCreateFolder = (parentId?: string | null) => {
    setCreateModalParentId(parentId);
    setShowCreateModal(true);
  };

  const handleCreateFolderSubmit = async (name: string) => {
    try {
      await createFolder(name, createModalParentId);
      setShowCreateModal(false);
      setCreateModalParentId(null);
    } catch (err: any) {
      console.error("폴더 생성 실패:", err);
      alert("폴더 생성에 실패했습니다: " + err.message);
    }
  };

  const handleMenuClick = (e: React.MouseEvent, item: FolderNode) => {
    e.stopPropagation();
    setMenuState({
      item,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const handleEdit = (item: FolderNode) => {
    setEditingItem(item);
    setEditName(item.name);
  };

  const handleEditSubmit = async () => {
    if (editingItem && editName.trim()) {
      try {
        if (editingItem.type === "folder") {
          await updateFolder(editingItem.id, editName.trim());
        } else {
          await updateDocument(editingItem.id, editName.trim());
        }
        setEditingItem(null);
        setEditName("");
      } catch (err: any) {
        console.error("이름 변경 실패:", err);
        alert("이름 변경에 실패했습니다: " + err.message);
      }
    }
  };

  const handleDelete = (item: FolderNode) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (itemToDelete) {
      try {
        if (itemToDelete.type === "folder") {
          await deleteFolder(itemToDelete.id);
        } else {
          await deleteDocument(itemToDelete.id);
        }
        if (selectedItemId === itemToDelete.id) {
          onSelectItem({} as FolderNode);
        }
        setItemToDelete(null);
        setShowDeleteModal(false);
      } catch (err: any) {
        console.error("삭제 실패:", err);
        alert("삭제에 실패했습니다: " + err.message);
      }
    }
  };

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    if (draggedItemId && draggedItemId !== itemId) setDragOverItemId(itemId);
  };
  const handleDragLeave = () => setDragOverItemId(null);
  const handleDrop = async (e: React.DragEvent, targetItemId: string) => {
    e.preventDefault();
    if (!draggedItemId || draggedItemId === targetItemId) return;
    try {
      await moveItemBefore(draggedItemId, targetItemId);
    } catch (err: any) { alert(err.message); }
    setDraggedItemId(null);
    setDragOverItemId(null);
  };

  const renderFolderTree = (items: FolderNode[], level = 0) => {
    const sortedItems = [...items].sort((a, b) => {
      if (a.type === "folder" && b.type === "document") return -1;
      if (a.type === "document" && b.type === "folder") return 1;
      return a.name.localeCompare(b.name);
    });

    return sortedItems.map((item) => {
      const isExpanded = expandedFolders.has(item.id);
      const isSelected = selectedItemId === item.id;
      const isHovered = hoveredItemId === item.id;
      const hasChildren = item.children && item.children.length > 0;
      const isDragging = draggedItemId === item.id;
      const isDragOver = dragOverItemId === item.id;

      return (
        <div key={item.id} className="relative select-none">
          <div
            draggable
            onDragStart={(e) => handleDragStart(e, item.id)}
            onDragOver={(e) => handleDragOver(e, item.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, item.id)}
            className={`
              relative flex items-center justify-between px-2 py-1.5 mb-0.5 rounded-lg cursor-pointer transition-all duration-200
              ${isSelected ? "bg-primary/10 text-primary shadow-sm" : "text-gray-500 hover:bg-black/5 hover:text-gray-900"}
              ${isDragging ? "opacity-40" : ""}
              ${isDragOver ? "ring-1 ring-primary/50 bg-primary/5" : ""}
            `}
            style={{ paddingLeft: `${8 + level * 16}px` }}
            onClick={() => {
              onSelectItem(item);
              if (item.type === "folder") toggleFolder(item.id);
            }}
            onMouseEnter={() => setHoveredItemId(item.id)}
            onMouseLeave={() => setHoveredItemId(null)}
          >
            <div className={`flex items-center gap-2.5 flex-1 min-w-0`}>
              {item.type === "folder" ? (
                <div className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}>
                  <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                </div>
              ) : <div className="w-3.5" />}

              <div className={`transition-colors duration-200 ${isSelected ? "text-primary scale-110" : "text-gray-400 group-hover:text-gray-500"}`} title={item.name}>
                {item.type === "folder" ? (
                  isExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />
                ) : (
                  <File className="w-4 h-4" />
                )}
              </div>

              {editingItem?.id === item.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleEditSubmit}
                  onKeyDown={(e) => e.key === "Enter" && handleEditSubmit()}
                  className="bg-transparent border-b border-primary text-sm text-gray-900 focus:outline-none w-full"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className={`text-[13px] font-medium truncate leading-none pt-0.5 ${isSelected ? 'text-primary font-semibold' : ''}`}>
                  {item.name}
                </span>
              )}
            </div>

            {isHovered && !editingItem && (
              <button
                onClick={(e) => handleMenuClick(e, item)}
                className="opacity-0 group-hover:opacity-100 hover:bg-black/5 p-1 rounded transition-all"
              >
                <MoreHorizontal className="w-3.5 h-3.5 text-gray-400" />
              </button>
            )}
          </div>

          {item.type === "folder" && isExpanded && hasChildren && (
            <div className="relative">
              <div className="absolute left-[15px] top-0 bottom-0 w-[1px] bg-black/5" style={{ left: `${15 + level * 16}px` }}></div>
              {renderFolderTree(item.children!, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  // IF COLLAPSED: Render ONLY the toggle button absolutely positioned at top-left.
  // We keep a small width (w-[60px]) to reserve space so the Header Search Bar doesn't overlap.
  // IF COLLAPSED: Render nothing (or minimal hidden state). 
  // The expand button is now handled in the Header component.
  // Render sidebar with smooth transition
  // Render sidebar with smooth transition
  return (
    <div
      className={`hidden md:flex flex-col h-full glass-panel rounded-3xl z-50 transition-all duration-500 ease-in-out relative group overflow-hidden min-w-0 ${isCollapsed ? "!w-0 !p-0 !border-0 !m-0 shadow-none bg-transparent" : "w-[280px]"
        }`}
    >
      {/* Fixed width container to prevent content squishing during transition */}
      <div className="min-w-[280px] h-full flex flex-col">
        {/* Brand Header */}
        <div className="flex items-center justify-between p-6 pb-4 relative group/header">
          <button
            onClick={() => { window.location.href = '/dashboard'; }}
            className="flex items-center gap-3 hover:bg-black/5 rounded-2xl px-2 py-1 transition-colors text-left"
          >
            <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="text-white font-bold text-2xl italic">A</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">
              Aone
            </span>
          </button>

          <button
            onClick={toggleSidebar}
            className="opacity-0 group-hover/header:opacity-100 absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/50 hover:bg-white rounded-full text-gray-400 hover:text-gray-900 transition-all shadow-sm border border-transparent hover:border-gray-100"
            title="사이드바 접기"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="h-[1px] bg-gray-200/80 mx-5 mb-4" />

        {/* Navigation Tree */}
        <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-hide w-full">
          {/* 최상위 "문서" 노드 */}
          <div className="relative select-none">
            <div
              className={`
                relative flex items-center justify-between px-2 py-1.5 mb-0.5 rounded-lg cursor-pointer transition-all duration-200
                ${!selectedItemId ? "bg-primary/10 text-primary shadow-sm" : "text-gray-700 hover:bg-black/5 hover:text-gray-900"}
              `}
              style={{ paddingLeft: '8px' }}
              onClick={() => {
                router.push('/dashboard');
                setIsDocumentsExpanded(!isDocumentsExpanded);
              }}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className={`transition-transform duration-200 ${isDocumentsExpanded ? "rotate-90" : ""}`}>
                  <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                </div>

                <div className={`transition-colors duration-200 ${!selectedItemId ? "text-primary" : "text-gray-400"}`} title="문서">
                  {isDocumentsExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                </div>

                <span className={`text-[13px] font-semibold truncate leading-none pt-0.5 ${!selectedItemId ? 'text-primary' : ''}`}>
                  문서
                </span>
              </div>
            </div>

            {/* 자식 폴더들 */}
            {isDocumentsExpanded && (
              <div className="relative">
                <div className="absolute left-[15px] top-0 bottom-0 w-[1px] bg-black/5"></div>
                {renderFolderTree(folders, 1)}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 bg-gradient-to-t from-white/50 to-transparent space-y-3">
          <button
            onClick={() => handleCreateFolder(null)}
            className="glass-button flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-gray-600 hover:text-gray-900 group"
            title="새 폴더"
          >
            <div className="flex items-center justify-center transition-colors w-8 h-8 rounded-lg bg-primary/10">
              <Plus className="w-4 h-4 text-primary transition-colors" />
            </div>
            <span className="text-sm font-medium">새 폴더</span>
          </button>

          <button
            onClick={() => router.push("/trash")}
            className={`glass-button flex items-center gap-3 w-full px-3 py-2.5 rounded-xl group ${pathname === "/trash" ? "bg-primary/5 text-primary border-primary/20" : "text-gray-600 hover:text-gray-900"}`}
            title="휴지통"
          >
            <div className="flex items-center justify-center transition-colors w-8 h-8 rounded-lg bg-red-500/10">
              <Trash2 className="w-4 h-4 text-red-500 transition-colors" />
            </div>
            <span className="text-sm font-medium">휴지통</span>
          </button>
        </div>
      </div>

      {/* Modals & Menu */}
      <CreateFolderModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCreateModalParentId(null);
        }}
        onSubmit={handleCreateFolderSubmit}
        parentId={createModalParentId}
      />

      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setItemToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        itemName={itemToDelete?.name || ""}
        itemType={itemToDelete?.type || "folder"}
      />

      {menuState && menuState.item && (
        <FolderMenu
          item={menuState.item}
          position={menuState.position}
          onClose={() => setMenuState(null)}
          onEdit={() => handleEdit(menuState.item!)}
          onDelete={() => handleDelete(menuState.item!)}
          onCreateFolder={() => handleCreateFolder(menuState.item!.id)}
          onCreateDocument={() => {
            const name = prompt("문서 이름:");
            if (name?.trim()) createDocument(name.trim(), menuState.item!.id);
            setMenuState(null);
          }}
        />
      )}
    </div>
  );
}
