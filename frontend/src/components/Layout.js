import { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSidebar } from '../contexts/SidebarContext';
import { useFeatures } from '../contexts/FeatureContext';
import { useBranding } from '../contexts/BrandingContext';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  ClipboardList,
  Package,
  FileText,
  Shield,
  Settings,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  Building2,
  Code,
  PanelLeftClose,
  PanelLeft,
  Stethoscope,
  Bell,
  MessageSquare,
  MessageCircle,
  Phone,
  Volume2,
  VolumeX,
  Mail,
  UserCog,
  Headphones,
  Ticket,
  PhoneCall,
  ExternalLink,
  Newspaper
} from 'lucide-react';
import axios from 'axios';
import SlideOutDialer from './SlideOutDialer';
import GlobalCommunicationPanel from './GlobalCommunicationPanel';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/stay-up-to-date', icon: Newspaper, label: 'Stay Up To Date' },
  { to: '/patients', icon: Users, label: 'Patients' },
  { to: '/leads', icon: UserPlus, label: 'Patient Requests' },
  { to: '/orders', icon: ClipboardList, label: 'Orders' },
  { to: '/support-tickets', icon: Ticket, label: 'Support Tickets' },
  { to: '/documents', icon: FileText, label: 'Documents' },
];

// Fax Center visible to admin, sales_manager (checked in render)
const faxNavItem = { to: '/fax-center', icon: Phone, label: 'Fax Center' };

// Newsletter - admin only
const newsletterNavItem = { to: '/newsletter', icon: Mail, label: 'Newsletter' };

// Doctors Directory - shown when feature is enabled
const doctorsNavItem = { to: '/doctors', icon: Stethoscope, label: 'Doctors' };

// Live Chat - visible to admin, sales_manager, super_admin, store_owner
const chatNavItem = { to: '/admin-settings?tab=chat', icon: MessageCircle, label: 'Live Chat' };

const adminNavItems = [];

