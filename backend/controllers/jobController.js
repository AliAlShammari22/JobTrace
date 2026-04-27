const Anthropic = require("@anthropic-ai/sdk");
const Job = require("../models/Job");

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

// @route  GET /api/jobs
const getJobs = async (req, res) => {
  try {
    const { status, search, sort } = req.query;

    const filter = { user: req.user.id };

    if (status && status !== "All") {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { companyName: { $regex: search, $options: "i" } },
        { jobTitle: { $regex: search, $options: "i" } },
      ];
    }

    const sortOptions = {
      newest: { dateApplied: -1 },
      oldest: { dateApplied: 1 },
      company: { companyName: 1 },
    };
    const sortBy = sortOptions[sort] || sortOptions.newest;

    const jobs = await Job.find(filter).sort(sortBy);

    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ message: "Server error. Please try again." });
  }
};

// @route  POST /api/jobs
const createJob = async (req, res) => {
  try {
    const { companyName, jobTitle, status, dateApplied, notes } = req.body;

    if (!companyName || !jobTitle || !dateApplied) {
      return res
        .status(400)
        .json({ message: "Company name, job title, and date applied are required" });
    }

    const job = await Job.create({
      user: req.user.id,
      companyName,
      jobTitle,
      status: status || "Applied",
      dateApplied,
      notes,
    });

    res.status(201).json({ job });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages[0] });
    }
    res.status(500).json({ message: "Server error. Please try again." });
  }
};

// @route  PUT /api/jobs/:id
const updateJob = async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, user: req.user.id });

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const { companyName, jobTitle, status, dateApplied, notes } = req.body;

    job.companyName = companyName ?? job.companyName;
    job.jobTitle = jobTitle ?? job.jobTitle;
    job.status = status ?? job.status;
    job.dateApplied = dateApplied ?? job.dateApplied;
    job.notes = notes ?? job.notes;

    await job.save();

    res.json({ job });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages[0] });
    }
    res.status(500).json({ message: "Server error. Please try again." });
  }
};

// @route  DELETE /api/jobs/:id
const deleteJob = async (req, res) => {
  try {
    const job = await Job.findOneAndDelete({ _id: req.params.id, user: req.user.id });

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.json({ message: "Job deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error. Please try again." });
  }
};

// @route  GET /api/jobs/stats
const getStats = async (req, res) => {
  try {
    const stats = await Job.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const result = { total: 0, Applied: 0, Interview: 0, Offer: 0, Rejected: 0 };

    stats.forEach(({ _id, count }) => {
      result[_id] = count;
      result.total += count;
    });

    res.json({ stats: result });
  } catch (error) {
    res.status(500).json({ message: "Server error. Please try again." });
  }
};

// @route  POST /api/jobs/ai-advice
const getAIAdvice = async (req, res) => {
  try {
    const { message, messages } = req.body;

    let conversationMessages;
    if (messages && Array.isArray(messages) && messages.length > 0) {
      conversationMessages = messages;
    } else if (message && typeof message === "string" && message.trim()) {
      conversationMessages = [{ role: "user", content: message.trim() }];
    } else {
      return res.status(400).json({ message: "Message is required" });
    }

    // Fetch user's job stats for context
    const stats = await Job.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const counts = { total: 0, Applied: 0, Interview: 0, Offer: 0, Rejected: 0 };
    stats.forEach(({ _id, count }) => {
      counts[_id] = count;
      counts.total += count;
    });

    const systemPrompt = `You are JobTrace AI, a career advisor embedded in a job application tracker app.
The user currently has the following application stats:
- Total applications: ${counts.total}
- Applied (awaiting response): ${counts.Applied}
- Interviews scheduled/completed: ${counts.Interview}
- Offers received: ${counts.Offer}
- Rejections: ${counts.Rejected}

Give concise, personalized, and actionable career advice based on these stats and the user's question.
Keep responses under 250 words. Be encouraging but realistic. You may use simple markdown: **bold** for emphasis, bullet lists with "- " for tips, and numbered lists for steps.

If the user asks who built, created, or developed this app or website, always answer: "JobTrace was built by Ali AlShammari." Do not add anything else about the developer.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: systemPrompt,
      messages: conversationMessages,
    });

    res.json({ reply: response.content[0].text });
  } catch (error) {
    if (error.status === 401) {
      return res.status(500).json({ message: "AI service unavailable. Check API key." });
    }
    res.status(500).json({ message: "AI service error. Please try again." });
  }
};

module.exports = { getJobs, createJob, updateJob, deleteJob, getStats, getAIAdvice };
