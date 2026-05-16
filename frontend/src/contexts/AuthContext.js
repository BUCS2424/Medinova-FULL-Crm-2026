import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('dme_token'));
  const [originalToken, setOriginalToken] = useState(localStorage.getItem('dme_original_token'));
  const [loading, setLoading] = useState(true);

  // Configure axios defaults
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API_URL}/api/auth/me`);
          setUser(response.data);
        } catch (error) {
          console.error('Auth check failed:', error);
          logout();
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, [token]);

  const login = useCallback(async (email, password) => {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email,
      password
    });
    
    const { access_token, user: userData } = response.data;
    
    localStorage.setItem('dme_token', access_token);
    localStorage.removeItem('dme_original_token'); // Clear any impersonation state
    setToken(access_token);
    setOriginalToken(null);
    setUser(userData);
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    
    return userData;
  }, []);

  const register = useCallback(async (userData) => {
    const response = await axios.post(`${API_URL}/api/auth/register`, userData);
    
    const { access_token, user: newUser } = response.data;
    
    localStorage.setItem('dme_token', access_token);
    setToken(access_token);
    setUser(newUser);
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    
    return newUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('dme_token');
    localStorage.removeItem('dme_original_token');
    setToken(null);
    setOriginalToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  }, []);

  // Impersonate a user
  const impersonateUser = useCallback(async (userId) => {
    const response = await axios.post(`${API_URL}/api/auth/impersonate/${userId}`);
    
    const { access_token, impersonated_user } = response.data;
    
    // Save original token before impersonating
    localStorage.setItem('dme_original_token', token);
    localStorage.setItem('dme_token', access_token);
    setOriginalToken(token);
    setToken(access_token);
    setUser({
      ...impersonated_user,
      is_impersonating: true,
      impersonated_by: user
    });
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    
    return impersonated_user;
  }, [token, user]);

  // End impersonation and return to original admin session
  const endImpersonation = useCallback(() => {
    if (originalToken) {
      localStorage.setItem('dme_token', originalToken);
      localStorage.removeItem('dme_original_token');
      setToken(originalToken);
      setOriginalToken(null);
      axios.defaults.headers.common['Authorization'] = `Bearer ${originalToken}`;
      
      // Refresh user data
      axios.get(`${API_URL}/api/auth/me`).then(response => {
        setUser(response.data);
      });
    }
  }, [originalToken]);

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    impersonateUser,
    endImpersonation,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin' || user?.role === 'super_admin',
    isSuperAdmin: user?.role === 'super_admin',
    isSalesRep: user?.role === 'sales_rep',
    isDoctor: user?.role === 'doctor',
    isPatient: user?.role === 'patient',
    isImpersonating: !!user?.is_impersonating || !!originalToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
