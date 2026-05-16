import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Shield, Users, FileText, Activity, ShieldCheck, Lock } from 'lucide-react';
import axios from 'axios';
import { useBranding } from '../contexts/BrandingContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: ''
  });
  const [siteBranding, setSiteBranding] = useState({ logo_url: null });
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  
  const { login, register } = useAuth();
  const { branding, versionedLogoUrl } = useBranding();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if registration is enabled
    const checkRegistrationFeature = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/features/user_registration`);
        setRegistrationEnabled(res.data.enabled);
      } catch (error) {
        // Default to enabled if check fails
        setRegistrationEnabled(true);
      }
    };
    
    checkRegistrationFeature();
  }, []);

  useEffect(() => {
    setSiteBranding({ logo_url: versionedLogoUrl || branding.logo_url || null });
  }, [branding.logo_url, versionedLogoUrl]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await login(loginData.email, loginData.password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await register(registerData);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container" data-testid="login-page">
      {/* Form Section */}
      <div className="login-form-section">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              {siteBranding.logo_url ? (
                <img 
                  src={siteBranding.logo_url} 
                  alt="Logo" 
                  className="h-10 max-w-[200px] object-contain"
                  data-testid="login-brand-logo-image"
                />
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-extrabold text-navy-700">DME</span>
                    <span className="text-2xl font-extrabold text-lime-500">PROS</span>
                  </div>
                </>
              )}
            </div>
            <p className="text-muted-foreground">HIPAA-Compliant Patient Management</p>
          </div>

          <Card className="border-slate-200 shadow-xl shadow-primary-100/40">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Welcome</CardTitle>
              <CardDescription>
                {registrationEnabled 
                  ? 'Sign in to your account or create a new one'
                  : 'Sign in to your account'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {registrationEnabled ? (
                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="login" data-testid="login-tab">Sign In</TabsTrigger>
                    <TabsTrigger value="register" data-testid="register-tab">Register</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login">
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-email">Email</Label>
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="you@example.com"
                          value={loginData.email}
                          onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                          required
                          data-testid="login-email-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="login-password">Password</Label>
                        <Input
                          id="login-password"
                          type="password"
                          placeholder="Enter your password"
                          value={loginData.password}
                          onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                          required
                          data-testid="login-password-input"
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={isLoading} data-testid="login-submit-btn">
                        {isLoading ? 'Signing in...' : 'Sign In'}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="first_name">First Name</Label>
                        <Input
                          id="first_name"
                          placeholder="John"
                          value={registerData.first_name}
                          onChange={(e) => setRegisterData({ ...registerData, first_name: e.target.value })}
                          required
                          data-testid="register-firstname-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last_name">Last Name</Label>
                        <Input
                          id="last_name"
                          placeholder="Doe"
                          value={registerData.last_name}
                          onChange={(e) => setRegisterData({ ...registerData, last_name: e.target.value })}
                          required
                          data-testid="register-lastname-input"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email</Label>
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="you@example.com"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                        required
                        data-testid="register-email-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password">Password</Label>
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="Create a password"
                        value={registerData.password}
                        onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                        required
                        data-testid="register-password-input"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading} data-testid="register-submit-btn">
                      {isLoading ? 'Creating account...' : 'Create Patient Account'}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground mt-2">
                      Staff accounts are created by administrators
                    </p>
                  </form>
                </TabsContent>
              </Tabs>
              ) : (
                /* Registration disabled - show only login form */
                <div className="space-y-4">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="you@example.com"
                        value={loginData.email}
                        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                        required
                        data-testid="login-email-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="Enter your password"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        required
                        data-testid="login-password-input"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading} data-testid="login-submit-btn">
                      {isLoading ? 'Signing in...' : 'Sign In'}
                    </Button>
                  </form>
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                    <Lock className="w-4 h-4" />
                    <span>New account registration is currently disabled</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="mt-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Protected by HIPAA-compliant security
          </p>
        </div>
      </div>

      {/* Hero Section */}
      <div className="login-hero-section">
        <div className="relative z-10 text-center text-navy-700 px-8 max-w-lg">
          <h2 className="text-3xl font-bold mb-6">Streamline Your <span className="whitespace-nowrap text-lime-500">Patient Experience</span></h2>
          <p className="text-slate-600 mb-8">
            Trust & Manage your billing, orders, deliveries, and all around DME experience with us, to get the job done right.
          </p>
          
          <div className="grid grid-cols-2 gap-4 text-left">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-primary-100 shadow-sm">
              <Users className="w-5 h-5 text-lime-400 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm">Patient Management</h3>
                <p className="text-xs text-slate-500">Secure patient records with audit trails</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-primary-100 shadow-sm">
              <Activity className="w-5 h-5 text-lime-400 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm">Easy Communication</h3>
                <p className="text-xs text-slate-500">Send and receive messages about your updates</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-primary-100 shadow-sm">
              <FileText className="w-5 h-5 text-lime-400 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm">Order Tracking</h3>
                <p className="text-xs text-slate-500">Full order lifecycle management</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-primary-100 shadow-sm">
              <Shield className="w-5 h-5 text-lime-400 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm">HIPAA Compliant</h3>
                <p className="text-xs text-slate-500">Complete audit log tracking</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
