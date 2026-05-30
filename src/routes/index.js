import express from "express";
import auth from "./auth.js";
import users from "./users.js";
import children from "./children.js";
import diagnostics from "./diagnostics.js";
import skills from "./skills.js";
import exercises from "./exercises.js";
import adaptive from "./adaptive.js";
import spaced from "./spaced.js";
import tutor from "./tutor.js";
import emotion from "./emotion.js";
import quests from "./quests.js";
import gamification from "./gamification.js";
import avatars from "./avatars.js";
import friends from "./friends.js";
import challenges from "./challenges.js";
import leaderboards from "./leaderboards.js";
import parents from "./parents.js";
import analytics from "./analytics.js";
import notifications from "./notifications.js";
import sync from "./sync.js";
import homework from "./homework.js";
import ops from "./ops.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
const enableIncompleteModules = process.env.ENABLE_INCOMPLETE_MODULES === "true";

router.use("/auth", auth);

router.use(requireAuth);
router.use("/users", users);
router.use("/children", children);
router.use("/diagnostics", diagnostics);
router.use("/skills", skills);
router.use("/exercises", exercises);
router.use("/adaptive", adaptive);
router.use("/spaced", spaced);
router.use("/tutor", tutor);
router.use("/emotion", emotion);
router.use("/quests", quests);
router.use("/gamification", gamification);
router.use("/parents", parents);
router.use("/events", analytics);
router.use("/notifications", notifications);
router.use("/sync", sync);
router.use("/homework", homework);
router.use("/ops", ops);

if (enableIncompleteModules) {
  router.use("/avatars", avatars);
  router.use("/friends", friends);
  router.use("/challenges", challenges);
  router.use("/leaderboards", leaderboards);
}

export default router;
