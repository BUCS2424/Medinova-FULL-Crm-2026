import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Send,
  Loader2,
  Sparkles,
  Palette,
  Layout,
  Grid,
  MousePointerClick,
  Square,
  PlusSquare,
  Smartphone,
  Search,
  Command,
  X,
  Copy,
  Check,
  Trash2,
  MessageSquare,
  Wand2,
  Code,
  Eye
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const iconMap = {
  'palette': Palette,
  'layout': Layout,
  'grid': Grid,
  'mouse-pointer-click': MousePointerClick,
  'square': Square,
  'plus-square': PlusSquare,
  'smartphone': Smartphone,
  'search': Search
};

export default function AITemplateEditor({ templatePreview }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [commands, setCommands] = useState([]);
  const [showCommands, setShowCommands] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [activeView, setActiveView] = useState('chat'); // 'chat' or 'commands'
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load available commands
  useEffect(() => {
    loadCommands();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadCommands = async () => {
    try {
      const token = localStorage.getItem('dme_token');
      const response = await axios.get(`${API_URL}/api/dev/template-editor/commands`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCommands(response.data.commands);
    } catch (error) {
      console.error('Failed to load commands:', error);
    }
  };

  const sendMessage = async (text = inputValue) => {
    if (!text.trim() || loading) return;

    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      const token = localStorage.getItem('dme_token');
      const response = await axios.post(
        `${API_URL}/api/dev/template-editor/chat`,
        {
          message: text,
          session_id: sessionId,
          current_template: messages.length === 0 ? templatePreview?.html?.substring(0, 3000) : null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSessionId(response.data.session_id);
      
      const assistantMessage = {
        role: 'assistant',
        content: response.data.response,
        code_blocks: response.data.code_blocks
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI chat error:', error);
      toast.error('Failed to get AI response');
      setMessages(prev => prev.slice(0, -1)); // Remove user message on error
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    // Toggle command palette with Cmd/Ctrl + K
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setShowCommands(prev => !prev);
    }
  };

  const copyCode = (code, index) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const clearSession = async () => {
    if (!sessionId) return;
    
    try {
      const token = localStorage.getItem('dme_token');
      await axios.delete(`${API_URL}/api/dev/template-editor/session/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages([]);
      setSessionId(null);
      toast.success('Conversation cleared');
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  };

  const handleUseCommand = (prompt) => {
    setInputValue(prompt);
    setShowCommands(false);
    inputRef.current?.focus();
  };

  const renderMessageContent = (message, msgIndex) => {
    if (message.role === 'user') {
      return <p className="whitespace-pre-wrap">{message.content}</p>;
    }

    // Parse and render assistant message with code blocks
    const content = message.content;
    const parts = [];
    let lastIndex = 0;
    
    // Find code blocks and split content
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    let blockIndex = 0;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.slice(lastIndex, match.index)
        });
      }
      
      // Add code block
      parts.push({
        type: 'code',
        language: match[1] || 'html',
        content: match[2].trim(),
        index: blockIndex++
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex)
      });
    }

    return (
      <div className="space-y-3">
        {parts.map((part, i) => {
          if (part.type === 'text') {
            return (
              <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed">
                {part.content}
              </p>
            );
          }
          
          const globalIndex = `${msgIndex}-${part.index}`;
          return (
            <div key={i} className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-xs">
                <span className="font-mono text-slate-600 dark:text-slate-400">{part.language}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2"
                  onClick={() => copyCode(part.content, globalIndex)}
                >
                  {copiedIndex === globalIndex ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
              </div>
              <pre className="p-3 bg-slate-50 dark:bg-slate-900 overflow-x-auto text-xs">
                <code className="text-slate-800 dark:text-slate-200">{part.content}</code>
              </pre>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">AI Template Editor</CardTitle>
              <p className="text-xs text-muted-foreground">Powered by GPT-5.2</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
              <Button
                size="sm"
                variant={activeView === 'chat' ? 'default' : 'ghost'}
                className="h-7 px-3 text-xs"
                onClick={() => setActiveView('chat')}
              >
                <MessageSquare className="w-3 h-3 mr-1" />
                Chat
              </Button>
              <Button
                size="sm"
                variant={activeView === 'commands' ? 'default' : 'ghost'}
                className="h-7 px-3 text-xs"
                onClick={() => setActiveView('commands')}
              >
                <Command className="w-3 h-3 mr-1" />
                Commands
              </Button>
            </div>
            {sessionId && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={clearSession}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {activeView === 'chat' ? (
          <>
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 rounded-2xl flex items-center justify-center mb-4">
                    <Wand2 className="w-8 h-8 text-violet-500" />
                  </div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">
                    Welcome to the AI Template Editor
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                    Ask me to modify colors, layout, add sections, or improve the design. 
                    Press <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs">⌘K</kbd> for quick commands.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {['Change colors to blue', 'Make hero section larger', 'Add testimonials section'].map((prompt) => (
                      <Button
                        key={prompt}
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => {
                          setInputValue(prompt);
                          inputRef.current?.focus();
                        }}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-violet-500 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {renderMessageContent(message, index)}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                          <span className="text-sm text-muted-foreground">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Ask me to modify the template..."
                    className="pr-10"
                    disabled={loading}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowCommands(prev => !prev)}
                  >
                    <Command className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
                <Button
                  onClick={() => sendMessage()}
                  disabled={!inputValue.trim() || loading}
                  className="bg-violet-500 hover:bg-violet-600"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Press Enter to send • <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs">⌘K</kbd> for commands
              </p>
            </div>
          </>
        ) : (
          /* Commands View */
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid gap-3">
              {commands.map((cmd) => {
                const IconComponent = iconMap[cmd.icon] || Sparkles;
                return (
                  <div
                    key={cmd.id}
                    className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/50 dark:to-purple-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <IconComponent className="w-5 h-5 text-violet-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-800 dark:text-slate-200">{cmd.name}</h4>
                        <p className="text-xs text-muted-foreground mb-3">{cmd.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {cmd.prompts.map((prompt, i) => (
                            <Button
                              key={i}
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              onClick={() => {
                                handleUseCommand(prompt);
                                setActiveView('chat');
                              }}
                            >
                              {prompt}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Command Palette Overlay */}
        {showCommands && activeView === 'chat' && (
          <div className="absolute inset-0 bg-black/50 flex items-start justify-center pt-20 z-50" onClick={() => setShowCommands(false)}>
            <div 
              className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 border-b flex items-center gap-2">
                <Command className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search commands..."
                  className="border-0 focus-visible:ring-0 p-0 h-auto"
                  autoFocus
                />
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowCommands(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="max-h-80 overflow-y-auto p-2">
                {commands.map((cmd) => {
                  const IconComponent = iconMap[cmd.icon] || Sparkles;
                  return (
                    <div key={cmd.id} className="mb-2">
                      <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                        <IconComponent className="w-3 h-3" />
                        {cmd.name}
                      </div>
                      {cmd.prompts.map((prompt, i) => (
                        <button
                          key={i}
                          className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          onClick={() => {
                            handleUseCommand(prompt);
                            sendMessage(prompt);
                          }}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
