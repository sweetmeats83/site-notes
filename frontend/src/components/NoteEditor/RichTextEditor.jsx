import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { useEffect } from 'react';
import Icon from '../common/Icon.jsx';

const ToolbarButton = ({ onClick, active, title, children }) => (
  <button
    onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    title={title}
    className={`p-1.5 rounded transition-colors ${
      active
        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-white'
    }`}
  >
    {children}
  </button>
);

function Toolbar({ editor }) {
  if (!editor) return null;
  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
      <ToolbarButton title="Bold"         onClick={() => editor.chain().focus().toggleBold().run()}          active={editor.isActive('bold')}>
        <Icon name="format_bold" size="sm" />
      </ToolbarButton>
      <ToolbarButton title="Italic"       onClick={() => editor.chain().focus().toggleItalic().run()}        active={editor.isActive('italic')}>
        <Icon name="format_italic" size="sm" />
      </ToolbarButton>
      <ToolbarButton title="Strike"       onClick={() => editor.chain().focus().toggleStrike().run()}        active={editor.isActive('strike')}>
        <Icon name="strikethrough_s" size="sm" />
      </ToolbarButton>
      <ToolbarButton title="Code"         onClick={() => editor.chain().focus().toggleCode().run()}          active={editor.isActive('code')}>
        <Icon name="code" size="sm" />
      </ToolbarButton>

      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

      <ToolbarButton title="Heading 1"    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })}>
        <span className="text-xs font-bold">H1</span>
      </ToolbarButton>
      <ToolbarButton title="Heading 2"    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>
        <span className="text-xs font-bold">H2</span>
      </ToolbarButton>
      <ToolbarButton title="Heading 3"    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}>
        <span className="text-xs font-bold">H3</span>
      </ToolbarButton>

      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

      <ToolbarButton title="Bullet list"  onClick={() => editor.chain().focus().toggleBulletList().run()}    active={editor.isActive('bulletList')}>
        <Icon name="format_list_bulleted" size="sm" />
      </ToolbarButton>
      <ToolbarButton title="Ordered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}   active={editor.isActive('orderedList')}>
        <Icon name="format_list_numbered" size="sm" />
      </ToolbarButton>
      <ToolbarButton title="Task list"    onClick={() => editor.chain().focus().toggleTaskList().run()}      active={editor.isActive('taskList')}>
        <Icon name="checklist" size="sm" />
      </ToolbarButton>

      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

      <ToolbarButton title="Blockquote"   onClick={() => editor.chain().focus().toggleBlockquote().run()}    active={editor.isActive('blockquote')}>
        <Icon name="format_quote" size="sm" />
      </ToolbarButton>
      <ToolbarButton title="Code block"   onClick={() => editor.chain().focus().toggleCodeBlock().run()}     active={editor.isActive('codeBlock')}>
        <Icon name="data_object" size="sm" />
      </ToolbarButton>
      <ToolbarButton title="Divider"      onClick={() => editor.chain().focus().setHorizontalRule().run()}   active={false}>
        <Icon name="horizontal_rule" size="sm" />
      </ToolbarButton>

      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

      <ToolbarButton title="Undo"         onClick={() => editor.chain().focus().undo().run()}                active={false}>
        <Icon name="undo" size="sm" />
      </ToolbarButton>
      <ToolbarButton title="Redo"         onClick={() => editor.chain().focus().redo().run()}                active={false}>
        <Icon name="redo" size="sm" />
      </ToolbarButton>
    </div>
  );
}

export default function RichTextEditor({ content, onChange, placeholder = 'Start writing…' }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      Image.configure({ inline: false, allowBase64: true }),
    ],
    content,
    editorProps: {
      attributes: { class: 'tiptap-editor px-4 py-3 min-h-[300px] outline-none' },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync external content changes (e.g. transcription appended)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (content !== editor.getHTML()) {
      editor.commands.setContent(content || '', false);
    }
  // Only trigger when content prop is explicitly set from outside
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  return (
    <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
