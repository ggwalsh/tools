import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: { host: "0.0.0.0", port: 5173 },
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        wall: "wall.html",
        board: "board.html",
        stock: "stock.html",
      },
    },
  },
});
