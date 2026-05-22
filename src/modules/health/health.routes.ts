import { Router } from "express";
import { healthController } from "./health.controller";

const router = Router();
router.get("/", (req, res) => healthController.check(req, res));
router.get("/ping", (req, res) => healthController.ping(req, res));
export default router;
