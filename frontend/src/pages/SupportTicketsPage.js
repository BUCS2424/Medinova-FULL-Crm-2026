import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Ticket,
  Search,
  Plus,
  Filter,
  Clock,
  User,
  Mail,
  Phone,
  MessageCircle,
  ChevronRight,
  MoreVertical,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Circle,
  Pause,
  XCircle,
  Send
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('dme_token')}`
});

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-700', icon: Circle },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  pending: { label: 'Pending', color: 'bg-purple-100 text-purple-700', icon: Pause },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-700', icon: XCircle }
};

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-600' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-600' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-600' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-600' }
};

const SOURCE_CONFIG = {
  chat: { label: 'Chat', icon: MessageCircle },
  email: { label: 'Email', icon: Mail },
  phone: { label: 'Phone', icon: Phone },
  manual: { label: 'Manual', icon: User }
};

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  
  // New ticket form
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    priority: 'medium',
    contact_name: '',
    contact_email: '',
    contact_phone: ''
  });
  const [creating, setCreating] = useState(false);
  
  // Note input
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, priorityFilter, sourceFilter]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (priorityFilter !== 'all') params.priority = priorityFilter;
      if (sourceFilter !== 'all') params.source = sourceFilter;
      if (search) params.search = search;
      
      const response = await axios.get(`${API_URL}/api/tickets`, {
        params,
        headers: getHeaders()
      });
      
      setTickets(response.data.tickets || []);
      setStats(response.data.stats || {});
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketDetails = async (ticketId) => {
    try {
      const response = await axios.get(`${API_URL}/api/tickets/${ticketId}`, {
        headers: getHeaders()
      });
      setSelectedTicket(response.data);
      setDetailOpen(true);
    } catch (error) {
      toast.error('Failed to load ticket details');
    }
  };

  const createTicket = async () => {
    if (!newTicket.subject) {
      toast.error('Subject is required');
      return;
    }
    
    setCreating(true);
    try {
      const response = await axios.post(`${API_URL}/api/tickets`, newTicket, {
        headers: getHeaders()
      });
      
      toast.success(`Ticket ${response.data.ticket_number} created`);
      setCreateOpen(false);
      setNewTicket({
        subject: '',
        description: '',
        priority: 'medium',
        contact_name: '',
        contact_email: '',
        contact_phone: ''
      });
      fetchTickets();
    } catch (error) {
      toast.error('Failed to create ticket');
    } finally {
      setCreating(false);
    }
  };

  const updateTicketStatus = async (ticketId, status) => {
    try {
      await axios.put(`${API_URL}/api/tickets/${ticketId}`, { status }, {
        headers: getHeaders()
      });
      toast.success('Status updated');
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        fetchTicketDetails(ticketId);
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const addNote = async () => {
    if (!noteText.trim() || !selectedTicket) return;
    
    setAddingNote(true);
    try {
      await axios.post(`${API_URL}/api/tickets/${selectedTicket.id}/notes`, {
        text: noteText
      }, {
        headers: getHeaders()
      });
      
      setNoteText('');
      fetchTicketDetails(selectedTicket.id);
      toast.success('Note added');
    } catch (error) {
      toast.error('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 p-6" data-testid="support-tickets-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ticket className="w-6 h-6" />
            Support Tickets
          </h1>
          <p className="text-muted-foreground">Manage customer support requests and inquiries</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Ticket
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('all')}>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{stats.total || 0}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${statusFilter === 'open' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setStatusFilter('open')}>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-blue-600">{stats.open || 0}</p>
            <p className="text-sm text-muted-foreground">Open</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${statusFilter === 'in_progress' ? 'ring-2 ring-yellow-500' : ''}`} onClick={() => setStatusFilter('in_progress')}>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-yellow-600">{stats.in_progress || 0}</p>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${statusFilter === 'pending' ? 'ring-2 ring-purple-500' : ''}`} onClick={() => setStatusFilter('pending')}>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-purple-600">{stats.pending || 0}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${statusFilter === 'resolved' ? 'ring-2 ring-green-500' : ''}`} onClick={() => setStatusFilter('resolved')}>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-600">{stats.resolved || 0}</p>
            <p className="text-sm text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchTickets()}
            className="pl-10"
          />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="chat">Chat</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="phone">Phone</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => {
          setStatusFilter('all');
          setPriorityFilter('all');
          setSourceFilter('all');
          setSearch('');
        }}>
          Clear Filters
        </Button>
      </div>

      {/* Tickets List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No tickets found</p>
            </div>
          ) : (
            <div className="divide-y">
              {tickets.map(ticket => {
                const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
                const sourceConfig = SOURCE_CONFIG[ticket.source] || SOURCE_CONFIG.manual;
                const StatusIcon = statusConfig.icon;
                const SourceIcon = sourceConfig.icon;
                
                return (
                  <div
                    key={ticket.id}
                    className="p-4 hover:bg-muted/50 cursor-pointer transition-colors flex items-center justify-between"
                    onClick={() => fetchTicketDetails(ticket.id)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`p-2 rounded-lg ${statusConfig.color}`}>
                        <StatusIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-muted-foreground">{ticket.ticket_number}</span>
                          <Badge className={priorityConfig.color}>{priorityConfig.label}</Badge>
                          {ticket.source === 'chat' && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <MessageCircle className="w-3 h-3" />
                              Chat
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium truncate">{ticket.subject}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          {ticket.contact_name && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {ticket.contact_name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(ticket.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Ticket Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Ticket</DialogTitle>
            <DialogDescription>Create a support ticket manually</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject *</label>
              <Input
                placeholder="Brief description of the issue"
                value={newTicket.subject}
                onChange={(e) => setNewTicket(prev => ({ ...prev, subject: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Detailed description..."
                value={newTicket.description}
                onChange={(e) => setNewTicket(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <div className="flex gap-2">
                {['low', 'medium', 'high', 'urgent'].map(p => (
                  <button
                    key={p}
                    onClick={() => setNewTicket(prev => ({ ...prev, priority: p }))}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium capitalize transition-colors ${
                      newTicket.priority === p
                        ? PRIORITY_CONFIG[p].color.replace('100', '500').replace('600', 'white')
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Contact Name</label>
                <Input
                  placeholder="Customer name"
                  value={newTicket.contact_name}
                  onChange={(e) => setNewTicket(prev => ({ ...prev, contact_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Contact Email</label>
                <Input
                  type="email"
                  placeholder="customer@email.com"
                  value={newTicket.contact_email}
                  onChange={(e) => setNewTicket(prev => ({ ...prev, contact_email: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createTicket} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          {selectedTicket && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground">{selectedTicket.ticket_number}</span>
                      <Badge className={PRIORITY_CONFIG[selectedTicket.priority]?.color}>
                        {PRIORITY_CONFIG[selectedTicket.priority]?.label}
                      </Badge>
                    </DialogTitle>
                    <DialogDescription className="mt-1">{selectedTicket.subject}</DialogDescription>
                  </div>
                  <Select
                    value={selectedTicket.status}
                    onValueChange={(value) => updateTicketStatus(selectedTicket.id, value)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto space-y-4 py-4">
                {/* Contact Info */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Contact Information</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      {selectedTicket.contact_name || 'N/A'}
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      {selectedTicket.contact_email || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {selectedTicket.description && (
                  <div>
                    <h4 className="font-medium mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedTicket.description}</p>
                  </div>
                )}

                {/* Chat Messages (if source is chat) */}
                {selectedTicket.source === 'chat' && selectedTicket.chat_messages?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <MessageCircle className="w-4 h-4" />
                      Chat Transcript
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                      {selectedTicket.chat_messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-2 ${msg.type === 'user' ? '' : 'flex-row-reverse'}`}>
                          <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                            msg.type === 'user' ? 'bg-blue-100' :
                            msg.type === 'ai' ? 'bg-lime-100' : 'bg-green-100'
                          }`}>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              {msg.type === 'user' ? 'Customer' : msg.type === 'ai' ? 'Joffry (AI)' : 'Agent'}
                            </p>
                            {msg.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <h4 className="font-medium mb-2">Notes ({selectedTicket.notes?.length || 0})</h4>
                  <div className="space-y-2 mb-4">
                    {selectedTicket.notes?.map(note => (
                      <div key={note.id} className="bg-muted/50 rounded-lg p-3">
                        <p className="text-sm">{note.text}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {note.created_by_name} • {formatDate(note.created_at)}
                        </p>
                      </div>
                    ))}
                    {(!selectedTicket.notes || selectedTicket.notes.length === 0) && (
                      <p className="text-sm text-muted-foreground">No notes yet</p>
                    )}
                  </div>
                  
                  {/* Add Note */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a note..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addNote()}
                    />
                    <Button onClick={addNote} disabled={addingNote || !noteText.trim()}>
                      {addingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
