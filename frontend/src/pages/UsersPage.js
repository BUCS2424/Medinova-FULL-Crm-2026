import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import { Skeleton } from '../components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Users, Edit, Trash2, Shield, UserCheck, MoreHorizontal, LogIn, Crown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Super admin email - protected from impersonation
const SUPER_ADMIN_EMAIL = 'mel@a2gdesigns.com';

// Default role colors (for roles without custom colors)
const ROLE_COLORS = {
  'admin': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  'administrator': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  'sales_rep': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'doctor': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'patient': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  'office_manager': 'bg-lime-100 text-amber-800 dark:bg-amber-900/30 dark:text-lime-400',
};

const DEFAULT_ROLE_COLOR = 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';

export default function UsersPage({ embedded = false }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [impersonating, setImpersonating] = useState(false);
  const { user: currentUser, impersonateUser } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'sales_rep',
    is_active: true
  });

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users`);
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem('dme_token');
      const response = await axios.get(`${API_URL}/api/roles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRoles(response.data);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
      // Fallback to default roles if fetch fails
      setRoles([
        { name: 'admin', display_name: 'Admin' },
        { name: 'sales_rep', display_name: 'Sales Rep' },
        { name: 'doctor', display_name: 'Doctor' },
        { name: 'patient', display_name: 'Patient' }
      ]);
    }
  };

  const getRoleColor = (roleName) => {
    return ROLE_COLORS[roleName] || DEFAULT_ROLE_COLOR;
  };

  const getRoleDisplayName = (roleName) => {
    const role = roles.find(r => r.name === roleName);
    return role?.display_name || roleName?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown';
  };

  const handleImpersonate = async (user) => {
    if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      toast.error('Cannot impersonate super admin');
      return;
    }
    if (user.id === currentUser?.id) {
      toast.error('Cannot impersonate yourself');
      return;
    }
    
    setImpersonating(true);
    try {
      await impersonateUser(user.id);
      toast.success(`Now viewing as ${user.first_name} ${user.last_name}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to impersonate user');
    } finally {
      setImpersonating(false);
    }
  };

  const isSuperAdmin = (email) => email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      // Use admin user creation endpoint instead of public register
      await axios.post(`${API_URL}/api/users`, formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('dme_token')}` }
      });
      toast.success('User created successfully');
      setIsCreateOpen(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const { password, ...updateData } = formData;
      await axios.put(`${API_URL}/api/users/${selectedUser.id}`, updateData);
      toast.success('User updated successfully');
      setIsEditOpen(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update user');
    }
  };

  const handleDelete = async (userId) => {
    if (userId === currentUser?.id) {
      toast.error("You cannot delete your own account");
      return;
    }
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/users/${userId}`);
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  const openEditDialog = (user) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      password: '',
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      is_active: user.is_active
    });
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      role: 'sales_rep',
      is_active: true
    });
    setSelectedUser(null);
  };

  const getRoleBadgeClass = (role) => {
    return getRoleColor(role);
  };

  return (
    <div data-testid="users-page" className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Manage users and role-based access control (RBAC)</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <Button onClick={() => setIsCreateOpen(true)} data-testid="create-user-btn">
            <Plus className="w-4 h-4 mr-2" />
            Add User
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Create a new user account with role assignment</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                    data-testid="user-firstname-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                    data-testid="user-lastname-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  data-testid="user-email-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  data-testid="user-password-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger data-testid="user-role-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.name} value={role.name}>
                        {role.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" data-testid="user-submit-btn">Create User</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* RBAC Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {roles.slice(0, 4).map((role) => (
          <Card key={role.name}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{role.display_name}</p>
                  <p className="text-2xl font-bold mt-1">
                    {users.filter(u => u.role === role.name).length}
                  </p>
                </div>
                <div className={`p-2 rounded-lg ${getRoleColor(role.name).split(' ').slice(0, 2).join(' ')}`}>
                  {role.name === 'admin' || role.name === 'administrator' ? <Shield className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : users && users.length > 0 ? (
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {user.first_name} {user.last_name}
                        {user.id === currentUser?.id && (
                          <Badge variant="outline" className="text-xs">You</Badge>
                        )}
                        {isSuperAdmin(user.email) && (
                          <Badge className="bg-lime-100 text-lime-700 text-xs flex items-center gap-1">
                            <Crown className="w-3 h-3" />
                            Super Admin
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge className={`${getRoleBadgeClass(user.role)} capitalize`}>
                        {getRoleDisplayName(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? 'default' : 'secondary'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(user)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit User
                          </DropdownMenuItem>
                          {!isSuperAdmin(user.email) && user.id !== currentUser?.id && (
                            <DropdownMenuItem 
                              onClick={() => handleImpersonate(user)}
                              disabled={impersonating}
                            >
                              <LogIn className="w-4 h-4 mr-2" />
                              Login as User
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(user.id)}
                            disabled={user.id === currentUser?.id || isSuperAdmin(user.email)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="empty-state">
              <Users className="empty-state-icon" />
              <h3 className="font-semibold mb-1">No users found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get started by adding your first user
              </p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information and role</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.name} value={role.name}>
                      {role.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.is_active ? 'active' : 'inactive'}
                onValueChange={(value) => setFormData({ ...formData, is_active: value === 'active' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
