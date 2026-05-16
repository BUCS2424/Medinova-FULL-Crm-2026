import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Video, VideoOff, Mic, MicOff, Monitor, PhoneOff,
  Users, MessageSquare, Loader2, Copy, Send
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function VideoRoomPage() {
  const { meetingId } = useParams();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [connected, setConnected] = useState(false);
  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);

  const roomRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteVideosRef = useRef({});

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    fetchMeeting();
    return () => { cleanup(); };
  }, [meetingId]);

  const fetchMeeting = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/video-rooms/meetings/${meetingId}`, { headers: getHeaders() });
      setMeeting(res.data);
    } catch (error) {
      toast.error('Meeting not found');
    } finally {
      setLoading(false);
    }
  };

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (roomRef.current) {
      try { roomRef.current.disconnect(); } catch (e) {}
    }
  };

  const handleJoin = async () => {
    setJoining(true);
    try {
      // Get join token
      const tokenRes = await axios.post(
        `${API_URL}/api/video-rooms/meetings/${meetingId}/join-token`, {},
        { headers: getHeaders() }
      );

      const { token, room_id } = tokenRes.data;

      // Get local media
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Connect via Telnyx Video SDK
      const { Room } = await import('@telnyx/video');
      const room = new Room(room_id, { clientToken: token });

      room.on('connected', () => {
        setConnected(true);
        toast.success('Connected to meeting');
      });

      room.on('participant_joined', (participant) => {
        setParticipants(prev => [...prev, participant]);
      });

      room.on('participant_left', (participant) => {
        setParticipants(prev => prev.filter(p => p.id !== participant.id));
        if (remoteVideosRef.current[participant.id]) {
          delete remoteVideosRef.current[participant.id];
        }
      });

      room.on('stream_published', (participant, stream) => {
        const videoEl = document.getElementById(`remote-video-${participant.id}`);
        if (videoEl) {
          videoEl.srcObject = stream;
        }
      });

      room.on('disconnected', () => {
        setConnected(false);
        toast.info('Disconnected from meeting');
      });

      await room.connect();
      roomRef.current = room;

      // Publish local stream
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];
      if (audioTrack || videoTrack) {
        await room.addStream('self', {
          audio: audioTrack || undefined,
          video: videoTrack || undefined
        });
      }

    } catch (error) {
      console.error('Join error:', error);
      toast.error(error.response?.data?.detail || 'Failed to join meeting');
    } finally {
      setJoining(false);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
      setVideoOn(prev => !prev);
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
      setAudioOn(prev => !prev);
    }
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      cleanup();
      setScreenSharing(false);
      return;
    }
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screen;
      }
      setScreenSharing(true);
      screen.getVideoTracks()[0].onended = () => {
        if (localStreamRef.current && localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        setScreenSharing(false);
      };
    } catch (e) {
      toast.error('Screen share cancelled');
    }
  };

  const handleLeave = () => {
    cleanup();
    setConnected(false);
    window.close();
  };

  const copyJoinLink = () => {
    const link = `${window.location.origin}/video-room/${meetingId}`;
    navigator.clipboard.writeText(link);
    toast.success('Join link copied!');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-900">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-900 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Meeting Not Found</h1>
          <p className="text-slate-400">This meeting may have ended or the link is invalid.</p>
        </div>
      </div>
    );
  }

  if (meeting.status === 'ended') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-900 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Meeting Ended</h1>
          <p className="text-slate-400">This meeting has concluded.</p>
        </div>
      </div>
    );
  }

  // Pre-join lobby
  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-900 to-navy-800">
        <div className="max-w-md w-full p-8 text-center text-white" data-testid="video-lobby">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Video className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{meeting.title}</h1>
          <p className="text-slate-400 mb-1">
            {new Date(meeting.scheduled_at).toLocaleString()}
          </p>
          <p className="text-slate-500 text-sm mb-8">{meeting.duration_minutes} minutes</p>

          {/* Preview */}
          <div className="relative bg-navy-800 rounded-xl overflow-hidden mb-6 aspect-video">
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            <div className="absolute bottom-3 left-3">
              <Badge variant="secondary" className="text-xs">You</Badge>
            </div>
          </div>

          <div className="flex gap-3 justify-center mb-6">
            <Button variant={audioOn ? 'secondary' : 'destructive'} size="icon" onClick={toggleAudio} className="rounded-full w-12 h-12">
              {audioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </Button>
            <Button variant={videoOn ? 'secondary' : 'destructive'} size="icon" onClick={toggleVideo} className="rounded-full w-12 h-12">
              {videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </Button>
          </div>

          <Button onClick={handleJoin} disabled={joining} className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg" data-testid="join-meeting-btn">
            {joining ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Joining...</> : 'Join Meeting'}
          </Button>

          <Button variant="ghost" onClick={copyJoinLink} className="w-full mt-3 text-slate-400 hover:text-white">
            <Copy className="w-4 h-4 mr-2" /> Copy Join Link
          </Button>
        </div>
      </div>
    );
  }

  // In-meeting view
  return (
    <div className="h-screen flex flex-col bg-navy-900" data-testid="video-room-active">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-navy-800 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <Badge className="bg-red-600 text-white gap-1"><div className="w-2 h-2 rounded-full bg-white animate-pulse" /> Live</Badge>
          <span className="text-white font-medium text-sm">{meeting.title}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Users className="w-4 h-4" />
          <span>{participants.length + 1}</span>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4 grid gap-4" style={{
        gridTemplateColumns: participants.length === 0 ? '1fr' : participants.length <= 1 ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(300px, 1fr))'
      }}>
        {/* Local video */}
        <div className="relative bg-navy-800 rounded-xl overflow-hidden">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          <div className="absolute bottom-3 left-3">
            <Badge variant="secondary" className="text-xs">You {screenSharing ? '(Screen)' : ''}</Badge>
          </div>
        </div>

        {/* Remote participants */}
        {participants.map(p => (
          <div key={p.id} className="relative bg-navy-800 rounded-xl overflow-hidden">
            <video id={`remote-video-${p.id}`} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute bottom-3 left-3">
              <Badge variant="secondary" className="text-xs">{p.context?.name || 'Participant'}</Badge>
            </div>
          </div>
        ))}
      </div>

      {/* Chat Sidebar */}
      {showChat && (
        <div className="absolute right-0 top-12 bottom-16 w-80 bg-navy-800 border-l border-slate-700 flex flex-col">
          <div className="p-3 border-b border-slate-700 font-medium text-white text-sm">Chat</div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {chatMessages.map((msg, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium text-blue-400">{msg.from}: </span>
                <span className="text-slate-300">{msg.text}</span>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-slate-700 flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && chatInput.trim()) {
                  setChatMessages(prev => [...prev, { from: 'You', text: chatInput }]);
                  setChatInput('');
                }
              }}
              placeholder="Type a message..."
              className="flex-1 bg-slate-700 text-white rounded px-3 py-2 text-sm outline-none"
            />
            <Button size="icon" variant="ghost" onClick={() => {
              if (chatInput.trim()) {
                setChatMessages(prev => [...prev, { from: 'You', text: chatInput }]);
                setChatInput('');
              }
            }}>
              <Send className="w-4 h-4 text-white" />
            </Button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 py-4 bg-navy-800 border-t border-slate-700">
        <Button variant={audioOn ? 'secondary' : 'destructive'} size="icon" onClick={toggleAudio} className="rounded-full w-12 h-12" data-testid="toggle-audio">
          {audioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </Button>
        <Button variant={videoOn ? 'secondary' : 'destructive'} size="icon" onClick={toggleVideo} className="rounded-full w-12 h-12" data-testid="toggle-video">
          {videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </Button>
        <Button variant={screenSharing ? 'default' : 'secondary'} size="icon" onClick={toggleScreenShare} className="rounded-full w-12 h-12" data-testid="toggle-screen">
          <Monitor className="w-5 h-5" />
        </Button>
        <Button variant={showChat ? 'default' : 'secondary'} size="icon" onClick={() => setShowChat(!showChat)} className="rounded-full w-12 h-12">
          <MessageSquare className="w-5 h-5" />
        </Button>
        <Button variant="destructive" size="icon" onClick={handleLeave} className="rounded-full w-14 h-14 ml-4" data-testid="leave-meeting">
          <PhoneOff className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
