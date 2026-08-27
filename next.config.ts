import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Trip cover photos, gallery thumbnails, and avatars are served from
    // Supabase Storage's public bucket URL (https://<project-ref>.supabase.co/
    // storage/v1/object/public/...) -- wildcarded by hostname since the
    // project ref differs per Supabase project/environment.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      // Google OAuth profile photo (user_metadata.avatar_url from Supabase's
      // Google sign-in), shown in AuthButton and Settings.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
