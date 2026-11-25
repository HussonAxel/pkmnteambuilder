import evlog from "evlog/nitro/v3";
import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./server",
  // Artwork thumbnails (scripts/build-artwork.mjs) keep their name when regenerated, so a month of
  // cache rather than "immutable".
  routeRules: {
    "/artwork/**": { headers: { "cache-control": "public, max-age=2592000" } },
  },
  experimental: {
    asyncContext: true,
  },
  modules: [
    evlog({
      env: { service: "pkmnteambuilder-web" },
    }),
  ],
});
