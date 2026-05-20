import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Video, VideoOff, Mic, MicOff, Monitor, MonitorOff,
  PhoneOff, Loader2, Copy, Brain, Send, X
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const getWsUrl = () => API_URL.replace(/^https/, 'wss').replace(/^http(?!s)/, 'ws');

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export default function VideoRoomPage() {
  const { meetingId } = useParams();
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role') || 'patient';

  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [connected, setConnected] = useState(false);
  const [hasRemote, setHasRemote] = useState(false);
  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  // media state: 'pending' | 'ok' | 'audio_only' | 'denied' | 'not_found' | 'unavailable'
  const [mediaState, setMediaState] = useState('pending');
  const [showDiagnose, setShowDiagnose] = useState(false);
  const [symptoms, setSymptoms] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [diagnosing, setDiagnosing] = useState(false);

  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidates = useRef([]);

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    fetchMeeting();
    return () => cleanup();
  }, [meetingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start camera preview once in lobby — track media state for UI feedback
  useEffect(() => {
    if (!loading && meeting && meeting.status !== 'ended' && !connected) {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaState('unavailable');
        return;
      }
      navigator.mediaDevices
        .getUserMedia({ audio: true, video: true })
        .then((stream) => {
          localStreamRef.current = stream;
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;
          setMediaState('ok');
        })
        .catch((err) => {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setMediaState('denied');
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            // Try audio-only fallback
            navigator.mediaDevices
              .getUserMedia({ audio: true, video: false })
              .then((stream) => {
                localStreamRef.current = stream;
                setMediaState('audio_only');
              })
              .catch(() => setMediaState('not_found'));
          } else {
            setMediaState('not_found');
          }
        });
    }
  }, [loading, meeting, connected]);

  const fetchMeeting = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/video-rooms/meetings/${meetingId}`, {
        headers: getHeaders(),
      });
      setMeeting(res.data);
    } catch {
      toast.error('Meeting not found');
    } finally {
      setLoading(false);
    }
  };

  const cleanup = () => {
    if (wsRef.current) { try { wsRef.current.close(); } catch (e) {} wsRef.current = null; }
    if (pcRef.current) { try { pcRef.current.close(); } catch (e) {} pcRef.current = null; }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
  };

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: 'ice-candidate', candidate: event.candidate })
        );
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setHasRemote(true);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setHasRemote(false);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      }
    };

    return pc;
  }, []);

  const handleSignalingMessage = useCallback(
    async (msg) => {
      const pc = pcRef.current;
      if (!pc) return;

      if (msg.type === 'peer_joined') {
        // Host initiates the offer when the patient joins
        if (role === 'host') {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            wsRef.current?.send(
              JSON.stringify({ type: 'offer', sdp: pc.localDescription })
            );
          } catch (e) {
            console.error('Offer creation error:', e);
          }
        }
      } else if (msg.type === 'offer') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          for (const c of pendingCandidates.current) {
            await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          }
          pendingCandidates.current = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          wsRef.current?.send(
            JSON.stringify({ type: 'answer', sdp: pc.localDescription })
          );
        } catch (e) {
          console.error('Answer creation error:', e);
        }
      } else if (msg.type === 'answer') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          for (const c of pendingCandidates.current) {
            await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          }
          pendingCandidates.current = [];
        } catch (e) {
          console.error('Set remote description error:', e);
        }
      } else if (msg.type === 'ice-candidate') {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
        } else {
          pendingCandidates.current.push(msg.candidate);
        }
      } else if (msg.type === 'peer_left') {
        setHasRemote(false);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      }
    },
    [role]
  );

  const handleJoin = async () => {
    // Hard stop if mediaDevices API not available
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Your browser does not support camera/mic access. Use Chrome, Firefox, or Safari over HTTPS.');
      return;
    }

    setJoining(true);
    try {
      // Reuse existing stream if still alive
      let stream = localStreamRef.current;
      const streamDead = !stream || stream.getTracks().every((t) => t.readyState === 'ended');

      if (streamDead) {
        try {
          // Prefer full AV
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          setMediaState('ok');
        } catch (mediaErr) {
          if (mediaErr.name === 'NotAllowedError' || mediaErr.name === 'PermissionDeniedError') {
            toast.error('Camera/microphone permission was denied. Click the camera icon in your browser address bar and allow access, then try again.');
            setMediaState('denied');
            setJoining(false);
            return;
          }
          // NotFoundError / NotReadableError → try audio-only
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            setMediaState('audio_only');
            toast.info('No camera found — joining with microphone only.');
          } catch (audioErr) {
            if (audioErr.name === 'NotAllowedError' || audioErr.name === 'PermissionDeniedError') {
              toast.error('Microphone permission denied. Allow access in your browser and try again.');
              setMediaState('denied');
            } else {
              toast.error('No camera or microphone found. Check your device settings.');
              setMediaState('not_found');
            }
            setJoining(false);
            return;
          }
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      }

      // Create RTCPeerConnection and add tracks
      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pcRef.current = pc;

      // Connect WebSocket signaling
      const wsUrl = `${getWsUrl()}/api/video-rooms/ws/${meetingId}/${role}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setJoining(false);
        toast.success(`Joined as ${role === 'host' ? 'Provider' : 'Patient'}`);
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type !== 'ping') await handleSignalingMessage(msg);
        } catch (e) {}
      };

      ws.onerror = () => {
        toast.error('Could not connect to the signaling server. Check your network and try again.');
        setJoining(false);
      };

      ws.onclose = () => {
        setConnected(false);
      };
    } catch (error) {
      console.error('[VideoRoom] handleJoin error:', error);
      toast.error(`Join failed: ${error.message || error.name || 'Unknown error'}`);
      setJoining(false);
    }
  };

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setVideoOn((prev) => !prev);
  };

  const toggleAudio = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setAudioOn((prev) => !prev);
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack && pcRef.current) {
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(videoTrack).catch(() => {});
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      setScreenSharing(false);
      return;
    }
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      if (pcRef.current) {
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(screenTrack).catch(() => {});
      }
      if (localVideoRef.current)
        localVideoRef.current.srcObject = new MediaStream([
          screenTrack,
          ...( localStreamRef.current?.getAudioTracks() || []),
        ]);

      setScreenSharing(true);

      screenTrack.onended = () => {
        setScreenSharing(false);
        const vt = localStreamRef.current?.getVideoTracks()[0];
        if (vt && pcRef.current) {
          const s = pcRef.current.getSenders().find((x) => x.track?.kind === 'video');
          if (s) s.replaceTrack(vt);
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      };
    } catch (e) {
      if (e.name !== 'NotAllowedError') toast.error('Screen share failed');
    }
  };

  const handleLeave = () => {
    cleanup();
    setConnected(false);
    window.history.back();
  };

  const formatDiagnosis = (text) =>
    text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .trim();

  const handleDiagnose = async () => {
    if (!symptoms.trim()) return;
    setDiagnosing(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/gemini/diagnose`,
        { symptoms: symptoms.trim() },
        { headers: getHeaders() }
      );
      setDiagnosis(formatDiagnosis(res.data.diagnosis));
    } catch {
      toast.error('AI service unavailable');
    } finally {
      setDiagnosing(false);
    }
  };

  const copyJoinLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/video-room/${meetingId}`);
    toast.success('Join link copied!');
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B1B33' }}>
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B1B33' }}>
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-2">Meeting Not Found</h1>
          <p className="text-slate-400">This meeting may have ended or the link is invalid.</p>
        </div>
      </div>
    );
  }

  if (meeting.status === 'ended') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B1B33' }}>
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-2">Meeting Ended</h1>
          <p className="text-slate-400">This meeting has concluded.</p>
        </div>
      </div>
    );
  }

  // ── Pre-join lobby ──────────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #0B1B33 0%, #0a2240 100%)' }}
      >
        <div className="max-w-md w-full p-8 text-center text-white" data-testid="video-lobby">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'linear-gradient(135deg, #0055CC, #00A3E0)' }}
          >
            <Video className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-1">{meeting.title}</h1>
          <p className="text-slate-400 text-sm mb-1">
            {new Date(meeting.scheduled_at).toLocaleString()}
          </p>
          <div className="flex justify-center mb-6">
            <Badge
              className="text-xs px-3 py-1"
              style={{ background: role === 'host' ? '#0055CC' : '#1a3a5c', color: '#fff' }}
            >
              Joining as {role === 'host' ? 'Provider (Host)' : 'Patient'}
            </Badge>
          </div>

          {/* Camera preview */}
          <div
            className="relative rounded-xl overflow-hidden mb-4 aspect-video"
            style={{ background: '#0a2240' }}
          >
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Media state overlays */}
            {mediaState === 'pending' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                <p className="text-slate-400 text-xs">Requesting camera access…</p>
              </div>
            )}
            {mediaState === 'audio_only' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <Mic className="w-8 h-8 text-yellow-400" />
                <p className="text-yellow-300 text-xs font-medium">Audio only — no camera found</p>
              </div>
            )}
            {(mediaState === 'denied' || mediaState === 'not_found' || mediaState === 'unavailable') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4">
                <VideoOff className="w-8 h-8 text-red-400" />
                <p className="text-red-300 text-xs font-medium text-center">
                  {mediaState === 'denied' && 'Camera permission blocked — click the camera icon in your browser address bar to allow it'}
                  {mediaState === 'not_found' && 'No camera/mic found — check that your device is connected'}
                  {mediaState === 'unavailable' && 'WebRTC not supported — use Chrome, Firefox, or Safari'}
                </p>
              </div>
            )}

            <div className="absolute bottom-3 left-3">
              <Badge
                variant="secondary"
                className="text-xs"
                style={mediaState === 'ok' ? {} : mediaState === 'audio_only' ? { background: '#7c5f00', color: '#fde68a' } : { background: '#7f1d1d', color: '#fca5a5' }}
              >
                {mediaState === 'ok' ? 'Preview' : mediaState === 'audio_only' ? 'Audio only' : mediaState === 'pending' ? 'Requesting…' : 'No device'}
              </Badge>
            </div>
          </div>

          {/* Media toggles */}
          <div className="flex gap-3 justify-center mb-5">
            <Button
              variant={audioOn ? 'secondary' : 'destructive'}
              size="icon"
              onClick={toggleAudio}
              className="rounded-full w-12 h-12"
              data-testid="lobby-toggle-audio"
            >
              {audioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </Button>
            <Button
              variant={videoOn ? 'secondary' : 'destructive'}
              size="icon"
              onClick={toggleVideo}
              className="rounded-full w-12 h-12"
              data-testid="lobby-toggle-video"
            >
              {videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </Button>
            {/* Re-request permission button when blocked */}
            {(mediaState === 'denied' || mediaState === 'not_found') && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setMediaState('pending');
                  navigator.mediaDevices
                    .getUserMedia({ audio: true, video: true })
                    .then((stream) => {
                      localStreamRef.current = stream;
                      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
                      setMediaState('ok');
                    })
                    .catch(() => setMediaState('denied'));
                }}
                className="rounded-full w-12 h-12 border-yellow-400 text-yellow-400"
                title="Retry camera access"
              >
                <Loader2 className="w-5 h-5" />
              </Button>
            )}
          </div>

          <Button
            onClick={handleJoin}
            disabled={joining || mediaState === 'unavailable'}
            className="w-full py-6 text-lg font-semibold mb-3"
            style={{
              background: mediaState === 'unavailable'
                ? '#334155'
                : 'linear-gradient(135deg, #0055CC, #00A3E0)'
            }}
            data-testid="join-meeting-btn"
          >
            {joining ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Connecting...</>
            ) : mediaState === 'unavailable' ? (
              'Browser Not Supported'
            ) : mediaState === 'audio_only' ? (
              'Join Meeting (Audio Only)'
            ) : (
              'Join Meeting'
            )}
          </Button>

          <Button
            variant="ghost"
            onClick={copyJoinLink}
            className="w-full text-slate-400 hover:text-white"
          >
            <Copy className="w-4 h-4 mr-2" /> Copy Join Link
          </Button>
        </div>
      </div>
    );
  }

  // ── In-meeting view ─────────────────────────────────────────────────────────
  return (
    <div
      className="h-screen flex flex-col"
      style={{ background: '#0B1B33' }}
      data-testid="video-room-active"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b shrink-0"
        style={{ background: '#0a1f3d', borderColor: '#1e3a5f' }}
      >
        <div className="flex items-center gap-3">
          <Badge className="gap-1.5 text-white text-xs" style={{ background: '#c0392b' }}>
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            Live
          </Badge>
          <span className="text-white font-medium text-sm truncate max-w-48">{meeting.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="text-xs" style={{ background: '#1a3a5c', color: '#7eb8e8' }}>
            {role === 'host' ? 'Provider' : 'Patient'}
          </Badge>
          <span className="text-slate-500 text-xs">
            {hasRemote ? '2 participants' : 'Waiting for other party...'}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video area */}
        <div className="flex-1 p-3">
          <div
            className={`h-full grid gap-3 ${hasRemote ? 'grid-cols-2' : 'grid-cols-1'}`}
          >
            {/* Remote video */}
            {hasRemote && (
              <div
                className="relative rounded-xl overflow-hidden"
                style={{ background: '#0a2240' }}
                data-testid="remote-video-container"
              >
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-3 left-3">
                  <Badge variant="secondary" className="text-xs">
                    {role === 'host' ? 'Patient' : 'Provider'}
                  </Badge>
                </div>
              </div>
            )}

            {/* Local video */}
            <div
              className="relative rounded-xl overflow-hidden"
              style={{ background: '#0a2240' }}
              data-testid="local-video-container"
            >
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {!videoOn && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ background: '#0a2240' }}
                >
                  <VideoOff className="w-10 h-10 text-slate-600" />
                </div>
              )}
              <div className="absolute bottom-3 left-3 flex gap-2">
                <Badge variant="secondary" className="text-xs">
                  You {screenSharing ? '(Screen)' : ''}
                </Badge>
                {!audioOn && (
                  <Badge variant="destructive" className="text-xs">
                    Muted
                  </Badge>
                )}
              </div>

              {/* Waiting indicator */}
              {!hasRemote && (
                <div className="absolute bottom-12 left-0 right-0 flex justify-center pointer-events-none">
                  <div
                    className="px-4 py-2.5 rounded-lg text-center"
                    style={{ background: 'rgba(10,31,61,0.85)' }}
                  >
                    <div className="flex items-center gap-2 justify-center">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                      <span className="text-slate-300 text-sm">
                        Waiting for other party to join...
                      </span>
                    </div>
                    <p className="text-slate-500 text-xs mt-1">
                      Share the join link to invite them
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Diagnose Panel */}
        {showDiagnose && (
          <div
            className="w-80 flex flex-col border-l shrink-0"
            style={{ background: '#0a1f3d', borderColor: '#1e3a5f' }}
            data-testid="diagnose-panel"
          >
            <div
              className="flex items-center justify-between px-3 py-2.5 border-b shrink-0"
              style={{ borderColor: '#1e3a5f' }}
            >
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-blue-400" />
                <span className="text-white font-medium text-sm">AI Clinical Assistant</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-slate-700"
                onClick={() => setShowDiagnose(false)}
              >
                <X className="w-4 h-4 text-slate-400" />
              </Button>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-3">
              {diagnosis && (
                <div
                  className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed p-3 rounded-lg"
                  style={{ background: '#0B1B33' }}
                  data-testid="diagnosis-result"
                >
                  {diagnosis}
                </div>
              )}
              {!diagnosis && !diagnosing && (
                <p className="text-slate-500 text-xs text-center mt-8 px-2 leading-relaxed">
                  Enter patient symptoms below to get AI clinical suggestions, DME
                  recommendations, and ICD-10 codes.
                </p>
              )}
              {diagnosing && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                  <span className="text-slate-400 text-sm">Analyzing...</span>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t shrink-0" style={{ borderColor: '#1e3a5f' }}>
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) handleDiagnose();
                }}
                placeholder="Describe patient symptoms... (Ctrl+Enter to submit)"
                rows={3}
                className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none text-white placeholder-slate-600"
                style={{ background: '#0B1B33', border: '1px solid #1e3a5f' }}
                data-testid="symptoms-input"
              />
              <Button
                onClick={handleDiagnose}
                disabled={!symptoms.trim() || diagnosing}
                className="w-full mt-2 text-sm font-medium"
                style={{ background: 'linear-gradient(135deg, #0055CC, #00A3E0)' }}
                data-testid="diagnose-submit-btn"
              >
                {diagnosing ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Analyzing...</>
                ) : (
                  <><Send className="w-3.5 h-3.5 mr-1.5" /> Analyze Symptoms</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div
        className="flex items-center justify-center gap-3 py-3 border-t shrink-0"
        style={{ background: '#0a1f3d', borderColor: '#1e3a5f' }}
      >
        <Button
          variant={audioOn ? 'secondary' : 'destructive'}
          size="icon"
          onClick={toggleAudio}
          className="rounded-full w-12 h-12"
          data-testid="toggle-audio"
          title={audioOn ? 'Mute microphone' : 'Unmute microphone'}
        >
          {audioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </Button>

        <Button
          variant={videoOn ? 'secondary' : 'destructive'}
          size="icon"
          onClick={toggleVideo}
          className="rounded-full w-12 h-12"
          data-testid="toggle-video"
          title={videoOn ? 'Stop video' : 'Start video'}
        >
          {videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </Button>

        <Button
          variant="secondary"
          size="icon"
          onClick={toggleScreenShare}
          className="rounded-full w-12 h-12"
          data-testid="toggle-screen"
          title={screenSharing ? 'Stop screen share' : 'Share screen'}
          style={screenSharing ? { background: '#0055CC', color: '#fff' } : {}}
        >
          {screenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
        </Button>

        <Button
          variant="secondary"
          size="icon"
          onClick={() => setShowDiagnose((v) => !v)}
          className="rounded-full w-12 h-12"
          data-testid="toggle-diagnose"
          title="AI Clinical Assistant"
          style={showDiagnose ? { background: '#0055CC', color: '#fff' } : {}}
        >
          <Brain className="w-5 h-5" />
        </Button>

        <Button
          variant="destructive"
          size="icon"
          onClick={handleLeave}
          className="rounded-full w-14 h-14 ml-4"
          data-testid="leave-meeting"
          style={{ background: '#c0392b' }}
        >
          <PhoneOff className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
