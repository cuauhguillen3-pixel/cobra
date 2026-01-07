import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function useAlertCount() {
  const { user, userData } = useAuth();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    if (!user || !userData?.organization_id) return;

    const loadAlertCount = async () => {
      try {
        let count = 0;

        const isFilteredUser = userData.role !== 'superadmin' && userData.role !== 'admin' && !userData.permissions?.includes('*:*');
        const assignedRoutes = userData.assigned_routes || [];

        if (isFilteredUser && assignedRoutes.length === 0) {
          setAlertCount(0);
          return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sevenDaysFromNow = new Date(today);
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        let receivablesQuery = supabase
          .from('accounts_receivable')
          .select('id, due_date, clients!inner(name, route_id)')
          .eq('organization_id', userData.organization_id)
          .neq('status', 'paid');

        if (isFilteredUser) {
          receivablesQuery = receivablesQuery.in('clients.route_id', assignedRoutes);
        }

        const { data: receivables } = await receivablesQuery;

        if (receivables) {
          receivables.forEach((receivable) => {
            const dueDate = new Date(receivable.due_date);
            dueDate.setHours(0, 0, 0, 0);

            if (dueDate < today || dueDate <= sevenDaysFromNow) {
              count++;
            }
          });
        }

        let promisesQuery = supabase
          .from('collection_activities')
          .select('id, clients!inner(name, route_id)')
          .eq('organization_id', userData.organization_id)
          .eq('activity_type', 'promise')
          .eq('completed', false)
          .gte('scheduled_date', today.toISOString())
          .lt('scheduled_date', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString());

        if (isFilteredUser) {
          promisesQuery = promisesQuery.in('clients.route_id', assignedRoutes);
        }

        const { data: promises } = await promisesQuery;

        count += promises?.length || 0;
        setAlertCount(count);
      } catch (error) {
        console.error('Error loading alert count:', error);
      }
    };

    loadAlertCount();

    const interval = setInterval(loadAlertCount, 60000);

    return () => clearInterval(interval);
  }, [user, userData]);

  return alertCount;
}