export const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [prevUnreadCount, setPrevUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [chatWindowRef, setChatWindowRef] = useState(null); // Reference to popup window
  const [dialerWindowRef, setDialerWindowRef] = useState(null); // Reference to dialer popup window
  const [phoneConnected, setPhoneConnected] = useState(false); // Phone connection status
  const [commPanelOpen, setCommPanelOpen] = useState(false); // Communication panel state
  const { user, logout, isAdmin, isImpersonating, endImpersonation } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isCollapsed, toggleCollapsed } = useSidebar();
  const { isFeatureEnabled } = useFeatures();
  const { branding, versionedDashboardLogoUrl } = useBranding();
  const navigate = useNavigate();
  const audioRef = useRef(null);

  // Feature flags from context
  const patientPortalEnabled = isFeatureEnabled('patient_portal');
  const doctorsDirectoryEnabled = isFeatureEnabled('doctors_directory');
  const phoneDialerEnabled = isFeatureEnabled('phone_dialer');
  const faxCenterEnabled = isFeatureEnabled('fax_center');
  const analyticsEnabled = isFeatureEnabled('analytics_dashboard');

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.log('Could not play notification sound:', err);
      });
    }
  }, [soundEnabled]);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  }, []);

  // Fetch phone connection status (for green indicator dot)
  useEffect(() => {
    const checkPhoneConnectionStatus = async () => {
      if (!phoneDialerEnabled) {
        setPhoneConnected(false);
        return;
      }
      try {
        const token = localStorage.getItem('dme_token');
        const response = await axios.get(`${API_URL}/api/voice/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPhoneConnected(response.data.connected || false);
      } catch (error) {
        console.log('Failed to check phone connection status');
        setPhoneConnected(false);
      }
    };
    
    // Check immediately
    checkPhoneConnectionStatus();
    
    // Poll every 30 seconds
    const interval = setInterval(checkPhoneConnectionStatus, 30000);
    return () => clearInterval(interval);
  }, [phoneDialerEnabled]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/notifications/unread-count`, { headers: getHeaders() });
      const newUnreadCount = res.data.unread_count;
      
      // Play sound if there are new notifications
      if (newUnreadCount > prevUnreadCount && prevUnreadCount >= 0) {
        playNotificationSound();
      }
      
      setPrevUnreadCount(newUnreadCount);
      setUnreadCount(newUnreadCount);
      setNotifications(res.data.notifications || []);
    } catch (error) {
      console.log('Failed to fetch notifications');
    }
  }, [getHeaders, prevUnreadCount, playNotificationSound]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user, fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await axios.post(`${API_URL}/api/notifications/mark-all-read`, {}, { headers: getHeaders() });
      setUnreadCount(0);
      setNotifications([]);
    } catch (error) {
      console.log('Failed to mark all as read');
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      await axios.post(`${API_URL}/api/notifications/mark-read/${notif.id}`, {}, { headers: getHeaders() });
      setNotifOpen(false);
      
      // Navigate based on notification type
      if (notif.type === 'new_lead' && notif.lead_id) {
        navigate(`/leads/${notif.lead_id}`);
      } else if (notif.patient_id) {
        navigate(`/patients/${notif.patient_id}`);
      }
      
      fetchNotifications();
    } catch (error) {
      console.log('Failed to mark as read');
    }
  };

  const formatTimeAgo = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleEndImpersonation = () => {
    endImpersonation();
    navigate('/admin-settings');
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const NavItem = ({ item }) => {
    if (isCollapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `nav-link justify-center ${isActive ? 'active' : ''}`
              }
              style={{ padding: '20px 8px' }}
              onClick={() => setSidebarOpen(false)}
              data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
            >
              <item.icon className="w-5 h-5" />
            </NavLink>
          </TooltipTrigger>
          <TooltipContent side="right">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <NavLink
        to={item.to}
        className={({ isActive }) =>
          `nav-link ${isActive ? 'active' : ''}`
        }
        onClick={() => setSidebarOpen(false)}
        data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
      >
        <item.icon className="w-5 h-5" />
        <span>{item.label}</span>
      </NavLink>
    );
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''} transition-all duration-200 lg:translate-x-0`}>
          <div className="sidebar-header">
            <div className="flex items-center gap-2">
              {!isCollapsed ? (
                <a
                  href={branding.dashboard_logo_link || '/dashboard'}
                  className="flex items-center gap-2"
                  data-testid="dashboard-top-logo-link"
                >
                  {versionedDashboardLogoUrl ? (
                    <img
                      src={versionedDashboardLogoUrl}
                      alt="MediNova logo"
                      className="h-10 max-w-[170px] object-contain"
                      data-testid="dashboard-top-logo-image"
                    />
                  ) : (
                    <>
                      <img src="/images/medinova/logo.webp" alt="MediNova" className="h-10 max-w-[170px] object-contain" />
                    </>
                  )}
                </a>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-[#0055CC] flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex h-8 w-8"
              onClick={toggleCollapsed}
              data-testid="sidebar-collapse-btn"
            >
              {isCollapsed ? (
                <PanelLeft className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </Button>
          </div>

          <nav className="sidebar-nav">
            <div className={isCollapsed ? "space-y-4" : "space-y-1"}>
              {navItems
                .filter(item => item.to !== '/patients' || patientPortalEnabled)
                .map((item) => (
                <NavItem key={item.to} item={item} />
              ))}
              {/* Fax Center - visible to admin, sales_manager, super_admin when feature enabled */}
              {faxCenterEnabled && (user?.role === 'admin' || user?.role === 'sales_manager' || user?.role === 'super_admin') && (
                <NavItem item={faxNavItem} />
              )}
              {/* Newsletter - visible to admin, super_admin */}
              {(user?.role === 'admin' || user?.role === 'super_admin') && (
                <NavItem item={newsletterNavItem} />
              )}
              {/* Doctors Directory - visible when feature is enabled */}
              {doctorsDirectoryEnabled && (
                <NavItem item={doctorsNavItem} />
              )}
            </div>

            {isAdmin && adminNavItems.length > 0 && (
              <>
                <div className="my-4 px-4">
                  <div className="border-t border-slate-200 dark:border-slate-700" />
                </div>
                <div className={isCollapsed ? "space-y-4" : "space-y-1"}>
                  {!isCollapsed && (
                    <p className="px-4 mb-2 text-xs font-semibold uppercase text-muted-foreground">Admin</p>
                  )}
                  {adminNavItems.map((item) => (
                    <NavItem key={item.to} item={item} />
                  ))}
                </div>
              </>
            )}
          </nav>

          <div className="sidebar-footer">
            {/* Communication Hub Slide-out Button - visible to admin, sales_manager, super_admin, store_owner, sales_rep */}
            {phoneDialerEnabled && (user?.role === 'admin' || user?.role === 'sales_manager' || user?.role === 'super_admin' || user?.role === 'store_owner' || user?.role === 'sales_rep') && (
              <div className={`mb-3 ${isCollapsed ? 'px-2' : ''}`}>
                {isCollapsed ? (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setCommPanelOpen(true)}
                        className="w-full flex justify-center p-2 rounded-lg transition-colors hover:bg-accent relative"
                        data-testid="comm-panel-btn-collapsed"
                      >
                        <PhoneCall className="w-5 h-5" />
                        {phoneConnected && (
                          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      Communication Hub (Phone, SMS, History)
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <button
                    onClick={() => setCommPanelOpen(true)}
                    className="w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm font-medium hover:bg-accent text-foreground"
                    data-testid="comm-panel-btn"
                  >
                    <div className="relative">
                      <PhoneCall className="w-5 h-5" />
                      {phoneConnected && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />
                      )}
                    </div>
                    <span className="flex-1">Communication</span>
                    {phoneConnected && (
                      <span className="text-xs text-green-600 dark:text-green-400">●</span>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Browser Dialer Popup Button - visible to admin, sales_manager, super_admin, store_owner when feature enabled */}
            {phoneDialerEnabled && (user?.role === 'admin' || user?.role === 'sales_manager' || user?.role === 'super_admin' || user?.role === 'store_owner' || user?.role === 'sales_rep') && (
              <div className={`mb-3 ${isCollapsed ? 'px-2' : ''}`}>
                {isCollapsed ? (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          const width = 400;
                          const height = 650;
                          const left = window.screen.width - width - 50;
                          const top = 50;
                          const newWindow = window.open(
                            '/dialer-window',
                            'PhoneDialer',
                            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
                          );
                          setDialerWindowRef(newWindow);
                        }}
                        className="w-full flex justify-center p-2 rounded-lg transition-colors hover:bg-accent relative"
                        data-testid="dialer-popup-btn-collapsed"
                      >
                        <Phone className="w-5 h-5" />
                        {/* Connection status indicator - green dot */}
                        {phoneConnected && (
                          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {phoneConnected ? 'Phone Dialer (Connected)' : 'Phone Dialer'}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <button
                    onClick={() => {
                      const width = 400;
                      const height = 650;
                      const left = window.screen.width - width - 50;
                      const top = 50;
                      const newWindow = window.open(
                        '/dialer-window',
                        'PhoneDialer',
                        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
                      );
                      setDialerWindowRef(newWindow);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm font-medium hover:bg-accent text-foreground"
                    data-testid="dialer-popup-btn"
                  >
                    <div className="relative">
                      <Phone className="w-5 h-5" />
                      {/* Connection status indicator - green dot */}
                      {phoneConnected && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />
                      )}
                    </div>
                    <span className="flex-1">Phone</span>
                    {/* Connected indicator text */}
                    {phoneConnected && (
                      <span className="text-xs text-green-600 dark:text-green-400">●</span>
                    )}
                  </button>
                )}
              </div>
            )}
            
            {/* Live Chat Window Button - visible to admin, sales_manager, super_admin, store_owner */}
            {(user?.role === 'admin' || user?.role === 'sales_manager' || user?.role === 'super_admin' || user?.role === 'store_owner') && (
              <div className={`mb-3 ${isCollapsed ? 'px-2' : ''}`}>
                {isCollapsed ? (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          // Open chat in a new browser window
                          const width = 600;
                          const height = 700;
                          const left = window.screen.width - width - 50;
                          const top = 50;
                          const newWindow = window.open(
                            '/admin-chat-window',
                            'LiveChatMonitor',
                            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
                          );
                          setChatWindowRef(newWindow);
                        }}
                        className="w-full flex justify-center p-2 rounded-lg transition-colors hover:bg-accent"
                      >
                        <Headphones className="w-5 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Open Live Chat Monitor</TooltipContent>
                  </Tooltip>
                ) : (
                  <button
                    onClick={() => {
                      // Open chat in a new browser window
                      const width = 600;
                      const height = 700;
                      const left = window.screen.width - width - 50;
                      const top = 50;
                      const newWindow = window.open(
                        '/admin-chat-window',
                        'LiveChatMonitor',
                        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
                      );
                      setChatWindowRef(newWindow);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm font-medium hover:bg-accent text-foreground"
                  >
                    <Headphones className="w-5 h-5" />
                    <span>Live Chat</span>
                  </button>
                )}
              </div>
            )}
            
            {/* User Profile Badge with Profile Link */}
            {isCollapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <NavLink to="/profile" className="flex justify-center">
                    <Avatar className="w-9 h-9 cursor-pointer hover:ring-2 hover:ring-primary transition-all">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {getInitials(user?.first_name, user?.last_name)}
                      </AvatarFallback>
                    </Avatar>
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {user?.first_name} {user?.last_name} - Click for Profile
                </TooltipContent>
              </Tooltip>
            ) : (
              <NavLink 
                to="/profile" 
                className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent transition-colors group"
              >
                <Avatar className="w-9 h-9 group-hover:ring-2 group-hover:ring-primary transition-all">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {getInitials(user?.first_name, user?.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.first_name} {user?.last_name}</p>
                  <p className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                    {user?.role?.replace('_', ' ')}
                    <UserCog className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                </div>
              </NavLink>
            )}

            {/* Bottom dashboard logo sync */}
            {!isCollapsed && (
              <a
                href={branding.dashboard_logo_link || '/dashboard'}
                className="mt-4 mx-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 flex items-center justify-center"
                data-testid="dashboard-bottom-logo-link"
              >
                {versionedDashboardLogoUrl ? (
                  <img
                    src={versionedDashboardLogoUrl}
                    alt="DME PROS logo"
                    className="h-8 max-w-[140px] object-contain"
                    data-testid="dashboard-bottom-logo-image"
                  />
                ) : (
                  <span className="text-xs font-bold tracking-wide text-muted-foreground">MediNova</span>
                )}
              </a>
            )}
          </div>
        </aside>

      {/* Main content */}
      <main className={`main-content ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Impersonation Banner */}
        {isImpersonating && (
          <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="text-sm font-medium">
                You are viewing as: <strong>{user?.first_name} {user?.last_name}</strong> ({user?.role})
              </span>
            </div>
            <Button 
              size="sm" 
              variant="secondary"
              onClick={handleEndImpersonation}
              className="h-7 text-xs"
            >
              Exit Impersonation
            </Button>
          </div>
        )}
        
        {/* Header */}
        <header className="page-header">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
            data-testid="mobile-menu-btn"
          >
            <Menu className="w-5 h-5" />
          </Button>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  data-testid="notifications-btn"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>Notifications</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto py-1 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSoundEnabled(!soundEnabled);
                      }}
                      title={soundEnabled ? 'Mute notification sounds' : 'Enable notification sounds'}
                    >
                      {soundEnabled ? (
                        <Volume2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                    {unreadCount > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-auto py-1 px-2 text-xs"
                        onClick={handleMarkAllRead}
                      >
                        Mark all read
                      </Button>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No new notifications</p>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map((notif) => (
                      <DropdownMenuItem
                        key={notif.id}
                        className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                        onClick={() => handleNotificationClick(notif)}
                      >
                        <div className="flex items-center gap-2 w-full">
                          {notif.type === 'new_lead' ? (
                            <UserPlus className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <MessageSquare className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          )}
                          <span className="font-medium text-sm truncate flex-1">
                            {notif.type === 'new_lead' ? 'New Request: ' : ''}{notif.patient_name}
                          </span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {formatTimeAgo(notif.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 pl-6">
                          <span className="font-medium">{notif.from_name}:</span> {notif.content_preview}
                        </p>
                      </DropdownMenuItem>
                    ))}
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              data-testid="theme-toggle-btn"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="user-menu-btn">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {getInitials(user?.first_name, user?.last_name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <p className="font-medium">{user?.first_name} {user?.last_name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(user?.role === 'admin' || user?.role === 'store_owner' || user?.role === 'super_admin') && (
                  <DropdownMenuItem onClick={() => navigate('/admin-settings')} data-testid="admin-settings-menu-item">
                    <Settings className="w-4 h-4 mr-2" />
                    Admin Settings
                  </DropdownMenuItem>
                )}
                {user?.role === 'super_admin' && (
                  <DropdownMenuItem onClick={() => navigate('/dev-settings')} data-testid="dev-settings-menu-item">
                    <Code className="w-4 h-4 mr-2" />
                    Dev Settings
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive" data-testid="logout-menu-item">
                  <LogOut className="w-4 h-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <div className="page-content">
          {children}
        </div>
      </main>
      
      {/* Hidden audio element for notification sounds */}
      <audio
        ref={audioRef}
        src="/sounds/notification.ogg"
        preload="auto"
      />
      
      {/* Global Communication Panel */}
      <GlobalCommunicationPanel
        isOpen={commPanelOpen}
        onClose={() => setCommPanelOpen(false)}
        phoneConnected={phoneConnected}
      />
    </div>
    </TooltipProvider>
  );
};

export default Layout;
