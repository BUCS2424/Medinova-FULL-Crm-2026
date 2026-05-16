import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Phone,
  Settings,
  Clock,
  MessageSquare,
  Users,
  Save,
  Loader2,
  CheckCircle,
  XCircle,
  Volume2,
  Mic,
  PhoneIncoming,
  PhoneOutgoing,
  Hash,
  Calendar,
  Coffee
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
];

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (No DST)' },
  { value: 'America/Anchorage', label: 'Alaska Time' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time' }
];

export default function VoiceSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Telnyx Configuration
  const [telnyxConfig, setTelnyxConfig] = useState({
    enabled: false,
    api_key: '',
    connection_id: '',
    phone_number: '',
    webhook_url: ''
  });
  
  // Business Hours
  const [businessHours, setBusinessHours] = useState({
    enabled: true,
    timezone: 'America/New_York',
    schedule: {
      monday: { enabled: true, start: '09:00', end: '17:00' },
      tuesday: { enabled: true, start: '09:00', end: '17:00' },
      wednesday: { enabled: true, start: '09:00', end: '17:00' },
      thursday: { enabled: true, start: '09:00', end: '17:00' },
      friday: { enabled: true, start: '09:00', end: '17:00' },
      saturday: { enabled: false, start: '10:00', end: '14:00' },
      sunday: { enabled: false, start: '10:00', end: '14:00' }
    },
    lunch_break: { enabled: true, start: '12:00', end: '13:00' },
    after_hours_message: "Thank you for calling. Our office is currently closed. Please leave a message after the beep, or call back during business hours."
  });
  
  // IVR Configuration
  const [ivrConfig, setIvrConfig] = useState({
    enabled: true,
    greeting: "Thank you for calling DME PROSical Equipment. ",
    main_menu: "Press 1 for Sales and new orders. Press 2 for Support and existing orders. Press 3 for Billing. Press 4 to check your eligibility. Press 0 to speak with an operator.",
    sales_menu: "You've reached Sales. Press 1 to speak with a representative, or press 0 to return to the main menu.",
    support_menu: "You've reached Support. Press 1 for order status. Press 2 for technical support. Press 0 to return to the main menu.",
    billing_menu: "You've reached Billing. Press 1 to speak with billing support. Press 0 to return to the main menu.",
    transfer_timeout: 30,
    voicemail_enabled: true,
    voicemail_greeting: "Please leave a message after the beep. Include your name, phone number, and a brief description of how we can help you."
  });
  
  // Extensions list
  const [extensions, setExtensions] = useState([]);

  useEffect(() => {
    fetchVoiceConfig();
    fetchExtensions();
  }, []);

  const fetchVoiceConfig = async () => {
    try {
      const token = localStorage.getItem('dme_token');
      const response = await axios.get(`${API_URL}/api/voice/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.telnyx) {
        setTelnyxConfig(prev => ({ ...prev, ...response.data.telnyx }));
      }
      if (response.data.business_hours) {
        setBusinessHours(prev => ({ ...prev, ...response.data.business_hours }));
      }
      if (response.data.ivr) {
        setIvrConfig(prev => ({ ...prev, ...response.data.ivr }));
      }
    } catch (error) {
      console.error('Error fetching voice config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExtensions = async () => {
    try {
      const token = localStorage.getItem('dme_token');
      const response = await axios.get(`${API_URL}/api/voice/extensions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExtensions(response.data.extensions || []);
    } catch (error) {
      console.error('Error fetching extensions:', error);
    }
  };

  const saveTelnyxConfig = async () => {
    try {
      setIsSaving(true);
      const token = localStorage.getItem('dme_token');
      
      await axios.put(`${API_URL}/api/voice/config/telnyx`, telnyxConfig, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Telnyx configuration saved');
    } catch (error) {
      console.error('Error saving Telnyx config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const saveBusinessHours = async () => {
    try {
      setIsSaving(true);
      const token = localStorage.getItem('dme_token');
      
      await axios.put(`${API_URL}/api/voice/config/business-hours`, businessHours, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Business hours saved');
    } catch (error) {
      console.error('Error saving business hours:', error);
      toast.error('Failed to save business hours');
    } finally {
      setIsSaving(false);
    }
  };

  const saveIvrConfig = async () => {
    try {
      setIsSaving(true);
      const token = localStorage.getItem('dme_token');
      
      await axios.put(`${API_URL}/api/voice/config/ivr`, ivrConfig, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('IVR configuration saved');
    } catch (error) {
      console.error('Error saving IVR config:', error);
      toast.error('Failed to save IVR configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const updateScheduleDay = (day, field, value) => {
    setBusinessHours(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: {
          ...prev.schedule[day],
          [field]: value
        }
      }
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-lime-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="w-7 h-7 text-lime-500" />
            Voice & Dialer Settings
          </h1>
          <p className="text-muted-foreground">Configure browser dialer, IVR, and business hours</p>
        </div>
        <Badge variant={telnyxConfig.enabled ? "default" : "secondary"} className="text-sm">
          {telnyxConfig.enabled ? (
            <><CheckCircle className="w-4 h-4 mr-1" /> Voice Enabled</>
          ) : (
            <><XCircle className="w-4 h-4 mr-1" /> Voice Disabled</>
          )}
        </Badge>
      </div>

      <Tabs defaultValue="telnyx" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="telnyx" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Telnyx
          </TabsTrigger>
          <TabsTrigger value="hours" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Hours
          </TabsTrigger>
          <TabsTrigger value="ivr" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            IVR
          </TabsTrigger>
          <TabsTrigger value="extensions" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Extensions
          </TabsTrigger>
        </TabsList>

        {/* Telnyx Configuration Tab */}
        <TabsContent value="telnyx">
          <Card>
            <CardHeader>
              <CardTitle>Telnyx API Configuration</CardTitle>
              <CardDescription>
                Connect your Telnyx account to enable browser calling, IVR, and call recording.
                <a href="https://portal.telnyx.com" target="_blank" rel="noopener noreferrer" className="text-lime-500 ml-1 hover:underline">
                  Get credentials from Telnyx Portal →
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Enable Voice Features</p>
                    <p className="text-sm text-muted-foreground">Browser dialer, IVR, call recording</p>
                  </div>
                </div>
                <Switch
                  checked={telnyxConfig.enabled}
                  onCheckedChange={(checked) => setTelnyxConfig(prev => ({ ...prev, enabled: checked }))}
                />
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="api_key">API Key</Label>
                  <Input
                    id="api_key"
                    type="password"
                    value={telnyxConfig.api_key}
                    onChange={(e) => setTelnyxConfig(prev => ({ ...prev, api_key: e.target.value }))}
                    placeholder="KEY_xxxxxxxxxxxxxxxx"
                  />
                  <p className="text-xs text-muted-foreground">Found in Telnyx Portal → Keys & Credentials</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="connection_id">Connection ID</Label>
                  <Input
                    id="connection_id"
                    value={telnyxConfig.connection_id}
                    onChange={(e) => setTelnyxConfig(prev => ({ ...prev, connection_id: e.target.value }))}
                    placeholder="1234567890123456789"
                  />
                  <p className="text-xs text-muted-foreground">Found in Voice → Connections → Your Credential Connection</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone_number">Phone Number</Label>
                  <Input
                    id="phone_number"
                    value={telnyxConfig.phone_number}
                    onChange={(e) => setTelnyxConfig(prev => ({ ...prev, phone_number: e.target.value }))}
                    placeholder="+15551234567"
                  />
                  <p className="text-xs text-muted-foreground">Your Telnyx phone number for outbound caller ID</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webhook_url">Webhook URL</Label>
                  <Input
                    id="webhook_url"
                    value={telnyxConfig.webhook_url}
                    onChange={(e) => setTelnyxConfig(prev => ({ ...prev, webhook_url: e.target.value }))}
                    placeholder="https://yourdomain.com/api/voice/webhooks"
                  />
                  <p className="text-xs text-muted-foreground">URL for Telnyx to send call events. Set this in your Connection settings.</p>
                </div>
              </div>

              <Button onClick={saveTelnyxConfig} disabled={isSaving} className="w-full">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Telnyx Configuration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Business Hours Tab */}
        <TabsContent value="hours">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Business Hours
              </CardTitle>
              <CardDescription>
                Set your operating hours. Calls outside these hours will go to voicemail or hear the after-hours message.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Enable Business Hours</p>
                    <p className="text-sm text-muted-foreground">Route calls based on schedule</p>
                  </div>
                </div>
                <Switch
                  checked={businessHours.enabled}
                  onCheckedChange={(checked) => setBusinessHours(prev => ({ ...prev, enabled: checked }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Timezone</Label>
                <select
                  value={businessHours.timezone}
                  onChange={(e) => setBusinessHours(prev => ({ ...prev, timezone: e.target.value }))}
                  className="w-full h-10 px-3 border rounded-md"
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <Label>Weekly Schedule</Label>
                {DAYS_OF_WEEK.map(day => (
                  <div key={day.key} className="flex items-center gap-4 p-3 border rounded-lg">
                    <Switch
                      checked={businessHours.schedule[day.key]?.enabled || false}
                      onCheckedChange={(checked) => updateScheduleDay(day.key, 'enabled', checked)}
                    />
                    <span className="w-24 font-medium">{day.label}</span>
                    <Input
                      type="time"
                      value={businessHours.schedule[day.key]?.start || '09:00'}
                      onChange={(e) => updateScheduleDay(day.key, 'start', e.target.value)}
                      disabled={!businessHours.schedule[day.key]?.enabled}
                      className="w-32"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={businessHours.schedule[day.key]?.end || '17:00'}
                      onChange={(e) => updateScheduleDay(day.key, 'end', e.target.value)}
                      disabled={!businessHours.schedule[day.key]?.enabled}
                      className="w-32"
                    />
                  </div>
                ))}
              </div>

              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coffee className="w-5 h-5" />
                    <Label>Lunch Break</Label>
                  </div>
                  <Switch
                    checked={businessHours.lunch_break?.enabled || false}
                    onCheckedChange={(checked) => setBusinessHours(prev => ({
                      ...prev,
                      lunch_break: { ...prev.lunch_break, enabled: checked }
                    }))}
                  />
                </div>
                {businessHours.lunch_break?.enabled && (
                  <div className="flex items-center gap-4">
                    <Input
                      type="time"
                      value={businessHours.lunch_break?.start || '12:00'}
                      onChange={(e) => setBusinessHours(prev => ({
                        ...prev,
                        lunch_break: { ...prev.lunch_break, start: e.target.value }
                      }))}
                      className="w-32"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={businessHours.lunch_break?.end || '13:00'}
                      onChange={(e) => setBusinessHours(prev => ({
                        ...prev,
                        lunch_break: { ...prev.lunch_break, end: e.target.value }
                      }))}
                      className="w-32"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>After Hours Message</Label>
                <Textarea
                  value={businessHours.after_hours_message}
                  onChange={(e) => setBusinessHours(prev => ({ ...prev, after_hours_message: e.target.value }))}
                  rows={3}
                  placeholder="Thank you for calling. Our office is currently closed..."
                />
              </div>

              <Button onClick={saveBusinessHours} disabled={isSaving} className="w-full">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Business Hours
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* IVR Configuration Tab */}
        <TabsContent value="ivr">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                IVR (Interactive Voice Response)
              </CardTitle>
              <CardDescription>
                Configure the automated phone menu system that greets callers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Enable IVR</p>
                    <p className="text-sm text-muted-foreground">Play menu prompts to callers</p>
                  </div>
                </div>
                <Switch
                  checked={ivrConfig.enabled}
                  onCheckedChange={(checked) => setIvrConfig(prev => ({ ...prev, enabled: checked }))}
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Greeting Message</Label>
                  <Textarea
                    value={ivrConfig.greeting}
                    onChange={(e) => setIvrConfig(prev => ({ ...prev, greeting: e.target.value }))}
                    rows={2}
                    placeholder="Thank you for calling..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Main Menu (Press 1, 2, 3...)</Label>
                  <Textarea
                    value={ivrConfig.main_menu}
                    onChange={(e) => setIvrConfig(prev => ({ ...prev, main_menu: e.target.value }))}
                    rows={3}
                    placeholder="Press 1 for Sales. Press 2 for Support..."
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sales Menu (After pressing 1)</Label>
                    <Textarea
                      value={ivrConfig.sales_menu}
                      onChange={(e) => setIvrConfig(prev => ({ ...prev, sales_menu: e.target.value }))}
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Support Menu (After pressing 2)</Label>
                    <Textarea
                      value={ivrConfig.support_menu}
                      onChange={(e) => setIvrConfig(prev => ({ ...prev, support_menu: e.target.value }))}
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Billing Menu (After pressing 3)</Label>
                    <Textarea
                      value={ivrConfig.billing_menu}
                      onChange={(e) => setIvrConfig(prev => ({ ...prev, billing_menu: e.target.value }))}
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Transfer Timeout (seconds)</Label>
                    <Input
                      type="number"
                      value={ivrConfig.transfer_timeout}
                      onChange={(e) => setIvrConfig(prev => ({ ...prev, transfer_timeout: parseInt(e.target.value) || 30 }))}
                      min={10}
                      max={120}
                    />
                    <p className="text-xs text-muted-foreground">Time to wait before going to voicemail</p>
                  </div>
                </div>

                <div className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Mic className="w-5 h-5" />
                      <div>
                        <p className="font-medium">Enable Voicemail</p>
                        <p className="text-sm text-muted-foreground">Allow callers to leave messages</p>
                      </div>
                    </div>
                    <Switch
                      checked={ivrConfig.voicemail_enabled}
                      onCheckedChange={(checked) => setIvrConfig(prev => ({ ...prev, voicemail_enabled: checked }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="voicemail_greeting">Voicemail Greeting</Label>
                    <Textarea
                      id="voicemail_greeting"
                      value={ivrConfig.voicemail_greeting || ''}
                      onChange={(e) => setIvrConfig(prev => ({ ...prev, voicemail_greeting: e.target.value }))}
                      placeholder="Please leave a message after the beep. Include your name, phone number, and a brief description of how we can help you."
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">Message played before caller leaves voicemail</p>
                  </div>
                </div>
              </div>

              <Button onClick={saveIvrConfig} disabled={isSaving} className="w-full">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save IVR Configuration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Extensions Tab */}
        <TabsContent value="extensions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="w-5 h-5" />
                Staff Extensions
              </CardTitle>
              <CardDescription>
                View and manage extension numbers for IVR routing. Extensions are set in each user's profile.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {extensions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No extensions configured</p>
                  <p className="text-sm">Users can add extensions in their Profile Settings</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {extensions.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${user.is_available ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <div>
                          <p className="font-medium">{user.first_name} {user.last_name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono">
                          Ext. {user.extension}
                        </Badge>
                        <Badge variant={user.is_available ? "default" : "secondary"}>
                          {user.is_available ? 'Online' : 'Offline'}
                        </Badge>
                      </div>
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
