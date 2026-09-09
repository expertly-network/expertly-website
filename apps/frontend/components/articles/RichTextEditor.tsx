'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import type { ReactNode } from 'react';

// The write flow's article-content editor. Tiptap (matching the reference repo's own choice —
// see docs/database-erd.md), configured to a deliberately small surface: paragraphs, bold/
// italic/underline, bullet/numbered lists, blockquote, inline code + code block, and links —
// exactly the tags apps/backend/src/articles/articles.service.ts's sanitize-html allowlist
// accepts, so nothing a member formats here gets silently stripped on save. No headings/images/
// tables — headings would fight the detail page's own h2/h3 hierarchy, and images need upload
// infra this repo doesn't have yet.
function buildExtensions(placeholder?: string) {
  return [
    StarterKit.configure({
      heading: false,
      // codeBlock/blockquote/bulletList/orderedList/bold/italic/code/paragraph/hardBreak all
      // stay enabled at StarterKit's defaults.
    }),
    Underline,
    Link.configure({ openOnClick: false, autolink: true }),
    Placeholder.configure({ placeholder: placeholder ?? '' }),
  ];
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? 'bg-ink text-bg-card' : 'text-ink-2 hover:bg-bg-alt hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

const ICON_PROPS = {
  width: 15,
  height: 15,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-2 py-1.5">
      <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <svg {...ICON_PROPS}>
          <path d="M6 4h8a4 4 0 010 8H6zM6 12h9a4 4 0 010 8H6z" />
        </svg>
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <svg {...ICON_PROPS}>
          <line x1="19" y1="4" x2="10" y2="4" />
          <line x1="14" y1="20" x2="5" y2="20" />
          <line x1="15" y1="4" x2="9" y2="20" />
        </svg>
      </ToolbarButton>
      <ToolbarButton label="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <svg {...ICON_PROPS}>
          <path d="M6 3v7a6 6 0 0012 0V3" />
          <line x1="4" y1="21" x2="20" y2="21" />
        </svg>
      </ToolbarButton>

      <span className="mx-1 h-5 w-px flex-none bg-line" />

      <ToolbarButton
        label="Bullet list"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <svg {...ICON_PROPS}>
          <line x1="9" y1="6" x2="20" y2="6" />
          <line x1="9" y1="12" x2="20" y2="12" />
          <line x1="9" y1="18" x2="20" y2="18" />
          <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <svg {...ICON_PROPS}>
          <line x1="10" y1="6" x2="20" y2="6" />
          <line x1="10" y1="12" x2="20" y2="12" />
          <line x1="10" y1="18" x2="20" y2="18" />
          <text x="2" y="8" fontSize="7" fill="currentColor" stroke="none">1</text>
          <text x="2" y="14" fontSize="7" fill="currentColor" stroke="none">2</text>
          <text x="2" y="20" fontSize="7" fill="currentColor" stroke="none">3</text>
        </svg>
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <svg {...ICON_PROPS}>
          <path d="M7 8a3 3 0 00-3 3v3a1 1 0 001 1h3v-4H6a1 1 0 011-1zM17 8a3 3 0 00-3 3v3a1 1 0 001 1h3v-4h-2a1 1 0 011-1z" />
        </svg>
      </ToolbarButton>

      <span className="mx-1 h-5 w-px flex-none bg-line" />

      <ToolbarButton label="Inline code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
        <svg {...ICON_PROPS}>
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        label="Code block"
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <svg {...ICON_PROPS}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 9l-2 3 2 3M15 9l2 3-2 3" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        label={editor.isActive('link') ? 'Remove link' : 'Add link'}
        active={editor.isActive('link')}
        onClick={() => {
          if (editor.isActive('link')) {
            editor.chain().focus().unsetLink().run();
            return;
          }
          const url = window.prompt('Link URL');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
      >
        <svg {...ICON_PROPS}>
          <path d="M10 13a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07l-1.5 1.5" />
          <path d="M14 11a5 5 0 00-7.07 0L4.1 13.83a5 5 0 007.07 7.07l1.5-1.5" />
        </svg>
      </ToolbarButton>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: buildExtensions(placeholder),
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose-article min-h-[320px] px-3.5 py-3 text-sm leading-relaxed text-ink outline-none [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-ink-2 [&_code]:rounded [&_code]:bg-bg-alt [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-ink [&_pre]:p-3 [&_pre]:text-bg-card [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit [&_a]:text-accent [&_a]:underline [&_u]:underline [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-ink-4 [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  return (
    <div className="overflow-hidden rounded-input border border-line-2 bg-bg focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_14%,transparent)]">
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
