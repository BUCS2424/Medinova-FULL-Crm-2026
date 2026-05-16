import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Globe,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Download,
  Edit2,
  MapPin,
  Building2,
  Heart,
  Database,
  Users,
  Star,
  ChevronRight,
  Loader2
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('dme_token')}`
});

const STATUS_CONFIG = {
  not_submitted: { label: 'Not Submitted', color: 'bg-gray-100 text-gray-700', icon: Globe },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700', icon: Clock },
  pending_verification: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: RefreshCw },
  verified: { label: 'Verified', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  needs_update: { label: 'Needs Update', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle }
};

const CATEGORY_ICONS = {
  'Search & Maps': MapPin,
  'Social & Reviews': Users,
  'General Directories': Building2,
  'Local & Maps': MapPin,
  'Healthcare': Heart,
  'Data Aggregators': Database,
  'Industry': Building2,
  'Local Community': Users,
  'Business Profiles': Building2
};

export default function DirectorySubmissionManager() {
  const [directories, setDirectories] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [editingDirectory, setEditingDirectory] = useState(null);
  const [selectedDirectories, setSelectedDirectories] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dirRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/api/directories`, { headers: getHeaders() }),
        axios.get(`${API_URL}/api/directories/stats`, { headers: getHeaders() })
      ]);
      setDirectories(dirRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error('Failed to fetch directories');
    } finally {
      setLoading(false);
    }
  };

  const updateDirectory = async (directoryId, data) => {
    try {
      await axios.put(`${API_URL}/api/directories/${directoryId}`, data, { headers: getHeaders() });
      toast.success('Directory updated');
      fetchData();
      setEditingDirectory(null);
    } catch (error) {
      toast.error('Failed to update directory');
    }
  };

  const handleBulkUpdate = async (status) => {
    if (selectedDirectories.length === 0) {
      toast.error('Select directories first');
      return;
    }
    try {
      await axios.post(`${API_URL}/api/directories/bulk-update`, {
        directory_ids: selectedDirectories,
        status
      }, { headers: getHeaders() });
      toast.success(`Updated ${selectedDirectories.length} directories`);
      setSelectedDirectories([]);
      fetchData();
    } catch (error) {
      toast.error('Failed to bulk update');
    }
  };

  const handleExport = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/directories/export`, { headers: getHeaders() });
      const blob = new Blob([response.data.csv_data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.data.filename;
      a.click();
      toast.success('Export downloaded');
    } catch (error) {
      toast.error('Failed to export');
    }
  };

  const filteredDirectories = directories.filter(dir => {
    const matchesSearch = dir.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         dir.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || dir.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || dir.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || dir.priority === parseInt(filterPriority);
    return matchesSearch && matchesCategory && matchesStatus && matchesPriority;
  });

  const categories = [...new Set(directories.map(d => d.category))];

  const toggleSelectAll = () => {
    if (selectedDirectories.length === filteredDirectories.length) {
      setSelectedDirectories([]);
    } else {
      setSelectedDirectories(filteredDirectories.map(d => d.id));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="directory-submission-manager">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Directory Submission Tool</h2>
          <p className="text-muted-foreground">Submit your business to {directories.length} free US directories</p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Total Directories</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-green-600">{stats.verified}</div>
              <p className="text-xs text-muted-foreground">Verified</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.submitted}</div>
              <p className="text-xs text-muted-foreground">Submitted</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-orange-600">{stats.needs_update}</div>
              <p className="text-xs text-muted-foreground">Needs Update</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-gray-600">{stats.not_submitted}</div>
              <p className="text-xs text-muted-foreground">Not Submitted</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-primary">{stats.completion_percentage}%</div>
              <p className="text-xs text-muted-foreground">Complete</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Progress Bar */}
      {stats && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Submission Progress</span>
              <span className="text-sm text-muted-foreground">
                {stats.verified + stats.submitted + stats.pending} / {stats.total} directories
              </span>
            </div>
            <Progress value={stats.completion_percentage} className="h-3" />
          </CardContent>
        </Card>
      )}

      {/* Filters & Search */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search directories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="not_submitted">Not Submitted</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="pending_verification">Pending</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="needs_update">Needs Update</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="1">Priority 1 (High)</SelectItem>
                <SelectItem value="2">Priority 2 (Medium)</SelectItem>
                <SelectItem value="3">Priority 3 (Low)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedDirectories.length > 0 && (
        <Card className="border-primary">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{selectedDirectories.length} directories selected</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleBulkUpdate('submitted')}>
                  Mark Submitted
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkUpdate('verified')}>
                  Mark Verified
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedDirectories([])}>
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Directory Tabs by Category */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="all" className="text-xs">All ({directories.length})</TabsTrigger>
          {categories.map(cat => {
            const count = directories.filter(d => d.category === cat).length;
            return (
              <TabsTrigger key={cat} value={cat} className="text-xs">
                {cat} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="all">
          <DirectoryList 
            directories={filteredDirectories}
            selectedDirectories={selectedDirectories}
            setSelectedDirectories={setSelectedDirectories}
            setEditingDirectory={setEditingDirectory}
            toggleSelectAll={toggleSelectAll}
          />
        </TabsContent>

        {categories.map(cat => (
          <TabsContent key={cat} value={cat}>
            <DirectoryList 
              directories={filteredDirectories.filter(d => d.category === cat)}
              selectedDirectories={selectedDirectories}
              setSelectedDirectories={setSelectedDirectories}
              setEditingDirectory={setEditingDirectory}
              toggleSelectAll={toggleSelectAll}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editingDirectory} onOpenChange={() => setEditingDirectory(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              {editingDirectory?.name}
            </DialogTitle>
            <DialogDescription>{editingDirectory?.description}</DialogDescription>
          </DialogHeader>
          
          {editingDirectory && (
            <EditDirectoryForm 
              directory={editingDirectory} 
              onSave={updateDirectory}
              onCancel={() => setEditingDirectory(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DirectoryList({ directories, selectedDirectories, setSelectedDirectories, setEditingDirectory, toggleSelectAll }) {
  const toggleSelect = (id) => {
    setSelectedDirectories(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  return (
    <Card>
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center gap-4 p-4 border-b bg-muted/50">
          <input
            type="checkbox"
            checked={selectedDirectories.length === directories.length && directories.length > 0}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm text-muted-foreground">
            {directories.length} directories
          </span>
        </div>

        {/* Directory Items */}
        <div className="divide-y">
          {directories.map(dir => {
            const StatusIcon = STATUS_CONFIG[dir.status]?.icon || Globe;
            const CategoryIcon = CATEGORY_ICONS[dir.category] || Building2;
            
            return (
              <div
                key={dir.id}
                className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedDirectories.includes(dir.id)}
                  onChange={() => toggleSelect(dir.id)}
                  className="w-4 h-4 rounded"
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{dir.name}</span>
                    {dir.priority === 1 && (
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{dir.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      <CategoryIcon className="w-3 h-3 mr-1" />
                      {dir.category}
                    </Badge>
                    {dir.submitted_date && (
                      <span className="text-xs text-muted-foreground">
                        Submitted: {new Date(dir.submitted_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <Badge className={STATUS_CONFIG[dir.status]?.color}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {STATUS_CONFIG[dir.status]?.label}
                </Badge>

                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditingDirectory(dir)}
                    data-testid={`edit-directory-${dir.id}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => window.open(dir.url, '_blank')}
                    data-testid={`open-directory-${dir.id}`}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {directories.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No directories match your filters
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EditDirectoryForm({ directory, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    status: directory.status || 'not_submitted',
    submitted_date: directory.submitted_date || '',
    verified_date: directory.verified_date || '',
    listing_url: directory.listing_url || '',
    username: directory.username || '',
    notes: directory.notes || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(directory.id, formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="not_submitted">Not Submitted</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="pending_verification">Pending Verification</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="needs_update">Needs Update</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Listing URL</Label>
        <Input
          placeholder="https://..."
          value={formData.listing_url}
          onChange={(e) => setFormData({...formData, listing_url: e.target.value})}
        />
      </div>

      <div className="space-y-2">
        <Label>Username/Email Used</Label>
        <Input
          placeholder="Account used for this directory"
          value={formData.username}
          onChange={(e) => setFormData({...formData, username: e.target.value})}
        />
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          placeholder="Any notes about this submission..."
          value={formData.notes}
          onChange={(e) => setFormData({...formData, notes: e.target.value})}
          rows={3}
        />
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => window.open(directory.url, '_blank')}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Open Directory
        </Button>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Save Changes
        </Button>
      </DialogFooter>
    </form>
  );
}
