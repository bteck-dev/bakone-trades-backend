import { Router } from "express";
import { authController } from "./auth.controller";
import { authMiddleware } from "../../middleware/auth";

const router = Router();

router.post("/login", (req, res) => authController.login(req, res));
router.get("/me", authMiddleware, (req, res) => authController.getMe(req, res));
router.post("/change-password", authMiddleware, (req, res) => authController.changePassword(req, res));

export default router;
