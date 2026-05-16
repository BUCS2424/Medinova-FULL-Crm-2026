import { useState, useEffect, useRef, useCallback } from 'react';
import { TelnyxRTC } from '@telnyx/webrtc';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { toast, Toaster } from 'sonner';
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
  Delete,
  Loader2,
  Users,
  AlertCircle,
  RefreshCw,
  Speaker,
  Check,
  Bell,
  BellRing,
  Square,
  MessageCircle,
  X
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DIAL_PAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#']
];

const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('dme_token')}`
});

export default function DialerWindowPage() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState(null);
  
  // Telnyx WebRTC client
  const clientRef = useRef(null);
  const currentCallRef = useRef(null);
  
  // Connection state
  const [clientState, setClientState] = useState('disconnected');
  const [sipCredentials, setSipCredentials] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef(null);
  
  // Call state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callState, setCallState] = useState('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [callerInfo, setCallerInfo] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  
  // Transfer
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferNumber, setTransferNumber] = useState('');
  
  // Call history & queue
  const [recentCalls, setRecentCalls] = useState([]);
  const [callQueue, setCallQueue] = useState([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  
  // Sound & UI
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState('dialer');
  
  // Audio devices
  const [audioOutputDevices, setAudioOutputDevices] = useState([]);
  const [selectedAudioOutput, setSelectedAudioOutput] = useState('default');
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  
  // Ringtone settings
  const [selectedRingtone, setSelectedRingtone] = useState('classic');
  const [isTestingRingtone, setIsTestingRingtone] = useState(false);
  
  // Available ringtones
  const ringtones = [
    { id: 'classic', name: 'Classic', url: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3' },
    { id: 'digital', name: 'Digital', url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_12b0c7443c.mp3' },
    { id: 'soft', name: 'Soft Chime', url: 'https://cdn.pixabay.com/download/audio/2022/10/30/audio_67823f5fbd.mp3' },
    { id: 'urgent', name: 'Urgent', url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb749bf23.mp3' },
    { id: 'office', name: 'Office', url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_c518dc5e7c.mp3' },
    { id: 'ring01', name: 'Ring 01', url: 'https://customer-assets.emergentagent.com/job_9f47c90b-54d6-46ef-b606-98511a840286/artifacts/pgsd2wm3_Ring01.wma' },
    { id: 'cellphone', name: 'Cellphone', url: 'https://customer-assets.emergentagent.com/job_9f47c90b-54d6-46ef-b606-98511a840286/artifacts/ot3tsmb6_freesound_community-cellphone-ringing-6475.mp3' },
    { id: 'lowring', name: 'Low Ring', url: 'https://customer-assets.emergentagent.com/job_9f47c90b-54d6-46ef-b606-98511a840286/artifacts/5fvzqu74_lowsound-ring.mp3' },
  ];
  
  // Refs
  const durationInterval = useRef(null);
  const ringtoneRef = useRef(null);
  const disconnectSoundRef = useRef(null);
  const keypressSoundRef = useRef(null);
  const remoteAudioRef = useRef(null);

  // Check authentication on mount
  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      setAuthChecking(true);
      const token = localStorage.getItem('dme_token');
      
      if (!token) {
        setAuthError('Not logged in. Please log in to access the phone dialer.');
        setIsAuthenticated(false);
        setAuthChecking(false);
        return;
      }

      // Verify token and get user info
      const response = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const user = response.data;
      
      // Check if user has a role
      if (!user.role) {
        setAuthError('Access denied. You need a valid role to use the phone dialer.');
        setIsAuthenticated(false);
        setAuthChecking(false);
        return;
      }

      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      console.error('Auth check failed:', error);
      if (error.response?.status === 401) {
        setAuthError('Session expired. Please log in again.');
      } else {
        setAuthError('Authentication failed. Please log in to access the phone dialer.');
      }
      setIsAuthenticated(false);
    } finally {
      setAuthChecking(false);
    }
  };

  // Check for phone number in URL params (click-to-call)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const numberToCall = params.get('number');
    const callerName = params.get('name');
    const callerType = params.get('type');
    const autoCall = params.get('autoCall');
    
    if (numberToCall) {
      setPhoneNumber(numberToCall);
      if (callerName) {
        setCallerInfo({ name: callerName, type: callerType || 'contact' });
      }
      if (autoCall === 'true') {
        window.autoCallPending = numberToCall;
      }
    }
  }, []);

  // Fetch credentials and connect (only if authenticated)
  useEffect(() => {
    if (isAuthenticated) {
      fetchCredentialsAndConnect();
      loadRecentCalls();
      loadCallQueue();
    }
    
    return () => {
      if (clientRef.current) clientRef.current.disconnect();
      if (durationInterval.current) clearInterval(durationInterval.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [isAuthenticated]);

  // Load audio output devices
  useEffect(() => {
    loadAudioDevices();
    // Listen for device changes
    navigator.mediaDevices?.addEventListener('devicechange', loadAudioDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', loadAudioDevices);
    };
  }, []);

  // Apply selected audio output to all audio elements
  useEffect(() => {
    applyAudioOutput(selectedAudioOutput);
  }, [selectedAudioOutput]);

  const loadAudioDevices = async () => {
    try {
      // Request permission first to get device labels
      await navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        stream.getTracks().forEach(track => track.stop());
      }).catch(() => {});
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
      setAudioOutputDevices(audioOutputs);
      
      // Check if saved device exists
      const savedDevice = localStorage.getItem('dme_audio_output');
      if (savedDevice && audioOutputs.some(d => d.deviceId === savedDevice)) {
        setSelectedAudioOutput(savedDevice);
      }
    } catch (error) {
      console.error('Failed to enumerate audio devices:', error);
    }
  };

  const applyAudioOutput = async (deviceId) => {
    const audioElements = [ringtoneRef.current, disconnectSoundRef.current, keypressSoundRef.current, remoteAudioRef.current];
    
    for (const audio of audioElements) {
      if (audio && typeof audio.setSinkId === 'function') {
        try {
          await audio.setSinkId(deviceId);
        } catch (error) {
          console.error('Failed to set audio output:', error);
        }
      }
    }
    
    // Save preference
    localStorage.setItem('dme_audio_output', deviceId);
  };

  const handleAudioOutputChange = (deviceId) => {
    setSelectedAudioOutput(deviceId);
    setShowAudioSettings(false);
  };

  // Load saved ringtone preference
  useEffect(() => {
    const savedRingtone = localStorage.getItem('dme_selected_ringtone');
    if (savedRingtone && ringtones.some(r => r.id === savedRingtone)) {
      setSelectedRingtone(savedRingtone);
    }
  }, []);

  // Update ringtone audio source when selection changes
  useEffect(() => {
    const ringtone = ringtones.find(r => r.id === selectedRingtone);
    if (ringtone && ringtoneRef.current) {
      ringtoneRef.current.src = ringtone.url;
      ringtoneRef.current.load();
    }
    localStorage.setItem('dme_selected_ringtone', selectedRingtone);
  }, [selectedRingtone]);

  const handleRingtoneChange = (ringtoneId) => {
    setSelectedRingtone(ringtoneId);
  };

  const testRingtone = () => {
    if (ringtoneRef.current) {
      if (isTestingRingtone) {
        // Stop testing
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
        setIsTestingRingtone(false);
      } else {
        // Start testing
        ringtoneRef.current.loop = false;
        ringtoneRef.current.currentTime = 0;
        ringtoneRef.current.play().then(() => {
          setIsTestingRingtone(true);
          // Auto-stop after 5 seconds
          setTimeout(() => {
            if (ringtoneRef.current) {
              ringtoneRef.current.pause();
              ringtoneRef.current.currentTime = 0;
            }
            setIsTestingRingtone(false);
          }, 5000);
        }).catch(e => {
          console.error('Failed to play ringtone:', e);
          toast.error('Failed to play ringtone');
        });
      }
    }
  };

  // Call duration timer
  useEffect(() => {
    if (callState === 'active') {
      const startTime = Date.now();
      durationInterval.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
      if (callState === 'idle') setCallDuration(0);
    }
    return () => { if (durationInterval.current) clearInterval(durationInterval.current); };
  }, [callState]);

  // Ringtone
  useEffect(() => {
    if (incomingCall && soundEnabled && ringtoneRef.current) {
      ringtoneRef.current.loop = true;
      ringtoneRef.current.play().catch(() => {});
    } else if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
  }, [incomingCall, soundEnabled]);

  const fetchCredentialsAndConnect = async () => {
    try {
      setClientState('connecting');
      setConnectionError(null);
      
      // Reset reconnect attempts on manual reconnect
      reconnectAttempts.current = 0;
      
      // Clear any pending reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Disconnect existing client
      if (clientRef.current) {
        try {
          clientRef.current.disconnect();
        } catch (e) {
          console.log('Disconnect error (ignored):', e);
        }
        clientRef.current = null;
      }
      
      const response = await axios.get(`${API_URL}/api/voice/config/credentials`, { headers: getHeaders() });
      const creds = response.data;
      
      if (!creds.sip_username || !creds.sip_password) {
        setConnectionError('SIP credentials not configured. Go to Dev Settings → Telnyx → Voice tab.');
        setClientState('error');
        return;
      }
      
      setSipCredentials(creds);
      initializeTelnyxClient(creds);
    } catch (error) {
      console.error('Failed to fetch credentials:', error);
      setConnectionError('Failed to load SIP credentials.');
      setClientState('error');
    }
  };

  const initializeTelnyxClient = (creds) => {
    try {
      const client = new TelnyxRTC({
        login: creds.sip_username,
        password: creds.sip_password,
      });

      // Reset reconnect counter on successful connection
      client.on('telnyx.ready', () => {
        console.log('Telnyx WebRTC ready - can make and receive calls');
        reconnectAttempts.current = 0; // Reset on successful connection
        setClientState('connected');
        toast.success('Phone connected');
        
        if (window.autoCallPending) {
          setTimeout(() => { makeCall(window.autoCallPending); window.autoCallPending = null; }, 500);
        }
      });

      client.on('telnyx.error', (error) => {
        console.error('Telnyx error:', error);
        const errorMessage = error.message || 'Connection error';
        // Check for common media device errors
        if (errorMessage.includes('NotFoundError') || errorMessage.includes('device not found')) {
          setConnectionError('No microphone detected. Please connect a microphone and refresh.');
        } else if (errorMessage.includes('NotAllowedError') || errorMessage.includes('Permission')) {
          setConnectionError('Microphone access denied. Please allow microphone access and refresh.');
        } else {
          setConnectionError(errorMessage);
        }
        setClientState('error');
        toast.error('Connection error');
      });

      client.on('telnyx.socket.close', () => {
        console.log('Telnyx socket closed');
        setClientState('disconnected');
        
        // Clear any pending reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        // Auto-reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000); // Max 30s
          console.log(`Reconnect attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts} in ${delay}ms`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (sipCredentials) {
              reconnectAttempts.current++;
              console.log('Auto-reconnecting...');
              setClientState('connecting');
              setConnectionError(null);
              
              // Disconnect old client and create new one
              if (clientRef.current) {
                try {
                  clientRef.current.disconnect();
                } catch (e) {
                  console.log('Disconnect error (ignored):', e);
                }
                clientRef.current = null;
              }
              
              // Re-initialize with fresh client
              initializeTelnyxClient(sipCredentials);
            }
          }, delay);
        } else {
          setConnectionError('Connection lost. Click Reconnect to try again.');
          toast.error('Phone disconnected - max reconnect attempts reached');
        }
      });

      // Handle all notifications including incoming calls
      client.on('telnyx.notification', (notification) => {
        console.log('Telnyx notification:', notification.type, notification);
        
        // Handle incoming call invitation
        if (notification.type === 'callUpdate' && notification.call) {
          handleCallUpdate(notification.call);
        }
        
        // Handle call with remote stream
        if (notification.call && notification.call.remoteStream && remoteAudioRef.current) {
          console.log('Attaching remote audio stream');
          remoteAudioRef.current.srcObject = notification.call.remoteStream;
          remoteAudioRef.current.play().catch(e => console.error('Audio play error:', e));
          
          // Apply selected audio output
          if (typeof remoteAudioRef.current.setSinkId === 'function' && selectedAudioOutput) {
            remoteAudioRef.current.setSinkId(selectedAudioOutput).catch(e => 
              console.error('Failed to set audio output:', e)
            );
          }
        }
      });

      client.connect();
      clientRef.current = client;
    } catch (error) {
      console.error('Failed to initialize:', error);
      setConnectionError('Failed to initialize phone client');
      setClientState('error');
    }
  };

  const handleCallUpdate = (call) => {
    currentCallRef.current = call;
    const state = call.state;
    
    // Debug logging for incoming calls
    console.log('Call update:', { 
      state, 
      direction: call.direction, 
      id: call.id,
      remoteCallerNumber: call.options?.remoteCallerNumber,
      remoteCallerName: call.options?.remoteCallerName
    });

    switch (state) {
      case 'new':
      case 'ringing':
        if (call.direction === 'inbound') {
          const callerNumber = call.options?.remoteCallerNumber || call.options?.callerNumber || 'Unknown';
          console.log('Incoming call detected from:', callerNumber);
          setIncomingCall({ id: call.id, from: callerNumber, call });
          setCallState('incoming');
          // Force ringtone to play
          if (soundEnabled && ringtoneRef.current) {
            ringtoneRef.current.loop = true;
            ringtoneRef.current.currentTime = 0;
            ringtoneRef.current.play().catch(e => console.error('Ringtone play error:', e));
          }
        }
        break;
      case 'trying':
      case 'requesting':
        setCallState('dialing');
        break;
      case 'early':
        if (call.direction === 'outbound') {
          setCallState('ringing');
        }
        // Try to attach remote stream early
        attachRemoteStream(call);
        break;
      case 'active':
        setCallState('active');
        setIncomingCall(null);
        // Stop ringtone
        if (ringtoneRef.current) {
          ringtoneRef.current.pause();
          ringtoneRef.current.currentTime = 0;
        }
        // Attach remote audio stream
        attachRemoteStream(call);
        toast.success('Call connected');
        break;
      case 'held':
        setCallState('held');
        setIsHeld(true);
        break;
      case 'hangup':
      case 'destroy':
        handleCallEnded(call);
        break;
      default:
        console.log('Unhandled call state:', state);
        break;
    }
  };

  const attachRemoteStream = (call) => {
    if (call.remoteStream && remoteAudioRef.current) {
      console.log('Attaching remote audio stream to element');
      remoteAudioRef.current.srcObject = call.remoteStream;
      remoteAudioRef.current.play().catch(e => {
        console.error('Audio play error:', e);
        // Try again with user interaction
        toast.info('Click anywhere to enable audio');
      });
      
      // Apply selected audio output device
      if (typeof remoteAudioRef.current.setSinkId === 'function' && selectedAudioOutput) {
        remoteAudioRef.current.setSinkId(selectedAudioOutput).catch(e => 
          console.error('Failed to set audio output:', e)
        );
      }
    } else if (call.remoteStream) {
      console.log('Remote stream available but no audio element');
    }
  };

  const handleCallEnded = (call) => {
    // Stop remote audio
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    // Play disconnect sound
    if (soundEnabled && disconnectSoundRef.current) {
      disconnectSoundRef.current.currentTime = 0;
      disconnectSoundRef.current.play().catch(() => {});
    }
    toast.info(`Call ended - ${formatDuration(callDuration)}`);
    logCall(call, callDuration);
    resetCallState();
    loadRecentCalls();
  };

  const logCall = async (call, duration) => {
    try {
      await axios.post(`${API_URL}/api/voice/calls/log`, {
        direction: call.direction || 'outbound',
        from_number: sipCredentials?.phone_number,
        to_number: phoneNumber,
        duration_seconds: duration,
        status: 'completed'
      }, { headers: getHeaders() });
    } catch (error) {
      console.error('Failed to log call:', error);
    }
  };

  const resetCallState = () => {
    currentCallRef.current = null;
    setCallState('idle');
    setCallDuration(0);
    setIsMuted(false);
    setIsHeld(false);
    setIsRecording(false);
    setIncomingCall(null);
    setShowTransfer(false);
    setTransferNumber('');
  };

  const makeCall = useCallback(async (number) => {
    const client = clientRef.current;
    if (!client || clientState !== 'connected') {
      toast.error('Phone not connected');
      return;
    }

    const dialNumber = number || phoneNumber;
    if (!dialNumber.trim()) {
      toast.error('Enter a phone number');
      return;
    }

    // Check for microphone access first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Release the stream
    } catch (mediaError) {
      console.error('Microphone access error:', mediaError);
      if (mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError') {
        toast.error('No microphone found. Please connect a microphone.');
      } else if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
        toast.error('Microphone access denied. Please allow access in browser settings.');
      } else {
        toast.error('Cannot access microphone: ' + mediaError.message);
      }
      return;
    }

    try {
      let formattedNumber = dialNumber.replace(/[^0-9+]/g, '');
      if (!formattedNumber.startsWith('+')) {
        if (formattedNumber.length === 10) formattedNumber = '+1' + formattedNumber;
        else if (formattedNumber.length === 11 && formattedNumber.startsWith('1')) formattedNumber = '+' + formattedNumber;
      }

      client.newCall({
        destinationNumber: formattedNumber,
        callerNumber: sipCredentials?.phone_number || '',
        callerName: sipCredentials?.caller_name || 'DME PROSical',
        audio: true,
        video: false
      });

      setCallState('dialing');
    } catch (error) {
      console.error('Failed to call:', error);
      toast.error('Call failed: ' + (error.message || 'Unknown error'));
      resetCallState();
    }
  }, [clientState, phoneNumber, sipCredentials]);

  const answerCall = () => {
    if (incomingCall?.call) {
      incomingCall.call.answer();
      setPhoneNumber(incomingCall.from);
    }
  };

  const declineCall = () => {
    // Play disconnect sound when declining
    if (soundEnabled && disconnectSoundRef.current) {
      disconnectSoundRef.current.currentTime = 0;
      disconnectSoundRef.current.play().catch(() => {});
    }
    if (incomingCall?.call) incomingCall.call.hangup();
    setIncomingCall(null);
    setCallState('idle');
  };

  const hangup = () => {
    // Play disconnect sound when hanging up
    if (soundEnabled && disconnectSoundRef.current) {
      disconnectSoundRef.current.currentTime = 0;
      disconnectSoundRef.current.play().catch(() => {});
    }
    if (currentCallRef.current) currentCallRef.current.hangup();
    else resetCallState();
  };

  const toggleMute = () => {
    const call = currentCallRef.current;
    if (call) {
      if (isMuted) call.unmuteAudio(); else call.muteAudio();
      setIsMuted(!isMuted);
      toast.success(isMuted ? 'Unmuted' : 'Muted');
    }
  };

  const toggleHold = () => {
    const call = currentCallRef.current;
    if (call) {
      if (isHeld) { call.unhold(); setIsHeld(false); toast.success('Call resumed'); }
      else { call.hold(); setIsHeld(true); toast.success('Call on hold'); }
    }
  };

  const toggleRecording = () => {
    toast.info(isRecording ? 'Recording stopped' : 'Recording started');
    setIsRecording(!isRecording);
  };

  const transferCall = () => {
    const call = currentCallRef.current;
    if (call && transferNumber.trim()) {
      let formattedNumber = transferNumber.replace(/[^0-9+]/g, '');
      if (!formattedNumber.startsWith('+') && formattedNumber.length === 10) {
        formattedNumber = '+1' + formattedNumber;
      }
      call.transfer(formattedNumber);
      toast.success(`Transferring to ${transferNumber}`);
      setShowTransfer(false);
      setTransferNumber('');
    }
  };

  const sendDTMF = (digit) => {
    if (currentCallRef.current && callState === 'active') {
      currentCallRef.current.dtmf(digit);
    }
  };

  const handleDialPadPress = (digit) => {
    // Play keypress sound
    if (soundEnabled && keypressSoundRef.current) {
      keypressSoundRef.current.currentTime = 0;
      keypressSoundRef.current.play().catch(() => {});
    }
    
    if (callState === 'active') {
      sendDTMF(digit);
      toast.info(`DTMF: ${digit}`);
    } else if (callState === 'idle') {
      setPhoneNumber(prev => prev + digit);
    }
  };

  const loadRecentCalls = async () => {
    setLoadingCalls(true);
    try {
      const response = await axios.get(`${API_URL}/api/voice/calls?limit=20`, { headers: getHeaders() });
      setRecentCalls(response.data.calls || []);
    } catch (error) {
      console.error('Failed to load calls:', error);
    } finally {
      setLoadingCalls(false);
    }
  };

  const loadCallQueue = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/voice/queue`, { headers: getHeaders() });
      const queues = response.data.queues || {};
      const allQueued = Object.values(queues).flatMap(q => q.queue || []);
      setCallQueue(allQueued);
    } catch (error) {
      console.error('Failed to load queue:', error);
    }
  };

  const callFromHistory = (call) => {
    const number = call.direction === 'inbound' ? call.from_number : call.to_number;
    setPhoneNumber(number);
    setActiveTab('dialer');
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPhoneNumber = (number) => {
    const cleaned = (number || '').replace(/\D/g, '');
    if (cleaned.length === 10) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    if (cleaned.length === 11 && cleaned[0] === '1') return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    return number;
  };

  const formatTimeAgo = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getHeaderColor = () => {
    if (clientState === 'connected') return 'bg-green-600';
    if (clientState === 'connecting') return 'bg-lime-500';
    return 'bg-slate-600';
  };

  const getCallStatusColor = () => {
    switch (callState) {
      case 'incoming': return 'bg-blue-500';
      case 'dialing':
      case 'ringing': return 'bg-lime-500';
      case 'active': return 'bg-green-500';
      case 'held': return 'bg-yellow-500';
      default: return 'bg-slate-600';
    }
  };

  // Show loading while checking authentication
  if (authChecking) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center" data-testid="dialer-auth-checking">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Verifying access...</p>
      </div>
    );
  }

  // Show access denied if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="h-screen bg-background flex flex-col" data-testid="dialer-access-denied">
        <div className="bg-red-600 text-white p-3 flex items-center gap-3">
          <AlertCircle className="w-6 h-6" />
          <div>
            <h1 className="font-semibold">Access Denied</h1>
            <p className="text-xs opacity-90">Authentication required</p>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
            <Phone className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Phone Dialer Restricted</h2>
          <p className="text-muted-foreground mb-6 max-w-xs">
            {authError || 'You must be logged in with a valid role to use the phone dialer.'}
          </p>
          <Button 
            onClick={() => window.opener ? window.close() : window.location.href = '/login'}
            className="gap-2"
          >
            {window.opener ? 'Close Window' : 'Go to Login'}
          </Button>
          {window.opener && (
            <p className="text-xs text-muted-foreground mt-4">
              Please log in through the main application first.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#1a1f36] flex flex-col" data-testid="dialer-window">
      <Toaster position="top-center" richColors />
      
      {/* Incoming Call Overlay */}
      {incomingCall && (
        <div className="absolute inset-0 bg-[#1a1f36] z-50 flex flex-col">
          {/* Caller Info */}
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mb-6 animate-pulse">
              <User className="w-16 h-16 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">Incoming Call</h2>
            <p className="text-xl text-gray-300 font-mono">{formatPhoneNumber(incomingCall.from)}</p>
            <p className="text-sm text-gray-500 mt-2">mobile</p>
          </div>
          
          {/* Quick Actions */}
          <div className="flex justify-center gap-8 mb-8">
            <button className="flex flex-col items-center gap-2 text-gray-400">
              <div className="w-14 h-14 rounded-full bg-gray-700/50 flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
              <span className="text-xs">Remind me</span>
            </button>
            <button className="flex flex-col items-center gap-2 text-gray-400">
              <div className="w-14 h-14 rounded-full bg-gray-700/50 flex items-center justify-center">
                <MessageCircle className="w-6 h-6" />
              </div>
              <span className="text-xs">Message</span>
            </button>
          </div>
          
          {/* Accept/Decline Buttons */}
          <div className="flex justify-center gap-16 pb-12">
            <button 
              onClick={declineCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all active:scale-95"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
            <button 
              onClick={answerCall}
              className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-all active:scale-95"
            >
              <Phone className="w-7 h-7 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Active Call Screen */}
      {(callState === 'active' || callState === 'dialing' || callState === 'ringing' || callState === 'held') && (
        <div className="absolute inset-0 bg-[#1a1f36] z-40 flex flex-col">
          {/* Caller Info */}
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <div className={`w-28 h-28 rounded-full bg-gradient-to-br ${callState === 'held' ? 'from-yellow-400 to-yellow-600' : 'from-green-400 to-green-600'} flex items-center justify-center mb-6`}>
              <User className="w-16 h-16 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">
              {callerInfo?.name || formatPhoneNumber(phoneNumber)}
            </h2>
            <p className="text-gray-400">
              {callState === 'dialing' ? 'Calling...' : 
               callState === 'ringing' ? 'Ringing...' : 
               callState === 'held' ? 'On Hold' : 
               formatDuration(callDuration)}
            </p>
          </div>
          
          {/* Call Controls */}
          <div className="grid grid-cols-3 gap-6 px-8 mb-8">
            <button 
              onClick={toggleMute}
              className={`flex flex-col items-center gap-2 ${isMuted ? 'text-red-400' : 'text-gray-400'}`}
            >
              <div className={`w-14 h-14 rounded-full ${isMuted ? 'bg-red-500/20' : 'bg-gray-700/50'} flex items-center justify-center`}>
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </div>
              <span className="text-xs">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>
            <button 
              onClick={() => setActiveTab('dialer')}
              className="flex flex-col items-center gap-2 text-gray-400"
            >
              <div className="w-14 h-14 rounded-full bg-gray-700/50 flex items-center justify-center">
                <span className="text-lg font-bold">123</span>
              </div>
              <span className="text-xs">Keypad</span>
            </button>
            <button 
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`flex flex-col items-center gap-2 ${soundEnabled ? 'text-gray-400' : 'text-blue-400'}`}
            >
              <div className={`w-14 h-14 rounded-full ${soundEnabled ? 'bg-gray-700/50' : 'bg-blue-500/20'} flex items-center justify-center`}>
                {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
              </div>
              <span className="text-xs">Speaker</span>
            </button>
            <button 
              onClick={toggleHold}
              className={`flex flex-col items-center gap-2 ${isHeld ? 'text-yellow-400' : 'text-gray-400'}`}
            >
              <div className={`w-14 h-14 rounded-full ${isHeld ? 'bg-yellow-500/20' : 'bg-gray-700/50'} flex items-center justify-center`}>
                {isHeld ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
              </div>
              <span className="text-xs">{isHeld ? 'Resume' : 'Hold'}</span>
            </button>
            <button 
              onClick={toggleRecording}
              className={`flex flex-col items-center gap-2 ${isRecording ? 'text-red-400' : 'text-gray-400'}`}
            >
              <div className={`w-14 h-14 rounded-full ${isRecording ? 'bg-red-500/20' : 'bg-gray-700/50'} flex items-center justify-center`}>
                <Circle className={`w-6 h-6 ${isRecording ? 'fill-red-400' : ''}`} />
              </div>
              <span className="text-xs">{isRecording ? 'Stop Rec' : 'Record'}</span>
            </button>
            <button 
              onClick={() => setShowTransfer(true)}
              className="flex flex-col items-center gap-2 text-gray-400"
            >
              <div className="w-14 h-14 rounded-full bg-gray-700/50 flex items-center justify-center">
                <ArrowRightLeft className="w-6 h-6" />
              </div>
              <span className="text-xs">Transfer</span>
            </button>
          </div>
          
          {/* Hang Up Button */}
          <div className="flex justify-center pb-12">
            <button 
              onClick={hangup}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all active:scale-95"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
          </div>

          {/* Transfer Modal */}
          {showTransfer && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-6">
              <div className="bg-[#252a45] rounded-2xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-semibold text-white mb-4">Transfer Call</h3>
                <Input
                  value={transferNumber}
                  onChange={(e) => setTransferNumber(e.target.value)}
                  placeholder="Enter phone number"
                  className="bg-[#1a1f36] border-gray-600 text-white mb-4"
                />
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setShowTransfer(false)} className="flex-1 border-gray-600 text-gray-300">
                    Cancel
                  </Button>
                  <Button onClick={transferCall} className="flex-1 bg-green-500 hover:bg-green-600">
                    Transfer
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Dialer UI */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar with Settings */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className={`w-3 h-3 rounded-full ${clientState === 'connected' ? 'bg-green-500' : clientState === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
            </div>
            <span className="text-sm text-gray-400">
              {clientState === 'connected' ? sipCredentials?.phone_number || 'Connected' : clientState === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Ringtone Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 text-gray-400 hover:text-white transition-colors">
                  {isTestingRingtone ? <BellRing className="w-5 h-5 animate-pulse" /> : <Bell className="w-5 h-5" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-[#252a45] border-gray-700">
                <DropdownMenuLabel className="flex items-center justify-between text-gray-300">
                  <span>Ringtone</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); testRingtone(); }}
                    className="h-7 px-2 text-xs text-gray-400 hover:text-white"
                  >
                    {isTestingRingtone ? <><Square className="w-3 h-3 mr-1" /> Stop</> : <><Play className="w-3 h-3 mr-1" /> Test</>}
                  </Button>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-700" />
                {ringtones.map((ringtone) => (
                  <DropdownMenuItem
                    key={ringtone.id}
                    onClick={() => handleRingtoneChange(ringtone.id)}
                    className="flex items-center gap-2 text-gray-300 focus:bg-gray-700 focus:text-white"
                  >
                    {selectedRingtone === ringtone.id ? <Check className="w-4 h-4 text-green-500" /> : <span className="w-4" />}
                    <span className="text-sm">{ringtone.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Speaker Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 text-gray-400 hover:text-white transition-colors">
                  <Speaker className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-[#252a45] border-gray-700">
                <DropdownMenuLabel className="text-gray-300">Audio Output</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-700" />
                {audioOutputDevices.length === 0 ? (
                  <DropdownMenuItem disabled className="text-gray-500">No devices found</DropdownMenuItem>
                ) : (
                  audioOutputDevices.map((device) => (
                    <DropdownMenuItem
                      key={device.deviceId}
                      onClick={() => handleAudioOutputChange(device.deviceId)}
                      className="flex items-center gap-2 text-gray-300 focus:bg-gray-700 focus:text-white"
                    >
                      {selectedAudioOutput === device.deviceId ? <Check className="w-4 h-4 text-green-500" /> : <span className="w-4" />}
                      <span className="truncate text-sm">{device.label || `Speaker ${device.deviceId.slice(0, 8)}`}</span>
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator className="bg-gray-700" />
                <DropdownMenuItem onClick={loadAudioDevices} className="text-xs text-gray-500">
                  <RefreshCw className="w-3 h-3 mr-2" /> Refresh
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Sound Toggle */}
            <button 
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            
            {/* Reconnect */}
            <button 
              onClick={fetchCredentialsAndConnect}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${clientState === 'connecting' ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Connection Error */}
        {clientState === 'error' && (
          <div className="mx-4 mb-4 bg-red-500/20 border border-red-500/50 rounded-xl p-3">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Connection Failed</p>
                <p className="text-xs opacity-80">{connectionError}</p>
              </div>
              <button onClick={fetchCredentialsAndConnect} className="text-xs bg-red-500/30 px-3 py-1 rounded-full hover:bg-red-500/50">
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Phone Number Display */}
        <div className="px-6 py-8 text-center">
          <div className="text-4xl font-light text-white tracking-wider min-h-[48px]">
            {phoneNumber ? formatPhoneNumber(phoneNumber) : (
              <span className="text-gray-600">Enter number</span>
            )}
          </div>
          {callerInfo && (
            <p className="text-gray-500 mt-2">{callerInfo.name} • {callerInfo.type}</p>
          )}
        </div>

        {/* Dial Pad */}
        <div className="flex-1 px-6">
          <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto">
            {[
              { digit: '1', letters: '' },
              { digit: '2', letters: 'ABC' },
              { digit: '3', letters: 'DEF' },
              { digit: '4', letters: 'GHI' },
              { digit: '5', letters: 'JKL' },
              { digit: '6', letters: 'MNO' },
              { digit: '7', letters: 'PQRS' },
              { digit: '8', letters: 'TUV' },
              { digit: '9', letters: 'WXYZ' },
              { digit: '*', letters: '' },
              { digit: '0', letters: '+' },
              { digit: '#', letters: '' },
            ].map(({ digit, letters }) => (
              <button
                key={digit}
                onClick={() => handleDialPadPress(digit)}
                className="w-20 h-20 mx-auto rounded-full bg-[#252a45] hover:bg-[#2f3555] active:bg-[#3a4065] flex flex-col items-center justify-center transition-all"
              >
                <span className="text-2xl font-medium text-white">{digit}</span>
                {letters && <span className="text-[10px] text-gray-500 tracking-widest">{letters}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-center gap-8 py-6 px-6">
          {/* History Button */}
          <button 
            onClick={() => setActiveTab(activeTab === 'history' ? 'dialer' : 'history')}
            className={`p-4 rounded-full ${activeTab === 'history' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'} transition-colors`}
          >
            <History className="w-6 h-6" />
          </button>
          
          {/* Call Button */}
          {phoneNumber ? (
            <button 
              onClick={() => makeCall()}
              disabled={clientState !== 'connected'}
              className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95"
            >
              <Phone className="w-7 h-7 text-white" />
            </button>
          ) : (
            <div className="w-16 h-16 rounded-full bg-green-500/30 flex items-center justify-center">
              <Phone className="w-7 h-7 text-green-300/50" />
            </div>
          )}
          
          {/* Delete Button */}
          <button 
            onClick={() => setPhoneNumber(prev => prev.slice(0, -1))}
            onDoubleClick={() => setPhoneNumber('')}
            disabled={!phoneNumber}
            className={`p-4 rounded-full ${phoneNumber ? 'text-gray-400 hover:text-white' : 'text-gray-700'} transition-colors`}
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* History Overlay */}
      {activeTab === 'history' && (
        <div className="absolute inset-0 bg-[#1a1f36] z-30">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">Recent Calls</h2>
            <div className="flex items-center gap-2">
              <button 
                onClick={loadRecentCalls}
                disabled={loadingCalls}
                className="p-2 text-gray-400 hover:text-white"
              >
                <RefreshCw className={`w-5 h-5 ${loadingCalls ? 'animate-spin' : ''}`} />
              </button>
              <button 
                onClick={() => setActiveTab('dialer')}
                className="p-2 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <ScrollArea className="h-[calc(100vh-60px)]">
            <div className="p-4 space-y-2">
              {loadingCalls ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-500" />
                </div>
              ) : recentCalls.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No recent calls</p>
                </div>
              ) : (
                recentCalls.map((call) => (
                  <button
                    key={call.id}
                    onClick={() => callFromHistory(call)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-[#252a45] hover:bg-[#2f3555] transition-colors text-left"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      call.direction === 'inbound' 
                        ? call.status === 'completed' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}>
                      {call.direction === 'inbound' 
                        ? (call.status === 'completed' ? <PhoneIncoming className="w-5 h-5" /> : <PhoneMissed className="w-5 h-5" />)
                        : <PhoneOutgoing className="w-5 h-5" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">
                        {formatPhoneNumber(call.direction === 'inbound' ? call.from_number : call.to_number)}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{call.direction === 'inbound' ? 'Incoming' : 'Outgoing'}</span>
                        <span>•</span>
                        <span>{formatTimeAgo(call.start_time)}</span>
                        {call.duration_seconds > 0 && (
                          <>
                            <span>•</span>
                            <span>{formatDuration(call.duration_seconds)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Phone className="w-5 h-5 text-green-500" />
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Audio elements */}
      <audio ref={ringtoneRef} src="https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3" preload="auto" />
      <audio ref={disconnectSoundRef} src="https://customer-assets.emergentagent.com/job_9f47c90b-54d6-46ef-b606-98511a840286/artifacts/kbn121v6_disconnect.ogg" />
      <audio ref={keypressSoundRef} src="https://customer-assets.emergentagent.com/job_9f47c90b-54d6-46ef-b606-98511a840286/artifacts/3lfd4ged_dialer-keypress.mp3" />
      {/* Remote call audio - this plays the other party's voice */}
      <audio ref={remoteAudioRef} autoPlay />
    </div>
  );
}
