const express = require("express");
const router = express.Router();
const {
  getJobs,
  createJob,
  updateJob,
  deleteJob,
  getStats,
  getAIAdvice,
} = require("../controllers/jobController");
const { protect } = require("../middleware/authMiddleware");

// All job routes require authentication
router.use(protect);

router.get("/stats", getStats);
router.post("/ai-advice", getAIAdvice);

router.route("/").get(getJobs).post(createJob);
router.route("/:id").put(updateJob).delete(deleteJob);

module.exports = router;
