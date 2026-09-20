import type { MetadataRoute } from "next";
import { themeColors } from "@/lib/theme-colors";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "My Napkin",
    short_name: "Napkin",
    start_url: "/",
    display: "standalone",
    background_color: themeColors.light,
    theme_color: themeColors.light,
    icons: [
      { src: "/static/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/static/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
