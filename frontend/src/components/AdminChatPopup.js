import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { toast } from 'sonner';
import axios from 'axios';
import {
  MessageCircle,
  Users,
  Clock,
  CheckCircle2,
  Send,
  Bot,
  User,
  UserCheck,
  Volume2,
  VolumeX,
  Loader2,
  RefreshCw,
  X,
  GripHorizontal,
  Minimize2,
  Maximize2,
  ChevronRight,
  Bell,
  BellOff
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('dme_token')}`
});

// Notification sound
const playNotificationSound = () => {
  const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleRkAQZ3R3bJ0GQBDq93XqmcYAEaz4tSfXBcAR7zk0ZRSFgBJxOfOikgVAEzM6ciAPhMATtPszHY0EgBR2u/PbCsRAFTg8dFjIhAAV+bz02oZDgBa7PbVcRANAF3y+dh4CA0AYPT82YEADABA+P7ahwAIAEX6/dqMAAsASfv72Y8ADgBM+/rYkQAQAE/7+NaTABEAUfv22JUAEQBS+/TWlgARAFP79NaXABEAVPvz1pgAEQBV+/LWmAARAFX78daYABAAVvvy1pgAEABW+/HWmAAQAFb78NaYAA8AVvvw1pgADwBW++/WmAAOAFb779aYAA4AVvvu1pgADQBW++7WmAANAFX77taYAAwAVfvt1pgADABV++3WmAALAFX77NaYAAsAVPvs1pgACgBU++zWmAAKAFT76taYAAkAU/vq1pgACQBT++rWmAAIAFP76daYAAgAUvvp1pgABwBS++jWmAAHAFL76NaYAAYAUfvo1pgABgBR++fWmAAFAFH759aYAAUAUPvn1pgABABQ++bWmAAEAE/75taYAAMAT/vm1pgAAwBP++XWmAACAPI/79aYAAIA8T/v1pgAAgDxP+/WmAABAPE/79aYAAEA8T/v1pgAAQDxP+7WmAABAPE/7taYAAEA8T/u1pgAAQDxP+7WmAABAPE/7taYAAEA8T/u1pgAAQA=');
  audio.volume = 0.5;
  audio.play().catch(() => {});
};

export default function AdminChatPopup({ isOpen, onClose }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: null, y: null });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Chat state
  const [stats, setStats] = useState(null);
  const [pendingChats, setPendingChats] = useState([]);
  const [activeChats, setActiveChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [isAvailable, setIsAvailable] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [lastNotificationCount, setLastNotificationCount] = useState(0);
  
  const popupRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Initialize position on mount
  useEffect(() => {
    if (position.x === null && isOpen) {
      setPosition({
        x: window.innerWidth - 520,
        y: 80
      });
    }
  }, [position.x, isOpen]);

  // Drag handlers
  const handleMouseDown = useCallback((e) => {
    if (popupRef.current) {
      setIsDragging(true);
      const rect = popupRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      // Allow the popup to go outside screen bounds (for multi-monitor setups)
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // No bounds checking - popup can be dragged anywhere including off-screen
      setPosition({ x: newX, y: newY });
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Define data fetching functions
  const fetchData = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/chat/admin/dashboard`, {
        headers: getHeaders()
      });
      setStats(response.data.stats);
      setPendingChats(response.data.pending_chats || []);
      setActiveChats(response.data.active_chats || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching chat data:', error);
      setLoading(false);
    }
  };

  const fetchAvailability = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/chat/admin/availability`, {
        headers: getHeaders()
      });
      setIsAvailable(response.data.is_available);
    } catch (error) {
      console.error('Error fetching availability:', error);
    }
  };

  const fetchChatDetails = async (chatId) => {
    try {
      const response = await axios.get(`${API_URL}/api/chat/admin/chat/${chatId}`, {
        headers: getHeaders()
      });
      setSelectedChat(response.data);
    } catch (error) {
      console.error('Error fetching chat details:', error);
    }
  };

  const checkNotifications = () => {
    const newCount = pendingChats.length;
    if (newCount > lastNotificationCount && soundEnabled) {
      playNotificationSound();
      if (Notification.permission === 'granted') {
        new Notification('New Chat Request', {
          body: `${newCount} customer${newCount > 1 ? 's' : ''} waiting for assistance`,
          icon: '/favicon.ico'
        });
      }
    }
    setLastNotificationCount(newCount);
  };

  // Fetch chat data on open
  useEffect(() => {
    if (isOpen) {
      fetchData();
      fetchAvailability();
      
      const interval = setInterval(() => {
        fetchData();
        checkNotifications();
        if (selectedChat) {
          fetchChatDetails(selectedChat.id);
        }
      }, 3000);
      
      return () => clearInterval(interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedChat?.id]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedChat?.messages]);

  const toggleAvailability = async () => {
    try {
      const newStatus = !isAvailable;
      await axios.post(`${API_URL}/api/chat/admin/set-availability`, null, {
        params: { is_available: newStatus },
        headers: getHeaders()
      });
      setIsAvailable(newStatus);
      toast.success(newStatus ? 'You are now available for chats' : 'You are now offline');
    } catch (error) {
      toast.error('Failed to update availability');
    }
  };

  const joinChat = async (chatId) => {
    try {
      await axios.post(`${API_URL}/api/chat/admin/join/${chatId}`, null, {
        headers: getHeaders()
      });
      fetchChatDetails(chatId);
      fetchData();
      toast.success('Joined chat successfully');
    } catch (error) {
      toast.error('Failed to join chat');
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedChat) return;
    
    try {
      await axios.post(`${API_URL}/api/chat/admin/message`, {
        session_id: selectedChat.session_id,
        text: messageInput
      }, {
        headers: getHeaders()
      });
      setMessageInput('');
      fetchChatDetails(selectedChat.id);
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  const closeChat = async (chatId) => {
    try {
      await axios.post(`${API_URL}/api/chat/admin/close/${chatId}`, null, {
        headers: getHeaders()
      });
      setSelectedChat(null);
      fetchData();
      toast.success('Chat closed');
    } catch (error) {
      toast.error('Failed to close chat');
    }
  };

  const getMessageIcon = (type) => {
    switch (type) {
      case 'ai': return <Bot className="w-4 h-4 text-amber-500" />;
      case 'agent': return <UserCheck className="w-4 h-4 text-green-500" />;
      case 'user': return <User className="w-4 h-4 text-blue-500" />;
      default: return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={popupRef}
      className={`fixed bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden transition-all ${
        isMinimized ? 'w-80 h-14' : 'w-[500px] h-[600px]'
      } ${isDragging ? 'cursor-grabbing select-none' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9998
      }}
      data-testid="admin-chat-popup"
    >
      {/* Draggable Header */}
      <div
        className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 py-3 flex items-center justify-between cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-3">
          <MessageCircle className="w-5 h-5" />
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              Live Chat Monitor
              <GripHorizontal className="w-4 h-4 text-slate-400" />
            </h3>
            {!isMinimized && stats && (
              <p className="text-xs text-slate-300">
                {stats.waiting_for_agent || 0} waiting • {stats.with_agent || 0} active
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Availability Toggle */}
          {!isMinimized && (
            <div className="flex items-center gap-2 mr-2">
              <Switch
                checked={isAvailable}
                onCheckedChange={toggleAvailability}
                className="data-[state=checked]:bg-green-500"
              />
              <span className="text-xs">{isAvailable ? 'Online' : 'Offline'}</span>
            </div>
          )}
          
          {/* Notification Badge */}
          {pendingChats.length > 0 && (
            <Badge className="bg-red-500 text-white text-xs px-2">
              {pendingChats.length}
            </Badge>
          )}
          
          <button
            onClick={(e) => { e.stopPropagation(); setSoundEnabled(!soundEnabled); }}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            title={soundEnabled ? 'Mute notifications' : 'Enable notifications'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex h-[calc(100%-56px)]">
          {/* Chat List Sidebar */}
          <div className="w-48 border-r bg-gray-50 overflow-y-auto">
            {/* Pending Chats */}
            {pendingChats.length > 0 && (
              <div className="p-2">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">
                  Waiting ({pendingChats.length})
                </p>
                {pendingChats.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => joinChat(chat.id)}
                    className="w-full p-2 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors mb-2 text-left"
                  >
                    <p className="text-sm font-medium truncate">{chat.visitor_name || 'Visitor'}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(chat.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* Active Chats */}
            <div className="p-2">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">
                Active ({activeChats.length})
              </p>
              {activeChats.length === 0 ? (
                <p className="text-xs text-gray-400 px-2">No active chats</p>
              ) : (
                activeChats.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => fetchChatDetails(chat.id)}
                    className={`w-full p-2 rounded-lg transition-colors mb-2 text-left ${
                      selectedChat?.id === chat.id 
                        ? 'bg-blue-100 border border-blue-300' 
                        : 'bg-white border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <p className="text-sm font-medium truncate">{chat.visitor_name || 'Visitor'}</p>
                    <p className="text-xs text-gray-500">{chat.agent_name}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat Content */}
          <div className="flex-1 flex flex-col">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : selectedChat ? (
              <>
                {/* Chat Header */}
                <div className="p-3 border-b flex items-center justify-between bg-white">
                  <div>
                    <p className="font-medium text-sm">{selectedChat.visitor_name || 'Visitor'}</p>
                    <p className="text-xs text-gray-500">{selectedChat.visitor_email || 'No email'}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => closeChat(selectedChat.id)}
                    className="text-xs"
                  >
                    Close Chat
                  </Button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
                  {selectedChat.messages?.filter(m => m.type !== 'whisper').map((message, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-2 ${message.type === 'agent' ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.type === 'user' ? 'bg-blue-100' :
                        message.type === 'agent' ? 'bg-green-100' : 'bg-amber-100'
                      }`}>
                        {getMessageIcon(message.type)}
                      </div>
                      <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                        message.type === 'agent' 
                          ? 'bg-green-500 text-white' 
                          : message.type === 'ai'
                          ? 'bg-amber-100 text-gray-800'
                          : 'bg-white text-gray-800 border'
                      }`}>
                        {message.text}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-3 border-t bg-white">
                  <div className="flex gap-2">
                    <Input
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Type a message..."
                      className="text-sm"
                    />
                    <Button onClick={sendMessage} size="sm">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-4">
                <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm font-medium">No chat selected</p>
                <p className="text-xs text-center mt-1">
                  {pendingChats.length > 0 
                    ? 'Click on a waiting chat to join'
                    : 'Waiting for new chat requests...'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
