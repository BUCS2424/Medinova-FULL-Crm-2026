import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  PhoneOutgoing,
  Mic,
  MicOff,
  Pause,
  Play,
  ArrowRightLeft,
  Circle,
  Square,
  Volume2,
  VolumeX,
  User,
  Clock,
  History,
  Settings,
  X,
  Loader2,
  Delete,
  Hash
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Dial pad buttons layout
const DIAL_PAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#']
];

// Call state management
const CallState = {
  IDLE: 'idle',
  DIALING: 'dialing',
  RINGING: 'ringing',
  CONNECTED: 'connected',
  ON_HOLD: 'on_hold',
  ENDED: 'ended'
};

export default function BrowserDialer({ 
  isOpen, 
  onClose, 
  defaultNumber = '',
  leadId = null,
  patientId = null,
  callerInfo = null
}) {
  const [phoneNumber, setPhoneNumber] = useState(defaultNumber);
  const [callState, setCallState] = useState(CallState.IDLE);
  const [callId, setCallId] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferNumber, setTransferNumber] = useState('');
  const [recentCalls, setRecentCalls] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [webrtcClient, setWebrtcClient] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  
  const audioRef = useRef(null);
  const durationInterval = useRef(null);
  const callStartTime = useRef(null);

  // Check if voice features are enabled
  useEffect(() => {
    checkVoiceStatus();
    loadRecentCalls();
  }, []);

  // Update phone number when defaultNumber changes
  useEffect(() => {
    if (defaultNumber) {
      setPhoneNumber(defaultNumber);
    }
  }, [defaultNumber]);

  // Call duration timer
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
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, [callState]);

  const checkVoiceStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/voice/config`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setVoiceEnabled(response.data.telnyx?.enabled || false);
    } catch (error) {
      console.error('Failed to check voice status:', error);
    }
  };

  const loadRecentCalls = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/voice/calls?limit=10`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setRecentCalls(response.data.calls || []);
    } catch (error) {
      console.error('Failed to load recent calls:', error);
    }
  };

  const handleDialPadPress = useCallback((digit) => {
    if (callState === CallState.CONNECTED && activeCall) {
      // Send DTMF during active call
      activeCall.dtmf(digit);
    } else if (callState === CallState.IDLE) {
      setPhoneNumber(prev => prev + digit);
    }
  }, [callState, activeCall]);

  const handleBackspace = () => {
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  const handleCall = async () => {
    if (!phoneNumber.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    if (!voiceEnabled) {
      toast.error('Voice features are not enabled. Configure Telnyx in Dev Settings.');
      return;
    }

    try {
      setCallState(CallState.DIALING);
      
      const response = await axios.post(`${API_URL}/api/voice/calls/dial`, {
        to_number: phoneNumber,
        lead_id: leadId,
        patient_id: patientId
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      setCallId(response.data.call_id);
      
      if (response.data.status === 'ringing' || response.data.status === 'initiated') {
        setCallState(CallState.RINGING);
        // Simulate connection for demo (in real implementation, use WebRTC events)
        setTimeout(() => {
          setCallState(CallState.CONNECTED);
          toast.success('Call connected');
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to initiate call:', error);
      toast.error('Failed to initiate call');
      setCallState(CallState.IDLE);
    }
  };

  const handleHangup = async () => {
    if (!callId) {
      setCallState(CallState.IDLE);
      return;
    }

    try {
      await axios.post(`${API_URL}/api/voice/calls/${callId}/hangup`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      setCallState(CallState.ENDED);
      toast.info(`Call ended - Duration: ${formatDuration(callDuration)}`);
      
      // Reset after a moment
      setTimeout(() => {
        resetCall();
        loadRecentCalls();
      }, 1500);
    } catch (error) {
      console.error('Failed to hang up:', error);
      resetCall();
    }
  };

  const handleMute = async () => {
    if (!callId) return;

    try {
      const endpoint = isMuted ? 'unmute' : 'mute';
      await axios.post(`${API_URL}/api/voice/calls/${callId}/${endpoint}`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setIsMuted(!isMuted);
    } catch (error) {
      console.error('Failed to toggle mute:', error);
    }
  };

  const handleHold = async () => {
    if (!callId) return;

    try {
      const endpoint = callState === CallState.ON_HOLD ? 'unhold' : 'hold';
      await axios.post(`${API_URL}/api/voice/calls/${callId}/${endpoint}`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setCallState(callState === CallState.ON_HOLD ? CallState.CONNECTED : CallState.ON_HOLD);
    } catch (error) {
      console.error('Failed to toggle hold:', error);
    }
  };

  const handleRecord = async () => {
    if (!callId) return;

    try {
      const endpoint = isRecording ? 'record/stop' : 'record/start';
      await axios.post(`${API_URL}/api/voice/calls/${callId}/${endpoint}`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setIsRecording(!isRecording);
      toast.success(isRecording ? 'Recording stopped' : 'Recording started');
    } catch (error) {
      console.error('Failed to toggle recording:', error);
    }
  };

  const handleTransfer = async () => {
    if (!callId || !transferNumber.trim()) return;

    try {
      await axios.post(`${API_URL}/api/voice/calls/${callId}/transfer`, null, {
        params: { to_number: transferNumber },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success(`Transferring to ${transferNumber}`);
      setShowTransfer(false);
      setTransferNumber('');
    } catch (error) {
      console.error('Failed to transfer:', error);
      toast.error('Transfer failed');
    }
  };

  const resetCall = () => {
    setCallState(CallState.IDLE);
    setCallId(null);
    setCallDuration(0);
    setIsMuted(false);
    setIsRecording(false);
    setActiveCall(null);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPhoneNumber = (number) => {
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return number;
  };

  const getCallStateColor = () => {
    switch (callState) {
      case CallState.DIALING:
      case CallState.RINGING:
        return 'bg-amber-500';
      case CallState.CONNECTED:
        return 'bg-green-500';
      case CallState.ON_HOLD:
        return 'bg-yellow-500';
      case CallState.ENDED:
        return 'bg-gray-500';
      default:
        return 'bg-slate-700';
    }
  };

  const callFromHistory = (call) => {
    const number = call.direction === 'inbound' ? call.from_number : call.to_number;
    setPhoneNumber(number);
    setShowHistory(false);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* Header */}
        <div className={`${getCallStateColor()} text-white p-4 transition-colors duration-300`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                {callState === CallState.IDLE ? (
                  <Phone className="w-6 h-6" />
                ) : callState === CallState.CONNECTED ? (
                  <PhoneOutgoing className="w-6 h-6" />
                ) : (
                  <Phone className="w-6 h-6 animate-pulse" />
                )}
              </div>
              <div>
                <h3 className="font-semibold">
                  {callState === CallState.IDLE ? 'Browser Dialer' :
                   callState === CallState.DIALING ? 'Dialing...' :
                   callState === CallState.RINGING ? 'Ringing...' :
                   callState === CallState.CONNECTED ? 'Connected' :
                   callState === CallState.ON_HOLD ? 'On Hold' :
                   'Call Ended'}
                </h3>
                {callState !== CallState.IDLE && (
                  <p className="text-sm opacity-90">{formatPhoneNumber(phoneNumber)}</p>
                )}
              </div>
            </div>
            
            {callState === CallState.CONNECTED && (
              <div className="text-right">
                <div className="flex items-center gap-1 text-sm">
                  <Clock className="w-4 h-4" />
                  {formatDuration(callDuration)}
                </div>
                {isRecording && (
                  <Badge variant="destructive" className="text-xs mt-1">
                    <Circle className="w-2 h-2 mr-1 fill-current animate-pulse" />
                    REC
                  </Badge>
                )}
              </div>
            )}
          </div>
          
          {/* Caller Info */}
          {callerInfo && (
            <div className="mt-3 p-2 bg-white/10 rounded-lg">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {callerInfo.first_name} {callerInfo.last_name}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {callerInfo.type || 'Contact'}
                </Badge>
              </div>
            </div>
          )}
        </div>

        <div className="p-4">
          {/* Phone Number Display */}
          {callState === CallState.IDLE && (
            <div className="mb-4">
              <div className="relative">
                <Input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Enter phone number"
                  className="text-center text-2xl font-mono h-14 pr-10"
                />
                {phoneNumber && (
                  <button
                    onClick={handleBackspace}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Call Duration Display (during call) */}
          {callState !== CallState.IDLE && (
            <div className="text-center mb-4">
              <p className="text-3xl font-mono">{formatDuration(callDuration)}</p>
            </div>
          )}

          {/* Dial Pad */}
          {(callState === CallState.IDLE || callState === CallState.CONNECTED) && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {DIAL_PAD.flat().map((digit) => (
                <Button
                  key={digit}
                  variant="outline"
                  className="h-14 text-xl font-semibold hover:bg-slate-100"
                  onClick={() => handleDialPadPress(digit)}
                >
                  {digit}
                  {digit === '0' && <span className="text-xs text-gray-400 ml-1">+</span>}
                </Button>
              ))}
            </div>
          )}

          {/* Call Controls */}
          {callState === CallState.IDLE ? (
            <div className="flex gap-2">
              <Button
                onClick={() => setShowHistory(true)}
                variant="outline"
                className="flex-1"
              >
                <History className="w-4 h-4 mr-2" />
                Recent
              </Button>
              <Button
                onClick={handleCall}
                disabled={!phoneNumber.trim()}
                className="flex-[2] bg-green-500 hover:bg-green-600 text-white"
              >
                <Phone className="w-5 h-5 mr-2" />
                Call
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* In-call controls */}
              <div className="flex justify-center gap-3">
                <Button
                  variant={isMuted ? "destructive" : "outline"}
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={handleMute}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </Button>
                
                <Button
                  variant={callState === CallState.ON_HOLD ? "secondary" : "outline"}
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={handleHold}
                >
                  {callState === CallState.ON_HOLD ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                </Button>
                
                <Button
                  variant={isRecording ? "destructive" : "outline"}
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={handleRecord}
                >
                  {isRecording ? <Square className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                </Button>
                
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={() => setShowTransfer(true)}
                >
                  <ArrowRightLeft className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="flex justify-center gap-2 text-xs text-gray-500">
                <span>{isMuted ? 'Unmute' : 'Mute'}</span>
                <span>{callState === CallState.ON_HOLD ? 'Resume' : 'Hold'}</span>
                <span>{isRecording ? 'Stop Rec' : 'Record'}</span>
                <span>Transfer</span>
              </div>

              {/* Hang Up Button */}
              <Button
                onClick={handleHangup}
                className="w-full bg-red-500 hover:bg-red-600 text-white h-12"
              >
                <PhoneOff className="w-5 h-5 mr-2" />
                End Call
              </Button>
            </div>
          )}

          {/* Voice Not Enabled Warning */}
          {!voiceEnabled && callState === CallState.IDLE && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <Settings className="w-4 h-4 inline mr-1" />
                Voice features not configured. Go to Dev Settings to enable Telnyx integration.
              </p>
            </div>
          )}
        </div>

        {/* Transfer Dialog */}
        <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transfer Call</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                value={transferNumber}
                onChange={(e) => setTransferNumber(e.target.value)}
                placeholder="Enter number or extension"
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowTransfer(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleTransfer} className="flex-1">
                  Transfer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Recent Calls Dialog */}
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Recent Calls</DialogTitle>
            </DialogHeader>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {recentCalls.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No recent calls</p>
              ) : (
                recentCalls.map((call) => (
                  <div
                    key={call.id}
                    onClick={() => callFromHistory(call)}
                    className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {call.direction === 'inbound' ? (
                          <PhoneIncoming className="w-4 h-4 text-blue-500" />
                        ) : (
                          <PhoneOutgoing className="w-4 h-4 text-green-500" />
                        )}
                        <span className="font-medium">
                          {formatPhoneNumber(call.direction === 'inbound' ? call.from_number : call.to_number)}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {call.duration_seconds ? formatDuration(call.duration_seconds) : 'N/A'}
                      </Badge>
                    </div>
                    {call.caller_name && (
                      <p className="text-sm text-gray-500 mt-1">{call.caller_name}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(call.start_time).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Audio element for WebRTC */}
        <audio ref={audioRef} autoPlay />
      </DialogContent>
    </Dialog>
  );
}

// Floating Dialer Button Component
export function DialerButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center z-40"
      data-testid="dialer-button"
    >
      <Phone className="w-6 h-6" />
    </button>
  );
}
