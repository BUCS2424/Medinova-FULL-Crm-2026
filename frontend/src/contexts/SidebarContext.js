import { createContext, useContext, useState, useEffect } from 'react';

const SidebarContext = createContext(null);

export const SidebarProvider = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', isCollapsed.toString());
  }, [isCollapsed]);

  const toggleCollapsed = () => {
    setIsCollapsed(prev => !prev);
  };

  const collapse = () => setIsCollapsed(true);
  const expand = () => setIsCollapsed(false);

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleCollapsed, collapse, expand }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};
