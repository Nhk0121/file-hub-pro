import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReactMarkdown from 'react-markdown';
import { Eye, Code } from 'lucide-react';

interface MarkdownEditorProps {
  content: string;
  onChange: (md: string) => void;
}

const MarkdownEditor = ({ content, onChange }: MarkdownEditorProps) => {
  return (
    <Tabs defaultValue="edit" className="w-full">
      <TabsList className="mb-2">
        <TabsTrigger value="edit" className="gap-1">
          <Code className="w-4 h-4" />
          編輯
        </TabsTrigger>
        <TabsTrigger value="preview" className="gap-1">
          <Eye className="w-4 h-4" />
          預覽
        </TabsTrigger>
      </TabsList>
      <TabsContent value="edit">
        <textarea
          value={content}
          onChange={e => onChange(e.target.value)}
          className="w-full min-h-[400px] p-4 bg-card border rounded-lg font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="在此輸入 Markdown 內容..."
        />
      </TabsContent>
      <TabsContent value="preview">
        <div className="prose prose-sm max-w-none p-4 bg-card border rounded-lg min-h-[400px]">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default MarkdownEditor;
