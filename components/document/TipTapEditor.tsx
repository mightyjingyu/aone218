"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Strikethrough,
  Palette,
  Highlighter,
  Type,
  List,
  ListOrdered
} from 'lucide-react';
import { useEffect } from 'react';

interface TipTapEditorProps {
  content: any; // TipTap JSON 형식
  onChange: (content: any) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  dark?: boolean;
}

export default function TipTapEditor({
  content,
  onChange,
  placeholder = "내용을 입력하세요...",
  editable = true,
  className = "",
  dark = false,
}: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        underline: false, // StarterKit의 underline 비활성화 (별도로 추가)
      }),
      Underline,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
    ],
    content: content || null,
    editable,
    immediatelyRender: false, // SSR hydration mismatch 방지
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
  });

  useEffect(() => {
    if (editor) {
      const currentContent = JSON.stringify(editor.getJSON());
      const newContent = JSON.stringify(content || null);
      if (currentContent !== newContent) {
        editor.commands.setContent(content || null);
      }
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const wrapperClass = dark
    ? `tiptap-editor-dark border border-border rounded-xl bg-surface text-white ${className}`
    : `border border-gray-300 rounded-lg bg-white ${className}`;
  const toolbarClass = dark
    ? "border-b border-border p-2 flex items-center gap-1 flex-wrap bg-background"
    : "border-b border-gray-200 p-2 flex items-center gap-1 flex-wrap bg-gray-50";
  const btnClass = dark
    ? "p-2 rounded hover:bg-white/10 transition-colors text-gray-300 hover:text-white"
    : "p-2 rounded hover:bg-gray-200 transition-colors";
  const btnActiveClass = dark ? "bg-white/20 text-white" : "bg-gray-300";
  const dividerClass = dark ? "w-px h-6 bg-border mx-1" : "w-px h-6 bg-gray-300 mx-1";

  return (
    <div className={wrapperClass}>
      {editable && (
        <div className={toolbarClass}>
          {/* 텍스트 스타일 */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`${btnClass} ${editor.isActive('bold') ? btnActiveClass : ''}`}
            title="굵게"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`${btnClass} ${editor.isActive('italic') ? btnActiveClass : ''}`}
            title="기울임"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`${btnClass} ${editor.isActive('underline') ? btnActiveClass : ''}`}
            title="밑줄"
          >
            <UnderlineIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`${btnClass} ${editor.isActive('strike') ? btnActiveClass : ''}`}
            title="취소선"
          >
            <Strikethrough className="w-4 h-4" />
          </button>

          <div className={dividerClass} />

          {/* 색상 */}
          <div className="relative group">
            <button
              type="button"
              className={btnClass}
              title="텍스트 색상"
            >
              <Palette className="w-4 h-4" />
            </button>
            <div className={`absolute top-full left-0 mt-1 rounded-lg shadow-lg p-2 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all ${dark ? 'bg-surface border border-border' : 'bg-white border border-gray-300'}`}>
              <div className="grid grid-cols-6 gap-1">
                {['#ffffff', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => editor.chain().focus().setColor(color).run()}
                    className={`w-6 h-6 rounded border ${dark ? 'border-border' : 'border-gray-300'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={`${btnClass} ${editor.isActive('highlight') ? btnActiveClass : ''}`}
            title="하이라이트"
          >
            <Highlighter className="w-4 h-4" />
          </button>

          <div className={dividerClass} />

          {/* 제목 */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`${btnClass} ${editor.isActive('heading', { level: 1 }) ? btnActiveClass : ''}`}
            title="제목 1"
          >
            <Type className="w-4 h-4" />
          </button>

          <div className={dividerClass} />

          {/* 리스트 */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`${btnClass} ${editor.isActive('bulletList') ? btnActiveClass : ''}`}
            title="글머리 기호"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`${btnClass} ${editor.isActive('orderedList') ? btnActiveClass : ''}`}
            title="번호 매기기"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className={`p-4 min-h-[200px] relative ${dark ? "bg-surface" : ""}`}>
        <EditorContent 
          editor={editor} 
          className={`prose prose-sm max-w-none focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[150px] ${dark ? "prose-invert prose-p:text-white [&_.ProseMirror]:text-white [&_.ProseMirror]:bg-transparent" : ""}`}
        />
        {editable && editor.isEmpty && (
          <div className={`pointer-events-none absolute top-4 left-4 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}

