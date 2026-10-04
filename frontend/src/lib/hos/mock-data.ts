import type { GeoPoint, TripHistoryItem, TripInput } from "./types";
import usLocations from "./us-locations.json";

/** Demo geocoder dataset. Replace with backend geocoding later. */
export const CITIES: GeoPoint[] = [
  { name: "Chicago, IL", lat: 41.8781, lng: -87.6298 },
  { name: "St. Louis, MO", lat: 38.627, lng: -90.1994 },
  { name: "Kansas City, MO", lat: 39.0997, lng: -94.5786 },
  { name: "Oklahoma City, OK", lat: 35.4676, lng: -97.5164 },
  { name: "Tulsa, OK", lat: 36.154, lng: -95.9928 },
  { name: "Amarillo, TX", lat: 35.222, lng: -101.8313 },
  { name: "Albuquerque, NM", lat: 35.0844, lng: -106.6504 },
  { name: "Flagstaff, AZ", lat: 35.1983, lng: -111.6513 },
  { name: "Phoenix, AZ", lat: 33.4484, lng: -112.074 },
  { name: "Los Angeles, CA", lat: 34.0522, lng: -118.2437 },
  { name: "San Francisco, CA", lat: 37.7749, lng: -122.4194 },
  { name: "Sacramento, CA", lat: 38.5816, lng: -121.4944 },
  { name: "Las Vegas, NV", lat: 36.1699, lng: -115.1398 },
  { name: "Reno, NV", lat: 39.5296, lng: -119.8138 },
  { name: "Salt Lake City, UT", lat: 40.7608, lng: -111.891 },
  { name: "Denver, CO", lat: 39.7392, lng: -104.9903 },
  { name: "Cheyenne, WY", lat: 41.14, lng: -104.8202 },
  { name: "Boise, ID", lat: 43.615, lng: -116.2023 },
  { name: "Portland, OR", lat: 45.5152, lng: -122.6784 },
  { name: "Seattle, WA", lat: 47.6062, lng: -122.3321 },
  { name: "Omaha, NE", lat: 41.2565, lng: -95.9345 },
  { name: "Des Moines, IA", lat: 41.5868, lng: -93.625 },
  { name: "Minneapolis, MN", lat: 44.9778, lng: -93.265 },
  { name: "Milwaukee, WI", lat: 43.0389, lng: -87.9065 },
  { name: "Indianapolis, IN", lat: 39.7684, lng: -86.1581 },
  { name: "Columbus, OH", lat: 39.9612, lng: -82.9988 },
  { name: "Detroit, MI", lat: 42.3314, lng: -83.0458 },
  { name: "Cleveland, OH", lat: 41.4993, lng: -81.6944 },
  { name: "Pittsburgh, PA", lat: 40.4406, lng: -79.9959 },
  { name: "Philadelphia, PA", lat: 39.9526, lng: -75.1652 },
  { name: "New York, NY", lat: 40.7128, lng: -74.006 },
  { name: "Boston, MA", lat: 42.3601, lng: -71.0589 },
  { name: "Baltimore, MD", lat: 39.2904, lng: -76.6122 },
  { name: "Richmond, VA", lat: 37.5407, lng: -77.436 },
  { name: "Charlotte, NC", lat: 35.2271, lng: -80.8431 },
  { name: "Atlanta, GA", lat: 33.749, lng: -84.388 },
  { name: "Jacksonville, FL", lat: 30.3322, lng: -81.6557 },
  { name: "Orlando, FL", lat: 28.5383, lng: -81.3792 },
  { name: "Miami, FL", lat: 25.7617, lng: -80.1918 },
  { name: "Nashville, TN", lat: 36.1627, lng: -86.7816 },
  { name: "Memphis, TN", lat: 35.1495, lng: -90.049 },
  { name: "Louisville, KY", lat: 38.2527, lng: -85.7585 },
  { name: "Birmingham, AL", lat: 33.5186, lng: -86.8104 },
  { name: "New Orleans, LA", lat: 29.9511, lng: -90.0715 },
  { name: "Little Rock, AR", lat: 34.7465, lng: -92.2896 },
  { name: "Dallas, TX", lat: 32.7767, lng: -96.797 },
  { name: "Houston, TX", lat: 29.7604, lng: -95.3698 },
  { name: "San Antonio, TX", lat: 29.4241, lng: -98.4936 },
  { name: "El Paso, TX", lat: 31.7619, lng: -106.485 },
  { name: "Tucson, AZ", lat: 32.2226, lng: -110.9747 },
];

export const US_LOCATIONS: GeoPoint[] = usLocations.map(([name, lat, lng]) => ({ name: String(name), lat: Number(lat), lng: Number(lng) }));
const cityLookup = new Map(US_LOCATIONS.map((city) => [city.name.toLowerCase(), city]));

export function geocode(query: string): GeoPoint | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return (
    CITIES.find((c) => c.name.toLowerCase() === q) ??
    cityLookup.get(q) ??
    null
  );
}

export const DEMO_TRIP: TripInput = {
  currentLocation: "Chicago, IL",
  pickupLocation: "St. Louis, MO",
  dropoffLocation: "Phoenix, AZ",
  cycleUsedHours: 22,
};

/** Day 1 of the demo/planned trip (dates are rendered in UTC for determinism). */
export const TRIP_START_DATE = "2026-10-05";
export const TRIP_START_MINUTE = 6 * 60; // 06:00

export const MOCK_DRIVER = {
  name: "Driver (demo)",
  signature: "Driver (demo)",
  coDriver: "N/A",
  homeTerminal: "Home terminal time",
  carrier: "Carrier name — placeholder",
  carrierAddress: "Main office address — placeholder",
  truck: "Truck #—— / Trailer #——",
  shippingDoc: "BOL # —— (placeholder)",
  shipperCommodity: "Shipper / commodity — placeholder",
};

export const MOCK_HISTORY: TripHistoryItem[] = [
  { id: "T-1042", date: "2026-09-28", route: "Dallas, TX → Atlanta, GA", miles: 924, days: 2, status: "completed" },
  { id: "T-1037", date: "2026-09-22", route: "Denver, CO → Kansas City, MO", miles: 712, days: 2, status: "completed" },
  { id: "T-1031", date: "2026-09-15", route: "Memphis, TN → Columbus, OH", miles: 668, days: 1, status: "completed" },
  { id: "T-1024", date: "2026-09-08", route: "Los Angeles, CA → Salt Lake City, UT", miles: 812, days: 2, status: "completed" },
];
