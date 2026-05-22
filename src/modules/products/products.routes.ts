import { Router } from "express";
import { productsController } from "./products.controller";
import { authMiddleware } from "../../middleware/auth";

const router = Router();
router.get("/", (req, res) => productsController.getAll(req, res));
router.get("/admin/all", authMiddleware, (req, res) => productsController.getAllAdmin(req, res));
router.get("/:slug", (req, res) => productsController.getBySlug(req, res));
router.post("/", authMiddleware, (req, res) => productsController.create(req, res));
router.put("/:id", authMiddleware, (req, res) => productsController.update(req, res));
router.delete("/:id", authMiddleware, (req, res) => productsController.remove(req, res));
export default router;
