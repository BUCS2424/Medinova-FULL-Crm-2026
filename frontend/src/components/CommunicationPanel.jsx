import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import {
  MessageSquare,
  Mail,
  Phone,
  Send,
  X,
  Loader2,
  Clock,
  User,
  PhoneOutgoing,
  PhoneIncoming,
  MessageCircle,
  Paperclip,
  ChevronRight,
  History,
  Users,
  Grid3X3,
  Voicemail,
  ListOrdered
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function CommunicationPanel({ 
  isOpen, 
  onClose, 
  contactType,
  contactId,
  contactName,
  contactPhone,
  contactEmail 
}) {
  const [activeTab, setActiveTab] = useState('sms');
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [communications, setCommunications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fromNumber, setFromNumber] = useState('');
  const [availableNumbers, setAvailableNumbers] = useState([]);
  const [smsConfig, setSmsConfig] = useState(null);
  const [voiceConfig, setVoiceConfig] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && contactId) {
      loadCommunications();
      loadConfigs();
    }
  }, [isOpen, contactId]);

  useEffect(() => {
    scrollToBottom();
  }, [communications, activeTab]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConfigs = async () => {
    try {
      const token = localStorage.getItem('dme_token');
      const headers = { Authorization: `Bearer ${token}` };

      const smsRes = await axios.get(`${API_URL}/api/sms/config`, { headers });
      setSmsConfig(smsRes.data);
      if (smsRes.data.phone_number) {
        // Only use SMS number for SMS dropdown (not fax/voice numbers)
        setAvailableNumbers([smsRes.data.phone_number]);
        setFromNumber(smsRes.data.phone_number);
      }

      const voiceRes = await axios.get(`${API_URL}/api/voice/config`, { headers });
      if (voiceRes.data?.telnyx) {
        setVoiceConfig(voiceRes.data.telnyx);
      }
    } catch (error) {
      console.error('Failed to load configs:', error);
    }
  };

  const loadCommunications = async () => {
    if (!contactId) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('dme_token');
      const response = await axios.get(
        `${API_URL}/api/sms/communications/history`,
        {
          params: { [`${contactType}_id`]: contactId, limit: 100 },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      // Sort by timestamp ascending for chat view
      const sorted = (response.data.messages || []).sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );
      setCommunications(sorted);
    } catch (error) {
      console.error('Failed to load communications:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendSMS = async () => {
    if (!message.trim() || !contactPhone) {
      toast.error('Please enter a message');
      return;
    }

    setSending(true);
    try {
      const token = localStorage.getItem('dme_token');
      await axios.post(
        `${API_URL}/api/sms/send`,
        {
          to: contactPhone,
          text: message,
          from_number: fromNumber,
          [`${contactType}_id`]: contactId
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('SMS sent');
      setMessage('');
      loadCommunications();
    } catch (error) {
      console.error('Failed to send SMS:', error);
      toast.error(error.response?.data?.detail || 'Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  const sendEmail = async () => {
    if (!message.trim() || !contactEmail) {
      toast.error('Please enter a message');
      return;
    }

    setSending(true);
    try {
      const token = localStorage.getItem('dme_token');
      await axios.post(
        `${API_URL}/api/sms/communications/log`,
        {
          type: 'email',
          direction: 'outbound',
          content: message,
          subject: subject,
          from_address: 'system@mastechmedical.com',
          to_address: contactEmail,
          [`${contactType}_id`]: contactId
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Email logged');
      setMessage('');
      setSubject('');
      loadCommunications();
    } catch (error) {
      console.error('Failed to log email:', error);
      toast.error('Failed to log email');
    } finally {
      setSending(false);
    }
  };

  const makeCall = () => {
    if (!contactPhone) {
      toast.error('No phone number available');
      return;
    }
    const dialerUrl = `/dialer-window?number=${encodeURIComponent(contactPhone)}&name=${encodeURIComponent(contactName || '')}&type=${contactType}&autoCall=true`;
    window.open(dialerUrl, 'phone-dialer', 'width=400,height=700,left=100,top=100');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (activeTab === 'sms') sendSMS();
      else if (activeTab === 'email') sendEmail();
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getFilteredMessages = () => {
    if (activeTab === 'all') return communications;
    return communications.filter(c => c.type === activeTab);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Slide-out Panel */}
      <div className="fixed right-0 top-0 h-full w-[420px] bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b dark:border-slate-700 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{contactName || 'Contact'}</h3>
            <p className="text-xs text-white/80 truncate">
              {contactPhone || contactEmail || 'No contact info'}
            </p>
          </div>
          <button 
            onClick={makeCall}
            disabled={!contactPhone}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
          >
            <Phone className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
          {[
            { id: 'sms', icon: MessageSquare, label: 'SMS', color: 'green' },
            { id: 'email', icon: Mail, label: 'Email', color: 'purple' },
            { id: 'call', icon: Phone, label: 'Calls', color: 'orange' },
            { id: 'all', icon: MessageCircle, label: 'All', color: 'blue' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-all ${
                activeTab === tab.id 
                  ? `text-${tab.color}-600 border-b-2 border-${tab.color}-600 bg-white dark:bg-slate-900` 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4 mb-1" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-slate-800/50">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : getFilteredMessages().length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageCircle className="w-16 h-16 mb-3 opacity-30" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs">Start a conversation below</p>
            </div>
          ) : (
            <>
              {getFilteredMessages().map((comm, index) => {
                const isOutbound = comm.direction === 'outbound';
                const showDate = index === 0 || 
                  new Date(comm.timestamp).toDateString() !== 
                  new Date(getFilteredMessages()[index - 1]?.timestamp).toDateString();
                
                return (
                  <div key={comm._id || index}>
                    {/* Date separator */}
                    {showDate && (
                      <div className="flex items-center justify-center my-4">
                        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-slate-700 px-3 py-1 rounded-full">
                          {new Date(comm.timestamp).toLocaleDateString([], { 
                            weekday: 'short', month: 'short', day: 'numeric' 
                          })}
                        </span>
                      </div>
                    )}
                    
                    {/* Message bubble */}
                    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] ${isOutbound ? 'order-2' : 'order-1'}`}>
                        {/* Type badge */}
                        <div className={`flex items-center gap-1 mb-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {comm.type === 'sms' && <MessageSquare className="w-2.5 h-2.5 mr-1" />}
                            {comm.type === 'email' && <Mail className="w-2.5 h-2.5 mr-1" />}
                            {comm.type === 'call' && <Phone className="w-2.5 h-2.5 mr-1" />}
                            {comm.type?.toUpperCase()}
                          </Badge>
                        </div>
                        
                        {/* Bubble */}
                        <div className={`rounded-2xl px-4 py-2.5 ${
                          isOutbound 
                            ? 'bg-blue-600 text-white rounded-br-md' 
                            : 'bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-100 rounded-bl-md shadow-sm'
                        }`}>
                          {comm.subject && (
                            <p className={`text-xs font-semibold mb-1 ${isOutbound ? 'text-blue-100' : 'text-gray-500'}`}>
                              {comm.subject}
                            </p>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{comm.content || comm.text}</p>
                          {comm.duration_seconds > 0 && (
                            <p className={`text-xs mt-1 ${isOutbound ? 'text-blue-200' : 'text-gray-400'}`}>
                              Duration: {Math.floor(comm.duration_seconds / 60)}:{String(comm.duration_seconds % 60).padStart(2, '0')}
                            </p>
                          )}
                        </div>
                        
                        {/* Timestamp */}
                        <p className={`text-[10px] text-gray-400 mt-1 ${isOutbound ? 'text-right' : 'text-left'}`}>
                          {formatTime(comm.timestamp)}
                          {comm.status && comm.status !== 'sent' && comm.status !== 'received' && (
                            <span className="ml-1">• {comm.status}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          {/* From selector for SMS */}
          {activeTab === 'sms' && availableNumbers.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-500">From:</span>
              <Select value={fromNumber} onValueChange={setFromNumber}>
                <SelectTrigger className="h-7 text-xs w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableNumbers.map(num => (
                    <SelectItem key={num} value={num} className="text-xs">{num}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Subject for Email */}
          {activeTab === 'email' && (
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject..."
              className="mb-2 h-9 text-sm"
            />
          )}

          {/* Message input */}
          {(activeTab === 'sms' || activeTab === 'email') && (
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={activeTab === 'sms' ? "Type a message..." : "Type your email..."}
                  className="min-h-[44px] max-h-[120px] resize-none pr-10 text-sm"
                  rows={1}
                />
                {activeTab === 'sms' && message.length > 0 && (
                  <span className="absolute right-2 bottom-2 text-[10px] text-gray-400">
                    {message.length}/160
                  </span>
                )}
              </div>
              <Button 
                onClick={activeTab === 'sms' ? sendSMS : sendEmail}
                disabled={sending || !message.trim()}
                size="icon"
                className={`h-11 w-11 rounded-full ${
                  activeTab === 'sms' ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </div>
          )}

          {/* Call tab */}
          {activeTab === 'call' && (
            <div className="text-center py-4">
              <Button 
                onClick={makeCall}
                disabled={!contactPhone}
                className="bg-green-600 hover:bg-green-700"
              >
                <Phone className="w-4 h-4 mr-2" />
                Call {contactName || contactPhone}
              </Button>
            </div>
          )}

          {/* All tab - just viewing */}
          {activeTab === 'all' && (
            <p className="text-center text-xs text-gray-400 py-2">
              Select SMS or Email tab to send a message
            </p>
          )}
        </div>

        {/* Bottom Navigation Bar */}
        <div className="flex items-center justify-around py-3 border-t dark:border-slate-700 bg-white dark:bg-slate-900">
          <button 
            onClick={() => setActiveTab('all')}
            className={`flex flex-col items-center gap-1 px-4 py-1 rounded-lg transition-colors ${
              activeTab === 'all' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <History className="w-5 h-5" />
            <span className="text-[10px] font-medium">Recents</span>
          </button>
          <button 
            onClick={() => {/* Navigate to contacts */}}
            className="flex flex-col items-center gap-1 px-4 py-1 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] font-medium">Contacts</span>
          </button>
          <button 
            onClick={makeCall}
            className="flex flex-col items-center gap-1 px-4 py-1 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Grid3X3 className="w-5 h-5" />
            <span className="text-[10px] font-medium">Keypad</span>
          </button>
          <button 
            onClick={() => {/* Open voicemail */}}
            className="flex flex-col items-center gap-1 px-4 py-1 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Voicemail className="w-5 h-5" />
            <span className="text-[10px] font-medium">Voicemail</span>
          </button>
          <button 
            onClick={() => {/* Open queue */}}
            className="flex flex-col items-center gap-1 px-4 py-1 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ListOrdered className="w-5 h-5" />
            <span className="text-[10px] font-medium">Queue</span>
          </button>
        </div>
      </div>
    </>
  );
}
