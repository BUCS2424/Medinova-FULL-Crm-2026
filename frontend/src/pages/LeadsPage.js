import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { 
  Plus, 
  UserPlus, 
  ArrowRight, 
  Phone, 
  Mail, 
  GripVertical,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  TrendingUp,
  Users,
  Target,
  Upload,
  Download,
  FileDown,
  FileUp,
  FileSpreadsheet,
  Loader2,
  DollarSign,
  LayoutGrid,
  List,
  ChevronRight,
  MapPin
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const LEAD_STATUSES = [
  { 
    value: 'opportunity', 
    label: 'Opportunities', 
    icon: Sparkles,
    gradient: 'from-violet-500 to-purple-600',
    bgLight: 'bg-violet-50',
    borderColor: 'border-violet-200',
    textColor: 'text-violet-700',
    badgeBg: 'bg-violet-100',
    iconBg: 'bg-violet-500'
  },
  { 
    value: 'new', 
    label: 'New Requests', 
    icon: Users,
    gradient: 'from-blue-500 to-cyan-600',
    bgLight: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    badgeBg: 'bg-blue-100',
    iconBg: 'bg-blue-500'
  },
  { 
    value: 'verifying_insurance', 
    label: 'Verifying Insurance', 
    icon: Clock,
    gradient: 'from-lime-500 to-lime-600',
    bgLight: 'bg-lime-50',
    borderColor: 'border-lime-200',
    textColor: 'text-lime-700',
    badgeBg: 'bg-lime-100',
    iconBg: 'bg-lime-500'
  },
  { 
    value: 'qualified', 
    label: 'Qualified', 
    icon: CheckCircle2,
    gradient: 'from-emerald-500 to-green-600',
    bgLight: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-700',
    badgeBg: 'bg-emerald-100',
    iconBg: 'bg-emerald-500'
  },
  { 
    value: 'lost', 
    label: 'Lost', 
    icon: XCircle,
    gradient: 'from-rose-500 to-red-600',
    bgLight: 'bg-rose-50',
    borderColor: 'border-rose-200',
    textColor: 'text-rose-700',
    badgeBg: 'bg-rose-100',
    iconBg: 'bg-rose-500'
  }
];

// Sortable Lead Card Component
function SortableLeadCard({ lead, status, onConvert, onClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const statusConfig = LEAD_STATUSES.find(s => s.value === status);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700
        shadow-sm hover:shadow-md transition-all duration-200
        ${isDragging ? 'opacity-50 shadow-lg ring-2 ring-primary/50 scale-105' : ''}
      `}
      data-testid={`lead-card-${lead.id}`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="w-4 h-4 text-slate-400" />
      </div>

      {/* Card Content - Clickable */}
      <div 
        className="p-4 pl-8 cursor-pointer"
        onClick={() => onClick(lead.id)}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-navy-700 dark:text-white truncate">
              {lead.first_name} {lead.last_name}
            </h4>
            {(lead.utm_source || lead.form_source) && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                via {lead.utm_source || lead.form_source}
              </p>
            )}
          </div>
          {lead.patient_id && (
            <Badge className="bg-emerald-100 text-emerald-700 text-xs shrink-0">
              Converted
            </Badge>
          )}
        </div>

        {/* Medical Info Tags */}
        {lead.pain_location && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            <Badge variant="outline" className="text-xs capitalize bg-slate-50">
              {lead.pain_location}
            </Badge>
            {lead.has_medicare === 'yes' && (
              <Badge className="bg-green-100 text-green-700 text-xs">
                Medicare ✓
              </Badge>
            )}
            {lead.has_doctor === 'yes' && (
              <Badge className="bg-blue-100 text-blue-700 text-xs">
                Has Dr
              </Badge>
            )}
          </div>
        )}

        {/* Contact Info */}
        <div className="space-y-1.5 mb-3">
          {lead.phone && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate">{lead.phone}</span>
            </div>
          )}
          {lead.email && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {lead.zip_code && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Target className="w-3 h-3 text-slate-400" />
              <span>ZIP: {lead.zip_code}</span>
            </div>
          )}
          {lead.estimated_value > 0 && (
            <div className="flex items-center gap-2 text-sm font-medium text-green-600">
              <DollarSign className="w-3.5 h-3.5" />
              <span>${lead.estimated_value.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!lead.patient_id && status !== 'lost' && status !== 'qualified' && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onConvert(lead);
              }}
            >
              <UserPlus className="w-3 h-3 mr-1.5" />
              Convert to Patient
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Lead Card for Drag Overlay
function LeadCardOverlay({ lead }) {
  return (
    <div className="bg-white dark:bg-navy-800 rounded-xl border-2 border-primary shadow-2xl p-4 w-72">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-navy-700 dark:text-white">
          {lead.first_name} {lead.last_name}
        </h4>
      </div>
      {lead.phone && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Phone className="w-3.5 h-3.5" />
          <span>{lead.phone}</span>
        </div>
      )}
    </div>
  );
}

// Droppable Column Component
function KanbanColumn({ status, leads, onConvert, onCardClick, children }) {
  const statusConfig = LEAD_STATUSES.find(s => s.value === status.value);
  const StatusIcon = statusConfig.icon;
  const leadIds = leads.map(l => l.id);

  // Make the column itself a drop target (critical for cross-column drops)
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: status.value });

  return (
    <div 
      className={`
        flex flex-col w-80 min-w-[320px] rounded-2xl overflow-hidden
        bg-gradient-to-b ${statusConfig.bgLight} dark:from-navy-800 dark:to-navy-900
        border ${statusConfig.borderColor} dark:border-slate-700
        shadow-sm transition-colors duration-150
        ${isOver ? 'ring-2 ring-inset ring-blue-400/60 bg-blue-50/40' : ''}
      `}
      data-testid={`pipeline-${status.value}`}
    >
      {/* Column Header */}
      <div className={`
        p-4 bg-gradient-to-r ${statusConfig.gradient}
        flex items-center justify-between
      `}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <StatusIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{status.label}</h3>
            <p className="text-xs text-white/70">{leads.length} lead{leads.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-white/20 text-white border-0 font-bold">
            {leads.length}
          </Badge>
        </div>
      </div>

      {/* Column Content - Scrollable */}
      <div
        ref={setDropRef}
        className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[calc(100vh-300px)] min-h-[200px]"
      >
        <SortableContext items={leadIds} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <SortableLeadCard
              key={lead.id}
              lead={lead}
              status={status.value}
              onConvert={onConvert}
              onClick={onCardClick}
            />
          ))}
        </SortableContext>

        {/* Empty State */}
        {leads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className={`w-12 h-12 rounded-full ${statusConfig.badgeBg} flex items-center justify-center mb-3`}>
              <StatusIcon className={`w-6 h-6 ${statusConfig.textColor}`} />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No requests in {status.label.toLowerCase()}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Drag requests here or create new ones
            </p>
          </div>
        )}
      </div>

      {/* Column Footer Stats */}
      <div className={`p-3 border-t ${statusConfig.borderColor} dark:border-slate-700 bg-white/50 dark:bg-navy-800/50`}>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {leads.filter(l => l.has_medicare === 'yes').length} Medicare
          </span>
          <span className="flex items-center gap-1 text-green-600 font-medium">
            <DollarSign className="w-3 h-3" />
            ${leads.reduce((sum, l) => sum + (l.estimated_value || 0), 0).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [leadsSnapshot, setLeadsSnapshot] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState('board'); // 'board' or 'list'
  const [listStatusFilter, setListStatusFilter] = useState('all');
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    notes: ''
  });
  
  const [convertData, setConvertData] = useState({
    date_of_birth: '',
    ssn_last_four: '',
    primary_insurance: '',
    secondary_insurance: '',
    address: ''
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/leads`);
      setLeads(response.data);
    } catch (error) {
      toast.error('Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  };

  // Filter leads by search
  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return leads;
    const query = searchQuery.toLowerCase();
    return leads.filter(lead => 
      lead.first_name?.toLowerCase().includes(query) ||
      lead.last_name?.toLowerCase().includes(query) ||
      lead.email?.toLowerCase().includes(query) ||
      lead.phone?.includes(query)
    );
  }, [leads, searchQuery]);

  // Get leads by status
  const getLeadsByStatus = (status) => filteredLeads.filter(l => l.status === status);

  // Find which column a lead is in
  const findContainer = (id) => {
    const lead = leads.find(l => l.id === id);
    return lead?.status;
  };

  // Drag handlers
  const handleDragStart = (event) => {
    setActiveId(event.active.id);
    // Snapshot leads at drag start so we can revert on error
    setLeadsSnapshot(leads);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeLeadId = active.id;
    const overId = over.id;

    const targetStatus = LEAD_STATUSES.find(s => s.value === overId)?.value
      || leads.find(l => l.id === overId)?.status;

    if (!targetStatus) return;

    const activeLead = leads.find(l => l.id === activeLeadId);
    if (!activeLead || activeLead.status === targetStatus) return;

    // Live move while dragging so the card previews in the new column
    setLeads(prev => prev.map(l =>
      l.id === activeLeadId ? { ...l, status: targetStatus } : l
    ));
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeLeadId = active.id;
    const overId = over.id;

    // Resolve which column the card was dropped into:
    // 1. If dropped directly onto a column droppable (id === status.value)
    // 2. If dropped onto another card (find that card's status)
    let targetStatus = LEAD_STATUSES.find(s => s.value === overId)?.value
      || leads.find(l => l.id === overId)?.status;

    if (!targetStatus) return;

    const activeLead = leads.find(l => l.id === activeLeadId);
    if (!activeLead || activeLead.status === targetStatus) return;

    // Optimistic update
    setLeads(prev => prev.map(l =>
      l.id === activeLeadId ? { ...l, status: targetStatus } : l
    ));

    // Persist to server
    try {
      await axios.put(`${API_URL}/api/leads/${activeLeadId}`, { status: targetStatus });
      toast.success(`Moved to ${LEAD_STATUSES.find(s => s.value === targetStatus)?.label}`);
    } catch (error) {
      // Revert to pre-drag snapshot
      setLeads(leadsSnapshot);
      toast.error('Failed to update status');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/leads`, formData);
      toast.success('Lead created successfully');
      setIsCreateOpen(false);
      resetForm();
      fetchLeads();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create lead');
    }
  };

  const handleConvert = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/leads/${selectedLead.id}/convert`, convertData);
      toast.success('Lead converted to patient successfully!');
      setIsConvertOpen(false);
      setConvertData({
        date_of_birth: '',
        ssn_last_four: '',
        primary_insurance: '',
        secondary_insurance: '',
        address: ''
      });
      fetchLeads();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to convert lead');
    }
  };

  // Export leads to CSV
  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await axios.get(`${API_URL}/api/leads/export-csv`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Leads exported successfully');
    } catch (error) {
      toast.error('Failed to export leads');
    } finally {
      setExporting(false);
    }
  };

  // Download sample CSV template
  const handleDownloadTemplate = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/leads/sample-csv`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'leads_import_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Template downloaded');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  // Import leads from CSV
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await axios.post(`${API_URL}/api/leads/import-csv`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(`Imported ${response.data.imported} leads successfully`);
      if (response.data.errors?.length > 0) {
        toast.warning(`${response.data.errors.length} rows had errors`);
      }
      setIsImportOpen(false);
      fetchLeads();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to import leads');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const openConvertDialog = (lead) => {
    setSelectedLead(lead);
    setIsConvertOpen(true);
  };

  const handleCardClick = (leadId) => {
    navigate(`/leads/${leadId}`);
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      phone: '',
      email: '',
      utm_source: '',
      utm_medium: '',
      utm_campaign: '',
      notes: ''
    });
  };

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null;

  // Stats
  const totalLeads = leads.length;
  const totalMedicare = leads.filter(l => l.has_medicare === 'yes').length;
  const convertedCount = leads.filter(l => l.patient_id).length;

  return (
    <div data-testid="leads-page" className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Patient Requests</h1>
          <p className="text-muted-foreground">
            Drag and drop requests between stages • {totalLeads} total requests
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Quick Stats */}
          <div className="hidden md:flex items-center gap-4 mr-4">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-muted-foreground">{convertedCount} converted</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-muted-foreground">{totalMedicare} Medicare</span>
            </div>
          </div>
          
          {/* View Toggle */}
          <div className="flex items-center border rounded-lg p-1 bg-muted/30" data-testid="view-toggle">
            <Button
              variant={viewMode === 'board' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3"
              onClick={() => setViewMode('board')}
              data-testid="view-board-btn"
            >
              <LayoutGrid className="w-4 h-4 mr-1.5" />
              Board
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3"
              onClick={() => setViewMode('list')}
              data-testid="view-list-btn"
            >
              <List className="w-4 h-4 mr-1.5" />
              List
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-48"
            />
          </div>
          
          {/* Import/Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="import-export-btn">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Import/Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleExport} disabled={exporting}>
                {exporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Export All Leads
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsImportOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Import Leads
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadTemplate}>
                <FileDown className="w-4 h-4 mr-2" />
                Download Template
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button onClick={() => setIsCreateOpen(true)} data-testid="create-lead-btn">
            <Plus className="w-4 h-4 mr-2" />
            New Lead
          </Button>
        </div>
      </div>

      {/* Kanban Board or List View */}
      {viewMode === 'board' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6">
            {LEAD_STATUSES.map((status) => (
              <KanbanColumn
                key={status.value}
                status={status}
                leads={getLeadsByStatus(status.value)}
                onConvert={openConvertDialog}
                onCardClick={handleCardClick}
              />
            ))}
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeLead ? <LeadCardOverlay lead={activeLead} /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* List View */
        <div className="space-y-4" data-testid="leads-list-view">
          {/* List Filter */}
          <div className="flex items-center gap-3">
            <Label className="text-sm text-muted-foreground">Filter by Status:</Label>
            <Select value={listStatusFilter} onValueChange={setListStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {LEAD_STATUSES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto text-sm text-muted-foreground">
              {filteredLeads.filter(l => listStatusFilter === 'all' || l.status === listStatusFilter).length} leads
            </div>
          </div>
          
          {/* List Table */}
          <div className="border rounded-lg overflow-hidden bg-white dark:bg-navy-900">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[200px]">Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Medicare</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="w-[120px]">Created</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads
                  .filter(l => listStatusFilter === 'all' || l.status === listStatusFilter)
                  .map((lead) => {
                    const statusConfig = LEAD_STATUSES.find(s => s.value === lead.status) || LEAD_STATUSES[0];
                    return (
                      <TableRow 
                        key={lead.id} 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleCardClick(lead.id)}
                        data-testid={`lead-row-${lead.id}`}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`}></div>
                            {lead.first_name} {lead.last_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {lead.phone && (
                              <div className="flex items-center gap-1.5 text-sm">
                                <Phone className="w-3 h-3 text-muted-foreground" />
                                {lead.phone}
                              </div>
                            )}
                            {lead.email && (
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground truncate max-w-[180px]">
                                <Mail className="w-3 h-3" />
                                {lead.email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${statusConfig.badgeColor} border-0`}>
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {lead.estimated_value > 0 ? (
                            <span className="font-medium text-green-600">
                              ${lead.estimated_value.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {lead.has_medicare === 'yes' ? (
                            <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">
                              Yes
                            </Badge>
                          ) : lead.has_medicare === 'no' ? (
                            <Badge variant="outline" className="bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-400 border-0">
                              No
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {lead.utm_source && (
                              <span className="text-muted-foreground">{lead.utm_source}</span>
                            )}
                            {lead.utm_medium && (
                              <span className="text-muted-foreground"> / {lead.utm_medium}</span>
                            )}
                            {!lead.utm_source && !lead.utm_medium && (
                              <span className="text-muted-foreground">Direct</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(lead.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                {filteredLeads.filter(l => listStatusFilter === 'all' || l.status === listStatusFilter).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      No leads found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* List Summary */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg text-sm">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">
                Total Value: <span className="font-medium text-green-600">
                  ${filteredLeads
                    .filter(l => listStatusFilter === 'all' || l.status === listStatusFilter)
                    .reduce((sum, l) => sum + (l.estimated_value || 0), 0)
                    .toLocaleString()}
                </span>
              </span>
              <span className="text-muted-foreground">
                Medicare: <span className="font-medium text-blue-600">
                  {filteredLeads
                    .filter(l => listStatusFilter === 'all' || l.status === listStatusFilter)
                    .filter(l => l.has_medicare === 'yes').length}
                </span>
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setViewMode('board')}>
              <LayoutGrid className="w-4 h-4 mr-1.5" />
              Switch to Board View
            </Button>
          </div>
        </div>
      )}

      {/* Create Lead Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
            <DialogDescription>Enter lead contact information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                  data-testid="lead-firstname-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                  data-testid="lead-lastname-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  data-testid="lead-phone-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>UTM Source</Label>
                <Input
                  placeholder="google"
                  value={formData.utm_source}
                  onChange={(e) => setFormData({ ...formData, utm_source: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>UTM Medium</Label>
                <Input
                  placeholder="cpc"
                  value={formData.utm_medium}
                  onChange={(e) => setFormData({ ...formData, utm_medium: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>UTM Campaign</Label>
                <Input
                  placeholder="spring_promo"
                  value={formData.utm_campaign}
                  onChange={(e) => setFormData({ ...formData, utm_campaign: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="lead-submit-btn">Create Lead</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Convert to Patient Dialog */}
      <Dialog open={isConvertOpen} onOpenChange={setIsConvertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert Lead to Patient</DialogTitle>
            <DialogDescription>
              Convert {selectedLead?.first_name} {selectedLead?.last_name} to a patient record
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConvert} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input
                  type="date"
                  value={convertData.date_of_birth}
                  onChange={(e) => setConvertData({ ...convertData, date_of_birth: e.target.value })}
                  required
                  data-testid="convert-dob-input"
                />
              </div>
              <div className="space-y-2">
                <Label>SSN (Last 4 digits)</Label>
                <Input
                  maxLength={4}
                  placeholder="1234"
                  value={convertData.ssn_last_four}
                  onChange={(e) => setConvertData({ ...convertData, ssn_last_four: e.target.value.replace(/\D/g, '') })}
                  required
                  data-testid="convert-ssn-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Primary Insurance</Label>
                <Input
                  value={convertData.primary_insurance}
                  onChange={(e) => setConvertData({ ...convertData, primary_insurance: e.target.value })}
                  required
                  data-testid="convert-insurance-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Secondary Insurance</Label>
                <Input
                  value={convertData.secondary_insurance}
                  onChange={(e) => setConvertData({ ...convertData, secondary_insurance: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={convertData.address}
                onChange={(e) => setConvertData({ ...convertData, address: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsConvertOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="convert-submit-btn">
                <ArrowRight className="w-4 h-4 mr-2" />
                Convert to Patient
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Leads Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Leads from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import multiple leads at once
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* CSV Format Info */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                CSV Format
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Your CSV file should include the following columns:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-white dark:bg-navy-800 rounded border">
                  <span className="font-medium text-green-600">first_name</span> (required)
                </div>
                <div className="p-2 bg-white dark:bg-navy-800 rounded border">
                  <span className="font-medium text-green-600">last_name</span> (required)
                </div>
                <div className="p-2 bg-white dark:bg-navy-800 rounded border">
                  <span className="font-medium text-green-600">phone</span> (required)
                </div>
                <div className="p-2 bg-white dark:bg-navy-800 rounded border">
                  <span className="font-medium">email</span> (optional)
                </div>
                <div className="p-2 bg-white dark:bg-navy-800 rounded border">
                  <span className="font-medium">status</span> (optional)
                </div>
                <div className="p-2 bg-white dark:bg-navy-800 rounded border">
                  <span className="font-medium">zip_code</span> (optional)
                </div>
                <div className="p-2 bg-white dark:bg-navy-800 rounded border">
                  <span className="font-medium">utm_source</span> (optional)
                </div>
                <div className="p-2 bg-white dark:bg-navy-800 rounded border">
                  <span className="font-medium">utm_medium</span> (optional)
                </div>
                <div className="p-2 bg-white dark:bg-navy-800 rounded border">
                  <span className="font-medium">utm_campaign</span> (optional)
                </div>
                <div className="p-2 bg-white dark:bg-navy-800 rounded border">
                  <span className="font-medium">notes</span> (optional)
                </div>
                <div className="p-2 bg-white dark:bg-navy-800 rounded border">
                  <span className="font-medium">pain_location</span> (optional)
                </div>
                <div className="p-2 bg-white dark:bg-navy-800 rounded border">
                  <span className="font-medium">has_medicare</span> (yes/no)
                </div>
              </div>
            </div>

            {/* Download Template Button */}
            <Button variant="outline" className="w-full" onClick={handleDownloadTemplate}>
              <FileDown className="w-4 h-4 mr-2" />
              Download Sample Template
            </Button>

            {/* File Upload */}
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleImport}
                className="hidden"
                id="csv-upload"
              />
              <FileUp className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer text-primary hover:underline font-medium"
              >
                Click to upload CSV
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                or drag and drop your file here
              </p>
            </div>

            {importing && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing leads...
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
