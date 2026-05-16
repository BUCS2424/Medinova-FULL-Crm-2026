import { useState, useRef } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from './ui/alert';
import { toast } from 'sonner';
import {
  Database,
  Download,
  Upload,
  Users,
  UserPlus,
  ClipboardList,
  FileText,
  Stethoscope,
  Building2,
  Package,
  ScrollText,
  BarChart3,
  Shield,
  AlertTriangle,
  Loader2,
  CheckCircle,
  HardDrive,
  FileJson,
  Trash2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Super admin and store owner emails
const SUPER_ADMIN_EMAIL = 'mel@a2gdesigns.com';

// Collections available for export
const COLLECTIONS = [
  { id: 'patients', label: 'Patients', icon: Users, description: 'Patient records and medical info' },
  { id: 'leads', label: 'Patient Requests', icon: UserPlus, description: 'Patient request pipeline data' },
  { id: 'orders', label: 'Orders', icon: ClipboardList, description: 'Order history and status' },
  { id: 'documents', label: 'Documents', icon: FileText, description: 'Document metadata' },
  { id: 'users', label: 'Users', icon: Shield, description: 'User accounts (passwords excluded)' },
  { id: 'suppliers', label: 'Suppliers', icon: Building2, description: 'Supplier information' },
  { id: 'products', label: 'Products', icon: Package, description: 'Product catalog' },
  { id: 'audit_logs', label: 'Audit Logs', icon: ScrollText, description: 'System activity logs' },
  { id: 'analytics_events', label: 'Analytics', icon: BarChart3, description: 'Site traffic data' },
  { id: 'site_settings', label: 'Settings', icon: Database, description: 'Site configuration' },
  { id: 'site_rules', label: 'Site Rules', icon: FileJson, description: 'Business rules' },
  { id: 'signatures', label: 'Signatures', icon: FileText, description: 'E-signature records' },
];

export default function DatabaseManager() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  
  const [exporting, setExporting] = useState({});
  const [exportingAll, setExportingAll] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [dbStats, setDbStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Check if user has permission
  const isSuperAdmin = user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const isStoreOwner = user?.role === 'store_owner';
  const hasPermission = isSuperAdmin || isStoreOwner;

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  // Fetch database stats
  const fetchDbStats = async () => {
    setLoadingStats(true);
    try {
      const response = await axios.get(`${API_URL}/api/dev/database/stats`, { headers: getHeaders() });
      setDbStats(response.data);
    } catch (error) {
      toast.error('Failed to fetch database stats');
    } finally {
      setLoadingStats(false);
    }
  };

  // Export single collection
  const handleExportCollection = async (collectionId) => {
    setExporting(prev => ({ ...prev, [collectionId]: true }));
    try {
      const response = await axios.get(
        `${API_URL}/api/dev/database/export/${collectionId}`,
        { 
          headers: getHeaders(),
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${collectionId}_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`${collectionId} exported successfully`);
    } catch (error) {
      toast.error(`Failed to export ${collectionId}`);
    } finally {
      setExporting(prev => ({ ...prev, [collectionId]: false }));
    }
  };

  // Export entire database
  const handleExportAll = async () => {
    setExportingAll(true);
    try {
      const response = await axios.get(
        `${API_URL}/api/dev/database/export-all`,
        { 
          headers: getHeaders(),
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `full_database_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Full database exported successfully');
    } catch (error) {
      toast.error('Failed to export database');
    } finally {
      setExportingAll(false);
    }
  };

  // Handle file selection for import
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.json')) {
        toast.error('Please select a JSON file');
        return;
      }
      setSelectedFile(file);
      setConfirmImportOpen(true);
    }
  };

  // Import database
  const handleImport = async () => {
    if (!selectedFile) return;
    
    setImporting(true);
    setImportProgress(10);
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    try {
      setImportProgress(30);
      const response = await axios.post(
        `${API_URL}/api/dev/database/import`,
        formData,
        { 
          headers: { 
            ...getHeaders(),
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      setImportProgress(100);
      toast.success(`Import completed: ${response.data.imported_collections} collections imported`);
      setConfirmImportOpen(false);
      setSelectedFile(null);
      fetchDbStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to import database');
    } finally {
      setImporting(false);
      setImportProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Clear collection
  const handleClearCollection = async () => {
    if (!collectionToDelete) return;
    
    setDeleting(true);
    try {
      await axios.delete(
        `${API_URL}/api/dev/database/clear/${collectionToDelete}`,
        { headers: getHeaders() }
      );
      toast.success(`${collectionToDelete} cleared successfully`);
      setConfirmDeleteOpen(false);
      setCollectionToDelete(null);
      fetchDbStats();
    } catch (error) {
      toast.error(`Failed to clear ${collectionToDelete}`);
    } finally {
      setDeleting(false);
    }
  };

  // Permission denied view
  if (!hasPermission) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md text-center">
          <CardHeader>
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle>Access Restricted</CardTitle>
            <CardDescription>
              Database management is only available to Super Admins and Store Owners.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Contact your administrator if you need access to this feature.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6" />
            Database Management
          </h2>
          <p className="text-muted-foreground">
            Export, import, and manage your database collections
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchDbStats} disabled={loadingStats}>
            {loadingStats ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <HardDrive className="w-4 h-4 mr-2" />}
            Refresh Stats
          </Button>
        </div>
      </div>

      {/* Warning Alert */}
      <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-200">Sensitive Operations</AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300">
          Database operations can affect your entire system. Always create a backup before importing data.
          Passwords and sensitive tokens are excluded from exports for security.
        </AlertDescription>
      </Alert>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2 border-dashed hover:border-primary/50 transition-colors">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <Download className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold mb-2">Export Full Backup</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Download entire database as JSON
            </p>
            <Button onClick={handleExportAll} disabled={exportingAll} className="w-full">
              {exportingAll ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Export All Data
            </Button>
          </CardContent>
        </Card>

        <Card className="border-2 border-dashed hover:border-primary/50 transition-colors">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Upload className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold mb-2">Import Database</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Restore from a backup file
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
              id="db-import"
            />
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Select File
            </Button>
          </CardContent>
        </Card>

        <Card className="border-2 border-dashed hover:border-primary/50 transition-colors">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
              <HardDrive className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold mb-2">Database Stats</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {dbStats ? `${dbStats.total_documents.toLocaleString()} total records` : 'Click to load stats'}
            </p>
            <Button variant="secondary" onClick={fetchDbStats} disabled={loadingStats} className="w-full">
              {loadingStats ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <BarChart3 className="w-4 h-4 mr-2" />
              )}
              View Stats
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Collections Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Export Individual Collections</CardTitle>
          <CardDescription>
            Download specific data collections as JSON files
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {COLLECTIONS.map((collection) => {
              const Icon = collection.icon;
              const stats = dbStats?.collections?.[collection.id];
              
              return (
                <div 
                  key={collection.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{collection.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {stats ? `${stats.count.toLocaleString()} records` : collection.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExportCollection(collection.id)}
                      disabled={exporting[collection.id]}
                    >
                      {exporting[collection.id] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </Button>
                    {isSuperAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setCollectionToDelete(collection.id);
                          setConfirmDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Database Stats Display */}
      {dbStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Database Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-3xl font-bold">{dbStats.total_documents.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Records</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-3xl font-bold">{Object.keys(dbStats.collections).length}</p>
                <p className="text-sm text-muted-foreground">Collections</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-3xl font-bold">{dbStats.collections.patients?.count || 0}</p>
                <p className="text-sm text-muted-foreground">Patients</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-3xl font-bold">{dbStats.collections.orders?.count || 0}</p>
                <p className="text-sm text-muted-foreground">Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Confirmation Dialog */}
      <Dialog open={confirmImportOpen} onOpenChange={setConfirmImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Confirm Database Import
            </DialogTitle>
            <DialogDescription>
              This action will merge or overwrite existing data. Make sure you have a backup.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-muted/50 rounded-lg mb-4">
              <p className="text-sm font-medium">Selected file:</p>
              <p className="text-sm text-muted-foreground">{selectedFile?.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Size: {selectedFile ? (selectedFile.size / 1024).toFixed(2) + ' KB' : 'N/A'}
              </p>
            </div>
            {importing && (
              <div className="space-y-2">
                <Progress value={importProgress} />
                <p className="text-xs text-center text-muted-foreground">
                  Importing... {importProgress}%
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmImportOpen(false)} disabled={importing}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={importing} className="bg-amber-600 hover:bg-amber-700">
              {importing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Confirm Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Collection Confirmation Dialog */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Clear Collection
            </DialogTitle>
            <DialogDescription>
              This will permanently delete ALL records in the <strong>{collectionToDelete}</strong> collection.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                You are about to delete all data from {collectionToDelete}. 
                Consider exporting a backup first.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearCollection} disabled={deleting}>
              {deleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete All Records
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
