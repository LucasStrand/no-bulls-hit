import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Determine certificate filenames (adjust if mkcert generated different names)
  const host = 'localhost'; // Or your primary dev domain if not localhost
  const keyFileName = fs.readdirSync('.').find(file => file.includes(host) && file.endsWith('-key.pem'));
  const certFileName = fs.readdirSync('.').find(file => file.includes(host) && !file.includes('-key') && file.endsWith('.pem'));

  if (!keyFileName || !certFileName) {
    console.warn('MKCert certificate files not found in project root. HTTPS might not work.');
  }

  return {
    server: {
      host: "::",
      port: 5173,
      https: keyFileName && certFileName ? {
        key: fs.readFileSync(keyFileName),
        cert: fs.readFileSync(certFileName),
      } : undefined,
    },
    plugins: [
      react(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
