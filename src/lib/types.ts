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
  // URL for the moving marker shown during Play (see TripView.tsx's
  // buildMotoMarkerEl) -- null falls back to the default motorbike icon.
  // markerIconIsCustom distinguishes an owner-uploaded image from the
  // owner's-Google-avatar fallback, so the UI only offers "reset to
  // default" when there's actually something custom to reset.
  markerIconUrl: string | null;
  markerIconIsCustom: boolean;
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
