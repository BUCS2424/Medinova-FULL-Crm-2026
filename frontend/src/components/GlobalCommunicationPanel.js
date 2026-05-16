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
  Phone,
  PhoneOff,
  PhoneIncoming,
  PhoneOutgoing,
  MessageSquare,
  Mail,
  History,
  X,
  Send,
  Loader2,
  Clock,
  User,
  Mic,
  MicOff,
  Pause,
  Play,
  Circle,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Delete,
  Voicemail,
  ExternalLink
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DIAL_PAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#']
];

const CallState = {
  IDLE: 'idle',
  DIALING: 'dialing',
  RINGING: 'ringing',
  INCOMING: 'incoming',
  CONNECTED: 'connected',
  ON_HOLD: 'on_hold',
  ENDED: 'ended'
};

export default function GlobalCommunicationPanel({ isOpen, onClose, phoneConnected }) {
  const [activeTab, setActiveTab] = useState('phone');
  
  // Phone state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callState, setCallState] = useState(CallState.IDLE);
  const [callId, setCallId] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [recentCalls, setRecentCalls] = useState([]);
  
  // SMS state
  const [smsNumber, setSmsNumber] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [sendingSms, setSendingSms] = useState(false);
  const [smsConfig, setSmsConfig] = useState(null);
  const [fromNumber, setFromNumber] = useState('');
  
  // History state
  const [communications, setCommunications] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const durationInterval = useRef(null);
  const callStartTime = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadVoiceConfig();
      loadSmsConfig();
      loadRecentCalls();
      loadCommunicationHistory();
    }
  }, [isOpen]);

  useEffect(() => {
    if (callState === CallState.CONNECTED) {
      callStartTime.current = Date.now();
      durationInterval.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTime.current) / 1000));
      }, 1000);
    } else {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
    }
    
    return () => {
      if (durationInterval.current) clearInterval(durationInterval.current);
    };
  }, [callState]);

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  const loadVoiceConfig = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/voice/config`, { headers: getHeaders() });
      setVoiceEnabled(response.data.telnyx?.enabled || false);
    } catch (error) {
      console.error('Failed to load voice config:', error);
    }
  };

  const loadSmsConfig = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sms/config`, { headers: getHeaders() });
      setSmsConfig(response.data);
      if (response.data.phone_number) {
        setFromNumber(response.data.phone_number);
      }
    } catch (error) {
      console.error('Failed to load SMS config:', error);
    }
  };

  const loadRecentCalls = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/voice/calls?limit=10`, { headers: getHeaders() });
      setRecentCalls(response.data.calls || []);
    } catch (error) {
      console.error('Failed to load recent calls:', error);
    }
  };

  const loadCommunicationHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await axios.get(`${API_URL}/api/sms/communications/history?limit=50`, { headers: getHeaders() });
      setCommunications(response.data.communications || []);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Phone functions
  const handleDialPadPress = (digit) => {
    if (callState === CallState.CONNECTED) {
      toast.info(`DTMF: ${digit}`);
    } else if (callState === CallState.IDLE) {
      setPhoneNumber(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  const handleCall = async () => {
    if (!phoneNumber.trim()) {
      toast.error('Enter a phone number');
      return;
    }

    if (!voiceEnabled) {
      toast.error('Voice not enabled. Configure in Dev Settings.');
      return;
    }

    setCallState(CallState.DIALING);
    try {
      const response = await axios.post(`${API_URL}/api/voice/calls/dial`, 
        { to_number: phoneNumber },
        { headers: getHeaders() }
      );
      
      if (response.data.call_id) {
        setCallId(response.data.call_id);
        setCallState(CallState.RINGING);
        setTimeout(() => {
          if (callState === CallState.RINGING) {
            setCallState(CallState.CONNECTED);
          }
        }, 3000);
      }
    } catch (error) {
      console.error('Call failed:', error);
      toast.error('Failed to place call');
      setCallState(CallState.IDLE);
    }
  };

  const handleHangup = async () => {
    if (!callId) {
      setCallState(CallState.IDLE);
      return;
    }

    try {
      await axios.post(`${API_URL}/api/voice/calls/${callId}/hangup`, {}, { headers: getHeaders() });
      toast.info(`Call ended - ${formatDuration(callDuration)}`);
      resetCall();
      loadRecentCalls();
    } catch (error) {
      console.error('Hangup failed:', error);
      resetCall();
    }
  };

  const handleMute = async () => {
    if (!callId) return;
    try {
      const endpoint = isMuted ? 'unmute' : 'mute';
      await axios.post(`${API_URL}/api/voice/calls/${callId}/${endpoint}`, {}, { headers: getHeaders() });
      setIsMuted(!isMuted);
    } catch (error) {
      console.error('Mute toggle failed:', error);
    }
  };

  const handleRecord = async () => {
    if (!callId) return;
    try {
      const endpoint = isRecording ? 'record/stop' : 'record/start';
      await axios.post(`${API_URL}/api/voice/calls/${callId}/${endpoint}`, {}, { headers: getHeaders() });
      setIsRecording(!isRecording);
      toast.success(isRecording ? 'Recording stopped' : 'Recording started');
    } catch (error) {
      console.error('Record toggle failed:', error);
    }
  };

  const resetCall = () => {
    setCallState(CallState.IDLE);
    setCallId(null);
    setCallDuration(0);
    setIsMuted(false);
    setIsRecording(false);
  };

  // SMS functions
  const handleSendSms = async () => {
    if (!smsNumber.trim() || !smsMessage.trim()) {
      toast.error('Enter phone number and message');
      return;
    }

    setSendingSms(true);
    try {
      await axios.post(`${API_URL}/api/sms/send`, {
        to_number: smsNumber,
        message: smsMessage,
        from_number: fromNumber
      }, { headers: getHeaders() });
      
      toast.success('SMS sent successfully');
      setSmsMessage('');
      loadCommunicationHistory();
    } catch (error) {
      console.error('SMS failed:', error);
      toast.error(error.response?.data?.detail || 'Failed to send SMS');
    } finally {
      setSendingSms(false);
    }
  };

  // Helpers
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPhoneNumber = (number) => {
    const cleaned = (number || '').replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return number;
  };

  const openPopupDialer = () => {
    const width = 400;
    const height = 650;
    const left = window.screen.width - width - 50;
    const top = 50;
    window.open(
      '/dialer-window',
      'PhoneDialer',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      
      {/* Slide-out Panel */}
      <div className="fixed right-0 top-0 h-full w-96 bg-background border-l shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-slate-800 to-slate-900 text-white">
          <h2 className="font-semibold text-lg">Communication Hub</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={openPopupDialer}
              className="text-white hover:bg-white/10"
              title="Open in popup window"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {[
            { id: 'phone', icon: Phone, label: 'Phone' },
            { id: 'sms', icon: MessageSquare, label: 'SMS' },
            { id: 'history', icon: History, label: 'History' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary bg-muted/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {/* Phone Tab */}
          {activeTab === 'phone' && (
            <div className="p-4 space-y-4">
              {/* Status */}
              <div className={`p-3 rounded-lg ${phoneConnected ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${phoneConnected ? 'bg-green-500' : 'bg-amber-500'}`} />
                  <span className="text-sm font-medium">
                    {phoneConnected ? 'Phone Connected' : 'Phone Disconnected'}
                  </span>
                </div>
              </div>

              {/* Phone Input */}
              <div className="relative">
                <Input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Enter phone number"
                  className="text-lg text-center pr-10"
                  disabled={callState !== CallState.IDLE}
                />
                {phoneNumber && callState === CallState.IDLE && (
                  <button
                    onClick={handleBackspace}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
                  >
                    <Delete className="w-5 h-5 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Dial Pad */}
              {callState === CallState.IDLE && (
                <div className="grid grid-cols-3 gap-2">
                  {DIAL_PAD.flat().map((digit) => (
                    <button
                      key={digit}
                      onClick={() => handleDialPadPress(digit)}
                      className="p-4 text-xl font-medium rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                    >
                      {digit}
                    </button>
                  ))}
                </div>
              )}

              {/* Call Button / Active Call Controls */}
              {callState === CallState.IDLE ? (
                <Button
                  onClick={handleCall}
                  className="w-full bg-green-500 hover:bg-green-600"
                  disabled={!phoneNumber.trim() || !voiceEnabled}
                >
                  <Phone className="w-5 h-5 mr-2" />
                  Call
                </Button>
              ) : (
                <div className="space-y-3">
                  {/* Call Status */}
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <Badge className={`mb-2 ${
                      callState === CallState.CONNECTED ? 'bg-green-500' :
                      callState === CallState.DIALING || callState === CallState.RINGING ? 'bg-amber-500' : 'bg-slate-500'
                    }`}>
                      {callState === CallState.DIALING ? 'Dialing...' :
                       callState === CallState.RINGING ? 'Ringing...' :
                       callState === CallState.CONNECTED ? 'Connected' :
                       callState === CallState.ON_HOLD ? 'On Hold' : callState}
                    </Badge>
                    <p className="text-2xl font-mono">{formatDuration(callDuration)}</p>
                    <p className="text-sm text-muted-foreground">{formatPhoneNumber(phoneNumber)}</p>
                  </div>

                  {/* Call Controls */}
                  {callState === CallState.CONNECTED && (
                    <div className="flex justify-center gap-2">
                      <Button
                        variant={isMuted ? 'destructive' : 'outline'}
                        size="icon"
                        onClick={handleMute}
                      >
                        {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant={isRecording ? 'destructive' : 'outline'}
                        size="icon"
                        onClick={handleRecord}
                      >
                        <Circle className={`w-4 h-4 ${isRecording ? 'fill-current' : ''}`} />
                      </Button>
                    </div>
                  )}

                  {/* Hang Up */}
                  <Button
                    onClick={handleHangup}
                    className="w-full bg-red-500 hover:bg-red-600"
                  >
                    <PhoneOff className="w-5 h-5 mr-2" />
                    End Call
                  </Button>
                </div>
              )}

              {/* Recent Calls */}
              {callState === CallState.IDLE && recentCalls.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-3 py-2 text-xs font-medium uppercase text-muted-foreground flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    Recent Calls
                  </div>
                  <ScrollArea className="max-h-40">
                    {recentCalls.map((call) => (
                      <button
                        key={call.id}
                        onClick={() => setPhoneNumber(call.direction === 'inbound' ? call.from_number : call.to_number)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left border-b last:border-0"
                      >
                        {call.direction === 'inbound' ? (
                          <PhoneIncoming className="w-4 h-4 text-blue-500" />
                        ) : (
                          <PhoneOutgoing className="w-4 h-4 text-green-500" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {formatPhoneNumber(call.direction === 'inbound' ? call.from_number : call.to_number)}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {call.duration_seconds ? formatDuration(call.duration_seconds) : '--'}
                        </span>
                      </button>
                    ))}
                  </ScrollArea>
                </div>
              )}

              {/* Voice Not Enabled Warning */}
              {!voiceEnabled && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Voice not configured. Enable in Dev Settings → Voice & Dialer.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* SMS Tab */}
          {activeTab === 'sms' && (
            <div className="p-4 space-y-4">
              {/* From Number */}
              {smsConfig?.phone_number && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">From</label>
                  <Input
                    value={formatPhoneNumber(smsConfig.phone_number)}
                    disabled
                    className="bg-muted"
                  />
                </div>
              )}

              {/* To Number */}
              <div className="space-y-1">
                <label className="text-sm font-medium">To</label>
                <Input
                  value={smsNumber}
                  onChange={(e) => setSmsNumber(e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>

              {/* Message */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Message</label>
                <Textarea
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  placeholder="Type your message..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {smsMessage.length} / 160 characters
                </p>
              </div>

              {/* Send Button */}
              <Button
                onClick={handleSendSms}
                disabled={sendingSms || !smsNumber.trim() || !smsMessage.trim()}
                className="w-full"
              >
                {sendingSms ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send SMS
                  </>
                )}
              </Button>

              {/* SMS Not Configured Warning */}
              {!smsConfig?.enabled && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    SMS not configured. Enable in Dev Settings → SMS Settings.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="p-4">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : communications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No communication history</p>
                </div>
              ) : (
                <ScrollArea className="h-[calc(100vh-200px)]">
                  <div className="space-y-2">
                    {communications.map((comm, idx) => (
                      <div
                        key={comm.id || idx}
                        className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-full ${
                            comm.type === 'sms' ? 'bg-blue-100 text-blue-600' :
                            comm.type === 'call' ? 'bg-green-100 text-green-600' :
                            'bg-purple-100 text-purple-600'
                          }`}>
                            {comm.type === 'sms' ? <MessageSquare className="w-4 h-4" /> :
                             comm.type === 'call' ? <Phone className="w-4 h-4" /> :
                             <Mail className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-sm truncate">
                                {formatPhoneNumber(comm.phone_number || comm.to_number || comm.from_number)}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {comm.direction === 'inbound' ? 'In' : 'Out'}
                              </Badge>
                            </div>
                            {comm.message && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {comm.message}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(comm.created_at || comm.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
