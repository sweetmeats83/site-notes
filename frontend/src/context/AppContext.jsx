import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { settingsApi } from '../api/settings.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [settings, setSettings]         = useState({});
  const [quickCaptureOpen, setQCOpen]   = useState(false);
  const [loadingSettings, setLoading]   = useState(true);
  const [notification, setNotification] = useState(null);
  // Increment this to tell any mounted list view to re-fetch immediately
  const [refreshKey, setRefreshKey]     = useState(0);

  useEffect(() => {
    settingsApi.get()
      .then(setSettings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const updateSettings = useCallback(async (patch) => {
    const updated = await settingsApi.update(patch);
    setSettings(updated);
    return updated;
  }, []);

  const notify = useCallback((message, type = 'info', duration = 3500) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), duration);
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  return (
    <AppContext.Provider value={{
      settings,
      loadingSettings,
      updateSettings,
      quickCaptureOpen,
      setQCOpen,
      notification,
      notify,
      refreshKey,
      triggerRefresh,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
