import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useFeature } from '../contexts/FeatureContext';
import {
  MessageCircle,
  X,
  Send,
  User,
  Bot,
  UserCheck,
  Loader2,
  Phone,
  Ticket,
  Minimize2,
  Maximize2,
  Users,
  Paperclip,
  Image,
  FileText,
  File
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ChatWidget() {
  const { enabled: featureEnabled, loading: featureLoading } = useFeature('live_chat');
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [chatId, setChatId] = useState(null);
  const [status, setStatus] = useState('active'); // active, waiting_human, with_human
  const [isLoading, setIsLoading] = useState(false);
  const [visitorName, setVisitorName] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(true);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [startWithHuman, setStartWithHuman] = useState(false); // Toggle for starting with live rep
  const [isUploading, setIsUploading] = useState(false);
  const [showCallbackForm, setShowCallbackForm] = useState(false);
  const [callbackPhone, setCallbackPhone] = useState('');
  const [submittingCallback, setSubmittingCallback] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll for new messages when waiting for or with human
  useEffect(() => {
    let interval;
    if (sessionId && (status === 'with_human' || status === 'waiting_human')) {
      interval = setInterval(async () => {
        try {
          const response = await axios.get(`${API_URL}/api/chat/history/${sessionId}`);
          setMessages(response.data.messages || []);
          setStatus(response.data.status);
        } catch (error) {
          console.error('Error polling messages:', error);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [sessionId, status]);

  const startChat = async () => {
    try {
      setIsLoading(true);
      const response = await axios.post(`${API_URL}/api/chat/start`, null, {
        params: {
          visitor_name: visitorName || undefined,
          visitor_email: visitorEmail || undefined
        }
      });
      
      setSessionId(response.data.session_id);
      setChatId(response.data.chat_id);
      setMessages([response.data.welcome_message]);
      setShowNamePrompt(false);
      
      // If user wants to start with a live rep, immediately request human
      if (startWithHuman) {
        await requestHumanAfterStart(response.data.session_id);
      }
    } catch (error) {
      console.error('Error starting chat:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const requestHumanAfterStart = async (sid) => {
    try {
      const response = await axios.post(`${API_URL}/api/chat/request-human`, null, {
        params: { session_id: sid }
      });
      
      setMessages(prev => [...prev, response.data.message]);
      setStatus('waiting_human');
    } catch (error) {
      console.error('Error requesting human:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !sessionId) return;
    
    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      text: inputText,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    const messageText = inputText;
    setInputText('');
    setIsLoading(true);
    
    try {
      const response = await axios.post(`${API_URL}/api/chat/message`, {
        session_id: sessionId,
        text: messageText
      });
      
      if (response.data.ai_response) {
        setMessages(prev => [...prev, response.data.ai_response]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const requestHuman = async () => {
    if (!sessionId) return;
    
    try {
      setIsLoading(true);
      const response = await axios.post(`${API_URL}/api/chat/request-human`, null, {
        params: { session_id: sessionId }
      });
      
      setMessages(prev => [...prev, response.data.message]);
      setStatus('waiting_human');
    } catch (error) {
      console.error('Error requesting human:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Request a callback with phone number
  const requestCallback = async () => {
    if (!sessionId || !callbackPhone.trim()) return;
    
    setSubmittingCallback(true);
    try {
      const response = await axios.post(`${API_URL}/api/chat/request-callback`, {
        session_id: sessionId,
        phone: callbackPhone.trim()
      });
      
      // Add confirmation message to chat
      const systemMessage = {
        id: Date.now().toString(),
        type: 'system',
        text: `📞 Callback request submitted! A team member will call you at ${callbackPhone} shortly.`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, systemMessage]);
      setShowCallbackForm(false);
      setCallbackPhone('');
      setStatus('waiting_human');
    } catch (error) {
      console.error('Error requesting callback:', error);
      alert('Failed to submit callback request. Please try again.');
    } finally {
      setSubmittingCallback(false);
    }
  };

  const convertToLead = async () => {
    // Show callback form instead of direct conversion
    setShowCallbackForm(true);
  };

  // Handle file upload
  const handleFileUpload = async (file) => {
    if (!sessionId || !file) return;
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }
    
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('session_id', sessionId);
      
      const response = await axios.post(`${API_URL}/api/chat/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // Add the attachment message to chat
      const attachmentMessage = {
        id: Date.now().toString(),
        type: 'user',
        text: file.name,
        attachment: response.data.attachment,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, attachmentMessage]);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle file input change
  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  // Handle paste event for images
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          handleFileUpload(file);
        }
        return;
      }
    }
  };

  // Get file icon based on type
  const getFileIcon = (attachment) => {
    if (!attachment) return <File className="w-4 h-4" />;
    const type = attachment.content_type || '';
    if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (type.includes('pdf') || type.includes('document')) return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  // Send typing indicator
  const handleTyping = (text) => {
    setInputText(text);
    
    if (typingTimeout) clearTimeout(typingTimeout);
    
    if (sessionId) {
      const timeout = setTimeout(() => {
        axios.post(`${API_URL}/api/chat/typing`, null, {
          params: { session_id: sessionId, text }
        }).catch(() => {});
      }, 100);
      setTypingTimeout(timeout);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getMessageIcon = (type) => {
    switch (type) {
      case 'ai':
        return <Bot className="w-5 h-5 text-lime-500" />;
      case 'agent':
        return <UserCheck className="w-5 h-5 text-green-500" />;
      case 'user':
        return <User className="w-5 h-5 text-blue-500" />;
      default:
        return null;
    }
  };

  // Don't render if feature is explicitly disabled (show during loading with default true)
  if (!featureEnabled) {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-lime-500 to-lime-600 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center text-white z-50 hover:scale-110"
        data-testid="chat-widget-button"
      >
        <MessageCircle className="w-7 h-7" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></span>
      </button>
    );
  }

  return (
    <div 
      className={`fixed bottom-6 right-6 bg-white rounded-2xl shadow-2xl z-50 overflow-hidden transition-all ${
        isMinimized ? 'w-80 h-16' : 'w-96 h-[600px]'
      }`}
      data-testid="chat-widget"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-navy-700 to-navy-800 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-lime-500 rounded-full flex items-center justify-center">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold">Joffry</h3>
            <p className="text-xs text-slate-300">
              {status === 'with_human' ? 'Connected to agent' : 
               status === 'waiting_human' ? 'Connecting...' : 
               'AI Assistant'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Name Prompt */}
          {showNamePrompt && !sessionId && (
            <div className="p-4 space-y-4">
              <div className="text-center mb-4">
                {startWithHuman ? (
                  <>
                    <Users className="w-16 h-16 mx-auto text-green-500 mb-2" />
                    <h4 className="font-semibold text-lg">Talk to a Representative</h4>
                    <p className="text-sm text-gray-500">Connect with our team directly</p>
                  </>
                ) : (
                  <>
                    <Bot className="w-16 h-16 mx-auto text-amber-500 mb-2" />
                    <h4 className="font-semibold text-lg">Hi! I&apos;m Joffry 👋</h4>
                    <p className="text-sm text-gray-500">Your virtual assistant at DME PROS</p>
                  </>
                )}
              </div>
              
              {/* Toggle: AI vs Live Rep */}
              <div className="flex items-center justify-center gap-3 p-3 bg-gray-50 rounded-xl">
                <button
                  onClick={() => setStartWithHuman(false)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    !startWithHuman 
                      ? 'bg-amber-500 text-white shadow-md' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Bot className="w-4 h-4" />
                  AI Assistant
                </button>
                <button
                  onClick={() => setStartWithHuman(true)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    startWithHuman 
                      ? 'bg-green-500 text-white shadow-md' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Live Rep
                </button>
              </div>
              
              <div className="space-y-3">
                <input
                  type="text"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="Your name (optional)"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
                />
                <input
                  type="email"
                  value={visitorEmail}
                  onChange={(e) => setVisitorEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
                />
                <button
                  onClick={startChat}
                  disabled={isLoading}
                  className={`w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                    startWithHuman
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : startWithHuman ? (
                    <>
                      <Users className="w-5 h-5" />
                      Connect to Rep
                    </>
                  ) : (
                    <>
                      <MessageCircle className="w-5 h-5" />
                      Start Chatting
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          {sessionId && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ height: 'calc(600px - 180px)' }}>
                {messages.filter(m => m.type !== 'whisper').map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    {message.type !== 'system' && (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.type === 'user' ? 'bg-blue-100' :
                        message.type === 'agent' ? 'bg-green-100' : 'bg-amber-100'
                      }`}>
                        {getMessageIcon(message.type)}
                      </div>
                    )}
                    <div className={`max-w-[80%] ${message.type === 'system' ? 'w-full text-center' : ''}`}>
                      {message.type === 'system' ? (
                        <p className="text-xs text-gray-500 bg-gray-100 rounded-lg px-3 py-2">
                          {message.text}
                        </p>
                      ) : (
                        <div className={`rounded-2xl px-4 py-2 ${
                          message.type === 'user' 
                            ? 'bg-blue-500 text-white rounded-br-sm' 
                            : message.type === 'agent'
                            ? 'bg-green-100 text-gray-800 rounded-bl-sm'
                            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                        }`}>
                          {/* Show attachment if present */}
                          {message.attachment && (
                            <div className="mb-2">
                              {message.attachment.content_type?.startsWith('image/') ? (
                                <a href={message.attachment.url} target="_blank" rel="noopener noreferrer">
                                  <img 
                                    src={message.attachment.url} 
                                    alt={message.attachment.filename}
                                    className="max-w-full rounded-lg max-h-48 object-cover"
                                  />
                                </a>
                              ) : (
                                <a 
                                  href={message.attachment.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-2 p-2 rounded-lg ${
                                    message.type === 'user' ? 'bg-blue-400' : 'bg-white/50'
                                  }`}
                                >
                                  {getFileIcon(message.attachment)}
                                  <span className="text-sm truncate">{message.attachment.filename}</span>
                                </a>
                              )}
                            </div>
                          )}
                          {message.text && !message.attachment && (
                            <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                          )}
                          {message.text && message.attachment && (
                            <p className="text-xs opacity-80 mt-1">{message.text}</p>
                          )}
                        </div>
                      )}
                      <p className={`text-xs text-gray-400 mt-1 ${message.type === 'user' ? 'text-right' : ''}`}>
                        {message.agent_name || (message.type === 'ai' ? 'Joffry' : '')}
                        {message.timestamp && new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                      <Bot className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Callback Form */}
              {showCallbackForm && (
                <div className="px-4 py-3 border-t bg-amber-50">
                  <p className="text-sm font-medium text-gray-700 mb-2">Enter your phone number for a callback:</p>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={callbackPhone}
                      onChange={(e) => setCallbackPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
                    />
                    <button
                      onClick={requestCallback}
                      disabled={!callbackPhone.trim() || submittingCallback}
                      className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {submittingCallback ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Phone className="w-4 h-4" />
                      )}
                      Call Me
                    </button>
                  </div>
                  <button
                    onClick={() => setShowCallbackForm(false)}
                    className="text-xs text-gray-500 hover:text-gray-700 mt-2"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              {status === 'active' && !showCallbackForm && (
                <div className="px-4 py-2 border-t flex gap-2">
                  <button
                    onClick={requestHuman}
                    className="flex-1 text-xs py-2 px-3 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center gap-1 transition-colors"
                  >
                    <Phone className="w-3 h-3" />
                    Talk to Human
                  </button>
                  <button
                    onClick={convertToLead}
                    className="flex-1 text-xs py-2 px-3 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg flex items-center justify-center gap-1 transition-colors"
                  >
                    <Ticket className="w-3 h-3" />
                    Get a Callback
                  </button>
                </div>
              )}

              {/* Input */}
              <div className="p-4 border-t">
                {/* Hidden file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.txt"
                />
                
                {/* Upload progress indicator */}
                {isUploading && (
                  <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading file...
                  </div>
                )}
                
                <div className="flex gap-2">
                  {/* File upload button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading || isUploading}
                    className="w-10 h-10 border border-gray-300 text-gray-500 rounded-xl flex items-center justify-center hover:bg-gray-50 transition-all disabled:opacity-50"
                    title="Attach file"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => handleTyping(e.target.value)}
                    onKeyPress={handleKeyPress}
                    onPaste={handlePaste}
                    placeholder="Type a message or paste an image..."
                    className="flex-1 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
                    disabled={isLoading || isUploading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputText.trim() || isLoading || isUploading}
                    className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 text-white rounded-xl flex items-center justify-center hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
