import express from "express";

// Routes imports
import authRoutes from "./routes/auth.routes.js";
import maestrosRoutes from "./routes/maestros.routes.js";
import parosRoutes from "./routes/paros.routes.js";
import productionRoutes from "./routes/production.routes.js";
import genericRoutes from "./routes/generic.routes.js";

const app = express();

// Configure middlewares
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Register routes
app.use(authRoutes);
app.use(maestrosRoutes);
app.use(parosRoutes);
app.use(productionRoutes);
app.use(genericRoutes);

export default app;
