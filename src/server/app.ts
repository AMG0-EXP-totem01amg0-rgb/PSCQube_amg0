import express from "express";
import cors from "cors";

// Routes imports
import authRoutes from "./routes/auth.routes.js";
import maestrosRoutes from "./routes/maestros.routes.js";
import parosRoutes from "./routes/paros.routes.js";
import productionRoutes from "./routes/production.routes.js";
import genericRoutes from "./routes/generic.routes.js";
import syncRoutes from "./routes/sync.routes.js";

const app = express();

const ALLOWED_ORIGINS = [
  "https://psc-qube.vercel.app",
  "https://psc-qube-amg0.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".run.app") || origin.includes(".run.app")) {
      callback(null, true);
    } else {
      callback(new Error(`CORS bloqueado para origen: ${origin}`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-App-Caller"],
}));

// Configure middlewares
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Vercel-specific optimizations: Anti-timeout and global GET Cache-Control
if (process.env.VERCEL) {
  // 1. Anti-Timeout middleware: aborts hung requests after 8 seconds with 504
  app.use("/api", (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          error: "Gateway Timeout",
          message: "La petición excedió el límite de tiempo de ejecución (8s).",
        });
      }
    }, 8000);

    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));

    next();
  });

  // 2. Global Cache-Control for GET /api requests
  app.use("/api", (req, res, next) => {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "public, max-age=60, s-maxage=120, stale-while-revalidate=600");
    }
    next();
  });
}

// Register routes
app.use(authRoutes);
app.use(maestrosRoutes);
app.use(parosRoutes);
app.use(productionRoutes);
app.use(genericRoutes);
app.use(syncRoutes);

export default app;
