// Hand-written to match supabase/schema.sql. If the schema changes, update
// this alongside it (or swap for `supabase gen types typescript` output once
// the project has the Supabase CLI linked).
export type Database = {
  public: {
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Tables: {
      trips: {
        Row: {
          id: string;
          slug: string;
          edit_token_hash: string;
          title: string | null;
          distance_km: number | null;
          duration_ms: number | null;
          route_mode: string;
          route_geojson: { type: "LineString"; coordinates: [number, number][] } | null;
          user_id: string | null;
          is_public: boolean;
          marker_icon_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          edit_token_hash: string;
          title?: string | null;
          distance_km?: number | null;
          duration_ms?: number | null;
          route_mode: string;
          route_geojson?: { type: "LineString"; coordinates: [number, number][] } | null;
          user_id?: string | null;
          is_public?: boolean;
          marker_icon_path?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["trips"]["Insert"]>;
        Relationships: [];
      };
      photos: {
        Row: {
          id: string;
          trip_id: string;
          storage_path: string;
          lat: number;
          lng: number;
          taken_at: string | null;
          sort_order: number;
          place_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          storage_path: string;
          lat?: number | null;
          lng?: number | null;
          taken_at?: string | null;
          sort_order?: number;
          place_name?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["photos"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "photos_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limits: {
        Row: { key: string; count: number; updated_at: string };
        Insert: { key: string; count?: number; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["rate_limits"]["Insert"]>;
        Relationships: [];
      };
    };
  };
};
