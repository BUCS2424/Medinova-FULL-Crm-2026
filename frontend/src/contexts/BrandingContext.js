import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const BrandingContext = createContext({
  branding: {
    logo_url: null,
    dashboard_logo_url: null,
    favicon_url: null,
    logo_link_url: '/',
    dashboard_logo_link: '/dashboard',
    branding_version: null,
  },
  versionedLogoUrl: null,
  versionedDashboardLogoUrl: null,
  versionedFaviconUrl: null,
  refreshBranding: async () => {},
});

const appendVersion = (url, version) => {
  if (!url) return null;
  if (!version) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(version)}`;
};

const setFavicons = (faviconUrl) => {
  if (!faviconUrl) return;
  const rels = ['icon', 'shortcut icon', 'apple-touch-icon'];
  rels.forEach((rel) => {
    let node = document.querySelector(`link[rel="${rel}"]`);
    if (!node) {
      node = document.createElement('link');
      node.setAttribute('rel', rel);
      document.head.appendChild(node);
    }
    node.setAttribute('href', faviconUrl);
  });
};

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState({
    logo_url: null,
    dashboard_logo_url: null,
    favicon_url: null,
    logo_link_url: '/',
    dashboard_logo_link: '/dashboard',
    branding_version: null,
  });

  const refreshBranding = useCallback(async (overrideData = null) => {
    if (overrideData) {
      setBranding((prev) => ({ ...prev, ...overrideData }));
      return;
    }

    try {
      const res = await axios.get(`${API_URL}/api/public/site-branding`);
      setBranding((prev) => ({ ...prev, ...(res.data || {}) }));
    } catch (error) {
      // Fail silently to avoid breaking auth/public pages if branding fetch fails
    }
  }, []);

  useEffect(() => {
    refreshBranding();
  }, [refreshBranding]);

  useEffect(() => {
    const handleBrandingUpdated = (event) => {
      const payload = event?.detail || null;
      if (payload) {
        refreshBranding(payload);
      } else {
        refreshBranding();
      }
    };

    window.addEventListener('branding-updated', handleBrandingUpdated);
    return () => window.removeEventListener('branding-updated', handleBrandingUpdated);
  }, [refreshBranding]);

  const versionedLogoUrl = useMemo(
    () => appendVersion(branding.logo_url, branding.branding_version),
    [branding.logo_url, branding.branding_version]
  );

  const versionedDashboardLogoUrl = useMemo(
    () => appendVersion(branding.dashboard_logo_url || branding.logo_url, branding.branding_version),
    [branding.dashboard_logo_url, branding.logo_url, branding.branding_version]
  );

  const versionedFaviconUrl = useMemo(
    () => appendVersion(branding.favicon_url, branding.branding_version),
    [branding.favicon_url, branding.branding_version]
  );

  useEffect(() => {
    setFavicons(versionedFaviconUrl);
  }, [versionedFaviconUrl]);

  const value = useMemo(
    () => ({ branding, versionedLogoUrl, versionedDashboardLogoUrl, versionedFaviconUrl, refreshBranding }),
    [branding, versionedLogoUrl, versionedDashboardLogoUrl, versionedFaviconUrl, refreshBranding]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
};

export const useBranding = () => useContext(BrandingContext);
