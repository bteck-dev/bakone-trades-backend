import { Router } from "express";
import { auditController } from "./audit.controller";
import { authMiddleware } from "../../middleware/auth";

const router = Router();

router.get("/", authMiddleware, (req, res) => auditController.getAll(req, res));

export default router;
