"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ChapterWithRelationships } from '@/lib/db/types';
import { updateChapterContent } from '@/lib/db/chapters';
import { 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  List, 
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Undo,
  Redo,
  Search,
  Loader2
} from 'lucide-react';
import { AiEnhancedTextarea } from '@/components/ui/ai-enhanced-textarea';

interface ChapterContent {
  id: string;
  content: string;
}

interface TextEditorProps {
  activeChapterId: string | null;
  aiScribeEnabled: boolean;
  activeChapter?: ChapterWithRelationships | null;
  onChapterUpdate?: (chapterId: string, title: string) => void;
}

// Add debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function TextEditor({ activeChapterId, aiScribeEnabled, activeChapter, onChapterUpdate }: TextEditorProps) {
  const [currentContent, setCurrentContent] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const contentRef = useRef(currentContent);
  const lastSavedContent = useRef('');
  
  // Debounce the content changes with a 3-second delay
  const debouncedContent = useDebounce(currentContent, 3000);
  
  // Keep contentRef in sync with currentContent
  useEffect(() => {
    contentRef.current = currentContent;
  }, [currentContent]);
  
  // Load chapter content when active chapter changes
  useEffect(() => {
    if (activeChapter?.id !== contentRef.current.chapterId) {  // Only update if switching to different chapter
      if (activeChapter) {
        const initialContent = activeChapter.content || '';
        setCurrentContent(initialContent);
        contentRef.current = initialContent;
        lastSavedContent.current = initialContent;
        setWordCount(countWords(initialContent));
        setLastSaved(activeChapter.updatedAt || new Date());
      } else {
        setCurrentContent('');
        contentRef.current = '';
        lastSavedContent.current = '';
        setWordCount(0);
      }
    }
  }, [activeChapter]);
  
  // Save content when debounced content changes
  useEffect(() => {
    const saveContent = async () => {
      // Only save if:
      // 1. We have an active chapter
      // 2. The content has actually changed from last saved content
      // 3. We're not currently saving
      if (
        activeChapter?.id && 
        debouncedContent !== lastSavedContent.current &&
        !isSaving
      ) {
        try {
          setIsSaving(true);
          await updateChapterContent(activeChapter.id, debouncedContent);
          lastSavedContent.current = debouncedContent;
          setLastSaved(new Date());
        } catch (error) {
          console.error('Error saving chapter content:', error);
        } finally {
          setIsSaving(false);
        }
      }
    };
    
    saveContent();
  }, [debouncedContent, activeChapter?.id]);
  
  // Save content when unmounting or switching chapters
  useEffect(() => {
    return () => {
      const saveOnUnmount = async () => {
        if (
          activeChapter?.id && 
          contentRef.current !== lastSavedContent.current
        ) {
          try {
            await updateChapterContent(activeChapter.id, contentRef.current);
            lastSavedContent.current = contentRef.current;
          } catch (error) {
            console.error('Error saving chapter content on unmount:', error);
          }
        }
      };
      
      saveOnUnmount();
    };
  }, [activeChapter?.id]);
  
  const countWords = (text: string) => {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  };
  
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setCurrentContent(newContent);
    setWordCount(countWords(newContent));
  };
  
  const getChapterTitle = () => {
    if (!activeChapter) return 'No chapter selected';
    return activeChapter.title || 'Untitled Chapter';
  };
  
  const handleTitleClick = () => {
    if (!activeChapter || !onChapterUpdate) return;
    setEditedTitle(activeChapter.title || '');
    setIsEditingTitle(true);
  };
  
  const handleTitleSave = () => {
    if (!activeChapter || !onChapterUpdate || !editedTitle.trim()) return;
    onChapterUpdate(activeChapter.id, editedTitle.trim());
    setIsEditingTitle(false);
  };
  
  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };
  
  return (
    <div className="h-full flex flex-col relative">
      <div className="border-b p-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="icon">
            <Bold className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Italic className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Underline className="h-4 w-4" />
          </Button>
          
          <Separator orientation="vertical" className="h-6" />
          
          <Button variant="ghost" size="icon">
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <AlignRight className="h-4 w-4" />
          </Button>
          
          <Separator orientation="vertical" className="h-6" />
          
          <Button variant="ghost" size="icon">
            <List className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <ListOrdered className="h-4 w-4" />
          </Button>
          
          <Separator orientation="vertical" className="h-6" />
          
          <Button variant="ghost" size="icon">
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Heading3 className="h-4 w-4" />
          </Button>
          
          <Separator orientation="vertical" className="h-6" />
          
          <Button variant="ghost" size="icon">
            <Undo className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Redo className="h-4 w-4" />
          </Button>
          
          <Separator orientation="vertical" className="h-6" />
          
          <Button variant="ghost" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="p-4 border-b">
        {isEditingTitle ? (
          <input
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            className="text-xl font-semibold w-full bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-primary/20 rounded px-1"
            autoFocus
          />
        ) : (
          <h2 
            className="text-xl font-semibold cursor-pointer hover:text-primary/80 transition-colors"
            onClick={handleTitleClick}
          >
            {getChapterTitle()}
          </h2>
        )}
      </div>
      
      <ScrollArea className="flex-1 p-6">
        {activeChapterId && activeChapter ? (
          <AiEnhancedTextarea
            value={currentContent}
            onChange={handleContentChange}
            className="w-full h-full min-h-[calc(100vh-250px)] p-4 text-lg leading-relaxed resize-none focus:outline-none bg-transparent"
            placeholder="Start writing here..."
            aiScribeEnabled={aiScribeEnabled}
            chapterId={activeChapterId}
            projectId={activeChapter.projectId}
            contentType="text"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a chapter or section to start writing
          </div>
        )}
      </ScrollArea>
      
      <div className="border-t p-2 flex justify-between items-center text-sm text-muted-foreground">
        <div>
          {wordCount} words
        </div>
        <div className="flex items-center gap-2">
          {isSaving ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </span>
          ) : (
            <span>
              Last saved: {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}