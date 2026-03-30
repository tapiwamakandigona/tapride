import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Ride } from '../types';

export interface SOSAlert {
  id: string;
  ride_id: string;
  user_id: string;
  lat: number;
  lng: number;
  status: 'active' | 'resolved';
  created_at: string;
  resolved_at: string | null;
}

export function useSOS() {
  const { user, profile } = useAuth();
  const [activeAlert, setActiveAlert] = useState<SOSAlert | null>(null);
  const [loading, setLoading] = useState(false);

  const triggerSOS = useCallback(async (ride: Ride, lat: number, lng: number): Promise<SOSAlert> => {
    if (!user) throw new Error('Not authenticated');
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sos_alerts')
        .insert({
          ride_id: ride.id,
          user_id: user.id,
          lat,
          lng,
          status: 'active',
        })
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      const alert = data as SOSAlert;
      setActiveAlert(alert);
      return alert;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const resolveSOS = useCallback(async (alertId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('sos_alerts')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', alertId);
      if (error) throw new Error(error.message);
      setActiveAlert(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const getEmergencyContact = useCallback(() => {
    return {
      name: (profile as unknown as Record<string, unknown>)?.emergency_contact_name as string || '',
      phone: (profile as unknown as Record<string, unknown>)?.emergency_contact_phone as string || '',
    };
  }, [profile]);

  return { activeAlert, loading, triggerSOS, resolveSOS, getEmergencyContact };
}
