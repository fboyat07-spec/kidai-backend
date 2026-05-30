import express from "express";
import { ok } from "../utils/respond.js";

const router = express.Router();

router.post("/request", (req, res) => {
  ok(res, {});
});

export default router;
