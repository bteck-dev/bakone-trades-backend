import { Router } from "express";
import { licensesController } from "./licenses.controller";
import { authMiddleware } from "../../middleware/auth";

const router = Router();
router.get("/stock", authMiddleware, (req, res) => licensesController.getStockStatus(req, res));
router.get("/notes", authMiddleware, (req, res) => licensesController.getNotes(req, res));
router.post("/notes", authMiddleware, (req, res) => licensesController.addNote(req, res));
export default router;
