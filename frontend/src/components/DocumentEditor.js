import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Image from '@tiptap/extension-image';
import { useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link as LinkIcon,
  Unlink,
  Image as ImageIcon,
  Undo,
  Redo,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Quote,
  Minus,
  Code,
  RemoveFormatting,
  Type
} from 'lucide-react';

// Menu Button Component
const MenuButton = ({ onClick, isActive, disabled, children, title }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-2 rounded hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
      isActive ? 'bg-slate-200 text-slate-900' : 'text-slate-600'
    }`}
  >
    {children}
  </button>
);

// Separator
const Separator = () => <div className="w-px h-6 bg-slate-200 mx-1" />;

// Editor Toolbar
const EditorToolbar = ({ editor }) => {
  const addLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl);
    
    if (url === null) return;
    
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const setTextColor = useCallback((color) => {
    if (!editor) return;
    editor.chain().focus().setColor(color).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="border-b border-slate-200 bg-slate-50 p-2 flex flex-wrap items-center gap-0.5">
      {/* Text Style */}
      <MenuButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold (Ctrl+B)"
      >
        <Bold className="w-4 h-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic (Ctrl+I)"
      >
        <Italic className="w-4 h-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="Underline (Ctrl+U)"
      >
        <UnderlineIcon className="w-4 h-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="Strikethrough"
      >
        <Strikethrough className="w-4 h-4" />
      </MenuButton>

      <Separator />

      {/* Headings */}
      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        <Heading1 className="w-4 h-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className="w-4 h-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        <Heading3 className="w-4 h-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().setParagraph().run()}
        isActive={editor.isActive('paragraph')}
        title="Paragraph"
      >
        <Pilcrow className="w-4 h-4" />
      </MenuButton>

      <Separator />

      {/* Lists */}
      <MenuButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <List className="w-4 h-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered List"
      >
        <ListOrdered className="w-4 h-4" />
      </MenuButton>

      <Separator />

      {/* Alignment */}
      <MenuButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        title="Align Left"
      >
        <AlignLeft className="w-4 h-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        title="Align Center"
      >
        <AlignCenter className="w-4 h-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
        title="Align Right"
      >
        <AlignRight className="w-4 h-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        isActive={editor.isActive({ textAlign: 'justify' })}
        title="Justify"
      >
        <AlignJustify className="w-4 h-4" />
      </MenuButton>

      <Separator />

      {/* Block Elements */}
      <MenuButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="Quote"
      >
        <Quote className="w-4 h-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Line"
      >
        <Minus className="w-4 h-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        title="Code Block"
      >
        <Code className="w-4 h-4" />
      </MenuButton>

      <Separator />

      {/* Links & Images */}
      <MenuButton
        onClick={addLink}
        isActive={editor.isActive('link')}
        title="Add Link"
      >
        <LinkIcon className="w-4 h-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().unsetLink().run()}
        disabled={!editor.isActive('link')}
        title="Remove Link"
      >
        <Unlink className="w-4 h-4" />
      </MenuButton>
      <MenuButton
        onClick={addImage}
        title="Add Image"
      >
        <ImageIcon className="w-4 h-4" />
      </MenuButton>

      <Separator />

      {/* Text Colors */}
      <div className="flex items-center gap-1 px-1">
        <Type className="w-4 h-4 text-slate-500" />
        <input
          type="color"
          onChange={(e) => setTextColor(e.target.value)}
          className="w-6 h-6 cursor-pointer border-0 rounded"
          title="Text Color"
        />
      </div>

      <Separator />

      {/* Utilities */}
      <MenuButton
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        title="Clear Formatting"
      >
        <RemoveFormatting className="w-4 h-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Ctrl+Z)"
      >
        <Undo className="w-4 h-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Ctrl+Y)"
      >
        <Redo className="w-4 h-4" />
      </MenuButton>
    </div>
  );
};

// Variable Insert Buttons
const VariableButtons = ({ editor }) => {
  if (!editor) return null;

  const variables = [
    { label: 'Company Name', value: '{{company_name}}' },
    { label: 'Address', value: '{{company_address}}' },
    { label: 'Full Address', value: '{{company_full_address}}' },
    { label: 'City', value: '{{company_city}}' },
    { label: 'State', value: '{{company_state}}' },
    { label: 'ZIP', value: '{{company_zip}}' },
    { label: 'Phone', value: '{{company_phone}}' },
    { label: 'Email', value: '{{company_email}}' },
    { label: 'Website', value: '{{company_website}}' },
    { label: 'Current Date', value: '{{current_date}}' },
    { label: 'Current Year', value: '{{current_year}}' },
  ];

  const insertVariable = (variable) => {
    editor.chain().focus().insertContent(variable).run();
  };

  return (
    <div className="border-b border-slate-200 bg-amber-50 px-3 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-amber-700">Insert Variable:</span>
        {variables.map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => insertVariable(v.value)}
            className="text-xs px-2 py-1 bg-white border border-amber-200 rounded hover:bg-amber-100 hover:border-amber-300 text-amber-800 transition-colors"
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// Main Editor Component
export default function DocumentEditor({ content, onChange, placeholder, showVariables = true }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-amber-600 hover:text-amber-700 underline',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg',
        },
      }),
    ],
    content: content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '');
    }
  }, [content, editor]);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <EditorToolbar editor={editor} />
      {showVariables && <VariableButtons editor={editor} />}
      <div className="relative">
        <EditorContent editor={editor} />
        {!content && placeholder && (
          <div className="absolute top-4 left-4 text-slate-400 pointer-events-none">
            {placeholder}
          </div>
        )}
      </div>
      <style>{`
        .ProseMirror {
          min-height: 300px;
          padding: 1rem;
        }
        .ProseMirror:focus {
          outline: none;
        }
        .ProseMirror p {
          margin: 0.75rem 0;
        }
        .ProseMirror h1 {
          font-size: 1.75rem;
          font-weight: 700;
          margin: 1.5rem 0 1rem 0;
          color: #0f172a;
        }
        .ProseMirror h2 {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 1.25rem 0 0.75rem 0;
          color: #1e293b;
        }
        .ProseMirror h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 1rem 0 0.5rem 0;
          color: #334155;
        }
        .ProseMirror h4 {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0.75rem 0 0.5rem 0;
          color: #475569;
        }
        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5rem;
          margin: 0.75rem 0;
        }
        .ProseMirror ul {
          list-style-type: disc;
        }
        .ProseMirror ol {
          list-style-type: decimal;
        }
        .ProseMirror li {
          margin: 0.375rem 0;
        }
        .ProseMirror blockquote {
          border-left: 3px solid #f59e0b;
          padding-left: 1rem;
          margin: 1rem 0;
          color: #64748b;
          font-style: italic;
        }
        .ProseMirror hr {
          border: none;
          border-top: 1px solid #e2e8f0;
          margin: 1.5rem 0;
        }
        .ProseMirror code {
          background: #f1f5f9;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-family: monospace;
          font-size: 0.875em;
        }
        .ProseMirror pre {
          background: #1e293b;
          color: #e2e8f0;
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 1rem 0;
        }
        .ProseMirror pre code {
          background: none;
          padding: 0;
          color: inherit;
        }
        .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 1rem 0;
        }
        .ProseMirror a {
          color: #d97706;
          text-decoration: underline;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
          float: left;
          height: 0;
        }
      `}</style>
    </div>
  );
}
