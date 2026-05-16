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
  Hash,
  Calendar,
  Coffee,
  FileText,
  Send,
  Key,
  Globe,
  Webhook,
  TestTube,
  Eye,
  EyeOff,
  ExternalLink,
  Play,
  Pause,
  RefreshCw,
  Sparkles,
  AudioLines,
  GitBranch,
  Plus,
  Trash2,
  Edit,
  Music,
  ListOrdered,
  PhoneForwarded,
  UserPlus,
  Layers
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

export default function TelnyxSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingVoice, setTestingVoice] = useState(false);
  const [testingFax, setTestingFax] = useState(false);
  const [phoneFeatureEnabled, setPhoneFeatureEnabled] = useState(true);
  const [faxFeatureEnabled, setFaxFeatureEnabled] = useState(true);
  
  // Edit mode states - locked by default when credentials exist
  const [editModes, setEditModes] = useState({
    apiKey: false,
    voice: false,
    hours: false,
    ivr: false,
    routing: false,
    voiceAi: false
  });
  
  // Shared Telnyx API Key
  const [sharedApiKey, setSharedApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  
  // Voice Configuration
  const [voiceConfig, setVoiceConfig] = useState({
    enabled: false,
    connection_id: '',
    phone_number: '',
    caller_name: '',
    webhook_url: '',
    sip_username: '',
    sip_password: ''
  });
  
  // Fax Configuration
  const [faxConfig, setFaxConfig] = useState({
    enabled: false,
    fax_number: '',
    connection_id: '',
    caller_name: '',
    webhook_url: '',
    failover_webhook_url: ''
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
    voicemail_greeting: "Please leave a message after the beep. Include your name, phone number, and a brief description of how we can help you.",
    transfer_timeout: 30,
    voicemail_enabled: true,
    tts_enabled: false,
    tts_voice: 'nova',
    tts_model: 'tts-1',
    tts_speed: 1.0
  });
  
  // TTS/Voice AI State
  const [ttsVoices, setTtsVoices] = useState({});
  const [ttsModels, setTtsModels] = useState({});
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const [generatingTts, setGeneratingTts] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [ttsFiles, setTtsFiles] = useState([]);
  const [playingAudio, setPlayingAudio] = useState(null);
  const [audioRef, setAudioRef] = useState(null);
  const [previewText, setPreviewText] = useState('');
  const [previewingVoice, setPreviewingVoice] = useState(false);
  
  // Call Groups & Routing State
  const [callGroups, setCallGroups] = useState([]);
  const [ivrRouting, setIvrRouting] = useState({});
  const [holdConfig, setHoldConfig] = useState({
    enabled: true,
    music_url: '',
    position_announcement_enabled: true,
    position_announcement_interval: 30,
    custom_hold_message: "Thank you for holding. You are currently number {position} in the queue. Please stay on the line.",
    max_hold_time: 600
  });
  const [editingGroup, setEditingGroup] = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    extensions: [],
    ring_strategy: 'round_robin',
    ring_timeout: 20,
    max_queue_size: 10,
    fallback_action: 'voicemail',
    ivr_key: ''
  });
  const [generatingHoldMessage, setGeneratingHoldMessage] = useState(false);
  
  // Extensions list
  const [extensions, setExtensions] = useState([]);

  useEffect(() => {
    fetchFeatureFlags();
    fetchAllConfig();
    fetchExtensions();
    fetchTtsVoices();
    fetchTtsFiles();
    fetchCallGroups();
    fetchHoldConfig();
  }, []);

  const fetchFeatureFlags = async () => {
    try {
      const [phoneRes, faxRes] = await Promise.all([
        axios.get(`${API_URL}/api/features/phone_dialer`),
        axios.get(`${API_URL}/api/features/fax_center`)
      ]);
      setPhoneFeatureEnabled(phoneRes.data.enabled);
      setFaxFeatureEnabled(faxRes.data.enabled);
    } catch (error) {
      console.log('Failed to fetch feature flags');
    }
  };

  const fetchAllConfig = async () => {
    try {
      const token = localStorage.getItem('dme_token');
      
      // Fetch voice config
      const voiceResponse = await axios.get(`${API_URL}/api/voice/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (voiceResponse.data.telnyx) {
        const telnyxData = voiceResponse.data.telnyx;
        setVoiceConfig({
          enabled: telnyxData.enabled || false,
          connection_id: telnyxData.connection_id || '',
          phone_number: telnyxData.phone_number || '',
          caller_name: telnyxData.caller_name || '',
          webhook_url: telnyxData.webhook_url || '',
          sip_username: telnyxData.sip_username || '',
          sip_password: telnyxData.sip_password ? '••••••••' : ''
        });
        // Check if API key exists (it comes masked as ***)
        if (telnyxData.api_key && telnyxData.api_key !== '***') {
          setSharedApiKey(telnyxData.api_key);
        }
        setHasApiKey(!!telnyxData.api_key && telnyxData.api_key !== 'null');
      }
      if (voiceResponse.data.business_hours) {
        setBusinessHours(prev => ({ ...prev, ...voiceResponse.data.business_hours }));
      }
      if (voiceResponse.data.ivr) {
        setIvrConfig(prev => ({ ...prev, ...voiceResponse.data.ivr }));
      }
      
      // Fetch fax config
      const faxResponse = await axios.get(`${API_URL}/api/fax/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (faxResponse.data) {
        setFaxConfig({
          enabled: faxResponse.data.is_enabled || false,
          fax_number: faxResponse.data.fax_number || '',
          connection_id: faxResponse.data.connection_id || '',
          caller_name: faxResponse.data.caller_name || '',
          webhook_url: `${window.location.origin}/api/webhooks/fax`,
          failover_webhook_url: `${window.location.origin}/api/webhooks/fax/failover`
        });
        if (faxResponse.data.has_api_key) {
          setHasApiKey(true);
        }
      }
    } catch (error) {
      console.error('Error fetching config:', error);
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

  const fetchTtsVoices = async () => {
    try {
      const token = localStorage.getItem('dme_token');
      const response = await axios.get(`${API_URL}/api/voice/tts/voices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTtsVoices(response.data.voices || {});
      setTtsModels(response.data.models || {});
      setTtsAvailable(response.data.tts_available || false);
    } catch (error) {
      console.error('Error fetching TTS voices:', error);
    }
  };

  const fetchTtsFiles = async () => {
    try {
      const token = localStorage.getItem('dme_token');
      const response = await axios.get(`${API_URL}/api/voice/tts/files`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTtsFiles(response.data.files || []);
    } catch (error) {
      console.error('Error fetching TTS files:', error);
    }
  };

  const fetchCallGroups = async () => {
    try {
      const token = localStorage.getItem('dme_token');
      const response = await axios.get(`${API_URL}/api/voice/groups`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCallGroups(response.data.groups || []);
      
      // Also fetch routing
      const routingResponse = await axios.get(`${API_URL}/api/voice/routing`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIvrRouting(routingResponse.data.routing || {});
    } catch (error) {
      console.error('Error fetching call groups:', error);
    }
  };

  const fetchHoldConfig = async () => {
    try {
      const token = localStorage.getItem('dme_token');
      const response = await axios.get(`${API_URL}/api/voice/hold/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data) {
        setHoldConfig(prev => ({ ...prev, ...response.data }));
      }
    } catch (error) {
      console.error('Error fetching hold config:', error);
    }
  };

  const saveApiKey = async () => {
    if (!sharedApiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }
    
    try {
      setIsSaving(true);
      const token = localStorage.getItem('dme_token');
      
      // Save to voice config
      await axios.put(`${API_URL}/api/voice/config/telnyx`, {
        ...voiceConfig,
        api_key: sharedApiKey
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Save to fax config
      await axios.post(`${API_URL}/api/fax/settings`, {
        telnyx_api_key: sharedApiKey
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setHasApiKey(true);
      setEditModes(prev => ({ ...prev, apiKey: false })); // Lock after save
      toast.success('API Key saved to both Voice and Fax');
    } catch (error) {
      console.error('Error saving API key:', error);
      toast.error('Failed to save API key');
    } finally {
      setIsSaving(false);
    }
  };

  const saveVoiceConfig = async () => {
    try {
      setIsSaving(true);
      const token = localStorage.getItem('dme_token');
      
      await axios.put(`${API_URL}/api/voice/config/telnyx`, {
        ...voiceConfig,
        api_key: sharedApiKey || undefined
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setEditModes(prev => ({ ...prev, voice: false })); // Lock after save
      toast.success('Voice configuration saved');
    } catch (error) {
      console.error('Error saving voice config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const saveFaxConfig = async () => {
    try {
      setIsSaving(true);
      const token = localStorage.getItem('dme_token');
      
      await axios.post(`${API_URL}/api/fax/settings`, {
        telnyx_fax_number: faxConfig.fax_number,
        telnyx_connection_id: faxConfig.connection_id,
        caller_name: faxConfig.caller_name,
        is_enabled: faxConfig.enabled
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Fax configuration saved');
    } catch (error) {
      console.error('Error saving fax config:', error);
      toast.error('Failed to save fax configuration');
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
      
      setEditModes(prev => ({ ...prev, hours: false })); // Lock after save
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
      
      setEditModes(prev => ({ ...prev, ivr: false })); // Lock after save
      toast.success('IVR configuration saved');
    } catch (error) {
      console.error('Error saving IVR config:', error);
      toast.error('Failed to save IVR configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const testFaxConnection = async () => {
    try {
      setTestingFax(true);
      const token = localStorage.getItem('dme_token');
      
      const response = await axios.post(`${API_URL}/api/fax/test-connection`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success('Fax connection successful!');
      } else {
        toast.error(response.data.message || 'Fax connection failed');
      }
    } catch (error) {
      console.error('Fax test failed:', error);
      toast.error(error.response?.data?.detail || 'Fax connection test failed');
    } finally {
      setTestingFax(false);
    }
  };

  // TTS Functions
  const generateTtsAudio = async (scriptType) => {
    try {
      setGeneratingTts(scriptType);
      const token = localStorage.getItem('dme_token');
      
      const response = await axios.post(`${API_URL}/api/voice/tts/generate`, {
        script_type: scriptType,
        voice: ivrConfig.tts_voice,
        model: ivrConfig.tts_model,
        speed: ivrConfig.tts_speed
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success(`Audio generated for ${scriptType}`);
        fetchTtsFiles();
      }
    } catch (error) {
      console.error('TTS generation failed:', error);
      toast.error(error.response?.data?.detail || 'TTS generation failed');
    } finally {
      setGeneratingTts(false);
    }
  };

  const generateAllTtsAudio = async () => {
    try {
      setGeneratingAll(true);
      const token = localStorage.getItem('dme_token');
      
      const response = await axios.post(`${API_URL}/api/voice/tts/generate-all`, null, {
        params: {
          voice: ivrConfig.tts_voice,
          model: ivrConfig.tts_model,
          speed: ivrConfig.tts_speed
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success(`Generated ${response.data.generated.length} audio files`);
        setIvrConfig(prev => ({ ...prev, tts_enabled: true }));
      } else {
        toast.warning(`Generated with ${response.data.errors.length} errors`);
      }
      fetchTtsFiles();
    } catch (error) {
      console.error('Batch TTS generation failed:', error);
      toast.error(error.response?.data?.detail || 'Batch TTS generation failed');
    } finally {
      setGeneratingAll(false);
    }
  };

  const previewVoice = async () => {
    if (!previewText.trim()) {
      setPreviewText("Hello! This is a sample of how this voice sounds for your IVR system.");
    }
    
    try {
      setPreviewingVoice(true);
      const token = localStorage.getItem('dme_token');
      
      const response = await axios.post(`${API_URL}/api/voice/tts/preview`, null, {
        params: {
          text: previewText || "Hello! This is a sample of how this voice sounds for your IVR system.",
          voice: ivrConfig.tts_voice,
          model: ivrConfig.tts_model,
          speed: ivrConfig.tts_speed
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        playAudio(`${API_URL}${response.data.audio_url}`);
      }
    } catch (error) {
      console.error('Voice preview failed:', error);
      toast.error(error.response?.data?.detail || 'Voice preview failed');
    } finally {
      setPreviewingVoice(false);
    }
  };

  const playAudio = (url) => {
    if (audioRef) {
      audioRef.pause();
    }
    const audio = new Audio(url);
    audio.onended = () => setPlayingAudio(null);
    audio.play();
    setAudioRef(audio);
    setPlayingAudio(url);
  };

  const stopAudio = () => {
    if (audioRef) {
      audioRef.pause();
      setPlayingAudio(null);
    }
  };

  const deleteTtsFile = async (fileId) => {
    try {
      const token = localStorage.getItem('dme_token');
      await axios.delete(`${API_URL}/api/voice/tts/files/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Audio file deleted');
      fetchTtsFiles();
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete file');
    }
  };

  // Call Group Functions
  const createCallGroup = async () => {
    if (!newGroup.name.trim()) {
      toast.error('Please enter a group name');
      return;
    }
    
    try {
      setIsSaving(true);
      const token = localStorage.getItem('dme_token');
      
      await axios.post(`${API_URL}/api/voice/groups`, newGroup, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Call group created');
      setShowGroupModal(false);
      setNewGroup({
        name: '',
        description: '',
        extensions: [],
        ring_strategy: 'round_robin',
        ring_timeout: 20,
        max_queue_size: 10,
        fallback_action: 'voicemail',
        ivr_key: ''
      });
      fetchCallGroups();
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Failed to create call group');
    } finally {
      setIsSaving(false);
    }
  };

  const updateCallGroup = async () => {
    if (!editingGroup) return;
    
    try {
      setIsSaving(true);
      const token = localStorage.getItem('dme_token');
      
      await axios.put(`${API_URL}/api/voice/groups/${editingGroup.id}`, editingGroup, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Call group updated');
      setEditingGroup(null);
      fetchCallGroups();
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error('Failed to update call group');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCallGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to delete this call group?')) return;
    
    try {
      const token = localStorage.getItem('dme_token');
      await axios.delete(`${API_URL}/api/voice/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Call group deleted');
      fetchCallGroups();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Failed to delete call group');
    }
  };

  const addExtensionToGroup = async (groupId, extension) => {
    try {
      const token = localStorage.getItem('dme_token');
      await axios.post(`${API_URL}/api/voice/groups/${groupId}/extensions/${extension}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Extension added');
      fetchCallGroups();
    } catch (error) {
      console.error('Error adding extension:', error);
      toast.error(error.response?.data?.detail || 'Failed to add extension');
    }
  };

  const removeExtensionFromGroup = async (groupId, extension) => {
    try {
      const token = localStorage.getItem('dme_token');
      await axios.delete(`${API_URL}/api/voice/groups/${groupId}/extensions/${extension}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Extension removed');
      fetchCallGroups();
    } catch (error) {
      console.error('Error removing extension:', error);
      toast.error('Failed to remove extension');
    }
  };

  const saveHoldConfig = async () => {
    try {
      setIsSaving(true);
      const token = localStorage.getItem('dme_token');
      
      await axios.put(`${API_URL}/api/voice/hold/config`, holdConfig, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Hold configuration saved');
    } catch (error) {
      console.error('Error saving hold config:', error);
      toast.error('Failed to save hold configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const generateHoldMessageAudio = async () => {
    try {
      setGeneratingHoldMessage(true);
      const token = localStorage.getItem('dme_token');
      
      const response = await axios.post(`${API_URL}/api/voice/hold/message/generate`, null, {
        params: {
          text: holdConfig.custom_hold_message,
          voice: 'echo',
          model: 'tts-1',
          speed: 0.9
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success('Hold message audio generated');
        setHoldConfig(prev => ({
          ...prev,
          custom_hold_message_audio_url: response.data.audio_url
        }));
      }
    } catch (error) {
      console.error('Error generating hold message:', error);
      toast.error('Failed to generate hold message audio');
    } finally {
      setGeneratingHoldMessage(false);
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

  // Check if both phone and fax features are disabled
  if (!phoneFeatureEnabled && !faxFeatureEnabled) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-7 h-7 text-lime-500" />
            Telnyx Settings
          </h1>
          <p className="text-muted-foreground">Configure Voice, Fax, IVR, and Business Hours</p>
        </div>
        <Card className="border-lime-200 bg-lime-50">
          <CardContent className="py-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-lime-100 flex items-center justify-center mx-auto mb-4">
                <EyeOff className="w-8 h-8 text-lime-600" />
              </div>
              <h3 className="text-xl font-bold text-amber-900 mb-2">Phone & Fax Features Disabled</h3>
              <p className="text-lime-700 mb-6 max-w-md mx-auto">
                Both the Phone Dialer and Fax Center features are currently turned off. Enable them in the Features Manager to configure Telnyx settings.
              </p>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/dev-settings'}
                className="border-lime-300 hover:bg-lime-100"
              >
                Go to Features Manager
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-7 h-7 text-lime-500" />
            Telnyx Settings
          </h1>
          <p className="text-muted-foreground">Configure Voice, Fax, IVR, and Business Hours - all powered by Telnyx</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={voiceConfig.enabled ? "default" : "secondary"}>
            {voiceConfig.enabled ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
            Voice
          </Badge>
          <Badge variant={faxConfig.enabled ? "default" : "secondary"}>
            {faxConfig.enabled ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
            Fax
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="api" className="space-y-4">
        <TabsList className={`grid w-full ${!phoneFeatureEnabled || !faxFeatureEnabled ? 'grid-cols-6' : 'grid-cols-8'}`}>
          <TabsTrigger value="api" className="flex items-center gap-1">
            <Key className="w-4 h-4" />
            <span className="hidden sm:inline">API Key</span>
          </TabsTrigger>
          {phoneFeatureEnabled && (
            <TabsTrigger value="voice" className="flex items-center gap-1">
              <Phone className="w-4 h-4" />
              <span className="hidden sm:inline">Voice</span>
            </TabsTrigger>
          )}
          {faxFeatureEnabled && (
            <TabsTrigger value="fax" className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Fax</span>
            </TabsTrigger>
          )}
          {phoneFeatureEnabled && (
            <>
              <TabsTrigger value="hours" className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span className="hidden sm:inline">Hours</span>
              </TabsTrigger>
              <TabsTrigger value="ivr" className="flex items-center gap-1">
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">IVR</span>
              </TabsTrigger>
              <TabsTrigger value="routing" className="flex items-center gap-1">
                <GitBranch className="w-4 h-4" />
                <span className="hidden sm:inline">Routing</span>
              </TabsTrigger>
              <TabsTrigger value="voiceai" className="flex items-center gap-1">
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">Voice AI</span>
              </TabsTrigger>
              <TabsTrigger value="extensions" className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Extensions</span>
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Shared API Key Tab */}
        <TabsContent value="api">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5" />
                    Telnyx API Key (Shared)
                  </CardTitle>
                  <CardDescription>
                    This API key is used for both Voice and Fax services. You only need one key for your entire Telnyx account.
                    <a href="https://portal.telnyx.com/#/app/api-keys" target="_blank" rel="noopener noreferrer" className="text-lime-500 ml-1 hover:underline inline-flex items-center gap-1">
                      Get your API key <ExternalLink className="w-3 h-3" />
                    </a>
                  </CardDescription>
                </div>
                {hasApiKey && !editModes.apiKey && (
                  <Button variant="outline" size="sm" onClick={() => setEditModes(prev => ({ ...prev, apiKey: true }))}>
                    <Edit className="w-4 h-4 mr-2" /> Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Locked View */}
              {hasApiKey && !editModes.apiKey ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                      <CheckCircle className="w-5 h-5" />
                      <p className="font-medium">API Key Configured</p>
                    </div>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      Your Telnyx API key is securely saved and active for Voice and Fax services.
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <strong>API Key:</strong> ••••••••••••••••••••
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>One API Key for Everything:</strong> Your Telnyx API key works across all services (Voice, Fax, SMS). 
                      Enter it here once, and it will be used for both Voice Dialer and Fax.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shared_api_key">API Key</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="shared_api_key"
                          type={showApiKey ? "text" : "password"}
                          value={sharedApiKey}
                          onChange={(e) => setSharedApiKey(e.target.value)}
                          placeholder={hasApiKey ? "••••••••••••••••••••" : "KEY_xxxxxxxxxxxxxxxx"}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {hasApiKey && !sharedApiKey && (
                      <p className="text-xs text-lime-600 flex items-center gap-1">
                        Leave blank to keep existing key, or enter a new key to replace it
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={saveApiKey} disabled={isSaving} className="flex-1">
                      {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Save API Key
                    </Button>
                    {editModes.apiKey && (
                      <Button variant="outline" onClick={() => { setEditModes(prev => ({ ...prev, apiKey: false })); setSharedApiKey(''); }}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </>
              )}

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">What you need from Telnyx:</h4>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="font-medium flex items-center gap-2 mb-1">
                      <Phone className="w-4 h-4 text-green-500" /> For Voice/Dialer
                    </p>
                    <ul className="text-muted-foreground space-y-1 text-xs">
                      <li>• Voice → Connections → Create "Credential" type</li>
                      <li>• Note the Connection ID</li>
                      <li>• Assign a phone number to the connection</li>
                    </ul>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="font-medium flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-blue-500" /> For Fax
                    </p>
                    <ul className="text-muted-foreground space-y-1 text-xs">
                      <li>• Messaging → Fax → Create Application</li>
                      <li>• Note the Connection ID</li>
                      <li>• Purchase/assign a fax-enabled number</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Voice Configuration Tab */}
        <TabsContent value="voice">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="w-5 h-5" />
                    Voice / Browser Dialer
                  </CardTitle>
                  <CardDescription>
                    Enable browser-based calling with WebRTC. Requires a Credential Connection in Telnyx.
                  </CardDescription>
                </div>
                {voiceConfig.connection_id && !editModes.voice && (
                  <Button variant="outline" size="sm" onClick={() => setEditModes(prev => ({ ...prev, voice: true }))}>
                    <Edit className="w-4 h-4 mr-2" /> Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Locked View */}
              {voiceConfig.connection_id && !editModes.voice ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5" />
                      <div>
                        <p className="font-medium">Voice Features</p>
                        <p className="text-sm text-muted-foreground">Browser dialer, IVR, call recording</p>
                      </div>
                    </div>
                    <Badge variant={voiceConfig.enabled ? "default" : "secondary"}>
                      {voiceConfig.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  
                  <div className="grid gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                      <CheckCircle className="w-5 h-5" />
                      <p className="font-medium">Voice Configuration Saved</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Connection ID</p>
                        <p className="font-mono">{voiceConfig.connection_id}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Phone Number</p>
                        <p className="font-mono">{voiceConfig.phone_number || 'Not set'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Caller Name</p>
                        <p>{voiceConfig.caller_name || 'Not set'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">SIP Username</p>
                        <p className="font-mono">{voiceConfig.sip_username ? '••••••••' : 'Not set'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5" />
                      <div>
                        <p className="font-medium">Enable Voice Features</p>
                        <p className="text-sm text-muted-foreground">Browser dialer, IVR, call recording</p>
                      </div>
                    </div>
                    <Switch
                      checked={voiceConfig.enabled}
                      onCheckedChange={(checked) => setVoiceConfig(prev => ({ ...prev, enabled: checked }))}
                    />
                  </div>

                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="voice_connection_id">Voice Connection ID</Label>
                      <Input
                        id="voice_connection_id"
                        value={voiceConfig.connection_id}
                        onChange={(e) => setVoiceConfig(prev => ({ ...prev, connection_id: e.target.value }))}
                        placeholder="1234567890123456789"
                      />
                      <p className="text-xs text-muted-foreground">From Voice → Connections → Your Credential Connection</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="voice_phone_number">Outgoing Phone Number (Caller ID)</Label>
                      <Input
                        id="voice_phone_number"
                        value={voiceConfig.phone_number}
                        onChange={(e) => setVoiceConfig(prev => ({ ...prev, phone_number: e.target.value }))}
                        placeholder="+15551234567"
                      />
                      <p className="text-xs text-muted-foreground">The number recipients see when you call them</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="voice_caller_name">Outgoing Caller Name (CNAM)</Label>
                      <Input
                        id="voice_caller_name"
                        value={voiceConfig.caller_name || ''}
                        onChange={(e) => setVoiceConfig(prev => ({ ...prev, caller_name: e.target.value }))}
                        placeholder="DME PROSical"
                        maxLength={15}
                      />
                      <p className="text-xs text-muted-foreground">Business name shown on recipient's caller ID (max 15 chars)</p>
                    </div>

                    {/* SIP Credentials Section */}
                    <div className="border-t pt-4 mt-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        SIP/WebRTC Credentials
                      </h4>
                      <p className="text-xs text-muted-foreground mb-4">
                        For browser-based WebRTC calling. Get these from your Telnyx Credential Connection.
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="sip_username">SIP Username</Label>
                          <Input
                            id="sip_username"
                            value={voiceConfig.sip_username || ''}
                            onChange={(e) => setVoiceConfig(prev => ({ ...prev, sip_username: e.target.value }))}
                            placeholder="credential_username"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="sip_password">SIP Password</Label>
                          <Input
                            id="sip_password"
                            type="password"
                            value={voiceConfig.sip_password || ''}
                            onChange={(e) => setVoiceConfig(prev => ({ ...prev, sip_password: e.target.value }))}
                            placeholder="••••••••"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Found in Telnyx Portal → Voice → Credentials → Your Connection → Show Credentials
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Voice Webhook URLs</Label>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-1">Primary Webhook:</p>
                            <Input
                              value={`${window.location.origin}/api/voice/webhooks`}
                              readOnly
                              className="bg-muted font-mono text-xs"
                            />
                          </div>
                          <Button variant="outline" size="icon" className="mt-5" onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/api/voice/webhooks`);
                            toast.success('Primary webhook copied!');
                          }}>
                            <Globe className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-1">Failover Webhook:</p>
                            <Input
                              value={`${window.location.origin}/api/voice/webhooks/failover`}
                              readOnly
                              className="bg-muted font-mono text-xs"
                            />
                          </div>
                          <Button variant="outline" size="icon" className="mt-5" onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/api/voice/webhooks/failover`);
                            toast.success('Failover webhook copied!');
                          }}>
                            <Webhook className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Set these in your Telnyx Connection settings</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={saveVoiceConfig} disabled={isSaving} className="flex-1">
                      {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Save Voice Configuration
                    </Button>
                    {editModes.voice && (
                      <Button variant="outline" onClick={() => setEditModes(prev => ({ ...prev, voice: false }))}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fax Configuration Tab */}
        <TabsContent value="fax">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Fax Configuration
              </CardTitle>
              <CardDescription>
                HIPAA-compliant faxing powered by Telnyx. Requires a Fax Application.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Enable Fax Features</p>
                    <p className="text-sm text-muted-foreground">Send and receive HIPAA-compliant faxes</p>
                  </div>
                </div>
                <Switch
                  checked={faxConfig.enabled}
                  onCheckedChange={(checked) => setFaxConfig(prev => ({ ...prev, enabled: checked }))}
                />
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fax_number">Fax Phone Number</Label>
                  <Input
                    id="fax_number"
                    value={faxConfig.fax_number}
                    onChange={(e) => setFaxConfig(prev => ({ ...prev, fax_number: e.target.value }))}
                    placeholder="+15559876543"
                  />
                  <p className="text-xs text-muted-foreground">Your fax-enabled Telnyx number</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fax_connection_id">Fax Connection/App ID</Label>
                  <Input
                    id="fax_connection_id"
                    value={faxConfig.connection_id}
                    onChange={(e) => setFaxConfig(prev => ({ ...prev, connection_id: e.target.value }))}
                    placeholder="1234567890123456789"
                  />
                  <p className="text-xs text-muted-foreground">From Messaging → Fax → Applications</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fax_caller_name">Outgoing Caller Name (CNAM)</Label>
                  <Input
                    id="fax_caller_name"
                    value={faxConfig.caller_name || ''}
                    onChange={(e) => setFaxConfig(prev => ({ ...prev, caller_name: e.target.value }))}
                    placeholder="DME PROSical"
                    maxLength={15}
                  />
                  <p className="text-xs text-muted-foreground">Business name shown on recipient's fax header (max 15 chars)</p>
                </div>

                <div className="space-y-2">
                  <Label>Fax Webhook URLs</Label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">Primary Webhook:</p>
                        <Input
                          value={`${window.location.origin}/api/webhooks/fax`}
                          readOnly
                          className="bg-muted font-mono text-xs"
                        />
                      </div>
                      <Button variant="outline" size="icon" className="mt-5" onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/fax`);
                        toast.success('Primary webhook copied!');
                      }}>
                        <Globe className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">Failover Webhook:</p>
                        <Input
                          value={`${window.location.origin}/api/webhooks/fax/failover`}
                          readOnly
                          className="bg-muted font-mono text-xs"
                        />
                      </div>
                      <Button variant="outline" size="icon" className="mt-5" onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/fax/failover`);
                        toast.success('Failover webhook copied!');
                      }}>
                        <Webhook className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={saveFaxConfig} disabled={isSaving} className="flex-1">
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Fax Configuration
                </Button>
                <Button onClick={testFaxConnection} disabled={testingFax} variant="outline">
                  {testingFax ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TestTube className="w-4 h-4 mr-2" />}
                  Test
                </Button>
              </div>
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
                Set your operating hours. Calls outside these hours go to voicemail or hear the after-hours message.
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
                    <span className="w-24 font-medium text-sm">{day.label}</span>
                    <Input
                      type="time"
                      value={businessHours.schedule[day.key]?.start || '09:00'}
                      onChange={(e) => updateScheduleDay(day.key, 'start', e.target.value)}
                      disabled={!businessHours.schedule[day.key]?.enabled}
                      className="w-28"
                    />
                    <span className="text-muted-foreground text-sm">to</span>
                    <Input
                      type="time"
                      value={businessHours.schedule[day.key]?.end || '17:00'}
                      onChange={(e) => updateScheduleDay(day.key, 'end', e.target.value)}
                      disabled={!businessHours.schedule[day.key]?.enabled}
                      className="w-28"
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
                      className="w-28"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={businessHours.lunch_break?.end || '13:00'}
                      onChange={(e) => setBusinessHours(prev => ({
                        ...prev,
                        lunch_break: { ...prev.lunch_break, end: e.target.value }
                      }))}
                      className="w-28"
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
                Configure the automated phone menu system
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
                  />
                </div>

                <div className="space-y-2">
                  <Label>Main Menu</Label>
                  <Textarea
                    value={ivrConfig.main_menu}
                    onChange={(e) => setIvrConfig(prev => ({ ...prev, main_menu: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sales Menu (Press 1)</Label>
                    <Textarea
                      value={ivrConfig.sales_menu}
                      onChange={(e) => setIvrConfig(prev => ({ ...prev, sales_menu: e.target.value }))}
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Support Menu (Press 2)</Label>
                    <Textarea
                      value={ivrConfig.support_menu}
                      onChange={(e) => setIvrConfig(prev => ({ ...prev, support_menu: e.target.value }))}
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Billing Menu (Press 3)</Label>
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
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
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
              </div>

              <Button onClick={saveIvrConfig} disabled={isSaving} className="w-full">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save IVR Configuration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Call Routing & Groups Tab */}
        <TabsContent value="routing">
          <div className="space-y-6">
            {/* Call Groups Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="w-5 h-5" />
                      Call Groups
                    </CardTitle>
                    <CardDescription>
                      Create groups and assign extensions. Map IVR keys to route calls to specific groups.
                    </CardDescription>
                  </div>
                  <Button onClick={() => setShowGroupModal(true)} className="gap-2">
                    <Plus className="w-4 h-4" /> New Group
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {callGroups.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No call groups configured</p>
                    <p className="text-sm">Create groups like Sales, Support, Billing and assign extensions</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {callGroups.map(group => (
                      <div key={group.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${group.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <div>
                              <h4 className="font-medium">{group.name}</h4>
                              <p className="text-sm text-muted-foreground">{group.description || 'No description'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {group.ivr_key && (
                              <Badge variant="outline">Press {group.ivr_key}</Badge>
                            )}
                            <Badge variant={group.ring_strategy === 'ring_all' ? 'default' : 'secondary'}>
                              {group.ring_strategy === 'ring_all' ? 'Ring All' : group.ring_strategy === 'sequential' ? 'Sequential' : 'Round Robin'}
                            </Badge>
                            <Badge variant="outline">{group.queue_count || 0} in queue</Badge>
                            <Button size="sm" variant="ghost" onClick={() => setEditingGroup(group)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deleteCallGroup(group.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Extensions in group */}
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="text-sm text-muted-foreground">Extensions:</span>
                          {(group.agents || []).map(agent => (
                            <Badge
                              key={agent.extension}
                              variant={agent.is_available ? 'default' : 'secondary'}
                              className="flex items-center gap-1"
                            >
                              <span className={`w-2 h-2 rounded-full ${agent.is_available ? 'bg-green-400' : 'bg-gray-400'}`} />
                              {agent.extension} - {agent.name || 'Unknown'}
                              <button
                                className="ml-1 hover:text-red-500"
                                onClick={() => removeExtensionFromGroup(group.id, agent.extension)}
                              >
                                <XCircle className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                          
                          {/* Add extension dropdown */}
                          <select
                            className="h-7 px-2 text-xs border rounded"
                            onChange={(e) => {
                              if (e.target.value) {
                                addExtensionToGroup(group.id, e.target.value);
                                e.target.value = '';
                              }
                            }}
                            defaultValue=""
                          >
                            <option value="">+ Add</option>
                            {extensions
                              .filter(ext => !group.extensions?.includes(ext.extension))
                              .map(ext => (
                                <option key={ext.extension} value={ext.extension}>
                                  {ext.extension} - {ext.first_name} {ext.last_name}
                                </option>
                              ))
                            }
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Create Group Modal/Form */}
                {showGroupModal && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg space-y-4">
                      <h3 className="text-lg font-bold">Create Call Group</h3>
                      
                      <div className="space-y-3">
                        <div>
                          <Label>Group Name *</Label>
                          <Input
                            value={newGroup.name}
                            onChange={(e) => setNewGroup(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g., Sales Team"
                          />
                        </div>
                        <div>
                          <Label>Description</Label>
                          <Input
                            value={newGroup.description}
                            onChange={(e) => setNewGroup(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Handle new orders and inquiries"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>IVR Key (Press #)</Label>
                            <select
                              className="w-full h-10 px-3 border rounded-md"
                              value={newGroup.ivr_key}
                              onChange={(e) => setNewGroup(prev => ({ ...prev, ivr_key: e.target.value }))}
                            >
                              <option value="">None</option>
                              {['1', '2', '3', '4', '5', '0'].map(key => (
                                <option key={key} value={key} disabled={Object.values(ivrRouting).some(r => r?.group_id && callGroups.find(g => g.id === r.group_id)?.ivr_key === key)}>
                                  Press {key}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label>Ring Strategy</Label>
                            <select
                              className="w-full h-10 px-3 border rounded-md"
                              value={newGroup.ring_strategy}
                              onChange={(e) => setNewGroup(prev => ({ ...prev, ring_strategy: e.target.value }))}
                            >
                              <option value="round_robin">Round Robin</option>
                              <option value="ring_all">Ring All (Simultaneous)</option>
                              <option value="sequential">Sequential</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Ring Timeout (seconds)</Label>
                            <Input
                              type="number"
                              value={newGroup.ring_timeout}
                              onChange={(e) => setNewGroup(prev => ({ ...prev, ring_timeout: parseInt(e.target.value) || 20 }))}
                              min={10}
                              max={60}
                            />
                          </div>
                          <div>
                            <Label>Max Queue Size</Label>
                            <Input
                              type="number"
                              value={newGroup.max_queue_size}
                              onChange={(e) => setNewGroup(prev => ({ ...prev, max_queue_size: parseInt(e.target.value) || 10 }))}
                              min={1}
                              max={50}
                            />
                          </div>
                        </div>
                        <div>
                          <Label>If No Answer</Label>
                          <select
                            className="w-full h-10 px-3 border rounded-md"
                            value={newGroup.fallback_action}
                            onChange={(e) => setNewGroup(prev => ({ ...prev, fallback_action: e.target.value }))}
                          >
                            <option value="voicemail">Go to Voicemail</option>
                            <option value="queue">Hold in Queue</option>
                            <option value="next_group">Transfer to Another Group</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setShowGroupModal(false)}>Cancel</Button>
                        <Button onClick={createCallGroup} disabled={isSaving}>
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                          Create Group
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Edit Group Modal */}
                {editingGroup && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg space-y-4">
                      <h3 className="text-lg font-bold">Edit Call Group: {editingGroup.name}</h3>
                      
                      <div className="space-y-3">
                        <div>
                          <Label>Group Name</Label>
                          <Input
                            value={editingGroup.name}
                            onChange={(e) => setEditingGroup(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label>Description</Label>
                          <Input
                            value={editingGroup.description || ''}
                            onChange={(e) => setEditingGroup(prev => ({ ...prev, description: e.target.value }))}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>IVR Key</Label>
                            <select
                              className="w-full h-10 px-3 border rounded-md"
                              value={editingGroup.ivr_key || ''}
                              onChange={(e) => setEditingGroup(prev => ({ ...prev, ivr_key: e.target.value }))}
                            >
                              <option value="">None</option>
                              {['1', '2', '3', '4', '5', '0'].map(key => (
                                <option key={key} value={key}>Press {key}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label>Ring Strategy</Label>
                            <select
                              className="w-full h-10 px-3 border rounded-md"
                              value={editingGroup.ring_strategy}
                              onChange={(e) => setEditingGroup(prev => ({ ...prev, ring_strategy: e.target.value }))}
                            >
                              <option value="round_robin">Round Robin</option>
                              <option value="ring_all">Ring All</option>
                              <option value="sequential">Sequential</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Ring Timeout</Label>
                            <Input
                              type="number"
                              value={editingGroup.ring_timeout}
                              onChange={(e) => setEditingGroup(prev => ({ ...prev, ring_timeout: parseInt(e.target.value) || 20 }))}
                            />
                          </div>
                          <div>
                            <Label>Max Queue</Label>
                            <Input
                              type="number"
                              value={editingGroup.max_queue_size}
                              onChange={(e) => setEditingGroup(prev => ({ ...prev, max_queue_size: parseInt(e.target.value) || 10 }))}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={editingGroup.is_active}
                            onCheckedChange={(checked) => setEditingGroup(prev => ({ ...prev, is_active: checked }))}
                          />
                          <Label>Group Active</Label>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setEditingGroup(null)}>Cancel</Button>
                        <Button onClick={updateCallGroup} disabled={isSaving}>
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Hold Queue Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="w-5 h-5" />
                  Hold Queue & Music
                </CardTitle>
                <CardDescription>
                  Configure what callers hear when waiting in queue
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <ListOrdered className="w-5 h-5" />
                    <div>
                      <p className="font-medium">Enable Hold Queue</p>
                      <p className="text-sm text-muted-foreground">Place callers in queue when agents are busy</p>
                    </div>
                  </div>
                  <Switch
                    checked={holdConfig.enabled}
                    onCheckedChange={(checked) => setHoldConfig(prev => ({ ...prev, enabled: checked }))}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hold Music URL</Label>
                    <Input
                      value={holdConfig.music_url || ''}
                      onChange={(e) => setHoldConfig(prev => ({ ...prev, music_url: e.target.value }))}
                      placeholder="https://example.com/hold-music.mp3"
                    />
                    <p className="text-xs text-muted-foreground">URL to MP3 file for hold music</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Hold Time (seconds)</Label>
                    <Input
                      type="number"
                      value={holdConfig.max_hold_time}
                      onChange={(e) => setHoldConfig(prev => ({ ...prev, max_hold_time: parseInt(e.target.value) || 600 }))}
                      min={60}
                      max={1800}
                    />
                    <p className="text-xs text-muted-foreground">After this, go to voicemail</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Volume2 className="w-5 h-5" />
                    <div>
                      <p className="font-medium">Position Announcements</p>
                      <p className="text-sm text-muted-foreground">"You are number X in the queue"</p>
                    </div>
                  </div>
                  <Switch
                    checked={holdConfig.position_announcement_enabled}
                    onCheckedChange={(checked) => setHoldConfig(prev => ({ ...prev, position_announcement_enabled: checked }))}
                  />
                </div>

                {holdConfig.position_announcement_enabled && (
                  <div className="space-y-2">
                    <Label>Announcement Interval (seconds)</Label>
                    <Input
                      type="number"
                      value={holdConfig.position_announcement_interval}
                      onChange={(e) => setHoldConfig(prev => ({ ...prev, position_announcement_interval: parseInt(e.target.value) || 30 }))}
                      min={15}
                      max={120}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Custom Hold Message</Label>
                  <Textarea
                    value={holdConfig.custom_hold_message}
                    onChange={(e) => setHoldConfig(prev => ({ ...prev, custom_hold_message: e.target.value }))}
                    rows={3}
                    placeholder="Thank you for holding. You are currently number {position} in the queue..."
                  />
                  <p className="text-xs text-muted-foreground">Use {'{position}'} to insert queue position</p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={generateHoldMessageAudio} disabled={generatingHoldMessage} variant="outline" className="gap-2">
                    {generatingHoldMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Generate Audio
                  </Button>
                  {holdConfig.custom_hold_message_audio_url && (
                    <Button
                      variant="outline"
                      onClick={() => playAudio(`${API_URL}${holdConfig.custom_hold_message_audio_url}`)}
                    >
                      <Play className="w-4 h-4 mr-2" /> Preview
                    </Button>
                  )}
                </div>

                <Button onClick={saveHoldConfig} disabled={isSaving} className="w-full">
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Hold Configuration
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Voice AI / TTS Tab */}
        <TabsContent value="voiceai">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Voice AI (Text-to-Speech)
              </CardTitle>
              <CardDescription>
                Generate professional AI voices for your IVR menus, voicemail, and after-hours messages using OpenAI TTS.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!ttsAvailable ? (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>TTS Service Unavailable:</strong> The text-to-speech service is not configured. Please contact your administrator.
                  </p>
                </div>
              ) : (
                <>
                  {/* Voice Selection */}
                  <div className="space-y-4">
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <AudioLines className="w-5 h-5 text-purple-600" />
                        <h4 className="font-medium">Voice Settings</h4>
                      </div>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Voice</Label>
                          <select
                            value={ivrConfig.tts_voice}
                            onChange={(e) => setIvrConfig(prev => ({ ...prev, tts_voice: e.target.value }))}
                            className="w-full h-10 px-3 border rounded-md"
                          >
                            {Object.entries(ttsVoices).map(([key, voice]) => (
                              <option key={key} value={key}>
                                {voice.name} - {voice.description}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label>Quality</Label>
                          <select
                            value={ivrConfig.tts_model}
                            onChange={(e) => setIvrConfig(prev => ({ ...prev, tts_model: e.target.value }))}
                            className="w-full h-10 px-3 border rounded-md"
                          >
                            {Object.entries(ttsModels).map(([key, model]) => (
                              <option key={key} value={key}>{model.name} - {model.description}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label>Speed ({ivrConfig.tts_speed}x)</Label>
                          <input
                            type="range"
                            min="0.5"
                            max="2"
                            step="0.1"
                            value={ivrConfig.tts_speed}
                            onChange={(e) => setIvrConfig(prev => ({ ...prev, tts_speed: parseFloat(e.target.value) }))}
                            className="w-full h-10"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Voice Preview */}
                    <div className="p-4 border rounded-lg space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Play className="w-4 h-4" /> Preview Voice
                      </h4>
                      <div className="flex gap-2">
                        <Input
                          value={previewText}
                          onChange={(e) => setPreviewText(e.target.value)}
                          placeholder="Enter text to preview voice..."
                          className="flex-1"
                        />
                        <Button onClick={previewVoice} disabled={previewingVoice} variant="outline">
                          {previewingVoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                          Preview
                        </Button>
                        {playingAudio && (
                          <Button onClick={stopAudio} variant="outline">
                            <Pause className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Script Generation */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Generate Audio for IVR Scripts</h4>
                      <Button onClick={generateAllTtsAudio} disabled={generatingAll} className="gap-2">
                        {generatingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Generate All
                      </Button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3">
                      {[
                        { key: 'greeting', label: 'Greeting', desc: 'Opening message' },
                        { key: 'main_menu', label: 'Main Menu', desc: 'Press 1 for Sales...' },
                        { key: 'sales_menu', label: 'Sales Menu', desc: 'Sales sub-menu' },
                        { key: 'support_menu', label: 'Support Menu', desc: 'Support sub-menu' },
                        { key: 'billing_menu', label: 'Billing Menu', desc: 'Billing sub-menu' },
                        { key: 'after_hours', label: 'After Hours', desc: 'Closed message' },
                        { key: 'voicemail', label: 'Voicemail', desc: 'Leave a message prompt' },
                        { key: 'no_agents', label: 'No Agents', desc: 'All reps busy message' }
                      ].map(script => {
                        const existingFile = ttsFiles.find(f => f.script_type === script.key && f.voice === ivrConfig.tts_voice);
                        return (
                          <div key={script.key} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium text-sm">{script.label}</p>
                              <p className="text-xs text-muted-foreground">{script.desc}</p>
                              {existingFile && (
                                <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                                  <CheckCircle className="w-3 h-3" /> Generated ({existingFile.voice})
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              {existingFile && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => playAudio(`${API_URL}/api/voice/tts/audio/${existingFile.filename}`)}
                                >
                                  {playingAudio?.includes(existingFile.filename) ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => generateTtsAudio(script.key)}
                                disabled={generatingTts === script.key}
                              >
                                {generatingTts === script.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Generated Files List */}
                  {ttsFiles.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium">Generated Audio Files ({ttsFiles.length})</h4>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {ttsFiles.slice(0, 10).map(file => (
                          <div key={file.id} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                            <div className="flex items-center gap-2">
                              <AudioLines className="w-4 h-4 text-purple-500" />
                              <span>{file.script_type}</span>
                              <Badge variant="outline" className="text-xs">{file.voice}</Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => playAudio(`${API_URL}/api/voice/tts/audio/${file.filename}`)}
                              >
                                <Play className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-500 hover:text-red-700"
                                onClick={() => deleteTtsFile(file.id)}
                              >
                                <XCircle className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
                    <p className="text-blue-800 dark:text-blue-200">
                      <strong>Note:</strong> After generating audio, save your IVR configuration and the system will use these AI voices instead of Telnyx's built-in TTS.
                    </p>
                  </div>
                </>
              )}
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
                Extensions are set in each user's Profile Settings
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
