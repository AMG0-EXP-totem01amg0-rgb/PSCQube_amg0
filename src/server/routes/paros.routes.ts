import { Router } from "express";
import { ParosService } from "../services/paros.service.js";

const router = Router();

// Specialized endpoints for paros/downtime events can be added here
router.get("/api/paros/health", (req, res) => {
  return res.json({ success: true, message: "Paros routing subsystem fully functional." });
});

export default router;
