import express from "express";
import { ok } from "../utils/respond.js";

const router = express.Router();

router.post("/", (req, res) => {
  ok(res, { challenge: null });
});

export default router;
