import { useState, useEffect, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast, Toaster } from 'sonner';
import axios from 'axios';
import {
  MessageCircle,
  Users,
  Clock,
  Send,
  Bot,
  User,
  UserCheck,
  Volume2,
  VolumeX,
  Loader2,
  RefreshCw,
  X,
  CheckCircle2,
  MoreVertical,
  UserPlus,
  Download,
  Ticket,
  Search,
  Paperclip,
  Image,
  FileText,
  File,
  Trash2,
  Phone
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

export default function AdminChatWindowPage() {
  const [stats, setStats] = useState(null);
  const [pendingChats, setPendingChats] = useState([]);
  const [activeChats, setActiveChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [isAvailable, setIsAvailable] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [lastNotificationCount, setLastNotificationCount] = useState(0);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  // Patient assignment dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [searchingPatients, setSearchingPatients] = useState(false);

  // Lead assignment dialog state
  const [assignLeadDialogOpen, setAssignLeadDialogOpen] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadResults, setLeadResults] = useState([]);
  const [searchingLeads, setSearchingLeads] = useState(false);

  // Ticket dialog state
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketPriority, setTicketPriority] = useState('medium');
  const [creatingTicket, setCreatingTicket] = useState(false);

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);

  // Check if user is authenticated
  useEffect(() => {
    const token = localStorage.getItem('dme_token');
    if (!token) {
      window.close();
      return;
    }
    
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat?.id]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedChat?.messages]);

  // Update window title with pending count
  useEffect(() => {
    const count = pendingChats.length;
    document.title = count > 0 ? `(${count}) Live Chat Monitor` : 'Live Chat Monitor';
  }, [pendingChats.length]);

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

  // Search patients for assignment
  const searchPatients = async (query) => {
    if (!query || query.length < 2) {
      setPatientResults([]);
      return;
    }
    
    setSearchingPatients(true);
    try {
      const response = await axios.get(`${API_URL}/api/patients`, {
        params: { search: query, limit: 10 },
        headers: getHeaders()
      });
      setPatientResults(response.data.patients || response.data || []);
    } catch (error) {
      console.error('Error searching patients:', error);
    } finally {
      setSearchingPatients(false);
    }
  };

  // Search leads for assignment
  const searchLeads = async (query) => {
    if (!query || query.length < 2) {
      setLeadResults([]);
      return;
    }
    
    setSearchingLeads(true);
    try {
      const response = await axios.get(`${API_URL}/api/leads`, {
        params: { limit: 50 },
        headers: getHeaders()
      });
      // Filter leads client-side by search query
      const allLeads = response.data || [];
      const filtered = allLeads.filter(lead => {
        const searchLower = query.toLowerCase();
        const name = `${lead.first_name || ''} ${lead.last_name || ''}`.toLowerCase();
        const email = (lead.email || '').toLowerCase();
        const phone = (lead.phone || '').toLowerCase();
        return name.includes(searchLower) || email.includes(searchLower) || phone.includes(searchLower);
      }).slice(0, 10);
      setLeadResults(filtered);
    } catch (error) {
      console.error('Error searching leads:', error);
    } finally {
      setSearchingLeads(false);
    }
  };

  // Assign chat to lead
  const assignToLead = async (leadId, leadName) => {
    if (!selectedChat) return;
    
    try {
      await axios.post(`${API_URL}/api/chat/admin/assign-lead`, {
        chat_id: selectedChat.id,
        lead_id: leadId
      }, {
        headers: getHeaders()
      });
      toast.success(`Chat assigned to lead: ${leadName} - Chat closed`);
      setAssignLeadDialogOpen(false);
      setLeadSearch('');
      setLeadResults([]);
      setSelectedChat(null);
      fetchData(); // Refresh sidebar to remove assigned chat
    } catch (error) {
      toast.error('Failed to assign chat to lead');
    }
  };

  // Create new lead from chat and assign
  const createLeadFromChat = async () => {
    if (!selectedChat) return;
    
    try {
      const response = await axios.post(`${API_URL}/api/chat/admin/create-lead-from-chat`, {
        chat_id: selectedChat.id
      }, {
        headers: getHeaders()
      });
      
      const lead = response.data.lead;
      toast.success(`Lead "${lead.first_name} ${lead.last_name}" created and chat assigned`);
      setAssignLeadDialogOpen(false);
      setLeadSearch('');
      setLeadResults([]);
      setSelectedChat(null);
      fetchData(); // Refresh sidebar to remove assigned chat
    } catch (error) {
      toast.error('Failed to create lead from chat');
    }
  };

  // Assign chat to patient (updated to close and refresh)
  const assignToPatient = async (patientId, patientName) => {
    if (!selectedChat) return;
    
    try {
      await axios.post(`${API_URL}/api/chat/admin/assign-patient`, {
        chat_id: selectedChat.id,
        patient_id: patientId
      }, {
        headers: getHeaders()
      });
      toast.success(`Chat assigned to ${patientName} - Chat closed`);
      setAssignDialogOpen(false);
      setPatientSearch('');
      setPatientResults([]);
      setSelectedChat(null);
      fetchData(); // Refresh sidebar to remove assigned chat
    } catch (error) {
      toast.error('Failed to assign chat to patient');
    }
  };

  // Download chat transcript
  const downloadTranscript = () => {
    if (!selectedChat) return;
    
    const messages = selectedChat.messages || [];
    let transcript = `Chat Transcript\n`;
    transcript += `================\n`;
    transcript += `Visitor: ${selectedChat.visitor_name || 'Unknown'}\n`;
    transcript += `Email: ${selectedChat.visitor_email || 'N/A'}\n`;
    transcript += `Date: ${new Date(selectedChat.created_at).toLocaleString()}\n`;
    if (selectedChat.patient_id) {
      transcript += `Assigned to Patient ID: ${selectedChat.patient_id}\n`;
    }
    if (selectedChat.lead_id) {
      transcript += `Assigned to Lead ID: ${selectedChat.lead_id}\n`;
    }
    transcript += `================\n\n`;
    
    // Collect attachments
    const attachments = [];
    
    messages.forEach(msg => {
      const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const sender = msg.type === 'user' ? (selectedChat.visitor_name || 'Visitor') : 
                     msg.type === 'ai' ? 'Joffry (AI)' : 
                     msg.type === 'agent' ? (msg.agent_name || 'Agent') : 'System';
      
      if (msg.attachment) {
        transcript += `[${time}] ${sender}: [Attachment: ${msg.attachment.filename}]\n`;
        transcript += `         URL: ${window.location.origin}${msg.attachment.url}\n\n`;
        attachments.push({
          filename: msg.attachment.filename,
          url: `${window.location.origin}${msg.attachment.url}`,
          type: msg.attachment.content_type
        });
      } else {
        transcript += `[${time}] ${sender}: ${msg.text}\n\n`;
      }
    });
    
    // Add attachments summary
    if (attachments.length > 0) {
      transcript += `\n================\n`;
      transcript += `ATTACHMENTS (${attachments.length})\n`;
      transcript += `================\n`;
      attachments.forEach((att, idx) => {
        transcript += `${idx + 1}. ${att.filename}\n`;
        transcript += `   Type: ${att.type}\n`;
        transcript += `   URL: ${att.url}\n\n`;
      });
    }
    
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-transcript-${selectedChat.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Transcript downloaded');
  };

  // Convert chat to support ticket
  const convertToTicket = async () => {
    if (!selectedChat) return;
    
    setCreatingTicket(true);
    try {
      const response = await axios.post(`${API_URL}/api/tickets`, {
        subject: ticketSubject || `Chat support request from ${selectedChat.visitor_name || 'Visitor'}`,
        description: `Chat transcript attached.\n\nVisitor: ${selectedChat.visitor_name || 'Unknown'}\nEmail: ${selectedChat.visitor_email || 'N/A'}`,
        priority: ticketPriority,
        source: 'chat',
        source_id: selectedChat.id,
        contact_name: selectedChat.visitor_name,
        contact_email: selectedChat.visitor_email,
        chat_messages: selectedChat.messages
      }, {
        headers: getHeaders()
      });
      
      toast.success(`Ticket #${response.data.ticket_number || response.data.id} created`);
      setTicketDialogOpen(false);
      setTicketSubject('');
      setTicketPriority('medium');
    } catch (error) {
      toast.error('Failed to create ticket');
    } finally {
      setCreatingTicket(false);
    }
  };

  // Handle file upload from admin
  const handleFileUpload = async (file) => {
    if (!selectedChat || !file) return;
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }
    
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('session_id', selectedChat.session_id);
      formData.append('is_agent', 'true');
      
      await axios.post(`${API_URL}/api/chat/upload`, formData, {
        headers: { 
          ...getHeaders(),
          'Content-Type': 'multipart/form-data' 
        }
      });
      
      toast.success('File uploaded');
      fetchChatDetails(selectedChat.id);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
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
    e.target.value = '';
  };

  // Handle paste for images
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

  // Delete chat
  const deleteChat = async () => {
    if (!selectedChat) return;
    
    setDeletingChat(true);
    try {
      await axios.delete(`${API_URL}/api/chat/admin/chat/${selectedChat.id}`, {
        headers: getHeaders()
      });
      
      toast.success('Chat deleted');
      setDeleteDialogOpen(false);
      setSelectedChat(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to delete chat');
    } finally {
      setDeletingChat(false);
    }
  };

  const getMessageIcon = (type) => {
    switch (type) {
      case 'ai': return <Bot className="w-4 h-4 text-lime-500" />;
      case 'agent': return <UserCheck className="w-4 h-4 text-green-500" />;
      case 'user': return <User className="w-4 h-4 text-blue-500" />;
      default: return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Toaster position="top-right" richColors />
      
      {/* Header */}
      <div className="bg-gradient-to-r from-navy-800 to-navy-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-6 h-6" />
          <div>
            <h1 className="font-bold text-lg">Live Chat Monitor</h1>
            {stats && (
              <p className="text-xs text-slate-300">
                {stats.waiting_for_agent || 0} waiting • {stats.with_agent || 0} active
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Availability Toggle */}
          <div className="flex items-center gap-2">
            <Switch
              checked={isAvailable}
              onCheckedChange={toggleAvailability}
              className="data-[state=checked]:bg-green-500"
            />
            <span className="text-sm font-medium">{isAvailable ? 'Online' : 'Offline'}</span>
          </div>
          
          {/* Pending Badge */}
          {pendingChats.length > 0 && (
            <Badge className="bg-red-500 text-white px-3 py-1">
              {pendingChats.length} waiting
            </Badge>
          )}
          
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title={soundEnabled ? 'Mute notifications' : 'Enable notifications'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          
          {/* Refresh */}
          <button
            onClick={fetchData}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat List Sidebar */}
        <div className="w-64 bg-white border-r overflow-y-auto">
          {/* Pending Chats */}
          {pendingChats.length > 0 && (
            <div className="p-3 border-b">
              <p className="text-xs font-semibold text-orange-600 uppercase mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Waiting ({pendingChats.length})
              </p>
              <div className="space-y-2">
                {pendingChats.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => joinChat(chat.id)}
                    className="w-full p-3 rounded-lg bg-lime-50 border border-lime-200 hover:bg-lime-100 transition-colors text-left"
                  >
                    <p className="font-medium truncate">{chat.visitor_name || 'Visitor'}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {chat.visitor_email || 'No email'}
                    </p>
                    <p className="text-xs text-lime-600 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(chat.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active Chats */}
          <div className="p-3">
            <p className="text-xs font-semibold text-green-600 uppercase mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Active ({activeChats.length})
            </p>
            {activeChats.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No active chats</p>
            ) : (
              <div className="space-y-2">
                {activeChats.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => fetchChatDetails(chat.id)}
                    className={`w-full p-3 rounded-lg transition-colors text-left ${
                      selectedChat?.id === chat.id 
                        ? 'bg-blue-100 border-2 border-blue-400' 
                        : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <p className="font-medium truncate">{chat.visitor_name || 'Visitor'}</p>
                    <p className="text-xs text-gray-500">{chat.agent_name}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Content */}
        <div className="flex-1 flex flex-col bg-white">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                <div>
                  <p className="font-semibold text-lg">{selectedChat.visitor_name || 'Visitor'}</p>
                  <p className="text-sm text-gray-500">{selectedChat.visitor_email || 'No email provided'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-green-600 border-green-300">
                    Active
                  </Badge>
                  
                  {/* 3-Dot Dropdown Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="px-2">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => setAssignDialogOpen(true)}>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Assign to Patient
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAssignLeadDialogOpen(true)}>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Assign to Lead
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={downloadTranscript}>
                        <Download className="w-4 h-4 mr-2" />
                        Download Transcript
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => {
                        setTicketSubject(`Support request from ${selectedChat.visitor_name || 'Visitor'}`);
                        setTicketDialogOpen(true);
                      }}>
                        <Ticket className="w-4 h-4 mr-2" />
                        Convert to Ticket
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setDeleteDialogOpen(true)}
                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Chat
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => closeChat(selectedChat.id)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Close Chat
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {selectedChat.messages?.filter(m => m.type !== 'whisper').map((message, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3 ${message.type === 'agent' ? 'flex-row-reverse' : ''} ${message.type === 'callback_request' ? 'justify-center' : ''}`}
                  >
                    {/* Callback Request - Special Display */}
                    {message.type === 'callback_request' ? (
                      <div className="w-full max-w-md bg-red-50 border-2 border-red-300 rounded-xl p-4 shadow-md animate-pulse">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                            <Phone className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-red-700 text-lg">CALLBACK REQUESTED</p>
                            <p className="text-gray-700 font-medium">{message.visitor_name || 'Visitor'}</p>
                            <a 
                              href={`tel:${message.phone}`}
                              className="text-xl font-bold text-red-600 hover:text-red-800 flex items-center gap-2"
                            >
                              <Phone className="w-5 h-5" />
                              {message.phone}
                            </a>
                            <p className="text-xs text-gray-500 mt-1">
                              {message.timestamp && new Date(message.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          message.type === 'user' ? 'bg-blue-100' :
                          message.type === 'agent' ? 'bg-green-100' : 'bg-lime-100'
                        }`}>
                          {getMessageIcon(message.type)}
                        </div>
                        <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                          message.type === 'agent' 
                            ? 'bg-green-500 text-white' 
                            : message.type === 'ai'
                            ? 'bg-lime-100 text-gray-800'
                            : 'bg-white text-gray-800 border shadow-sm'
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
                                    message.type === 'agent' ? 'bg-green-400' : 'bg-gray-100'
                                  }`}
                                >
                                  {getFileIcon(message.attachment)}
                                  <span className="text-sm truncate">{message.attachment.filename}</span>
                                </a>
                              )}
                            </div>
                          )}
                          {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
                          <p className={`text-xs mt-1 ${message.type === 'agent' ? 'text-green-100' : 'text-gray-400'}`}>
                            {message.timestamp && new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t bg-white">
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
                
                <div className="flex gap-3">
                  {/* File upload button */}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    title="Attach file"
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    onPaste={handlePaste}
                    placeholder="Type a message or paste an image..."
                    className="flex-1"
                    disabled={isUploading}
                  />
                  <Button onClick={sendMessage} className="px-6" disabled={isUploading}>
                    <Send className="w-4 h-4 mr-2" />
                    Send
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <MessageCircle className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-xl font-medium">No chat selected</p>
              <p className="text-sm mt-2">
                {pendingChats.length > 0 
                  ? 'Click on a waiting chat to join and start helping'
                  : 'Waiting for new chat requests...'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Assign to Patient Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Chat to Patient</DialogTitle>
            <DialogDescription>
              Search for a patient to link this chat conversation to their record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  searchPatients(e.target.value);
                }}
                className="pl-10"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {searchingPatients ? (
                <div className="text-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                </div>
              ) : patientResults.length > 0 ? (
                patientResults.map(patient => (
                  <button
                    key={patient.id}
                    onClick={() => assignToPatient(patient.id, `${patient.first_name} ${patient.last_name}`)}
                    className="w-full p-3 text-left rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <p className="font-medium">{patient.first_name} {patient.last_name}</p>
                    <p className="text-sm text-gray-500">{patient.email || patient.phone || 'No contact info'}</p>
                  </button>
                ))
              ) : patientSearch.length >= 2 ? (
                <p className="text-center text-gray-400 py-4">No patients found</p>
              ) : (
                <p className="text-center text-gray-400 py-4">Type at least 2 characters to search</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign to Lead Dialog */}
      <Dialog open={assignLeadDialogOpen} onOpenChange={setAssignLeadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Chat to Lead</DialogTitle>
            <DialogDescription>
              Search for a lead to link this chat conversation to their record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={leadSearch}
                onChange={(e) => {
                  setLeadSearch(e.target.value);
                  searchLeads(e.target.value);
                }}
                className="pl-10"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {searchingLeads ? (
                <div className="text-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                </div>
              ) : leadResults.length > 0 ? (
                leadResults.map(lead => (
                  <button
                    key={lead.id}
                    onClick={() => assignToLead(lead.id, `${lead.first_name} ${lead.last_name}`)}
                    className="w-full p-3 text-left rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <p className="font-medium">{lead.first_name} {lead.last_name}</p>
                    <p className="text-sm text-gray-500">{lead.email || lead.phone || 'No contact info'}</p>
                    {lead.status && (
                      <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                        lead.status === 'new' ? 'bg-blue-100 text-blue-700' :
                        lead.status === 'contacted' ? 'bg-yellow-100 text-yellow-700' :
                        lead.status === 'qualified' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {lead.status}
                      </span>
                    )}
                  </button>
                ))
              ) : leadSearch.length >= 2 ? (
                <div className="text-center py-4">
                  <p className="text-gray-400 mb-3">No leads found</p>
                  <Button 
                    onClick={createLeadFromChat}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create New Lead from Chat
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-400 mb-3">Type at least 2 characters to search</p>
                  <p className="text-sm text-gray-500 mb-3">Or create a new lead directly:</p>
                  <Button 
                    onClick={createLeadFromChat}
                    variant="outline"
                    className="border-green-500 text-green-600 hover:bg-green-50"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create New Lead from Chat
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Convert to Ticket Dialog */}
      <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convert to Support Ticket</DialogTitle>
            <DialogDescription>
              Create a support ticket from this chat conversation. The chat transcript will be attached.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject</label>
              <Input
                placeholder="Ticket subject..."
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <div className="flex gap-2">
                {['low', 'medium', 'high', 'urgent'].map(p => (
                  <button
                    key={p}
                    onClick={() => setTicketPriority(p)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium capitalize transition-colors ${
                      ticketPriority === p
                        ? p === 'urgent' ? 'bg-red-500 text-white' :
                          p === 'high' ? 'bg-orange-500 text-white' :
                          p === 'medium' ? 'bg-blue-500 text-white' :
                          'bg-gray-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTicketDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={convertToTicket} disabled={creatingTicket}>
              {creatingTicket ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Ticket className="w-4 h-4 mr-2" />
                  Create Ticket
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Chat Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Chat</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this chat? This action cannot be undone. 
              All messages and attachments will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={deleteChat} 
              disabled={deletingChat}
            >
              {deletingChat ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Chat
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
