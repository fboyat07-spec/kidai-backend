import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { attachRequestId, requestLogger } from "./middleware/requestId.js";
import { securityHeaders } from "./middleware/security.js";

const app = express();

function parseAllowedOrigins() {
  const raw = process.env.CORS_ORIGIN || "";
  if (!raw.trim()) {
    return [];
  }
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

const allowedOrigins = parseAllowedOrigins();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(attachRequestId);
app.use(requestLogger);
app.use(securityHeaders);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("cors_not_allowed"));
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "ok", requestId: req.id });
});

app.use("/v1", routes);

app.use(notFound);
app.use(errorHandler);

export default app;
