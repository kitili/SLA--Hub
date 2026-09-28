import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../utils/api';
import { sections as fallbackSections } from '../data/onboardingData';

const HubContentContext = createContext(null);

export function HubContentProvider({ children }) {
  const [sections, setSections] = useState(fallbackSections);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { sections: remote } = await api.getHubContent();
      if (remote?.length) setSections(remote);
    } catch {
      // keep current
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getAllItems = useCallback(
    () =>
      sections.flatMap((section) =>
        section.items.map((item) => ({
          ...item,
          sectionId: section.id,
          sectionTitle: section.title,
          sectionNumber: section.number,
        }))
      ),
    [sections]
  );

  const value = useMemo(
    () => ({ sections, loading, refresh, getAllItems }),
    [sections, loading, refresh, getAllItems]
  );

  return <HubContentContext.Provider value={value}>{children}</HubContentContext.Provider>;
}

export function useHubContent() {
  const ctx = useContext(HubContentContext);
  if (!ctx) throw new Error('useHubContent must be used within HubContentProvider');
  return ctx;
}
