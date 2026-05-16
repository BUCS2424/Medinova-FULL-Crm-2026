import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Voicemail, 
  Save, 
  Loader2, 
  Play, 
  User, 
  Users,
  Clock,
  Mail,
  Inbox
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function VoicemailSettingsPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Main voicemail settings
  const [mainVoicemail, setMainVoicemail] = useState({
    enabled: true,
    greeting: "No one is available to take your call. Please leave a message after the beep, including your name and phone number, and we will return your call as soon as possible.",
    max_duration: 120,
    email_notification: true,
    notification_email: ''
  });
  
  // User voicemails list
  const [userVoicemails, setUserVoicemails] = useState([]);

  useEffect(() => {
    fetchVoicemailSettings();
  }, []);

  const fetchVoicemailSettings = async () => {
    try {
      const token = localStorage.getItem('dme_token');
      const headers = { Authorization: `Bearer ${token}` };
      
      // Fetch main voicemail config
      const mainRes = await axios.get(`${API_URL}/api/voice/voicemail/config`, { headers });
      if (mainRes.data) {
        setMainVoicemail(prev => ({ ...prev, ...mainRes.data }));
      }
      
      // Fetch user voicemails
      const usersRes = await axios.get(`${API_URL}/api/voice/voicemail/users`, { headers });
      setUserVoicemails(usersRes.data.users || []);
      
    } catch (error) {
      console.error('Error fetching voicemail settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveMainVoicemail = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('dme_token');
      await axios.put(`${API_URL}/api/voice/voicemail/config`, mainVoicemail, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Main voicemail settings saved');
    } catch (error) {
      console.error('Error saving voicemail:', error);
      toast.error('Failed to save voicemail settings');
    } finally {
      setIsSaving(false);
    }
  };

  const updateUserVoicemail = async (userId, voicemailGreeting) => {
    try {
      const token = localStorage.getItem('dme_token');
      await axios.put(`${API_URL}/api/voice/voicemail/user/${userId}`, 
        { voicemail_greeting: voicemailGreeting },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      toast.success('User voicemail updated');
    } catch (error) {
      console.error('Error updating user voicemail:', error);
      toast.error('Failed to update user voicemail');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Voicemail className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Voicemail Settings</h1>
            <p className="text-muted-foreground">Manage voicemail greetings for main line and extensions</p>
          </div>
        </div>
        <Button onClick={() => navigate('/admin/voicemail-inbox')}>
          <Inbox className="w-4 h-4 mr-2" />
          View Inbox
        </Button>
      </div>

      <Tabs defaultValue="main" className="space-y-6">
        <TabsList>
          <TabsTrigger value="main" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Main Voicemail
          </TabsTrigger>
          <TabsTrigger value="extensions" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Extension Voicemails
          </TabsTrigger>
        </TabsList>

        {/* Main Voicemail Tab */}
        <TabsContent value="main">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Main Company Voicemail
              </CardTitle>
              <CardDescription>
                This voicemail is used when a group/queue call goes unanswered (round-robin, ring-all, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Voicemail className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Enable Voicemail</p>
                    <p className="text-sm text-muted-foreground">Allow callers to leave messages</p>
                  </div>
                </div>
                <Switch
                  checked={mainVoicemail.enabled}
                  onCheckedChange={(checked) => setMainVoicemail(prev => ({ ...prev, enabled: checked }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="main_greeting">Voicemail Greeting</Label>
                <Textarea
                  id="main_greeting"
                  value={mainVoicemail.greeting}
                  onChange={(e) => setMainVoicemail(prev => ({ ...prev, greeting: e.target.value }))}
                  placeholder="No one is available to take your call. Please leave a message after the beep..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  This message plays when group calls go to voicemail
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max_duration" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Max Recording Duration (seconds)
                  </Label>
                  <Input
                    id="max_duration"
                    type="number"
                    min={30}
                    max={300}
                    value={mainVoicemail.max_duration}
                    onChange={(e) => setMainVoicemail(prev => ({ 
                      ...prev, 
                      max_duration: parseInt(e.target.value) || 120 
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notification_email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Notification Email
                  </Label>
                  <Input
                    id="notification_email"
                    type="email"
                    value={mainVoicemail.notification_email}
                    onChange={(e) => setMainVoicemail(prev => ({ 
                      ...prev, 
                      notification_email: e.target.value 
                    }))}
                    placeholder="voicemail@company.com"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">Send email when new voicemail is received</p>
                  </div>
                </div>
                <Switch
                  checked={mainVoicemail.email_notification}
                  onCheckedChange={(checked) => setMainVoicemail(prev => ({ ...prev, email_notification: checked }))}
                />
              </div>

              <Button onClick={saveMainVoicemail} disabled={isSaving} className="w-full">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Main Voicemail Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Extension Voicemails Tab */}
        <TabsContent value="extensions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Extension Voicemails
              </CardTitle>
              <CardDescription>
                Personal voicemail greetings for direct extension calls. When a caller dials an extension directly and it goes unanswered, this voicemail plays.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userVoicemails.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No users with extensions found</p>
                  <p className="text-sm">Assign extensions to users in their profiles first</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {userVoicemails.map((user) => (
                    <div key={user.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{user.first_name} {user.last_name}</p>
                            <p className="text-sm text-muted-foreground">
                              Extension: {user.extension || 'Not set'} • {user.email}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor={`vm_${user.id}`}>Personal Voicemail Greeting</Label>
                        <Textarea
                          id={`vm_${user.id}`}
                          value={user.voicemail_greeting || ''}
                          onChange={(e) => {
                            setUserVoicemails(prev => prev.map(u => 
                              u.id === user.id ? { ...u, voicemail_greeting: e.target.value } : u
                            ));
                          }}
                          placeholder={`Hi, you've reached ${user.first_name}. I'm unable to take your call right now. Please leave a message and I'll get back to you as soon as possible.`}
                          rows={2}
                        />
                      </div>
                      
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => updateUserVoicemail(user.id, user.voicemail_greeting)}
                      >
                        <Save className="w-3 h-3 mr-2" />
                        Save
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
