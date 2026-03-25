import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log("Starting server initialization...");

  // Load config
  let localConfig: any = {};
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      localConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (e) {
    console.error("Error reading firebase config file", e);
  }

  // Initialize Admin SDK
  if (!admin.apps.length) {
    try {
      const projectId = localConfig.projectId || process.env.VITE_FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
      if (projectId) {
        admin.initializeApp({
          projectId: projectId,
        });
        console.log("Firebase Admin initialized for project:", projectId);
      } else {
        console.warn("No Firebase Project ID found. Firestore features will be limited.");
      }
    } catch (e) {
      console.error("Error initializing Firebase Admin:", e);
    }
  }

  // Initialize Firestore
  let db: any;
  try {
    const databaseId = localConfig.firestoreDatabaseId || process.env.VITE_FIREBASE_DATABASE_ID;
    if (admin.apps.length > 0) {
      // Use the specific database ID if provided, fallback to default if it fails
      try {
        db = getFirestore(admin.app(), databaseId && databaseId !== '(default)' ? databaseId : undefined);
        console.log(`Firestore initialized (Database: ${databaseId || '(default)'}).`);
      } catch (dbErr) {
        console.error(`Failed to initialize Firestore with databaseId ${databaseId}, trying default...`, dbErr);
        db = getFirestore(admin.app());
      }
    }
  } catch (e) {
    console.error("Error initializing Firestore:", e);
  }

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString(), dbReady: !!db });
  });

  // API Route for News (Now just a proxy to Firestore if needed, or we can do it in frontend)
  app.get("/api/news", async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({ error: "Database not ready" });
      }
      
      const newsDoc = await db.collection('system_news').doc('latest').get();
      if (newsDoc.exists) {
        return res.json(newsDoc.data());
      }
      res.status(404).json({ error: "No news found" });
    } catch (error) {
      console.error("News API error:", error);
      res.status(500).json({ error: "Failed to fetch news from DB" });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing Vite middleware...");
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      
      // Manual fallback for SPA in dev mode
      app.get("*", async (req, res, next) => {
        const url = req.originalUrl;
        if (url.startsWith('/api')) return next();
        
        try {
          let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) {
          console.error("Vite transform error:", e);
          next(e);
        }
      });
    } catch (viteErr) {
      console.error("Failed to start Vite server:", viteErr);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(console.error);
