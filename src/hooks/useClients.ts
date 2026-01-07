import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Client } from '../types/client';

const STORAGE_KEY = 'offline_clients';
const PENDING_SYNC_KEY = 'pending_client_changes';

interface PendingChange {
  id: string;
  action: 'create' | 'update' | 'delete';
  data: Partial<Client>;
  timestamp: number;
}

export function useClients(organizationId: string, allowedRouteIds?: string[]) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingChanges();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadFromLocalStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.organizationId === organizationId) {
          return data.clients as Client[];
        }
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
    return null;
  }, [organizationId]);

  const saveToLocalStorage = useCallback((clientsData: Client[]) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          organizationId,
          clients: clientsData,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [organizationId]);

  const addPendingChange = useCallback((change: PendingChange) => {
    try {
      const stored = localStorage.getItem(PENDING_SYNC_KEY);
      const pending: PendingChange[] = stored ? JSON.parse(stored) : [];
      pending.push(change);
      localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pending));
    } catch (error) {
      console.error('Error saving pending change:', error);
    }
  }, []);

  const syncPendingChanges = useCallback(async () => {
    if (!isOnline) return;

    try {
      setSyncing(true);
      const stored = localStorage.getItem(PENDING_SYNC_KEY);
      if (!stored) {
        setSyncing(false);
        return;
      }

      const pending: PendingChange[] = JSON.parse(stored);
      const successfulSyncs: string[] = [];

      for (const change of pending) {
        try {
          if (change.action === 'create') {
            const { pending_sync, synced, ...dataToInsert } = change.data;
            const { error } = await supabase
              .from('clients')
              .insert(dataToInsert);
            if (!error) successfulSyncs.push(change.id);
          } else if (change.action === 'update') {
            const { pending_sync, synced, ...dataToUpdate } = change.data;
            const { error } = await supabase
              .from('clients')
              .update(dataToUpdate)
              .eq('id', change.id);
            if (!error) successfulSyncs.push(change.id);
          } else if (change.action === 'delete') {
            const { error } = await supabase
              .from('clients')
              .delete()
              .eq('id', change.id);
            if (!error) successfulSyncs.push(change.id);
          }
        } catch (error) {
          console.error('Error syncing change:', error);
        }
      }

      const remainingPending = pending.filter(
        (p) => !successfulSyncs.includes(p.id)
      );

      if (remainingPending.length > 0) {
        localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(remainingPending));
      } else {
        localStorage.removeItem(PENDING_SYNC_KEY);
      }

      await fetchClients();
      setSyncing(false);
    } catch (error) {
      console.error('Error syncing pending changes:', error);
      setSyncing(false);
    }
  }, [isOnline]);

  const fetchClients = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      if (isOnline) {
        let query = supabase
          .from('clients')
          .select('*')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false });

      if (allowedRouteIds !== undefined) {
        if (allowedRouteIds.length === 0) {
          setClients([]);
          saveToLocalStorage([]);
          setLoading(false);
          return;
        }
        query = query.in('route_id', allowedRouteIds);
      }

        const { data, error } = await query;

        if (error) throw error;

        const clientsData = (data || []) as Client[];
        setClients(clientsData);
        saveToLocalStorage(clientsData);
      } else {
        const cachedClients = loadFromLocalStorage();
        if (cachedClients) {
          setClients(cachedClients);
        }
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
      const cachedClients = loadFromLocalStorage();
      if (cachedClients) {
        setClients(cachedClients);
      }
    } finally {
      setLoading(false);
    }
  }, [organizationId, isOnline, loadFromLocalStorage, saveToLocalStorage, allowedRouteIds]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const createClient = async (clientData: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => {
    const newClient: Client = {
      ...clientData,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      pending_sync: !isOnline,
    };

    const updatedClients = [newClient, ...clients];
    setClients(updatedClients);
    saveToLocalStorage(updatedClients);

    if (isOnline) {
      try {
        const { pending_sync, synced, ...supabaseData } = newClient;
        const { error } = await supabase.from('clients').insert(supabaseData);
        if (error) throw error;
      } catch (error) {
        console.error('Error creating client:', error);
        addPendingChange({
          id: newClient.id,
          action: 'create',
          data: newClient,
          timestamp: Date.now(),
        });
      }
    } else {
      addPendingChange({
        id: newClient.id,
        action: 'create',
        data: newClient,
        timestamp: Date.now(),
      });
    }

    return newClient;
  };

  const updateClient = async (id: string, updates: Partial<Client>) => {
    const updatedClients = clients.map((client) =>
      client.id === id
        ? { ...client, ...updates, updated_at: new Date().toISOString(), pending_sync: !isOnline }
        : client
    );
    setClients(updatedClients);
    saveToLocalStorage(updatedClients);

    if (isOnline) {
      try {
        const { pending_sync, synced, ...updateData } = { ...updates, updated_at: new Date().toISOString() };
        const { error } = await supabase
          .from('clients')
          .update(updateData)
          .eq('id', id);
        if (error) throw error;
      } catch (error) {
        console.error('Error updating client:', error);
        addPendingChange({
          id,
          action: 'update',
          data: updates,
          timestamp: Date.now(),
        });
      }
    } else {
      addPendingChange({
        id,
        action: 'update',
        data: updates,
        timestamp: Date.now(),
      });
    }
  };

  const deleteClient = async (id: string) => {
    const updatedClients = clients.filter((client) => client.id !== id);
    setClients(updatedClients);
    saveToLocalStorage(updatedClients);

    if (isOnline) {
      try {
        const { error } = await supabase.from('clients').delete().eq('id', id);
        if (error) throw error;
      } catch (error) {
        console.error('Error deleting client:', error);
        addPendingChange({
          id,
          action: 'delete',
          data: { id },
          timestamp: Date.now(),
        });
      }
    } else {
      addPendingChange({
        id,
        action: 'delete',
        data: { id },
        timestamp: Date.now(),
      });
    }
  };

  return {
    clients,
    loading,
    isOnline,
    syncing,
    createClient,
    updateClient,
    deleteClient,
    refresh: fetchClients,
  };
}
