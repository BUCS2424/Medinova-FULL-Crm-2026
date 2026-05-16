import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const FeatureContext = createContext(null);

// Default feature states (all enabled by default, disabled features will be fetched from backend)
const DEFAULT_FEATURES = {
  patient_portal: true,
  user_registration: true,
  doctor_portal: true,
  testimonials: true,
  phone_dialer: false,
  fax_center: true,
  location_pages: true,
  product_catalog: true,
  online_orders: false,
  notifications: false,
  sms_notifications: false,
  live_chat: true,
  appointment_scheduling: false,
  analytics_dashboard: true,
  document_upload: true,
  document_esign: true,
  patient_tutorial: true,
  ai_template_editor: true,
  doctors_directory: false,
  public_website: true,
  jornaya_tracking: false,
  trustedform_cert: false,
  availity_integration: false,
  waystar_integration: false,
  officeally_integration: false,
  video_conferencing: false,
  marketing_campaigns: false,
  lead_intake_hub: false
};

export function FeatureProvider({ children }) {
  const [features, setFeatures] = useState(DEFAULT_FEATURES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all features from backend
  const fetchFeatures = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/features/all`);
      if (response.data.features) {
        setFeatures(prev => ({
          ...prev,
          ...response.data.features
        }));
      }
      setError(null);
    } catch (err) {
      console.log('Failed to fetch features, using defaults');
      setError(err);
      // Keep using default features
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  // Check if a specific feature is enabled
  const isFeatureEnabled = useCallback((featureId) => {
    return features[featureId] ?? DEFAULT_FEATURES[featureId] ?? true;
  }, [features]);

  // Refresh features from backend
  const refreshFeatures = useCallback(() => {
    return fetchFeatures();
  }, [fetchFeatures]);

  const value = {
    features,
    loading,
    error,
    isFeatureEnabled,
    refreshFeatures
  };

  return (
    <FeatureContext.Provider value={value}>
      {children}
    </FeatureContext.Provider>
  );
}

export function useFeatures() {
  const context = useContext(FeatureContext);
  if (!context) {
    // Return a default context if not within FeatureProvider
    return {
      features: DEFAULT_FEATURES,
      loading: false,
      error: null,
      isFeatureEnabled: (featureId) => DEFAULT_FEATURES[featureId] ?? true,
      refreshFeatures: () => Promise.resolve()
    };
  }
  return context;
}

// Convenience hook to check a single feature
export function useFeature(featureId) {
  const { isFeatureEnabled, loading } = useFeatures();
  return {
    enabled: isFeatureEnabled(featureId),
    loading
  };
}

export default FeatureContext;
