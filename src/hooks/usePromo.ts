import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface PromoCode {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_uses: number;
  current_uses: number;
  valid_from: string;
  valid_until: string;
  min_fare: number;
}

export interface PromoResult {
  valid: boolean;
  promo?: PromoCode;
  discount?: number;
  error?: string;
}

export function usePromo() {
  const { user } = useAuth();
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(false);

  const validatePromo = useCallback(async (code: string, fareEstimate: number): Promise<PromoResult> => {
    if (!user) return { valid: false, error: 'Not authenticated' };
    if (!code.trim()) return { valid: false, error: 'Enter a promo code' };

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code.trim().toUpperCase())
        .single();

      if (error || !data) return { valid: false, error: 'Invalid promo code' };

      const promo = data as PromoCode;
      const now = new Date();

      if (new Date(promo.valid_from) > now) return { valid: false, error: 'Promo code is not yet active' };
      if (new Date(promo.valid_until) < now) return { valid: false, error: 'Promo code has expired' };
      if (promo.current_uses >= promo.max_uses) return { valid: false, error: 'Promo code has reached max uses' };
      if (fareEstimate < promo.min_fare) return { valid: false, error: `Minimum fare of $${promo.min_fare.toFixed(2)} required` };

      // Check if user already used this code
      const { data: existing } = await supabase
        .from('user_promos')
        .select('id')
        .eq('user_id', user.id)
        .eq('promo_id', promo.id)
        .limit(1);

      if (existing && existing.length > 0) return { valid: false, error: 'You have already used this promo code' };

      const discountAmount = promo.discount_type === 'percentage'
        ? (fareEstimate * promo.discount_value / 100)
        : promo.discount_value;

      const cappedDiscount = Math.min(discountAmount, fareEstimate);

      setAppliedPromo(promo);
      setDiscount(cappedDiscount);

      return { valid: true, promo, discount: cappedDiscount };
    } finally {
      setLoading(false);
    }
  }, [user]);

  const clearPromo = useCallback(() => {
    setAppliedPromo(null);
    setDiscount(0);
  }, []);

  const recordPromoUsage = useCallback(async (rideId: string) => {
    if (!user || !appliedPromo) return;
    try {
      await supabase.from('user_promos').insert({
        user_id: user.id,
        promo_id: appliedPromo.id,
        ride_id: rideId,
        discount_applied: discount,
      });
      // Increment usage count
      const { error: rpcErr } = await supabase.rpc('increment_promo_usage', { promo_id: appliedPromo.id });
      if (rpcErr) {
        // Fallback: manual update
        await supabase
          .from('promo_codes')
          .update({ current_uses: appliedPromo.current_uses + 1 })
          .eq('id', appliedPromo.id);
      }
    } catch (err) {
      console.warn('[TapRide] Failed to record promo usage:', err);
    }
  }, [user, appliedPromo, discount]);

  return { appliedPromo, discount, loading, validatePromo, clearPromo, recordPromoUsage };
}
