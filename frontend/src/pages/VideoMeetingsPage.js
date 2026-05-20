import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../components/ui/dialog';
import {
  Video, Plus, Copy, ExternalLink, Loader2, PhoneOff,
  Calendar, Clock, Users, MessageSquare, ArrowRight,
  UserCheck, Link as LinkIcon
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  sales_rep: 'Sales Rep',
  sales_manager: 'Sales Manager',
  doctor: 'Doctor',
};

export default function VideoMeetingsPage() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', duration_minutes: 30, notes: '', patient_phone: '' });
  const [sendingSms, setSendingSms] = useState(null); // meetingId of the one being sent

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => { fetchMeetings(); }, []);

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/video-rooms/meetings?limit=50`, {
        headers: getHeaders(),
      });
      setMeetings(res.data);
    } catch {
      toast.error('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error('Meeting title is required'); return; }
    setCreating(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/video-rooms/meetings`,
        {
          title: form.title,
          duration_minutes: Number(form.duration_minutes),
          notes: form.notes,
          participant_phones: form.patient_phone ? [form.patient_phone] : [],
        },
        { headers: getHeaders() }
      );
      toast.success('Meeting created');
      setShowCreate(false);
      setForm({ title: '', duration_minutes: 30, notes: '', patient_phone: '' });
      fetchMeetings();
      const meetingId = res.data.meeting?.id;
      if (meetingId) {
        window.open(`/video-room/${meetingId}?role=host`, '_blank');
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create meeting');
    } finally {
      setCreating(false);
    }
  };

  const handleEnd = async (meetingId) => {
    try {
      await axios.post(`${API_URL}/api/video-rooms/meetings/${meetingId}/end`, {}, {
        headers: getHeaders(),
      });
      toast.success('Meeting ended');
      fetchMeetings();
    } catch {
      toast.error('Failed to end meeting');
    }
  };

  const copyPatientLink = (meetingId) => {
    const url = `${window.location.origin}/video-room/${meetingId}`;
    navigator.clipboard.writeText(url);
    toast.success('Patient join link copied to clipboard!');
  };

  const copyHostLink = (meetingId) => {
    const url = `${window.location.origin}/video-room/${meetingId}?role=host`;
    navigator.clipboard.writeText(url);
    toast.success('Host join link copied!');
  };

  const sendSmsInvite = async (meeting) => {
    const phone = meeting.participant_phones?.[0];
    if (!phone) {
      toast.error('No phone number on this meeting. Edit it to add one.');
      return;
    }
    setSendingSms(meeting.id);
    try {
      const joinUrl = `${window.location.origin}/video-room/${meeting.id}`;
      await axios.post(
        `${API_URL}/api/sms/send`,
        {
          to: phone,
          message: `Your telehealth appointment "${meeting.title}" is ready. Join here: ${joinUrl}`,
        },
        { headers: getHeaders() }
      );
      toast.success('SMS invite sent to patient!');
    } catch {
      toast.error('SMS send failed. Check Telnyx SMS config.');
    } finally {
      setSendingSms(null);
    }
  };

  const statusColor = (status) => {
    if (status === 'active') return 'bg-green-100 text-green-700 border-green-200';
    if (status === 'scheduled') return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-slate-100 text-slate-500 border-slate-200';
  };

  const activeMeetings = meetings.filter((m) => m.status !== 'ended');
  const pastMeetings = meetings.filter((m) => m.status === 'ended');

  return (
    <div className="space-y-6 p-6" data-testid="video-meetings-page">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="w-6 h-6 text-blue-600" />
            Telehealth Meetings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Native WebRTC video consultations — no paid service required. Works in any modern browser.
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="gap-2"
          style={{ background: 'linear-gradient(135deg, #0055CC, #00A3E0)' }}
          data-testid="create-meeting-btn"
        >
          <Plus className="w-4 h-4" /> New Meeting
        </Button>
      </div>

      {/* How it works */}
      <Card className="border-blue-100 bg-blue-50/50">
        <CardContent className="pt-5 pb-4">
          <p className="text-sm font-semibold text-blue-800 mb-3">How Telehealth Works</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">1</div>
              <div>
                <p className="text-sm font-medium">Provider creates meeting</p>
                <p className="text-xs text-muted-foreground mt-0.5">Admin, Doctor, or Sales Rep clicks "New Meeting" and joins as Host.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">2</div>
              <div>
                <p className="text-sm font-medium">Share the patient link</p>
                <p className="text-xs text-muted-foreground mt-0.5">Copy the Patient Link and send via SMS, email, or phone call.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">3</div>
              <div>
                <p className="text-sm font-medium">Patient joins from any device</p>
                <p className="text-xs text-muted-foreground mt-0.5">Patient opens the link in Chrome/Safari — no login or app download needed.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100"><Video className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-2xl font-bold">{activeMeetings.length}</p>
                <p className="text-xs text-muted-foreground">Active / Scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100"><Clock className="w-5 h-5 text-slate-500" /></div>
              <div>
                <p className="text-2xl font-bold">{pastMeetings.length}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100"><Users className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold">{meetings.length}</p>
                <p className="text-xs text-muted-foreground">Total Meetings</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Meetings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Active &amp; Scheduled Meetings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeMeetings.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Video className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No active meetings</p>
              <p className="text-sm mt-1">Create a new meeting to start a telehealth session</p>
              <Button variant="outline" className="mt-4" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4 mr-2" /> Create Meeting
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {activeMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="py-4"
                  data-testid={`meeting-row-${meeting.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold truncate">{meeting.title}</h3>
                        <Badge className={`text-xs shrink-0 border ${statusColor(meeting.status)}`}>
                          {meeting.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs shrink-0">WebRTC</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(meeting.scheduled_at || meeting.created_at).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {meeting.duration_minutes} min
                        </span>
                        {meeting.created_by_name && (
                          <span className="flex items-center gap-1">
                            <UserCheck className="w-3 h-3" />
                            {meeting.created_by_name}
                            {meeting.created_by_role && (
                              <span className="text-muted-foreground/70">
                                ({ROLE_LABELS[meeting.created_by_role] || meeting.created_by_role})
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyPatientLink(meeting.id)}
                        title="Copy patient join link (no login required)"
                        data-testid={`copy-patient-link-${meeting.id}`}
                      >
                        <LinkIcon className="w-3.5 h-3.5 mr-1.5" /> Patient Link
                      </Button>
                      {meeting.participant_phones?.[0] && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sendSmsInvite(meeting)}
                          disabled={sendingSms === meeting.id}
                          title="Send SMS invite to patient"
                          data-testid={`send-sms-${meeting.id}`}
                        >
                          {sendingSms === meeting.id
                            ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Sending...</>
                            : <><MessageSquare className="w-3.5 h-3.5 mr-1.5" /> SMS</>
                          }
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => window.open(`/video-room/${meeting.id}?role=host`, '_blank')}
                        style={{ background: 'linear-gradient(135deg, #0055CC, #00A3E0)' }}
                        data-testid={`join-host-${meeting.id}`}
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Join as Host
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEnd(meeting.id)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        data-testid={`end-meeting-${meeting.id}`}
                      >
                        <PhoneOff className="w-3.5 h-3.5 mr-1.5" /> End
                      </Button>
                    </div>
                  </div>

                  {/* Patient link quick-view */}
                  <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-500">
                    <LinkIcon className="w-3 h-3 shrink-0 text-blue-500" />
                    <span className="font-medium text-slate-600 shrink-0">Patient link:</span>
                    <span className="truncate font-mono text-xs">{window.location.origin}/video-room/{meeting.id}</span>
                    <button
                      onClick={() => copyPatientLink(meeting.id)}
                      className="shrink-0 text-blue-600 hover:text-blue-800 ml-auto"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Meetings */}
      {pastMeetings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-muted-foreground">Past Meetings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {pastMeetings.slice(0, 10).map((meeting) => (
                <div key={meeting.id} className="py-3 flex items-center justify-between gap-4 opacity-60">
                  <div>
                    <p className="font-medium text-sm">{meeting.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(meeting.ended_at || meeting.created_at).toLocaleString()}
                      {' · '}{meeting.duration_minutes} min
                      {meeting.created_by_name && ` · ${meeting.created_by_name}`}
                    </p>
                  </div>
                  <Badge className="text-xs bg-slate-100 text-slate-500 border border-slate-200">Ended</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Meeting Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md" data-testid="create-meeting-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-blue-600" />
              New Telehealth Meeting
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="meeting-title">Meeting Title *</Label>
              <Input
                id="meeting-title"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Initial Consultation — John Smith"
                className="mt-1"
                data-testid="meeting-title-input"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="meeting-duration">Duration (minutes)</Label>
              <Input
                id="meeting-duration"
                type="number"
                min={5}
                max={180}
                value={form.duration_minutes}
                onChange={(e) => setForm((p) => ({ ...p, duration_minutes: e.target.value }))}
                className="mt-1"
                data-testid="meeting-duration-input"
              />
            </div>
            <div>
              <Label htmlFor="patient-phone">Patient Phone (optional — for SMS invite)</Label>
              <Input
                id="patient-phone"
                type="tel"
                value={form.patient_phone}
                onChange={(e) => setForm((p) => ({ ...p, patient_phone: e.target.value }))}
                placeholder="+1 (555) 000-0000"
                className="mt-1"
                data-testid="meeting-phone-input"
              />
            </div>
            <div>
              <Label htmlFor="meeting-notes">Notes (optional)</Label>
              <Input
                id="meeting-notes"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Appointment notes..."
                className="mt-1"
              />
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">What happens next:</p>
              <p className="flex items-center gap-1.5">
                <ArrowRight className="w-3 h-3 shrink-0" />
                You'll be opened as the Host in a new tab
              </p>
              <p className="flex items-center gap-1.5">
                <ArrowRight className="w-3 h-3 shrink-0" />
                Copy the Patient Link to share — patient joins with no login needed
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !form.title.trim()}
              style={{ background: 'linear-gradient(135deg, #0055CC, #00A3E0)' }}
              data-testid="create-meeting-submit-btn"
            >
              {creating
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                : <><Video className="w-4 h-4 mr-2" /> Create &amp; Join as Host</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
