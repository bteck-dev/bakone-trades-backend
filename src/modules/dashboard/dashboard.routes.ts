import { Router } from "express";
import { dashboardController } from "./dashboard.controller";
import { authMiddleware } from "../../middleware/auth";

const router = Router();
router.get("/stats", authMiddleware, (req, res) => dashboardController.getStats(req, res));
export default router;
