import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Users,
  GripVertical,
  UserPlus,
  UserMinus,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowUp,
  ArrowDown,
  Settings,
  RotateCcw
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('dme_token')}`
});

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  sales_manager: 'Sales Manager',
  sales_rep: 'Sales Rep'
};

export default function RoundRobinSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agentOrder, setAgentOrder] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/chat/round-robin/settings`, {
        headers: getHeaders()
      });
      
      setAgentOrder(response.data.agent_order || []);
      setCurrentIndex(response.data.current_index || 0);
      setEnabled(response.data.enabled !== false);
    } catch (error) {
      console.error('Error fetching round robin settings:', error);
      toast.error('Failed to load round robin settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/chat/round-robin/available-agents`, {
        headers: getHeaders()
      });
      setAvailableUsers(response.data.users || []);
    } catch (error) {
      console.error('Error fetching available users:', error);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/chat/round-robin/settings`, {
        agent_order: agentOrder.map((a, i) => ({
          user_id: a.user_id,
          order: i,
          opted_out: a.opted_out
        })),
        enabled,
        current_index: currentIndex
      }, {
        headers: getHeaders()
      });
      
      toast.success('Round robin settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addAgent = async (userId) => {
    try {
      await axios.post(`${API_URL}/api/chat/round-robin/add-agent`, {
        user_id: userId
      }, {
        headers: getHeaders()
      });
      
      toast.success('Agent added to rotation');
      setAddDialogOpen(false);
      fetchSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add agent');
    }
  };

  const removeAgent = async (userId) => {
    if (!confirm('Remove this agent from the rotation?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/chat/round-robin/remove-agent/${userId}`, {
        headers: getHeaders()
      });
      
      toast.success('Agent removed from rotation');
      fetchSettings();
    } catch (error) {
      toast.error('Failed to remove agent');
    }
  };

  const toggleOptOut = (userId) => {
    setAgentOrder(prev => prev.map(a => 
      a.user_id === userId ? { ...a, opted_out: !a.opted_out } : a
    ));
  };

  const moveAgent = (index, direction) => {
    const newOrder = [...agentOrder];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= newOrder.length) return;
    
    [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
    setAgentOrder(newOrder);
  };

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newOrder = [...agentOrder];
    const draggedItem = newOrder[draggedIndex];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(index, 0, draggedItem);
    
    setAgentOrder(newOrder);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const resetRotation = () => {
    setCurrentIndex(0);
    toast.success('Rotation reset to first agent');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" data-testid="round-robin-settings-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RotateCcw className="w-6 h-6" />
            Chat Round Robin Settings
          </h1>
          <p className="text-muted-foreground">
            Manage how incoming chats are distributed to agents
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Round Robin</span>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              className="data-[state=checked]:bg-green-500"
            />
            <span className={`text-sm ${enabled ? 'text-green-600' : 'text-gray-500'}`}>
              {enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Settings className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm text-blue-800">
                <strong>How it works:</strong> When a customer requests to speak with a human agent, 
                the system will assign the chat to the next available agent in the rotation order below. 
                Agents who are offline or have opted out will be skipped.
              </p>
              <p className="text-sm text-blue-700 mt-2">
                <strong>Current position:</strong> Agent #{currentIndex + 1} in the list will receive the next chat.
                <Button variant="link" size="sm" className="text-blue-600 p-0 h-auto ml-2" onClick={resetRotation}>
                  Reset to #1
                </Button>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent Order */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Agent Rotation Order</CardTitle>
            <CardDescription>Drag and drop to reorder agents. Agents at the top receive chats first.</CardDescription>
          </div>
          <Button onClick={() => { fetchAvailableUsers(); setAddDialogOpen(true); }}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add Agent
          </Button>
        </CardHeader>
        <CardContent>
          {agentOrder.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No agents in rotation yet</p>
              <p className="text-sm">Add agents to start the round robin</p>
            </div>
          ) : (
            <div className="space-y-2">
              {agentOrder.map((agent, index) => (
                <div
                  key={agent.user_id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                    draggedIndex === index ? 'bg-primary/10 border-primary' :
                    agent.opted_out ? 'bg-gray-50 border-gray-200 opacity-60' :
                    currentIndex === index ? 'bg-green-50 border-green-300' :
                    'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Drag Handle */}
                  <div className="cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-5 h-5 text-gray-400" />
                  </div>

                  {/* Order Number */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    currentIndex === index ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {index + 1}
                  </div>

                  {/* Agent Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{agent.first_name} {agent.last_name}</span>
                      <Badge variant="outline" className="text-xs">
                        {ROLE_LABELS[agent.role] || agent.role}
                      </Badge>
                      {currentIndex === index && (
                        <Badge className="bg-green-500 text-xs">Next Up</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{agent.email}</p>
                  </div>

                  {/* Status Indicators */}
                  <div className="flex items-center gap-3">
                    {/* Online Status */}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      agent.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {agent.is_available ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          Online
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" />
                          Offline
                        </>
                      )}
                    </div>

                    {/* Opt Out Toggle */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Active</span>
                      <Switch
                        checked={!agent.opted_out}
                        onCheckedChange={() => toggleOptOut(agent.user_id)}
                        className="data-[state=checked]:bg-green-500"
                      />
                    </div>
                  </div>

                  {/* Move Buttons */}
                  <div className="flex flex-col gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => moveAgent(index, 'up')}
                      disabled={index === 0}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => moveAgent(index, 'down')}
                      disabled={index === agentOrder.length - 1}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Remove Button */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => removeAgent(agent.user_id)}
                  >
                    <UserMinus className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Agent Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Agent to Rotation</DialogTitle>
            <DialogDescription>
              Select an agent to add to the round robin rotation
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2 py-4">
            {availableUsers.filter(u => !u.in_rotation).length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                All eligible agents are already in the rotation
              </p>
            ) : (
              availableUsers.filter(u => !u.in_rotation).map(user => (
                <button
                  key={user.id}
                  onClick={() => addAgent(user.id)}
                  className="w-full p-3 text-left rounded-lg border hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{user.first_name} {user.last_name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant="outline">{ROLE_LABELS[user.role] || user.role}</Badge>
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
