import React, { useState, useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';

export interface RichTextEditorHandle {
  insertText: (text: string) => void;
  insertHTML: (html: string) => void;
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

interface ToolbarButton {
  command: string;
  icon: string;
  title: string;
  arg?: string;
}

const TOOLBAR: (ToolbarButton | 'separator')[] = [
  { command: 'bold', icon: 'B', title: 'Bold' },
  { command: 'italic', icon: 'I', title: 'Italic' },
  { command: 'underline', icon: 'U', title: 'Underline' },
  { command: 'strikeThrough', icon: 'S', title: 'Strikethrough' },
  'separator',
  { command: 'insertUnorderedList', icon: '•', title: 'Bullet list' },
  { command: 'insertOrderedList', icon: '1.', title: 'Numbered list' },
  'separator',
  { command: 'formatBlock', icon: 'H1', title: 'Heading', arg: 'h2' },
  { command: 'formatBlock', icon: 'H2', title: 'Subheading', arg: 'h3' },
  { command: 'formatBlock', icon: 'P', title: 'Paragraph', arg: 'p' },
  'separator',
  { command: 'createLink', icon: '🔗', title: 'Insert link' },
  { command: 'removeFormat', icon: '✕', title: 'Clear formatting' },
];

const SIZE_OPTIONS = [
  { label: 'S', value: '25%', title: 'Small (25%)' },
  { label: 'M', value: '50%', title: 'Medium (50%)' },
  { label: 'L', value: '75%', title: 'Large (75%)' },
  { label: 'Full', value: '100%', title: 'Full width' },
];

const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(function RichTextEditor(
  { value, onChange, placeholder, minHeight = '200px' },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const isInternalUpdate = useRef(false);
  const [sourceMode, setSourceMode] = useState(false);

  // Selected image state
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
  const [imgToolbar, setImgToolbar] = useState<{ top: number; left: number } | null>(null);

  // Expose insertText / insertHTML to parent via ref
  useImperativeHandle(ref, () => ({
    insertText(text: string) {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      document.execCommand('insertText', false, text);
      isInternalUpdate.current = true;
      onChangeRef.current(el.innerHTML);
    },
    insertHTML(html: string) {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      document.execCommand('insertHTML', false, html);
      isInternalUpdate.current = true;
      onChangeRef.current(el.innerHTML);
    },
  }));

  // Sync external value only on initial render or when value is set programmatically
  useEffect(() => {
    if (editorRef.current && !isInternalUpdate.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
    }
    isInternalUpdate.current = false;
  }, [value]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalUpdate.current = true;
      onChangeRef.current(editorRef.current.innerHTML);
    }
  }, []);

  const execCommand = useCallback((command: string, arg?: string) => {
    if (command === 'createLink') {
      const url = prompt('Enter URL:', 'https://');
      if (url) {
        document.execCommand('createLink', false, url);
      }
    } else if (arg) {
      document.execCommand(command, false, arg);
    } else {
      document.execCommand(command, false);
    }
    editorRef.current?.focus();
    handleInput();
  }, [handleInput]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          execCommand('bold');
          break;
        case 'i':
          e.preventDefault();
          execCommand('italic');
          break;
        case 'u':
          e.preventDefault();
          execCommand('underline');
          break;
      }
    }
    // Delete selected image with Backspace/Delete
    if (selectedImg && (e.key === 'Backspace' || e.key === 'Delete')) {
      e.preventDefault();
      selectedImg.remove();
      setSelectedImg(null);
      setImgToolbar(null);
      handleInput();
    }
  }, [execCommand, selectedImg, handleInput]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');

    if (html) {
      const div = document.createElement('div');
      div.innerHTML = html;
      div.querySelectorAll('script, style, iframe, form, input, meta, link').forEach(el => el.remove());
      document.execCommand('insertHTML', false, div.innerHTML);
    } else {
      document.execCommand('insertText', false, text);
    }
    handleInput();
  }, [handleInput]);

  // Position the image toolbar relative to the wrapper
  const positionToolbar = useCallback((img: HTMLImageElement) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const wrapperRect = wrapper.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    setImgToolbar({
      top: imgRect.top - wrapperRect.top - 40,
      left: imgRect.left - wrapperRect.left + imgRect.width / 2,
    });
  }, []);

  // Handle clicks inside editor to detect image selection
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      setSelectedImg(img);
      positionToolbar(img);
    } else {
      setSelectedImg(null);
      setImgToolbar(null);
    }
  }, [positionToolbar]);

  // Dismiss image toolbar when clicking outside
  useEffect(() => {
    if (!selectedImg) return;
    const handleClickOutside = (e: MouseEvent) => {
      const wrapper = wrapperRef.current;
      if (wrapper && !wrapper.contains(e.target as Node)) {
        setSelectedImg(null);
        setImgToolbar(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedImg]);

  // Reposition toolbar on scroll/resize
  useEffect(() => {
    if (!selectedImg) return;
    const reposition = () => positionToolbar(selectedImg);
    const editor = editorRef.current;
    editor?.addEventListener('scroll', reposition);
    window.addEventListener('resize', reposition);
    return () => {
      editor?.removeEventListener('scroll', reposition);
      window.removeEventListener('resize', reposition);
    };
  }, [selectedImg, positionToolbar]);

  const resizeImage = (width: string) => {
    if (!selectedImg) return;
    selectedImg.style.maxWidth = width;
    selectedImg.style.width = width;
    selectedImg.style.height = 'auto';
    positionToolbar(selectedImg);
    handleInput();
  };

  const deleteImage = () => {
    if (!selectedImg) return;
    selectedImg.remove();
    setSelectedImg(null);
    setImgToolbar(null);
    handleInput();
  };

  return (
    <div ref={wrapperRef} className="relative border border-taupe rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-gold focus-within:border-transparent transition-all">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-cream/50 border-b border-cream flex-wrap">
        {!sourceMode && TOOLBAR.map((item, i) =>
          item === 'separator' ? (
            <div key={`sep-${i}`} className="w-px h-5 bg-taupe/30 mx-1" />
          ) : (
            <button
              key={item.command + (item.arg || '') + i}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => execCommand(item.command, item.arg)}
              title={item.title}
              className="px-2 py-1 rounded text-sm font-medium text-espresso hover:bg-white hover:shadow-sm transition-all min-w-[28px] text-center"
              style={
                item.command === 'bold' ? { fontWeight: 'bold' } :
                item.command === 'italic' ? { fontStyle: 'italic' } :
                item.command === 'underline' ? { textDecoration: 'underline' } :
                item.command === 'strikeThrough' ? { textDecoration: 'line-through' } :
                undefined
              }
            >
              {item.icon}
            </button>
          )
        )}
        {sourceMode && <span className="text-xs text-taupe font-medium px-1">HTML Source</span>}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setSourceMode(m => !m)}
          title={sourceMode ? 'Visual editor' : 'Edit HTML source'}
          className={`px-2 py-1 rounded text-xs font-medium transition-all ${
            sourceMode ? 'bg-espresso text-white' : 'text-taupe hover:bg-white hover:shadow-sm'
          }`}
        >
          {sourceMode ? 'Visual' : '</>'}
        </button>
      </div>

      {/* Source mode — raw HTML textarea */}
      {sourceMode ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-4 py-3 text-xs font-mono text-espresso outline-none bg-white resize-y"
          style={{ minHeight }}
          spellCheck={false}
        />
      ) : (
        <>
          {/* WYSIWYG Editor */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onClick={handleEditorClick}
            data-placeholder={placeholder || 'Write your message...'}
            className="px-4 py-3 text-sm text-espresso outline-none bg-white overflow-y-auto prose prose-sm max-w-none
              [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-taupe [&:empty]:before:pointer-events-none
              [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1
              [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1
              [&_p]:mb-2 [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:mb-1
              [&_a]:text-gold [&_a]:underline
              [&_img]:rounded-lg [&_img]:my-2 [&_img]:cursor-pointer"
            style={{ minHeight }}
          />

          {/* Image toolbar — floating above the selected image */}
          {selectedImg && imgToolbar && (
            <div
              className="absolute z-10 flex items-center gap-0.5 bg-espresso text-white rounded-lg shadow-lg px-1.5 py-1 -translate-x-1/2"
              style={{ top: imgToolbar.top, left: imgToolbar.left }}
              onMouseDown={e => e.preventDefault()}
            >
              {SIZE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => resizeImage(opt.value)}
                  title={opt.title}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    selectedImg.style.width === opt.value || selectedImg.style.maxWidth === opt.value
                      ? 'bg-gold text-espresso'
                      : 'hover:bg-white/20'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <div className="w-px h-4 bg-white/30 mx-0.5" />
              <button
                type="button"
                onClick={deleteImage}
                title="Delete image"
                className="px-1.5 py-0.5 rounded text-xs hover:bg-red-500 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
});

export default RichTextEditor;
