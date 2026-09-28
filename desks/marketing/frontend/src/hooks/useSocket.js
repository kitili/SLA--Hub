import { useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuthStore } from '../store/authStore';

// Same external interface as before (useSocket(handlers)) — internals now subscribe to
// Supabase Realtime broadcast channels instead of a Socket.IO room. Topic names are
// unchanged: `campus-${campusId}` for campus-scoped users, `global` for HQ/global-scope
// users, plus `user-${id}` always (kept for parity — no event currently targets it).
export function useSocket(handlers = {}) {
  const { user } = useAuthStore();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!user) return;

    const topics = [`user-${user.id}`, user.campusId ? `campus-${user.campusId}` : 'global'];
    const channels = topics.map(topic => {
      const channel = supabase.channel(topic);
      Object.keys(handlersRef.current).forEach(event => {
        channel.on('broadcast', { event }, ({ payload }) => handlersRef.current[event]?.(payload));
      });
      channel.subscribe();
      return channel;
    });

    return () => channels.forEach(channel => supabase.removeChannel(channel));
  }, [user]);
}
