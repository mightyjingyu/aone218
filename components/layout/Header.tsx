"use client";

import { useState, useEffect } from "react";
import { Search, Bell, Settings, LogOut, User as UserIcon, Command, ChevronRight } from "lucide-react";
import { getCurrentUser, signOut } from "@/lib/auth";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

interface HeaderProps {
  title: string;
  showSearch?: boolean;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export default function Header({ title, showSearch = true, isSidebarCollapsed, onToggleSidebar }: HeaderProps) {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  return (
    <header className="flex items-center justify-between pb-4 z-20 min-h-[4rem]">
      {/* Left section: Search Bar (Aligns with Content Panel) */}
      <div className="flex-1 max-w-3xl flex items-center gap-3">
        {isSidebarCollapsed && onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="flex-shrink-0 w-[50px] h-[50px] flex items-center justify-center bg-white border border-gray-200 rounded-2xl shadow-sm hover:bg-gray-50 hover:shadow-md transition-all group animate-[fadeIn_0.5s_ease-out_forwards]"
            title="사이드바 펼치기"
          >
            <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-gray-900 group-hover:scale-110 transition-transform" />
          </button>
        )}

        {showSearch && (
          <div className="relative group w-full max-w-xl">
            <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl transition-all duration-500 opacity-0 group-hover:opacity-40"></div>
            <div className="relative flex items-center bg-white border border-gray-200 rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all shadow-sm h-[50px]">
              <Search className="w-5 h-5 text-gray-400 mr-3" />
              <input
                type="text"
                placeholder="문서, 폴더 검색..."
                className="bg-transparent border-none outline-none text-gray-900 placeholder-gray-400 w-full text-base"
              />
              <div className="hidden md:flex items-center gap-1 px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50">
                <Command className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] font-medium text-gray-400">K</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right section: Actions & User Profile */}
      <div className="flex items-center gap-4 justify-end">
        <button className="glass-icon-button w-10 h-10 relative text-gray-400 hover:text-gray-900">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-[#F4F6F8]"></span>
        </button>

        {/* User Profile Panel */}
        <div className="flex items-center gap-3 pl-3 pr-2 py-1.5 bg-white/80 backdrop-blur-md border border-gray-200/60 shadow-sm rounded-2xl transition-all hover:bg-white hover:shadow-md cursor-default">
          <div className="text-right hidden md:block">
            <div className="text-sm font-bold text-gray-900 leading-none mb-1">{user?.email?.split('@')[0] || '게스트'}</div>
            <div className="text-[10px] text-gray-500 font-medium leading-none uppercase tracking-wide">무료 플랜</div>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-gray-100 to-gray-200 border border-gray-100 flex items-center justify-center overflow-hidden shadow-inner">
            <UserIcon className="w-4 h-4 text-gray-600" />
          </div>
          <div className="w-[1px] h-6 bg-gray-200 mx-1"></div>
          <button
            onClick={() => signOut().then(() => router.push('/login'))}
            className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
            title="로그아웃"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
