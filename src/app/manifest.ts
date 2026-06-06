import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VAYAX",
    short_name: "VAYAX",
    description: "Your car, our care",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7fbff",
    theme_color: "#0785e8",
    orientation: "portrait",
    icons: [
      {
        src: "/images/vayax-logo-transparent.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
