import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  Voicemail, 
  Play, 
  Pause,
  Phone,
  Clock,
  User,
  Users,
  Archive,
  Trash2,
  Link,
  ExternalLink,
  Search,
  Loader2,
  CheckCircle,
  Circle,
  RefreshCw
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function VoicemailInboxPage() {
  const [voicemails, setVoicemails] = useState([]);
  const [stats, setStats] = useState({ total: 0, unlistened: 0, listened: 0, archived: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [playingId, setPlayingId] = useState(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedVoicemail, setSelectedVoicemail] = useState(null);
  const [patients, setPatients] = useState([]);
  const [leads, setLeads] = useState([]);
  const [linkType, setLinkType] = useState('patient');
  const [selectedLinkId, setSelectedLinkId] = useState('');
  
  const audioRef = useRef(null);

  useEffect(() => {
    fetchVoicemails();
    fetchStats();
  }, [activeTab]);

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  const fetchVoicemails = async () => {
    try {
      setIsLoading(true);
      const params = {};
      if (activeTab === 'unlistened') params.status = 'completed';
      if (activeTab === 'listened') params.status = 'listened';
      if (activeTab === 'archived') params.status = 'archived';
      
      const response = await axios.get(`${API_URL}/api/voicemail/inbox`, {
        headers: getHeaders(),
        params
      });
      setVoicemails(response.data.voicemails || []);
    } catch (error) {
      console.error('Error fetching voicemails:', error);
      toast.error('Failed to load voicemails');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/voicemail/stats/summary`, {
        headers: getHeaders()
      });
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchPatientsAndLeads = async () => {
    try {
      const [patientsRes, leadsRes] = await Promise.all([
        axios.get(`${API_URL}/api/patients?limit=100`, { headers: getHeaders() }),
        axios.get(`${API_URL}/api/leads?limit=100`, { headers: getHeaders() })
      ]);
      setPatients(patientsRes.data.patients || patientsRes.data || []);
      setLeads(leadsRes.data.leads || leadsRes.data || []);
    } catch (error) {
      console.error('Error fetching patients/leads:', error);
    }
  };

  const playVoicemail = async (voicemail) => {
    if (playingId === voicemail.id) {
      // Pause
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingId(null);
      return;
    }
    
    // Play new voicemail
    setPlayingId(voicemail.id);
    
    if (audioRef.current) {
      audioRef.current.src = voicemail.recording_url;
      audioRef.current.play();
    }
    
    // Mark as listened if not already
    if (voicemail.status === 'completed') {
      try {
        await axios.put(`${API_URL}/api/voicemail/${voicemail.id}/listened`, {}, {
          headers: getHeaders()
        });
        // Update local state
        setVoicemails(prev => prev.map(v => 
          v.id === voicemail.id ? { ...v, status: 'listened' } : v
        ));
        fetchStats();
      } catch (error) {
        console.error('Error marking as listened:', error);
      }
    }
  };

  const archiveVoicemail = async (id) => {
    try {
      await axios.put(`${API_URL}/api/voicemail/${id}/archive`, {}, {
        headers: getHeaders()
      });
      toast.success('Voicemail archived');
      fetchVoicemails();
      fetchStats();
    } catch (error) {
      toast.error('Failed to archive voicemail');
    }
  };

  const deleteVoicemail = async (id) => {
    if (!window.confirm('Are you sure you want to delete this voicemail?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/voicemail/${id}`, {
        headers: getHeaders()
      });
      toast.success('Voicemail deleted');
      fetchVoicemails();
      fetchStats();
    } catch (error) {
      toast.error('Failed to delete voicemail');
    }
  };

  const openLinkDialog = (voicemail) => {
    setSelectedVoicemail(voicemail);
    setLinkType('patient');
    setSelectedLinkId('');
    fetchPatientsAndLeads();
    setLinkDialogOpen(true);
  };

  const linkVoicemail = async () => {
    if (!selectedLinkId) {
      toast.error('Please select a patient or lead');
      return;
    }
    
    try {
      const endpoint = linkType === 'patient' 
        ? `/api/voicemail/${selectedVoicemail.id}/link-patient/${selectedLinkId}`
        : `/api/voicemail/${selectedVoicemail.id}/link-lead/${selectedLinkId}`;
      
      await axios.put(`${API_URL}${endpoint}`, {}, {
        headers: getHeaders()
      });
      
      toast.success(`Voicemail linked to ${linkType}`);
      setLinkDialogOpen(false);
      fetchVoicemails();
    } catch (error) {
      toast.error('Failed to link voicemail');
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const filteredVoicemails = voicemails.filter(v => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      v.from_number?.toLowerCase().includes(search) ||
      v.caller_name?.toLowerCase().includes(search) ||
      v.recipient_name?.toLowerCase().includes(search) ||
      v.patient_name?.toLowerCase().includes(search) ||
      v.lead_name?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Hidden audio element */}
      <audio 
        ref={audioRef} 
        onEnded={() => setPlayingId(null)}
        onError={() => {
          toast.error('Failed to play voicemail');
          setPlayingId(null);
        }}
      />
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Voicemail className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Voicemail Inbox</h1>
            <p className="text-muted-foreground">Listen to and manage voicemail messages</p>
          </div>
        </div>
        
        <Button variant="outline" onClick={() => { fetchVoicemails(); fetchStats(); }}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Voicemail className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unlistened</p>
                <p className="text-2xl font-bold text-red-600">{stats.unlistened}</p>
              </div>
              <Circle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Listened</p>
                <p className="text-2xl font-bold text-green-600">{stats.listened}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Archived</p>
                <p className="text-2xl font-bold">{stats.archived}</p>
              </div>
              <Archive className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by phone, name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unlistened" className="flex items-center gap-2">
              Unlistened
              {stats.unlistened > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5">{stats.unlistened}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="listened">Listened</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Voicemail List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : filteredVoicemails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Voicemail className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg">No voicemails found</p>
              <p className="text-sm">Voicemails will appear here when received</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredVoicemails.map((voicemail) => (
                <div 
                  key={voicemail.id} 
                  className={`p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors ${
                    voicemail.status === 'completed' ? 'bg-red-50' : ''
                  }`}
                >
                  {/* Play Button */}
                  <Button
                    size="icon"
                    variant={playingId === voicemail.id ? "default" : "outline"}
                    onClick={() => playVoicemail(voicemail)}
                    disabled={!voicemail.recording_url}
                  >
                    {playingId === voicemail.id ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>

                  {/* Voicemail Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{voicemail.from_number}</span>
                      {voicemail.caller_name && (
                        <span className="text-muted-foreground">({voicemail.caller_name})</span>
                      )}
                      {voicemail.status === 'completed' && (
                        <Badge variant="destructive" className="ml-2">New</Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(voicemail.duration)}
                      </span>
                      <span>{formatDate(voicemail.created_at)}</span>
                      {voicemail.recipient_type === 'extension' && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {voicemail.recipient_name || 'Extension'}
                        </span>
                      )}
                      {voicemail.recipient_type === 'main' && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Main Line
                        </span>
                      )}
                    </div>
                    
                    {/* Linked Patient/Lead */}
                    {(voicemail.patient_name || voicemail.lead_name) && (
                      <div className="mt-1">
                        <Badge variant="secondary" className="text-xs">
                          <Link className="w-3 h-3 mr-1" />
                          {voicemail.patient_name ? `Patient: ${voicemail.patient_name}` : `Lead: ${voicemail.lead_name}`}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openLinkDialog(voicemail)}
                      title="Link to Patient/Lead"
                    >
                      <Link className="w-4 h-4" />
                    </Button>
                    
                    {voicemail.status !== 'archived' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => archiveVoicemail(voicemail.id)}
                        title="Archive"
                      >
                        <Archive className="w-4 h-4" />
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteVoicemail(voicemail.id)}
                      className="text-red-600 hover:text-red-700"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Voicemail to Patient/Lead</DialogTitle>
            <DialogDescription>
              Add this voicemail to a patient's or lead's file for HIPAA-compliant record keeping.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Link Type</label>
              <Select value={linkType} onValueChange={setLinkType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="patient">Patient</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {linkType === 'patient' ? 'Select Patient' : 'Select Lead'}
              </label>
              <Select value={selectedLinkId} onValueChange={setSelectedLinkId}>
                <SelectTrigger>
                  <SelectValue placeholder={`Choose a ${linkType}...`} />
                </SelectTrigger>
                <SelectContent>
                  {(linkType === 'patient' ? patients : leads).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.first_name} {item.last_name}
                      {item.phone && ` - ${item.phone}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={linkVoicemail}>
              <Link className="w-4 h-4 mr-2" />
              Link Voicemail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
