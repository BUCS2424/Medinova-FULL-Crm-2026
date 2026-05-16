import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { toast } from 'sonner';
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Users,
  UserPlus,
  ShoppingCart,
  FileText,
  Stethoscope,
  Building2,
  Calculator,
  BarChart3,
  ScrollText,
  Settings,
  FolderOpen,
  MessageSquare,
  Save,
  Lock,
  Check,
  X
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Permission categories with icons and labels
const PERMISSION_CATEGORIES = {
  patients: { label: 'Patients', icon: Users, actions: ['view', 'create', 'edit', 'delete'] },
  leads: { label: 'Patient Requests', icon: UserPlus, actions: ['view', 'create', 'edit', 'delete'] },
  orders: { label: 'Orders', icon: ShoppingCart, actions: ['view', 'create', 'edit', 'delete'] },
  documents: { label: 'Documents', icon: FileText, actions: ['view', 'create', 'edit', 'delete'] },
  doctors: { label: 'Doctors', icon: Stethoscope, actions: ['view', 'create', 'edit', 'delete'] },
  suppliers: { label: 'Suppliers', icon: Building2, actions: ['view', 'create', 'edit', 'delete'] },
  insurance: { label: 'Insurance', icon: Shield, actions: ['view', 'create', 'edit', 'delete'] },
  users: { label: 'User Management', icon: Users, actions: ['view', 'create', 'edit', 'delete', 'impersonate'] },
  accounting: { label: 'Accounting', icon: Calculator, actions: ['view', 'manage_expenses', 'view_reports'] },
  analytics: { label: 'Analytics', icon: BarChart3, actions: ['view'] },
  audit_logs: { label: 'Audit Logs', icon: ScrollText, actions: ['view'] },
  settings: { label: 'Settings', icon: Settings, actions: ['admin_access', 'dev_access'] },
  files: { label: 'Files', icon: FolderOpen, actions: ['view', 'upload', 'edit', 'delete'] },
  notes: { label: 'Notes', icon: MessageSquare, actions: ['view', 'create', 'delete'] }
};

// Human readable action labels
const ACTION_LABELS = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  impersonate: 'Impersonate',
  manage_expenses: 'Manage Expenses',
  view_reports: 'View Reports',
  admin_access: 'Admin Access',
  dev_access: 'Dev Access',
  upload: 'Upload'
};

