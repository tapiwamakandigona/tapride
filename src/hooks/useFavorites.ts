import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export interface FavoriteLocation {
  id: string;
  user_id: string;
  label: string;
  lat: number;
  lng: number;
  address: string;
  icon: string;
  created_at: string;
}

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    if (!user) { setFavorites([]); setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('favorite_locations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      setFavorites(data || []);
    } catch (err) {
      console.warn('[TapRide] Failed to fetch favorites:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  const addFavorite = async (fav: Omit<FavoriteLocation, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return;
    const { error } = await supabase.from('favorite_locations').insert({
      user_id: user.id,
      ...fav,
    });
    if (!error) await fetchFavorites();
    return error;
  };

  const updateFavorite = async (id: string, updates: Partial<Pick<FavoriteLocation, 'label' | 'lat' | 'lng' | 'address' | 'icon'>>) => {
    const { error } = await supabase.from('favorite_locations').update(updates).eq('id', id);
    if (!error) await fetchFavorites();
    return error;
  };

  const deleteFavorite = async (id: string) => {
    const { error } = await supabase.from('favorite_locations').delete().eq('id', id);
    if (!error) await fetchFavorites();
    return error;
  };

  return { favorites, loading, addFavorite, updateFavorite, deleteFavorite, refresh: fetchFavorites };
}
