/** All shared TypeScript types for TapRide */

export type UserRole = 'rider' | 'driver';
export type RideStatus = 'pending' | 'accepted' | 'inprogress' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'refunded';

/** User profile stored in the `profiles` collection */
export interface Profile {
  $id: string;
  userId: string;
  name: string;
  email?: string;
  phone: string;
  role: UserRole;
  rating: number;
  totalRides: number;
  isOnline: boolean;
  vehicleType?: string;
  licensePlate?: string;
  avatarUrl?: string;
}

/** A ride request/trip stored in the `rides` collection */
export interface Ride {
  $id: string;
  riderId: string;
  driverId?: string;
  status: RideStatus;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropLat: number;
  dropLng: number;
  dropAddress: string;
  fare: number;
  distanceKm: number;
  paymentStatus: PaymentStatus;
  requestedAt: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

/** Real-time driver position stored in `driver_locations` collection */
export interface DriverLocation {
  $id: string;
  driverId: string;
  lat: number;
  lng: number;
  isAvailable: boolean;
  heading?: number;
  updatedAt: string;
}

/** Chat message stored in `messages` collection */
export interface Message {
  $id: string;
  rideId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

/** Post-ride rating stored in `ratings` collection */
export interface Rating {
  $id: string;
  rideId: string;
  raterId: string;
  ratedId: string;
  score: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  createdAt: string;
}

/** Geocoding result from Nominatim */
export interface GeoResult {
  lat: string;
  lon: string;
  display_name: string;
}

/** OSRM route response */
export interface OsrmRoute {
  geometry: {
    coordinates: [number, number][];
    type: 'LineString';
  };
  distance: number; // metres
  duration: number; // seconds
}
