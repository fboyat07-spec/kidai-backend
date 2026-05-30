import express from "express";
import { ok } from "../utils/respond.js";

const router = express.Router();

router.get("/", (req, res) => {
  ok(res, { entries: [] });
});

export default router;
