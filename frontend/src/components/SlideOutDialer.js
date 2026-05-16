import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Mic,
  MicOff,
  Pause,
  Play,
  ArrowRightLeft,
  Circle,
  Volume2,
  VolumeX,
  User,
  Clock,
  History,
  X,
  ChevronUp,
  ChevronDown,
  Delete,
  Loader2,
  Minimize2,
  Maximize2
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

export default function SlideOutDialer({ isCollapsed, isConnected = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callState, setCallState] = useState(CallState.IDLE);
  const [callId, setCallId] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferNumber, setTransferNumber] = useState('');
  const [recentCalls, setRecentCalls] = useState([]);
  const [showRecent, setShowRecent] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callerInfo, setCallerInfo] = useState(null);
  
  const durationInterval = useRef(null);
  const callStartTime = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    checkVoiceStatus();
    loadRecentCalls();
    
    // Poll for incoming calls
    const pollInterval = setInterval(checkIncomingCalls, 5000);
    return () => clearInterval(pollInterval);
  }, []);

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

  const checkVoiceStatus = async () => {
    try {
      const token = localStorage.getItem('dme_token');
      const response = await axios.get(`${API_URL}/api/voice/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVoiceEnabled(response.data.telnyx?.enabled || false);
    } catch (error) {
      console.error('Failed to check voice status:', error);
    }
  };

  const loadRecentCalls = async () => {
    try {
      const token = localStorage.getItem('dme_token');
      const response = await axios.get(`${API_URL}/api/voice/calls?limit=5`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecentCalls(response.data.calls || []);
    } catch (error) {
      console.error('Failed to load recent calls:', error);
    }
  };

  const checkIncomingCalls = async () => {
    // This would be replaced with WebSocket in production
    // For now, we'll simulate checking for incoming calls
  };

  const handleDialPadPress = useCallback((digit) => {
    if (callState === CallState.CONNECTED) {
      // Send DTMF
      toast.info(`DTMF: ${digit}`);
    } else if (callState === CallState.IDLE) {
      setPhoneNumber(prev => prev + digit);
    }
  }, [callState]);

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

    try {
      setCallState(CallState.DIALING);
      const token = localStorage.getItem('dme_token');
      
      const response = await axios.post(`${API_URL}/api/voice/calls/dial`, {
        to_number: phoneNumber
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCallId(response.data.call_id);
      
      if (response.data.status === 'ringing' || response.data.status === 'initiated') {
        setCallState(CallState.RINGING);
        // Simulate connection (WebRTC would handle this)
        setTimeout(() => {
          setCallState(CallState.CONNECTED);
          toast.success('Connected');
        }, 2000);
      }
    } catch (error) {
      console.error('Call failed:', error);
      toast.error('Call failed');
      setCallState(CallState.IDLE);
    }
  };

  const handleAnswer = async () => {
    if (!incomingCall) return;
    
    try {
      const token = localStorage.getItem('dme_token');
      await axios.post(`${API_URL}/api/voice/calls/${incomingCall.id}/answer`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCallId(incomingCall.id);
      setCallState(CallState.CONNECTED);
      setIncomingCall(null);
      toast.success('Call answered');
    } catch (error) {
      console.error('Failed to answer:', error);
    }
  };

  const handleHangup = async () => {
    if (!callId) {
      setCallState(CallState.IDLE);
      return;
    }

    try {
      const token = localStorage.getItem('dme_token');
      await axios.post(`${API_URL}/api/voice/calls/${callId}/hangup`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.info(`Call ended - ${formatDuration(callDuration)}`);
      resetCall();
      loadRecentCalls();
    } catch (error) {
      console.error('Hangup failed:', error);
      resetCall();
    }
  };

  const handleDecline = () => {
    setIncomingCall(null);
    setCallState(CallState.IDLE);
  };

  const handleMute = async () => {
    if (!callId) return;

    try {
      const token = localStorage.getItem('dme_token');
      const endpoint = isMuted ? 'unmute' : 'mute';
      await axios.post(`${API_URL}/api/voice/calls/${callId}/${endpoint}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsMuted(!isMuted);
    } catch (error) {
      console.error('Mute toggle failed:', error);
    }
  };

  const handleHold = async () => {
    if (!callId) return;

    try {
      const token = localStorage.getItem('dme_token');
      const endpoint = callState === CallState.ON_HOLD ? 'unhold' : 'hold';
      await axios.post(`${API_URL}/api/voice/calls/${callId}/${endpoint}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCallState(callState === CallState.ON_HOLD ? CallState.CONNECTED : CallState.ON_HOLD);
    } catch (error) {
      console.error('Hold toggle failed:', error);
    }
  };

  const handleRecord = async () => {
    if (!callId) return;

    try {
      const token = localStorage.getItem('dme_token');
      const endpoint = isRecording ? 'record/stop' : 'record/start';
      await axios.post(`${API_URL}/api/voice/calls/${callId}/${endpoint}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsRecording(!isRecording);
      toast.success(isRecording ? 'Recording stopped' : 'Recording started');
    } catch (error) {
      console.error('Record toggle failed:', error);
    }
  };

  const handleTransfer = async () => {
    if (!callId || !transferNumber.trim()) return;

    try {
      const token = localStorage.getItem('dme_token');
      await axios.post(`${API_URL}/api/voice/calls/${callId}/transfer`, null, {
        params: { to_number: transferNumber },
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Transferring to ${transferNumber}`);
      setShowTransfer(false);
      setTransferNumber('');
    } catch (error) {
      console.error('Transfer failed:', error);
      toast.error('Transfer failed');
    }
  };

  const resetCall = () => {
    setCallState(CallState.IDLE);
    setCallId(null);
    setCallDuration(0);
    setIsMuted(false);
    setIsRecording(false);
    setCallerInfo(null);
  };

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

  const getStatusColor = () => {
    switch (callState) {
      case CallState.INCOMING: return 'bg-blue-500';
      case CallState.DIALING:
      case CallState.RINGING: return 'bg-amber-500';
      case CallState.CONNECTED: return 'bg-green-500';
      case CallState.ON_HOLD: return 'bg-yellow-500';
      default: return 'bg-slate-600';
    }
  };

  const callFromRecent = (call) => {
    const number = call.direction === 'inbound' ? call.from_number : call.to_number;
    setPhoneNumber(number);
    setShowRecent(false);
  };

  // Collapsed state - just show button
  if (isCollapsed) {
    return (
      <div className="relative">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`w-full flex justify-center p-2 rounded-lg transition-colors relative ${
                callState !== CallState.IDLE 
                  ? 'bg-green-500 text-white' 
                  : 'hover:bg-accent'
              }`}
              data-testid="dialer-toggle-collapsed"
            >
              <Phone className={`w-5 h-5 ${callState !== CallState.IDLE ? 'animate-pulse' : ''}`} />
              {/* Connection status indicator - green dot */}
              {callState === CallState.IDLE && isConnected && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {callState !== CallState.IDLE ? `On Call: ${formatDuration(callDuration)}` : isConnected ? 'Phone Dialer (Connected)' : 'Phone Dialer'}
          </TooltipContent>
        </Tooltip>
        
        {/* Slide out panel for collapsed sidebar */}
        {isOpen && (
          <div className="absolute bottom-0 left-full ml-2 w-72 bg-background border rounded-lg shadow-xl z-50">
            <DialerPanel
              phoneNumber={phoneNumber}
              setPhoneNumber={setPhoneNumber}
              callState={callState}
              callDuration={callDuration}
              isMuted={isMuted}
              isRecording={isRecording}
              voiceEnabled={voiceEnabled}
              callerInfo={callerInfo}
              incomingCall={incomingCall}
              showTransfer={showTransfer}
              setShowTransfer={setShowTransfer}
              transferNumber={transferNumber}
              setTransferNumber={setTransferNumber}
              showRecent={showRecent}
              setShowRecent={setShowRecent}
              recentCalls={recentCalls}
              onDialPadPress={handleDialPadPress}
              onBackspace={handleBackspace}
              onCall={handleCall}
              onHangup={handleHangup}
              onAnswer={handleAnswer}
              onDecline={handleDecline}
              onMute={handleMute}
              onHold={handleHold}
              onRecord={handleRecord}
              onTransfer={handleTransfer}
              onCallFromRecent={callFromRecent}
              onClose={() => setIsOpen(false)}
              formatDuration={formatDuration}
              formatPhoneNumber={formatPhoneNumber}
              getStatusColor={getStatusColor}
            />
          </div>
        )}
      </div>
    );
  }

  // Expanded sidebar - show inline dialer
  return (
    <div className="border-t border-border pt-3 mt-3">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm font-medium relative ${
          callState !== CallState.IDLE 
            ? 'bg-green-500 text-white hover:bg-green-600' 
            : 'hover:bg-accent text-foreground'
        }`}
        data-testid="dialer-toggle"
      >
        <div className="relative">
          <Phone className={`w-5 h-5 ${callState !== CallState.IDLE ? 'animate-pulse' : ''}`} />
          {/* Connection status indicator - green dot */}
          {callState === CallState.IDLE && isConnected && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />
          )}
        </div>
        <span className="flex-1 text-left">
          {callState !== CallState.IDLE ? `On Call ${formatDuration(callDuration)}` : 'Phone'}
        </span>
        {/* Connected indicator text when expanded */}
        {callState === CallState.IDLE && isConnected && (
          <span className="text-xs text-green-600 dark:text-green-400 mr-1">●</span>
        )}
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>

      {/* Slide Out Panel */}
      {isOpen && (
        <div className={`mt-2 overflow-hidden transition-all duration-300 ${isExpanded ? 'fixed inset-4 z-50 bg-background rounded-xl shadow-2xl border' : ''}`}>
          <DialerPanel
            phoneNumber={phoneNumber}
            setPhoneNumber={setPhoneNumber}
            callState={callState}
            callDuration={callDuration}
            isMuted={isMuted}
            isRecording={isRecording}
            voiceEnabled={voiceEnabled}
            callerInfo={callerInfo}
            incomingCall={incomingCall}
            showTransfer={showTransfer}
            setShowTransfer={setShowTransfer}
            transferNumber={transferNumber}
            setTransferNumber={setTransferNumber}
            showRecent={showRecent}
            setShowRecent={setShowRecent}
            recentCalls={recentCalls}
            isExpanded={isExpanded}
            setIsExpanded={setIsExpanded}
            onDialPadPress={handleDialPadPress}
            onBackspace={handleBackspace}
            onCall={handleCall}
            onHangup={handleHangup}
            onAnswer={handleAnswer}
            onDecline={handleDecline}
            onMute={handleMute}
            onHold={handleHold}
            onRecord={handleRecord}
            onTransfer={handleTransfer}
            onCallFromRecent={callFromRecent}
            onClose={() => { setIsOpen(false); setIsExpanded(false); }}
            formatDuration={formatDuration}
            formatPhoneNumber={formatPhoneNumber}
            getStatusColor={getStatusColor}
          />
        </div>
      )}
      
      <audio ref={audioRef} />
    </div>
  );
}

// Dialer Panel Component
function DialerPanel({
  phoneNumber,
  setPhoneNumber,
  callState,
  callDuration,
  isMuted,
  isRecording,
  voiceEnabled,
  callerInfo,
  incomingCall,
  showTransfer,
  setShowTransfer,
  transferNumber,
  setTransferNumber,
  showRecent,
  setShowRecent,
  recentCalls,
  isExpanded,
  setIsExpanded,
  onDialPadPress,
  onBackspace,
  onCall,
  onHangup,
  onAnswer,
  onDecline,
  onMute,
  onHold,
  onRecord,
  onTransfer,
  onCallFromRecent,
  onClose,
  formatDuration,
  formatPhoneNumber,
  getStatusColor
}) {
  return (
    <div className={`${isExpanded ? 'h-full flex flex-col' : ''}`}>
      {/* Header */}
      <div className={`${getStatusColor()} text-white p-3 rounded-t-lg flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Phone className="w-5 h-5" />
          <div>
            <p className="font-medium text-sm">
              {callState === CallState.IDLE ? 'Dialer' :
               callState === CallState.INCOMING ? 'Incoming Call' :
               callState === CallState.DIALING ? 'Dialing...' :
               callState === CallState.RINGING ? 'Ringing...' :
               callState === CallState.CONNECTED ? 'Connected' :
               callState === CallState.ON_HOLD ? 'On Hold' : 'Call Ended'}
            </p>
            {callState !== CallState.IDLE && (
              <p className="text-xs opacity-90">{formatPhoneNumber(phoneNumber)}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {callState === CallState.CONNECTED && (
            <Badge variant="secondary" className="text-xs bg-white/20 text-white">
              <Clock className="w-3 h-3 mr-1" />
              {formatDuration(callDuration)}
            </Badge>
          )}
          {isRecording && (
            <Badge variant="destructive" className="text-xs">
              <Circle className="w-2 h-2 mr-1 fill-current animate-pulse" />
              REC
            </Badge>
          )}
          {setIsExpanded && (
            <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 hover:bg-white/20 rounded">
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Caller Info */}
      {callerInfo && (
        <div className="px-3 py-2 bg-muted border-b flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{callerInfo.name}</span>
          <Badge variant="outline" className="text-xs">{callerInfo.type}</Badge>
        </div>
      )}

      {/* Incoming Call UI */}
      {incomingCall && callState === CallState.INCOMING && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center animate-pulse">
              <PhoneIncoming className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-medium">Incoming Call</p>
              <p className="text-sm text-muted-foreground">{formatPhoneNumber(incomingCall.from)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={onAnswer} className="flex-1 bg-green-500 hover:bg-green-600">
              <Phone className="w-4 h-4 mr-2" /> Answer
            </Button>
            <Button onClick={onDecline} variant="destructive" className="flex-1">
              <PhoneOff className="w-4 h-4 mr-2" /> Decline
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`p-3 ${isExpanded ? 'flex-1 overflow-auto' : ''}`}>
        {/* Phone Number Input */}
        {callState === CallState.IDLE && (
          <div className="relative mb-3">
            <Input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Enter number"
              className="text-center text-lg font-mono pr-10"
            />
            {phoneNumber && (
              <button
                onClick={onBackspace}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <Delete className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Call Duration Display */}
        {callState !== CallState.IDLE && callState !== CallState.INCOMING && (
          <div className="text-center mb-3">
            <p className="text-2xl font-mono">{formatDuration(callDuration)}</p>
          </div>
        )}

        {/* Dial Pad */}
        {(callState === CallState.IDLE || callState === CallState.CONNECTED) && (
          <div className="grid grid-cols-3 gap-1 mb-3">
            {DIAL_PAD.flat().map((digit) => (
              <button
                key={digit}
                onClick={() => onDialPadPress(digit)}
                className="h-10 text-lg font-medium rounded-lg border hover:bg-accent transition-colors"
              >
                {digit}
              </button>
            ))}
          </div>
        )}

        {/* Call Controls */}
        {callState === CallState.IDLE ? (
          <div className="flex gap-2">
            <Button
              onClick={() => setShowRecent(!showRecent)}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <History className="w-4 h-4" />
            </Button>
            <Button
              onClick={onCall}
              disabled={!phoneNumber.trim() || !voiceEnabled}
              className="flex-[2] bg-green-500 hover:bg-green-600"
              size="sm"
            >
              <Phone className="w-4 h-4 mr-1" /> Call
            </Button>
          </div>
        ) : callState !== CallState.INCOMING && (
          <>
            {/* In-call controls */}
            <div className="flex justify-center gap-2 mb-3">
              <Button
                variant={isMuted ? "destructive" : "outline"}
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={onMute}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              
              <Button
                variant={callState === CallState.ON_HOLD ? "secondary" : "outline"}
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={onHold}
              >
                {callState === CallState.ON_HOLD ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </Button>
              
              <Button
                variant={isRecording ? "destructive" : "outline"}
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={onRecord}
              >
                <Circle className={`w-4 h-4 ${isRecording ? 'fill-current' : ''}`} />
              </Button>
              
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={() => setShowTransfer(!showTransfer)}
              >
                <ArrowRightLeft className="w-4 h-4" />
              </Button>
            </div>

            {/* Transfer Input */}
            {showTransfer && (
              <div className="flex gap-2 mb-3">
                <Input
                  value={transferNumber}
                  onChange={(e) => setTransferNumber(e.target.value)}
                  placeholder="Transfer to..."
                  className="text-sm"
                />
                <Button size="sm" onClick={onTransfer}>
                  <ArrowRightLeft className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Hang Up */}
            <Button onClick={onHangup} className="w-full bg-red-500 hover:bg-red-600" size="sm">
              <PhoneOff className="w-4 h-4 mr-2" /> End Call
            </Button>
          </>
        )}

        {/* Recent Calls */}
        {showRecent && callState === CallState.IDLE && (
          <div className="mt-3 border rounded-lg overflow-hidden">
            <div className="bg-muted px-3 py-2 text-xs font-medium uppercase text-muted-foreground">
              Recent Calls
            </div>
            {recentCalls.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground text-center">No recent calls</p>
            ) : (
              <div className="max-h-32 overflow-y-auto">
                {recentCalls.map((call) => (
                  <button
                    key={call.id}
                    onClick={() => onCallFromRecent(call)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left border-b last:border-0"
                  >
                    {call.direction === 'inbound' ? (
                      <PhoneIncoming className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    ) : (
                      <PhoneOutgoing className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {formatPhoneNumber(call.direction === 'inbound' ? call.from_number : call.to_number)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {call.duration_seconds ? formatDuration(call.duration_seconds) : 'Missed'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Voice Not Enabled Warning */}
        {!voiceEnabled && callState === CallState.IDLE && (
          <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Voice not configured. Enable in Dev Settings → Voice & Dialer.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
