import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { toast } from 'sonner';
import axios from 'axios';
import {
  User,
  Mail,
  Phone,
  Save,
  Bell,
  Clock,
  Calendar,
  MessageCircle,
  Shield,
  Loader2,
  Check,
  X,
  Volume2,
  Monitor,
  Hash
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' }
];

const DEFAULT_SCHEDULE = {
  monday: { enabled: true, start: '09:00', end: '17:00' },
  tuesday: { enabled: true, start: '09:00', end: '17:00' },
  wednesday: { enabled: true, start: '09:00', end: '17:00' },
  thursday: { enabled: true, start: '09:00', end: '17:00' },
  friday: { enabled: true, start: '09:00', end: '17:00' },
  saturday: { enabled: false, start: '10:00', end: '14:00' },
  sunday: { enabled: false, start: '10:00', end: '14:00' }
};

const DEFAULT_LUNCH = {
  enabled: true,
  start: '12:00',
  end: '13:00'
};

export default function UserProfilePage() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Profile form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [extension, setExtension] = useState('');
  
  // Schedule state
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  
  // Lunch break state
  const [lunchBreak, setLunchBreak] = useState(DEFAULT_LUNCH);
  
  // Notification settings
  const [notifications, setNotifications] = useState({
    desktop_enabled: true,
    sound_enabled: true,
    chat_alerts: true,
    email_alerts: false,
    auto_availability: true
  });
  
  // Desktop notification permission
  const [notificationPermission, setNotificationPermission] = useState('default');

  useEffect(() => {
    fetchUserProfile();
    // Check notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('dme_token');
      const response = await axios.get(`${API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const userData = response.data;
      setUser(userData);
      setFirstName(userData.first_name || '');
      setLastName(userData.last_name || '');
      setEmail(userData.email || '');
      setPhone(userData.phone || '');
      setExtension(userData.extension || '');
      
      // Load saved schedule or use defaults
      if (userData.availability_schedule) {
        setSchedule(userData.availability_schedule);
      }
      
      // Load saved notification settings
      if (userData.notification_settings) {
        setNotifications(prev => ({ ...prev, ...userData.notification_settings }));
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      const token = localStorage.getItem('dme_token');
      
      await axios.put(`${API_URL}/api/users/me/profile`, {
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        extension: extension,
        availability_schedule: schedule,
        notification_settings: notifications
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error saving profile:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to save profile';
      toast.error(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        toast.success('Desktop notifications enabled!');
        // Send test notification
        new Notification('MediNova Medical Supplies', {
          body: 'You will now receive desktop notifications for chats and alerts.',
          icon: '/favicon.ico'
        });
      } else {
        toast.error('Notification permission denied');
      }
    }
  };

  const updateScheduleDay = (day, field, value) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const getInitials = (first, last) => {
    return `${first?.charAt(0) || ''}${last?.charAt(0) || ''}`.toUpperCase();
  };

  const isCurrentlyAvailable = () => {
    if (!notifications.auto_availability) return false;
    
    const now = new Date();
    const dayKey = DAYS_OF_WEEK[now.getDay() === 0 ? 6 : now.getDay() - 1].key;
    const daySchedule = schedule[dayKey];
    
    if (!daySchedule?.enabled) return false;
    
    const currentTime = now.toTimeString().slice(0, 5);
    return currentTime >= daySchedule.start && currentTime <= daySchedule.end;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto" data-testid="user-profile-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-muted-foreground">Manage your personal information and availability settings</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isCurrentlyAvailable() ? 'default' : 'secondary'} className={isCurrentlyAvailable() ? 'bg-green-500' : ''}>
            {isCurrentlyAvailable() ? 'Available' : 'Offline'}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Personal Information
            </CardTitle>
            <CardDescription>Update your contact details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="w-20 h-20">
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {getInitials(firstName, lastName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold">{firstName} {lastName}</h3>
                <p className="text-sm text-muted-foreground capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="pl-10 bg-muted"
                    placeholder="Email"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="extension">Extension Number</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="extension"
                    type="text"
                    value={extension}
                    onChange={(e) => setExtension(e.target.value)}
                    className="pl-10"
                    placeholder="101"
                    maxLength={6}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Used for internal dialing and IVR routing</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notification Settings
            </CardTitle>
            <CardDescription>Configure how you receive alerts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Desktop Notifications Permission */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Monitor className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Desktop Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      {notificationPermission === 'granted' ? 'Enabled' : 
                       notificationPermission === 'denied' ? 'Blocked in browser' : 
                       'Not enabled yet'}
                    </p>
                  </div>
                </div>
                {notificationPermission !== 'granted' && notificationPermission !== 'denied' && (
                  <Button size="sm" onClick={requestNotificationPermission}>
                    Enable
                  </Button>
                )}
                {notificationPermission === 'granted' && (
                  <Check className="w-5 h-5 text-green-500" />
                )}
                {notificationPermission === 'denied' && (
                  <X className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Sound Alerts</p>
                    <p className="text-xs text-muted-foreground">Play sound for new messages</p>
                  </div>
                </div>
                <Switch
                  checked={notifications.sound_enabled}
                  onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, sound_enabled: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Chat Alerts</p>
                    <p className="text-xs text-muted-foreground">Get notified of new chat requests</p>
                  </div>
                </div>
                <Switch
                  checked={notifications.chat_alerts}
                  onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, chat_alerts: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Email Notifications</p>
                    <p className="text-xs text-muted-foreground">Receive email for missed chats</p>
                  </div>
                </div>
                <Switch
                  checked={notifications.email_alerts}
                  onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, email_alerts: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Auto-Availability</p>
                    <p className="text-xs text-muted-foreground">Set available based on schedule</p>
                  </div>
                </div>
                <Switch
                  checked={notifications.auto_availability}
                  onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, auto_availability: checked }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Availability Schedule Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Availability Schedule
          </CardTitle>
          <CardDescription>
            Set your working hours for automatic availability status. When Auto-Availability is enabled, 
            you&apos;ll automatically appear online during these hours for chat and communications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {DAYS_OF_WEEK.map(({ key, label }) => (
              <div 
                key={key} 
                className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                  schedule[key]?.enabled ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <div className="w-20">
                  <span className={`font-medium ${schedule[key]?.enabled ? 'text-green-700' : 'text-gray-500'}`}>
                    {label}
                  </span>
                </div>
                
                <Switch
                  checked={schedule[key]?.enabled || false}
                  onCheckedChange={(checked) => updateScheduleDay(key, 'enabled', checked)}
                />
                
                {schedule[key]?.enabled ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      type="time"
                      value={schedule[key]?.start || '09:00'}
                      onChange={(e) => updateScheduleDay(key, 'start', e.target.value)}
                      className="w-32"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={schedule[key]?.end || '17:00'}
                      onChange={(e) => updateScheduleDay(key, 'end', e.target.value)}
                      className="w-32"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Not available</span>
                )}
              </div>
            ))}
          </div>
          
          {/* Quick Actions */}
          <div className="flex gap-2 mt-4 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const weekdays = {};
                DAYS_OF_WEEK.forEach(({ key }) => {
                  weekdays[key] = {
                    enabled: !['saturday', 'sunday'].includes(key),
                    start: '09:00',
                    end: '17:00'
                  };
                });
                setSchedule(weekdays);
              }}
            >
              Set Weekdays (9-5)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const allDays = {};
                DAYS_OF_WEEK.forEach(({ key }) => {
                  allDays[key] = { enabled: true, start: '08:00', end: '20:00' };
                });
                setSchedule(allDays);
              }}
            >
              Set All Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const noDays = {};
                DAYS_OF_WEEK.forEach(({ key }) => {
                  noDays[key] = { enabled: false, start: '09:00', end: '17:00' };
                });
                setSchedule(noDays);
              }}
            >
              Clear All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Account Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Password</p>
              <p className="text-sm text-muted-foreground">Last changed: Unknown</p>
            </div>
            <Button variant="outline" disabled>
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={fetchUserProfile}>
          Reset Changes
        </Button>
        <Button onClick={handleSaveProfile} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
