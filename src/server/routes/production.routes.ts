import { Router } from "express";
import { ProductionService } from "../services/production.service.js";

const router = Router();

// Specialized endpoints for Production reports can be added here
router.post("/api/production/recalculate", async (req, res) => {
  try {
    await ProductionService.autoRecalculateProductionMetrics();
    return res.json({ success: true, message: "Production metrics successfully recalculated." });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
