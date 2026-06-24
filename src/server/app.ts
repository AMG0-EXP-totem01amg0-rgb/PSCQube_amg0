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

// Register routes
app.use(authRoutes);
app.use(maestrosRoutes);
app.use(parosRoutes);
app.use(productionRoutes);
app.use(genericRoutes);
app.use(syncRoutes);

export default app;
