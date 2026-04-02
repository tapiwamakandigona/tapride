export type UserType = 'rider' | 'driver';

export type RideStatus = 'requested' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

export interface Profile {
  id: string;
  email?: string;
  full_name: string;
  phone: string;
  user_type: UserType;
  avatar_url: string | null;
  rating: number | null;
  rating_count: number;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  license_plate: string | null;
  is_online: boolean;
  current_lat: number | null;
  current_lng: number | null;
  created_at: string;
}

export interface Ride {
  id: string;
  rider_id: string;
  driver_id: string | null;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  destination_lat: number;
  destination_lng: number;
  destination_address: string;
  status: RideStatus;
  fare_estimate: number;
  fare_final: number | null;
  distance_km: number;
  created_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  rider?: Profile;
  driver?: Profile;
}

export interface DriverLocation {
  driver_id: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  updated_at: string;
}

export interface Message {
  id: string;
  ride_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface Rating {
  id: string;
  ride_id: string;
  rater_id: string;
  rated_id: string;
  score: number;
  comment: string | null;
  created_at: string;
}

export interface AppConfig {
  key: string;
  value: string;
}

export interface LocationCoords {
  lat: number;
  lng: number;
}

export interface GeoPosition {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
}