export default function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Create dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRole, setNewRole] = useState({
    name: '',
    display_name: '',
    description: '',
    permissions: {}
  });
  
  // Edit dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  
  // Permission template
  const [permissionTemplate, setPermissionTemplate] = useState({});

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  }, []);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, templateRes] = await Promise.all([
        axios.get(`${API_URL}/api/roles`, { headers: getHeaders() }),
        axios.get(`${API_URL}/api/roles/permissions/template`, { headers: getHeaders() })
      ]);
      setRoles(rolesRes.data);
      setPermissionTemplate(templateRes.data);
      setNewRole(prev => ({ ...prev, permissions: templateRes.data }));
    } catch (error) {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleCreateRole = async () => {
    if (!newRole.name || !newRole.display_name) {
      toast.error('Name and display name are required');
      return;
    }
    
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/roles`, newRole, { headers: getHeaders() });
      toast.success('Role created successfully');
      setIsCreateOpen(false);
      setNewRole({ name: '', display_name: '', description: '', permissions: permissionTemplate });
      fetchRoles();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create role');
    } finally {
      setSaving(false);
    }
  };

  const handleEditRole = (role) => {
    setEditingRole({ ...role });
    setIsEditOpen(true);
  };

  const handleSaveRole = async () => {
    if (!editingRole) return;
    
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/roles/${editingRole.id}`, {
        display_name: editingRole.display_name,
        description: editingRole.description,
        permissions: editingRole.permissions
      }, { headers: getHeaders() });
      
      toast.success('Role updated successfully');
      setIsEditOpen(false);
      setEditingRole(null);
      fetchRoles();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (role) => {
    if (role.is_system) {
      toast.error('Cannot delete system roles');
      return;
    }
    
    if (!window.confirm(`Are you sure you want to delete the "${role.display_name}" role?`)) {
      return;
    }
    
    try {
      await axios.delete(`${API_URL}/api/roles/${role.id}`, { headers: getHeaders() });
      toast.success('Role deleted successfully');
      fetchRoles();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete role');
    }
  };

  const togglePermission = (permissions, category, action) => {
    return {
      ...permissions,
      [category]: {
        ...permissions[category],
        [action]: !permissions[category]?.[action]
      }
    };
  };

  const toggleAllInCategory = (permissions, category, value) => {
    const actions = PERMISSION_CATEGORIES[category]?.actions || [];
    return {
      ...permissions,
      [category]: actions.reduce((acc, action) => ({ ...acc, [action]: value }), {})
    };
  };

  const countPermissions = (permissions) => {
    let count = 0;
    Object.values(permissions || {}).forEach(category => {
      Object.values(category || {}).forEach(value => {
        if (value) count++;
      });
    });
    return count;
  };

  const PermissionEditor = ({ permissions, onChange, disabled = false }) => (
    <Accordion type="multiple" className="w-full">
      {Object.entries(PERMISSION_CATEGORIES).map(([key, { label, icon: Icon, actions }]) => {
        const categoryPermissions = permissions?.[key] || {};
        const enabledCount = Object.values(categoryPermissions).filter(Boolean).length;
        const allEnabled = enabledCount === actions.length;
        
        return (
          <AccordionItem key={key} value={key}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span>{label}</span>
                </div>
                <Badge variant={enabledCount > 0 ? "default" : "outline"} className="ml-auto mr-4">
                  {enabledCount}/{actions.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pl-7 space-y-3">
                {/* Toggle all */}
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm font-medium">Enable All</span>
                  <Switch
                    checked={allEnabled}
                    onCheckedChange={(checked) => onChange(toggleAllInCategory(permissions, key, checked))}
                    disabled={disabled}
                  />
                </div>
                
                {/* Individual permissions */}
                {actions.map(action => (
                  <div key={action} className="flex items-center justify-between py-1">
                    <span className="text-sm">{ACTION_LABELS[action] || action}</span>
                    <Switch
                      checked={categoryPermissions[action] || false}
                      onCheckedChange={() => onChange(togglePermission(permissions, key, action))}
                      disabled={disabled}
                    />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="role-management">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Role Management
          </h2>
          <p className="text-muted-foreground">
            Create and manage user roles with granular permissions
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="create-role-btn">
          <Plus className="w-4 h-4 mr-2" />
          Create Role
        </Button>
      </div>

      {/* Roles Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map(role => (
          <Card key={role.id} className="relative" data-testid={`role-card-${role.name}`}>
            {role.is_system && (
              <Badge className="absolute top-3 right-3 bg-blue-100 text-blue-700" variant="outline">
                <Lock className="w-3 h-3 mr-1" />
                System
              </Badge>
            )}
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                {role.display_name}
              </CardTitle>
              <CardDescription>{role.description || 'No description'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Permission summary */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-green-500" />
                  {countPermissions(role.permissions)} permissions enabled
                </div>
                
                {/* Quick permission preview */}
                <div className="flex flex-wrap gap-1">
                  {Object.entries(role.permissions || {}).map(([cat, perms]) => {
                    const enabled = Object.values(perms || {}).some(Boolean);
                    if (!enabled) return null;
                    return (
                      <Badge key={cat} variant="outline" className="text-xs">
                        {PERMISSION_CATEGORIES[cat]?.label || cat}
                      </Badge>
                    );
                  })}
                </div>
                
                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleEditRole(role)}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  {!role.is_system && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteRole(role)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Role Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>
              Define a new role with custom permissions
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role-name">Role Name *</Label>
                <Input
                  id="role-name"
                  value={newRole.name}
                  onChange={(e) => setNewRole(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., biller"
                />
                <p className="text-xs text-muted-foreground">
                  Used internally (lowercase, no spaces)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-display-name">Display Name *</Label>
                <Input
                  id="role-display-name"
                  value={newRole.display_name}
                  onChange={(e) => setNewRole(prev => ({ ...prev, display_name: e.target.value }))}
                  placeholder="e.g., Biller"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                value={newRole.description}
                onChange={(e) => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this role can do..."
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="border rounded-lg p-4 max-h-[400px] overflow-y-auto">
                <PermissionEditor
                  permissions={newRole.permissions}
                  onChange={(perms) => setNewRole(prev => ({ ...prev, permissions: perms }))}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRole} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Role
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Role: {editingRole?.display_name}</DialogTitle>
            <DialogDescription>
              {editingRole?.is_system 
                ? "System roles have limited editing - you can modify permissions but not delete the role"
                : "Modify the role's name, description, and permissions"}
            </DialogDescription>
          </DialogHeader>
          
          {editingRole && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role Name</Label>
                  <Input value={editingRole.name} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-display-name">Display Name</Label>
                  <Input
                    id="edit-display-name"
                    value={editingRole.display_name}
                    onChange={(e) => setEditingRole(prev => ({ ...prev, display_name: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editingRole.description || ''}
                  onChange={(e) => setEditingRole(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="border rounded-lg p-4 max-h-[400px] overflow-y-auto">
                  <PermissionEditor
                    permissions={editingRole.permissions}
                    onChange={(perms) => setEditingRole(prev => ({ ...prev, permissions: perms }))}
                  />
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRole} disabled={saving}>
              {saving ? (
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
