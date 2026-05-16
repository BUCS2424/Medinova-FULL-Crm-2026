import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
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
  Link as LinkIcon,
  Image as ImageIcon,
  Heading1,
  Heading2,
  Undo,
  Redo,
  Code,
  Quote
} from 'lucide-react';
import { Button } from './ui/button';

const MenuBar = ({ editor }) => {
  if (!editor) {
    return null;
  }

  const addImage = () => {
    const url = window.prompt('Enter the image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const addLink = () => {
    const url = window.prompt('Enter the URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/30">
      <Button
        variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'}
        size="icon"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        type="button"
      >
        <Heading1 className="w-4 h-4" />
      </Button>
      <Button
        variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'}
        size="icon"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        type="button"
      >
        <Heading2 className="w-4 h-4" />
      </Button>
      <div className="w-px h-6 bg-border mx-1" />
      <Button
        variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
        size="icon"
        onClick={() => editor.chain().focus().toggleBold().run()}
        type="button"
      >
        <Bold className="w-4 h-4" />
      </Button>
      <Button
        variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
        size="icon"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        type="button"
      >
        <Italic className="w-4 h-4" />
      </Button>
      <Button
        variant={editor.isActive('underline') ? 'secondary' : 'ghost'}
        size="icon"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        type="button"
      >
        <UnderlineIcon className="w-4 h-4" />
      </Button>
      <Button
        variant={editor.isActive('strike') ? 'secondary' : 'ghost'}
        size="icon"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        type="button"
      >
        <Strikethrough className="w-4 h-4" />
      </Button>
      <div className="w-px h-6 bg-border mx-1" />
      <Button
        variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
        size="icon"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        type="button"
      >
        <List className="w-4 h-4" />
      </Button>
      <Button
        variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
        size="icon"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        type="button"
      >
        <ListOrdered className="w-4 h-4" />
      </Button>
      <div className="w-px h-6 bg-border mx-1" />
      <Button
        variant={editor.isActive({ textAlign: 'left' }) ? 'secondary' : 'ghost'}
        size="icon"
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        type="button"
      >
        <AlignLeft className="w-4 h-4" />
      </Button>
      <Button
        variant={editor.isActive({ textAlign: 'center' }) ? 'secondary' : 'ghost'}
        size="icon"
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        type="button"
      >
        <AlignCenter className="w-4 h-4" />
      </Button>
      <Button
        variant={editor.isActive({ textAlign: 'right' }) ? 'secondary' : 'ghost'}
        size="icon"
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        type="button"
      >
        <AlignRight className="w-4 h-4" />
      </Button>
      <div className="w-px h-6 bg-border mx-1" />
      <Button
        variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'}
        size="icon"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        type="button"
      >
        <Quote className="w-4 h-4" />
      </Button>
      <Button
        variant={editor.isActive('codeBlock') ? 'secondary' : 'ghost'}
        size="icon"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        type="button"
      >
        <Code className="w-4 h-4" />
      </Button>
      <div className="w-px h-6 bg-border mx-1" />
      <Button
        variant={editor.isActive('link') ? 'secondary' : 'ghost'}
        size="icon"
        onClick={addLink}
        type="button"
      >
        <LinkIcon className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={addImage}
        type="button"
      >
        <ImageIcon className="w-4 h-4" />
      </Button>
      <div className="w-px h-6 bg-border mx-1" />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => editor.chain().focus().undo().run()}
        type="button"
      >
        <Undo className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => editor.chain().focus().redo().run()}
        type="button"
      >
        <Redo className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default function RichTextEditor({ value, onChange, placeholder = 'Write your content here...' }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      Image,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Update editor content when value changes externally
  if (editor && value !== editor.getHTML()) {
    editor.commands.setContent(value, false);
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      <MenuBar editor={editor} />
      <EditorContent 
        editor={editor} 
        className="prose prose-sm max-w-none p-4 min-h-[250px] focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[200px]"
      />
      <style>{`
        .ProseMirror {
          outline: none;
        }
        .ProseMirror p {
          margin: 0.5em 0;
        }
        .ProseMirror h1 {
          font-size: 1.5em;
          font-weight: bold;
          margin: 0.5em 0;
        }
        .ProseMirror h2 {
          font-size: 1.25em;
          font-weight: bold;
          margin: 0.5em 0;
        }
        .ProseMirror ul, .ProseMirror ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .ProseMirror blockquote {
          border-left: 3px solid #ccc;
          padding-left: 1em;
          margin: 0.5em 0;
          color: #666;
        }
        .ProseMirror a {
          color: #3b82f6;
          text-decoration: underline;
        }
        .ProseMirror img {
          max-width: 100%;
          height: auto;
        }
      `}</style>
    </div>
  );
}
