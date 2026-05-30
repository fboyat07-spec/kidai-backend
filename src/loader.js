// Point d'entrée réel — charge dotenvx AVANT tout import ESM
import { config } from "@dotenvx/dotenvx";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

import "./server.js";
