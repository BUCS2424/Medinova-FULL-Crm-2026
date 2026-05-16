import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { Video, Loader2, Plus, X } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ScheduleMeetingModal({ isOpen, onClose, onSuccess, prefill = {} }) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: prefill.title || '',
    scheduled_at: '',
    duration_minutes: 30,
    notes: '',
    participant_emails: prefill.emails || [],
    participant_phones: prefill.phones || [],
    patient_id: prefill.patient_id || null,
    lead_id: prefill.lead_id || null,
    doctor_id: prefill.doctor_id || null,
  });
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('Meeting title is required'); return; }
    setSubmitting(true);
    try {
      const res = await axios.post(`${API_URL}/api/video-rooms/meetings`, {
        ...form,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      }, { headers: getHeaders() });

      const meeting = res.data.meeting;
      const invites = res.data.invites_sent;
      toast.success(`Meeting created! ${invites.sms + invites.email} invitations sent.`);
      if (onSuccess) onSuccess(meeting);
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create meeting');
    } finally {
      setSubmitting(false);
    }
  };

  const addEmail = () => {
    if (newEmail && !form.participant_emails.includes(newEmail)) {
      setForm(prev => ({ ...prev, participant_emails: [...prev.participant_emails, newEmail] }));
      setNewEmail('');
    }
  };

  const addPhone = () => {
    if (newPhone && !form.participant_phones.includes(newPhone)) {
      setForm(prev => ({ ...prev, participant_phones: [...prev.participant_phones, newPhone] }));
      setNewPhone('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="schedule-meeting-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Video className="w-5 h-5" /> Schedule Video Meeting</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <Label>Meeting Title *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., Patient Consultation" data-testid="meeting-title-input" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date & Time</Label>
              <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} data-testid="meeting-datetime" />
              <p className="text-xs text-muted-foreground mt-1">Leave empty for instant meeting</p>
            </div>
            <div>
              <Label>Duration (minutes)</Label>
              <Input type="number" min="5" max="120" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 30 })} />
            </div>
          </div>

          {/* Email participants */}
          <div>
            <Label>Invite by Email</Label>
            <div className="flex gap-2">
              <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())} placeholder="email@example.com" className="flex-1" />
              <Button variant="outline" size="icon" onClick={addEmail}><Plus className="w-4 h-4" /></Button>
            </div>
            {form.participant_emails.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.participant_emails.map((email, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
                    {email}
                    <button onClick={() => setForm(prev => ({ ...prev, participant_emails: prev.participant_emails.filter((_, idx) => idx !== i) }))}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Phone participants */}
          <div>
            <Label>Invite by SMS</Label>
            <div className="flex gap-2">
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPhone())} placeholder="(555) 123-4567" className="flex-1" />
              <Button variant="outline" size="icon" onClick={addPhone}><Plus className="w-4 h-4" /></Button>
            </div>
            {form.participant_phones.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.participant_phones.map((phone, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs">
                    {phone}
                    <button onClick={() => setForm(prev => ({ ...prev, participant_phones: prev.participant_phones.filter((_, idx) => idx !== i) }))}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Meeting agenda or instructions..." rows={2} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1 bg-blue-600 hover:bg-blue-700" data-testid="create-meeting-btn">
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : <><Video className="w-4 h-4 mr-2" /> {form.scheduled_at ? 'Schedule Meeting' : 'Start Instant Meeting'}</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
