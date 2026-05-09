import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ??
      "https://yqgtjgvqeogsykkpgxiy.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZ3RqZ3ZxZW9nc3lra3BneGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNzU0NDksImV4cCI6MjA5Mzg1MTQ0OX0.oeUTdvM_2J9njLuO3N9e7TQY2i1mqN2s0DWrtXIfqlE",
  },
  experimental: {
    cpus: 1,
    workerThreads: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
