export type RouteMode = "road" | "straight";

export type TripPhoto = {
  id: string;
  url: string;
  lat: number;
  lng: number;
  takenAt: string | null;
  sortOrder: number;
  placeName: string | null;
};

export type Trip = {
  slug: string;
  title: string | null;
  distanceKm: number;
  durationMs: number;
  routeMode: RouteMode;
  routeCoords: [number, number][]; // [lng, lat] pairs, GeoJSON order
  photos: TripPhoto[];
  isPublic: boolean;
  createdAt: string;
};

export type CreateTripPhotoInput = {
  fileName: string;
  lat: number;
  lng: number;
  takenAt: string | null;
  dataUrl: string; // compressed image as base64 data URL
};

export type CreateTripResponse = {
  slug: string;
  editToken: string;
  shareUrl: string;
  editUrl: string;
};
