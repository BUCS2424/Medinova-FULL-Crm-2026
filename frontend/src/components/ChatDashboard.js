import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { toast } from 'sonner';
import axios from 'axios';
import {
  MessageCircle,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  Phone,
  Bot,
  User,
  UserCheck,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Loader2,
  RefreshCw,
  Ticket,
  X,
  ChevronRight,
  MessageSquare
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

export default function ChatDashboard() {
  const [stats, setStats] = useState(null);
  const [pendingChats, setPendingChats] = useState([]);
  const [activeChats, setActiveChats] = useState([]);
  const [myChats, setMyChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [whisperInput, setWhisperInput] = useState('');
  const [isAvailable, setIsAvailable] = useState(false);
  const [availableFrom, setAvailableFrom] = useState('09:00');
  const [availableTo, setAvailableTo] = useState('17:00');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [supervisingChat, setSupervisingChat] = useState(null);
  const [userTypingText, setUserTypingText] = useState('');
  const [lastNotificationCount, setLastNotificationCount] = useState(0);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchData();
    fetchAvailability();
    
    // Poll for updates
    const interval = setInterval(() => {
      fetchData();
      checkNotifications();
      if (selectedChat) {
        fetchChatDetails(selectedChat.id);
        fetchUserTyping(selectedChat.id);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [selectedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedChat?.messages]);

  const fetchData = async () => {
    try {
      const [statsRes, pendingRes, activeRes, myRes] = await Promise.all([
        axios.get(`${API_URL}/api/chat/admin/stats`, { headers: getHeaders() }),
        axios.get(`${API_URL}/api/chat/admin/pending`, { headers: getHeaders() }),
        axios.get(`${API_URL}/api/chat/admin/active`, { headers: getHeaders() }),
        axios.get(`${API_URL}/api/chat/admin/my-chats`, { headers: getHeaders() })
      ]);
      
      setStats(statsRes.data);
      setPendingChats(pendingRes.data.chats || []);
      setActiveChats(activeRes.data.chats || []);
      setMyChats(myRes.data.chats || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailability = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/chat/admin/availability`, { headers: getHeaders() });
      setIsAvailable(response.data.is_available || false);
      setAvailableFrom(response.data.available_from || '09:00');
      setAvailableTo(response.data.available_to || '17:00');
    } catch (error) {
      console.error('Error fetching availability:', error);
    }
  };

  const checkNotifications = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/chat/admin/notifications`, { headers: getHeaders() });
      const count = response.data.count || 0;
      
      if (count > lastNotificationCount && soundEnabled) {
        playNotificationSound();
      }
      setLastNotificationCount(count);
    } catch (error) {
      console.error('Error checking notifications:', error);
    }
  };

  const fetchChatDetails = async (chatId) => {
    try {
      const chat = activeChats.find(c => c.id === chatId) || pendingChats.find(c => c.id === chatId);
      if (chat) {
        const response = await axios.get(`${API_URL}/api/chat/history/${chat.session_id}`, { headers: getHeaders() });
        setSelectedChat(response.data);
      }
    } catch (error) {
      console.error('Error fetching chat details:', error);
    }
  };

  const fetchUserTyping = async (chatId) => {
    try {
      const response = await axios.get(`${API_URL}/api/chat/admin/typing/${chatId}`, { headers: getHeaders() });
      setUserTypingText(response.data.typing_text || '');
    } catch (error) {
      console.error('Error fetching typing:', error);
    }
  };

  const updateAvailability = async (available) => {
    try {
      await axios.post(`${API_URL}/api/chat/admin/availability`, {
        is_available: available,
        available_from: availableFrom,
        available_to: availableTo
      }, { headers: getHeaders() });
      
      setIsAvailable(available);
      toast.success(available ? 'You are now available for chats' : 'You are now offline');
    } catch (error) {
      toast.error('Failed to update availability');
    }
  };

  const joinChat = async (chatId) => {
    try {
      await axios.post(`${API_URL}/api/chat/admin/join/${chatId}`, {}, { headers: getHeaders() });
      toast.success('Joined chat');
      fetchData();
      
      const chat = pendingChats.find(c => c.id === chatId);
      if (chat) {
        const response = await axios.get(`${API_URL}/api/chat/history/${chat.session_id}`, { headers: getHeaders() });
        setSelectedChat(response.data);
      }
    } catch (error) {
      toast.error('Failed to join chat');
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedChat) return;
    
    try {
      await axios.post(`${API_URL}/api/chat/admin/message/${selectedChat.id}`, null, {
        params: { text: messageInput },
        headers: getHeaders()
      });
      
      setMessageInput('');
      fetchChatDetails(selectedChat.id);
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  const sendWhisper = async (agentId) => {
    if (!whisperInput.trim() || !supervisingChat) return;
    
    try {
      await axios.post(`${API_URL}/api/chat/admin/whisper/${supervisingChat.id}`, null, {
        params: { agent_id: agentId, text: whisperInput },
        headers: getHeaders()
      });
      
      setWhisperInput('');
      toast.success('Whisper sent');
    } catch (error) {
      toast.error('Failed to send whisper');
    }
  };

  const closeChat = async (chatId) => {
    try {
      const response = await axios.post(`${API_URL}/api/chat/admin/close/${chatId}`, {}, { headers: getHeaders() });
      toast.success('Chat closed');
      setSelectedChat(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to close chat');
    }
  };

  const startSupervising = async (chat) => {
    try {
      await axios.post(`${API_URL}/api/chat/admin/supervise/${chat.id}`, {}, { headers: getHeaders() });
      setSupervisingChat(chat);
      toast.success('Now supervising this chat');
    } catch (error) {
      toast.error('Failed to start supervising');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'waiting_human':
        return <Badge className="bg-yellow-100 text-yellow-700"><AlertCircle className="w-3 h-3 mr-1" />Waiting</Badge>;
      case 'with_human':
        return <Badge className="bg-green-100 text-green-700"><UserCheck className="w-3 h-3 mr-1" />With Agent</Badge>;
      case 'active':
        return <Badge className="bg-blue-100 text-blue-700"><Bot className="w-3 h-3 mr-1" />AI Active</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="chat-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Chat Dashboard</h2>
          <p className="text-muted-foreground">Manage customer conversations</p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Mute notifications' : 'Enable notifications'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
          <div className="flex items-center gap-2">
            <Switch
              checked={isAvailable}
              onCheckedChange={updateAvailability}
              id="availability"
            />
            <Label htmlFor="availability" className={isAvailable ? 'text-green-600' : 'text-gray-500'}>
              {isAvailable ? 'Available' : 'Offline'}
            </Label>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold">{stats.active}</div>
              <p className="text-xs text-muted-foreground">Active Chats</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-yellow-600">{stats.waiting_for_human}</div>
              <p className="text-xs text-muted-foreground">Waiting</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-green-600">{stats.with_human}</div>
              <p className="text-xs text-muted-foreground">With Agent</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold">{stats.closed}</div>
              <p className="text-xs text-muted-foreground">Closed Today</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-purple-600">{stats.converted_to_leads}</div>
              <p className="text-xs text-muted-foreground">Leads Created</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.available_agents}</div>
              <p className="text-xs text-muted-foreground">Agents Online</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chat List */}
        <div className="lg:col-span-1 space-y-4">
          {/* Pending Chats */}
          {pendingChats.length > 0 && (
            <Card className="border-yellow-200 bg-yellow-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  Waiting for Agent ({pendingChats.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingChats.map(chat => (
                  <div
                    key={chat.id}
                    className="p-3 bg-white rounded-lg border border-yellow-200 cursor-pointer hover:border-yellow-400 transition-colors"
                    onClick={() => setSelectedChat(chat)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{chat.visitor_name || 'Visitor'}</span>
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); joinChat(chat.id); }}>
                        Join
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {chat.messages?.[chat.messages.length - 1]?.text || 'No messages'}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* My Active Chats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                My Chats ({myChats.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {myChats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No active chats</p>
              ) : (
                myChats.map(chat => (
                  <div
                    key={chat.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedChat?.id === chat.id ? 'border-primary bg-primary/5' : 'hover:border-gray-300'
                    }`}
                    onClick={() => fetchChatDetails(chat.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{chat.visitor_name || 'Visitor'}</span>
                      {getStatusBadge(chat.status)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {chat.messages?.[chat.messages.length - 1]?.text || 'No messages'}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* All Active Chats (for supervisors) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="w-5 h-5" />
                All Active ({activeChats.filter(c => c.status === 'with_human').length})
              </CardTitle>
              <CardDescription>Monitor other agents' chats</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-64 overflow-y-auto">
              {activeChats.filter(c => c.status === 'with_human' && c.agent_id).map(chat => (
                <div
                  key={chat.id}
                  className="p-3 rounded-lg border cursor-pointer hover:border-gray-300 transition-colors"
                  onClick={() => startSupervising(chat)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{chat.visitor_name || 'Visitor'}</span>
                    <Badge variant="outline" className="text-xs">{chat.agent_name}</Badge>
                  </div>
                  {chat.typing_text && (
                    <p className="text-xs text-amber-600 mt-1 italic">
                      Typing: {chat.typing_text.substring(0, 30)}...
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Chat Window */}
        <div className="lg:col-span-2">
          {selectedChat ? (
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="pb-2 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {selectedChat.visitor_name || 'Visitor'}
                    </CardTitle>
                    <CardDescription>
                      {selectedChat.visitor_email || 'No email provided'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedChat.status)}
                    {selectedChat.status === 'with_human' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => closeChat(selectedChat.id)}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Close
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* AI Conversation History Accordion */}
                <Accordion type="single" collapsible className="mt-2">
                  <AccordionItem value="ai-history">
                    <AccordionTrigger className="text-sm py-2">
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4" />
                        View AI Conversation History
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="max-h-40 overflow-y-auto space-y-2 p-2 bg-gray-50 rounded">
                        {selectedChat.messages?.filter(m => m.type === 'ai' || (m.type === 'user' && selectedChat.messages.indexOf(m) < selectedChat.messages.findIndex(x => x.type === 'system' && x.text.includes('joined')))).map(msg => (
                          <div key={msg.id} className={`text-xs p-2 rounded ${msg.type === 'user' ? 'bg-blue-50 ml-4' : 'bg-amber-50 mr-4'}`}>
                            <span className="font-medium">{msg.type === 'user' ? 'User' : 'Joffry'}:</span> {msg.text}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedChat.messages?.filter(m => m.type !== 'whisper' || m.to_agent_id === localStorage.getItem('dme_user_id')).map(msg => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.type === 'agent' ? 'flex-row-reverse' : ''} ${msg.type === 'whisper' ? 'opacity-75' : ''}`}
                  >
                    {msg.type !== 'system' && (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.type === 'user' ? 'bg-blue-100' :
                        msg.type === 'agent' ? 'bg-green-100' :
                        msg.type === 'whisper' ? 'bg-purple-100' : 'bg-amber-100'
                      }`}>
                        {msg.type === 'user' && <User className="w-4 h-4 text-blue-600" />}
                        {msg.type === 'agent' && <UserCheck className="w-4 h-4 text-green-600" />}
                        {msg.type === 'ai' && <Bot className="w-4 h-4 text-amber-600" />}
                        {msg.type === 'whisper' && <MessageSquare className="w-4 h-4 text-purple-600" />}
                      </div>
                    )}
                    <div className={`max-w-[75%] ${msg.type === 'system' ? 'w-full text-center' : ''}`}>
                      {msg.type === 'whisper' && (
                        <p className="text-xs text-purple-600 mb-1">Whisper from {msg.from_name}</p>
                      )}
                      {msg.type === 'system' ? (
                        <p className="text-xs text-gray-500 bg-gray-100 rounded px-3 py-2">{msg.text}</p>
                      ) : (
                        <div className={`rounded-2xl px-4 py-2 ${
                          msg.type === 'user' ? 'bg-blue-100' :
                          msg.type === 'agent' ? 'bg-green-100' :
                          msg.type === 'whisper' ? 'bg-purple-100 border border-purple-200' :
                          'bg-amber-50'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* User Typing Indicator */}
                {userTypingText && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-600 font-medium mb-1">User is typing:</p>
                    <p className="text-sm text-gray-700">{userTypingText}</p>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </CardContent>

              {/* Input */}
              {selectedChat.status === 'with_human' && selectedChat.agent_id && (
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Type a message..."
                    />
                    <Button onClick={sendMessage}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <Card className="h-[600px] flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>Select a chat to view messages</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Supervisor Whisper Panel */}
      {supervisingChat && (
        <Card className="fixed bottom-4 right-4 w-96 shadow-xl z-50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Supervising: {supervisingChat.visitor_name || 'Visitor'}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSupervisingChat(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <CardDescription className="text-xs">
              Agent: {supervisingChat.agent_name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              value={whisperInput}
              onChange={(e) => setWhisperInput(e.target.value)}
              placeholder="Send a private whisper to the agent..."
              rows={2}
            />
            <Button 
              size="sm" 
              className="w-full"
              onClick={() => sendWhisper(supervisingChat.agent_id)}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Send Whisper
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
