const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const http = require("http");
const dotenv = require("dotenv");

// Load backend .env first, then root .env if present
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const bcrypt = require("bcryptjs");
const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { Server } = require("socket.io");
const User = require("./models/User");
const Skill = require("./models/Skill");
const Request = require("./models/Request");
const Message = require("./models/Message");
const Session = require("./models/Session");
const Review = require("./models/Review");
const { requireAuth } = require("./middleware/auth");
const { requireDatabase } = require("./middleware/database");
const { publicMessage, publicReview, publicSession, publicUser } = require("./utils/serializers");
const { normalizeResource } = require("./utils/resources");
const authRoutes = require("./routes/auth");
const skillRoutes = require("./routes/skills");

const app = express();
const httpServer = http.createServer(app);
const port = process.env.PORT || 5000;
const uploadDirectory = path.join(__dirname, "uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });

const resourceUpload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// CORS configuration for deployment
const allowedOrigins = process.env.CLIENT_URL || process.env.FRONTEND_URL || process.env.CORS_ORIGIN;
if (allowedOrigins) {
  const originList = allowedOrigins.split(",").map((o) => o.trim());
  app.use(cors({ origin: originList, credentials: true }));
} else {
  app.use(cors());
}

app.use(express.json());
app.use("/uploads", express.static(uploadDirectory, { fallthrough: false }));

async function hasAcceptedConnection(userId, otherUserId) {
  return Request.exists({
    status: "Accepted",
    $or: [
      { from: userId, to: otherUserId },
      { from: otherUserId, to: userId },
    ],
  });
}

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins ? allowedOrigins.split(",").map((origin) => origin.trim()) : true,
    credentials: true,
  },
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Login required"));
    const payload = jwt.verify(
      token.replace("Bearer ", ""),
      process.env.JWT_SECRET || "skillswap-development-secret",
    );
    const user = await User.findById(payload.userId);
    if (!user) return next(new Error("User not found"));
    socket.user = user;
    next();
  } catch {
    next(new Error("Invalid or expired login"));
  }
});

io.on("connection", (socket) => {
  const userId = String(socket.user._id);
  socket.join(userId);

  socket.on("chat:read", async (otherUserId) => {
    if (!otherUserId || !(await hasAcceptedConnection(socket.user._id, otherUserId))) return;
    await Message.updateMany(
      { from: otherUserId, to: socket.user._id, readAt: null },
      { $set: { readAt: new Date() } },
    );
  });

  socket.on("chat:send", async ({ toUserId, text, resource }, callback) => {
    try {
      const messageText = String(text || "").trim();
      const messageResource = normalizeResource(resource);
      if (!messageText && !messageResource) throw new Error("Message or resource is required");
      if (messageText.length > 2000) throw new Error("Message cannot exceed 2000 characters");
      if (!(await hasAcceptedConnection(socket.user._id, toUserId))) {
        throw new Error("Chat is available after a request is accepted");
      }

      const message = await Message.create({
        from: socket.user._id,
        to: toUserId,
        text: messageText,
        resource: messageResource,
      });
      const payload = publicMessage(message);
      io.to(userId).to(String(toUserId)).emit("chat:message", payload);
      callback?.({ ok: true });
    } catch (error) {
      callback?.({ ok: false, message: error.message });
    }
  });
});

app.get("/api/health", (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? "ok" : "unavailable",
    database: connected ? "mongodb" : "disconnected",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/skills", skillRoutes);

app.get("/api/users", requireDatabase, requireAuth, async (_req, res) => {
  try {
    const users = await User.find()
      .select("name role department avatar teaches learns available")
      .sort({ createdAt: 1 });
    res.json(
      users.map((user) => ({ ...publicUser(user), role: user.department })),
    );
  } catch (error) {
    res.status(500).json({ message: "Could not fetch users", detail: error.message });
  }
});

function matchingProfile(viewer, candidate) {
  const viewerOffers = new Set((viewer.teaches || []).map((skill) => skill.trim().toLowerCase()));
  const viewerWants = new Set((viewer.learns || []).map((skill) => skill.trim().toLowerCase()));
  const candidateOffers = new Set((candidate.teaches || []).map((skill) => skill.trim().toLowerCase()));
  const candidateWants = new Set((candidate.learns || []).map((skill) => skill.trim().toLowerCase()));
  const viewerToCandidate = [...viewerWants].filter((skill) => candidateOffers.has(skill));
  const candidateToViewer = [...candidateWants].filter((skill) => viewerOffers.has(skill));
  const total = viewerWants.size + candidateWants.size;
  const matched = viewerToCandidate.length + candidateToViewer.length;
  return {
    score: total ? Math.round((matched / total) * 100) : 0,
    matchedSkills: [...new Set([...viewerToCandidate, ...candidateToViewer])],
    reciprocal: { viewerToCandidate, candidateToViewer },
  };
}

app.get("/api/matches", requireDatabase, requireAuth, async (req, res) => {
  try {
    const candidates = await User.find({ _id: { $ne: req.user._id } })
      .select("name email role department avatar bio profileImage teaches learns available")
      .sort({ createdAt: 1 });
    const matches = candidates
      .map((candidate) => ({ user: publicUser(candidate), ...matchingProfile(req.user, candidate) }))
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score);
    res.json(matches);
  } catch (error) {
    res.status(500).json({ message: "Could not calculate matches", detail: error.message });
  }
});

app.get("/api/dashboard", requireDatabase, requireAuth, async (req, res) => {
  try {
    const [offered, pendingRequests, acceptedSwaps, upcomingSessions, matches] = await Promise.all([
      Skill.countDocuments({ owner: req.user._id }),
      Request.countDocuments({ to: req.user._id, status: "Pending" }),
      Request.countDocuments({ status: "Accepted", $or: [{ from: req.user._id }, { to: req.user._id }] }),
      Session.countDocuments({
        $or: [{ requester: req.user._id }, { recipient: req.user._id }],
        startAt: { $gte: new Date() },
        status: { $in: ["Pending", "Accepted"] },
      }),
      User.find({ _id: { $ne: req.user._id } })
        .select("name email role department avatar bio profileImage teaches learns available")
        .then((users) => users.map((candidate) => ({ user: publicUser(candidate), ...matchingProfile(req.user, candidate) })).filter((match) => match.score > 0).sort((a, b) => b.score - a.score).slice(0, 5)),
    ]);
    res.json({
      offeredSkills: offered,
      wantedSkills: (req.user.learns || []).length,
      pendingRequests,
      acceptedSwaps,
      upcomingSessions,
      recommendedMatches: matches,
    });
  } catch (error) {
    res.status(500).json({ message: "Could not fetch dashboard", detail: error.message });
  }
});

// GET /api/requests — returns ONLY requests that:
//   1. Have a valid `to` field (old requests without `to` are excluded entirely)
//   2. The logged-in user is either the sender (from) or the recipient (to)
app.get("/api/requests", requireDatabase, requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const requests = await Request.find({
      // Must have a `to` field — filters out all legacy requests without a recipient
      to: { $exists: true, $ne: null },
      $or: [{ to: userId }, { from: userId }],
    })
      .populate("from", "name email whatsapp")
      .populate("to", "name email whatsapp")
      .sort({ createdAt: -1 });

    res.json(
      requests.map((r) => ({
        id: r._id,
        from: r.from?.name || "Unknown",
        fromEmail: r.from?.email || "",
        fromWhatsapp: r.from?.whatsapp || "",
        fromId: r.from?._id,
        to: r.to?.name || "Unknown",
        toEmail: r.to?.email || "",
        toWhatsapp: r.to?.whatsapp || "",
        toId: r.to?._id,
        skill: r.skill,
        skillId: r.skillId,
        type: r.type,
        offeredSkill: r.offeredSkill || "",
        wantedSkill: r.wantedSkill || "",
        status: r.status,
        message: r.message || "",
        isMine: String(r.from?._id) === String(userId),
        date: r.createdAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      }))
    );
  } catch (error) {
    res.status(500).json({ message: "Could not fetch requests", detail: error.message });
  }
});

// DELETE /api/admin/requests/stale — removes old requests that have no `to` field (admin only)
app.delete("/api/admin/requests/stale", requireDatabase, requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    const result = await Request.deleteMany({ to: { $exists: false } });
    const result2 = await Request.deleteMany({ to: null });
    res.json({ deleted: result.deletedCount + result2.deletedCount, message: "Stale requests cleaned up" });
  } catch (error) {
    res.status(500).json({ message: "Cleanup failed", detail: error.message });
  }
});

// POST /api/requests — requires a `to` (recipient user id) field
app.post("/api/requests", requireDatabase, requireAuth, async (req, res) => {
  try {
    const { skill, skillId, toUserId, type, message, offeredSkill, wantedSkill } = req.body;

    if (!toUserId) {
      return res.status(400).json({ message: "Recipient user id (toUserId) is required" });
    }
    if (String(toUserId) === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot request your own skill" });
    }
    const duplicate = await Request.exists({
      from: req.user._id,
      to: toUserId,
      status: "Pending",
      skill: skill || "New skill",
    });
    if (duplicate) return res.status(409).json({ message: "You already have a pending request for this skill" });

    const toUser = await User.findById(toUserId);
    if (!toUser) {
      return res.status(404).json({ message: "Recipient user not found" });
    }

    const request = await Request.create({
      from: req.user._id,
      to: toUserId,
      skill: skill || "New skill",
      skillId: skillId || undefined,
      type: type || "Learn",
      offeredSkill: offeredSkill || "",
      wantedSkill: wantedSkill || skill || "",
      message: message || "",
    });

    await request.populate("from", "name email whatsapp");
    await request.populate("to", "name email whatsapp");

    res.status(201).json({
      id: request._id,
      from: request.from?.name,
      fromId: request.from?._id,
      to: request.to?.name,
      toId: request.to?._id,
      skill: request.skill,
      type: request.type,
      status: request.status,
      isMine: true,
      date: "Just now",
    });
  } catch (error) {
    res.status(500).json({ message: "Could not create request", detail: error.message });
  }
});

// PATCH /api/requests/:id — accept or decline a request (only the recipient can do this)
app.patch("/api/requests/:id", requireDatabase, requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["Accepted", "Declined", "Cancelled"].includes(status)) {
      return res.status(400).json({ message: "Status must be Accepted, Declined, or Cancelled" });
    }

    const requestDoc = await Request.findById(req.params.id)
      .populate("from", "name email whatsapp")
      .populate("to", "name email whatsapp");

    if (!requestDoc) {
      return res.status(404).json({ message: "Request not found" });
    }
    const isRecipient = String(requestDoc.to._id) === String(req.user._id);
    const isSender = String(requestDoc.from._id) === String(req.user._id);
    if (!isRecipient && !isSender) {
      return res.status(403).json({ message: "Only the recipient can accept or decline" });
    }
    if (status === "Cancelled" && (!isSender || requestDoc.status !== "Pending")) {
      return res.status(403).json({ message: "Only the sender can cancel a pending request" });
    }
    if (status !== "Cancelled" && (!isRecipient || requestDoc.status !== "Pending")) {
      return res.status(403).json({ message: "Only the recipient can respond to a pending request" });
    }

    requestDoc.status = status;
    await requestDoc.save();

    const userId = req.user._id;
    res.json({
      id: requestDoc._id,
      from: requestDoc.from?.name,
      fromEmail: status === "Accepted" ? requestDoc.from?.email : undefined,
      fromWhatsapp: status === "Accepted" ? requestDoc.from?.whatsapp : undefined,
      fromId: requestDoc.from?._id,
      to: requestDoc.to?.name,
      toEmail: status === "Accepted" ? requestDoc.to?.email : undefined,
      toWhatsapp: status === "Accepted" ? requestDoc.to?.whatsapp : undefined,
      toId: requestDoc.to?._id,
      skill: requestDoc.skill,
      type: requestDoc.type,
      status: requestDoc.status,
      isMine: String(requestDoc.from?._id) === String(userId),
      date: requestDoc.createdAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    });

  } catch (error) {
    res.status(500).json({ message: "Could not update request", detail: error.message });
  }
});

app.get("/api/connections", requireDatabase, requireAuth, async (req, res) => {
  try {
    const requests = await Request.find({
      status: "Accepted",
      $or: [{ from: req.user._id }, { to: req.user._id }],
    }).populate("from to", "name email avatar department teaches learns available");

    const users = new Map();
    requests.forEach((request) => {
      const other = String(request.from._id) === String(req.user._id)
        ? request.to
        : request.from;
      users.set(String(other._id), publicUser(other));
    });
    res.json([...users.values()]);
  } catch (error) {
    res.status(500).json({ message: "Could not fetch connections", detail: error.message });
  }
});

app.get("/api/notifications", requireDatabase, requireAuth, async (req, res) => {
  try {
    const [unreadMessages, pendingSessions] = await Promise.all([
      Message.countDocuments({ to: req.user._id, readAt: null }),
      Session.countDocuments({
        recipient: req.user._id,
        status: "Pending",
      }),
    ]);
    res.json({
      unreadMessages,
      pendingSessions,
      total: unreadMessages + pendingSessions,
    });
  } catch (error) {
    res.status(500).json({ message: "Could not fetch notifications", detail: error.message });
  }
});

app.get("/api/messages/:userId", requireDatabase, requireAuth, async (req, res) => {
  try {
    if (!(await hasAcceptedConnection(req.user._id, req.params.userId))) {
      return res.status(403).json({ message: "Chat is available after a request is accepted" });
    }
    const messages = await Message.find({
      $or: [
        { from: req.user._id, to: req.params.userId },
        { from: req.params.userId, to: req.user._id },
      ],
    }).sort({ createdAt: 1 }).limit(200);
    await Message.updateMany(
      { from: req.params.userId, to: req.user._id, readAt: null },
      { $set: { readAt: new Date() } },
    );
    res.json(messages.map(publicMessage));
  } catch (error) {
    res.status(500).json({ message: "Could not fetch messages", detail: error.message });
  }
});

app.post(
  "/api/resources/upload",
  requireDatabase,
  requireAuth,
  (req, res, next) => resourceUpload.single("file")(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Files must be 10 MB or smaller" });
    }
    return res.status(400).json({ message: error.message || "Could not upload file" });
  }),
  (req, res) => {
    if (!req.file) return res.status(400).json({ message: "Choose a file to upload" });
    res.status(201).json({
      resource: {
        kind: "file",
        label: req.file.originalname.slice(0, 120),
        url: `/uploads/${req.file.filename}`,
        fileName: req.file.originalname.slice(0, 255),
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });
  },
);

app.post("/api/messages/:userId", requireDatabase, requireAuth, async (req, res) => {
  try {
    const text = String(req.body.text || "").trim();
    let resource;
    try {
      resource = normalizeResource(req.body.resource);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
    if (!text && !resource) return res.status(400).json({ message: "Message or resource is required" });
    if (text.length > 2000) return res.status(400).json({ message: "Message cannot exceed 2000 characters" });
    if (!(await hasAcceptedConnection(req.user._id, req.params.userId))) {
      return res.status(403).json({ message: "Chat is available after a request is accepted" });
    }
    const message = await Message.create({
      from: req.user._id,
      to: req.params.userId,
      text,
      resource,
    });
    res.status(201).json(publicMessage(message));
  } catch (error) {
    res.status(500).json({ message: "Could not send message", detail: error.message });
  }
});

app.get("/api/sessions", requireDatabase, requireAuth, async (req, res) => {
  try {
    const sessions = await Session.find({
      $or: [{ requester: req.user._id }, { recipient: req.user._id }],
    }).populate("requester recipient", "name");
    const reviews = await Review.find({
      session: { $in: sessions.map((session) => session._id) },
    }).populate("reviewer reviewee", "name");
    const reviewsBySession = reviews.reduce((result, review) => {
      const sessionId = String(review.session);
      if (!result[sessionId]) result[sessionId] = [];
      result[sessionId].push(review);
      return result;
    }, {});
    const reviewedSessions = new Set(
      (await Review.find({
        reviewer: req.user._id,
        session: { $in: sessions.map((session) => session._id) },
      }).select("session")).map((review) => String(review.session)),
    );
    sessions.forEach((session) => {
      session.reviewed = reviewedSessions.has(String(session._id));
      session.reviews = reviewsBySession[String(session._id)] || [];
    });
    res.json(sessions.sort((a, b) => a.startAt - b.startAt).map(publicSession));
  } catch (error) {
    res.status(500).json({ message: "Could not fetch sessions", detail: error.message });
  }
});

app.post("/api/sessions", requireDatabase, requireAuth, async (req, res) => {
  try {
    const { recipientId, skill, title, description, startAt, endAt } = req.body;
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (!recipientId || !skill || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ message: "A skill and valid start/end times are required" });
    }
    if (!(await hasAcceptedConnection(req.user._id, recipientId))) {
      return res.status(403).json({ message: "Sessions are available after a request is accepted" });
    }
    const overlap = await Session.exists({
      status: { $in: ["Pending", "Accepted"] },
      $or: [{ requester: req.user._id }, { recipient: req.user._id }],
      startAt: { $lt: end },
      endAt: { $gt: start },
    });
    if (overlap) return res.status(409).json({ message: "You already have a session during that time" });
    const session = await Session.create({
      requester: req.user._id,
      recipient: recipientId,
      skill,
      title: String(title || "").trim().slice(0, 120),
      description: String(description || "").trim().slice(0, 1000),
      startAt: start,
      endAt: end,
    });
    await session.populate("requester recipient", "name");
    res.status(201).json(publicSession(session));
  } catch (error) {
    res.status(500).json({ message: "Could not schedule session", detail: error.message });
  }
});

app.patch("/api/sessions/:id", requireDatabase, requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["Accepted", "Declined", "Cancelled", "Completed"].includes(status)) {
      return res.status(400).json({ message: "Invalid session status" });
    }
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: "Session not found" });
    const isRequester = String(session.requester) === String(req.user._id);
    const isRecipient = String(session.recipient) === String(req.user._id);
    if (!isRequester && !isRecipient) return res.status(403).json({ message: "Not allowed" });
    if (status === "Accepted" || status === "Declined") {
      if (!isRecipient || session.status !== "Pending") {
        return res.status(403).json({ message: "Only the recipient can respond to a pending session" });
      }
    }
    session.status = status;
    await session.save();
    await session.populate("requester recipient", "name");
    res.json(publicSession(session));
  } catch (error) {
    res.status(500).json({ message: "Could not update session", detail: error.message });
  }
});

app.get("/api/reviews/user/:userId", requireDatabase, requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const reviews = await Review.find({ reviewee: req.params.userId })
      .populate("reviewer", "name avatar")
      .sort({ createdAt: -1 })
      .limit(50);
    const summary = reviews.reduce(
      (result, review) => {
        result.count += 1;
        result.total += review.rating;
        return result;
      },
      { count: 0, total: 0 },
    );
    res.json({
      average: summary.count ? Number((summary.total / summary.count).toFixed(1)) : 0,
      count: summary.count,
      reviews: reviews.map(publicReview),
    });
  } catch (error) {
    res.status(500).json({ message: "Could not fetch reviews", detail: error.message });
  }
});

app.post("/api/reviews", requireDatabase, requireAuth, async (req, res) => {
  try {
    const { sessionId, rating, comment } = req.body;
    const numericRating = Number(rating);
    if (!mongoose.Types.ObjectId.isValid(sessionId) || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: "A session and rating from 1 to 5 are required" });
    }
    if (String(comment || "").trim().length > 500) {
      return res.status(400).json({ message: "Review cannot exceed 500 characters" });
    }

    const session = await Session.findOne({
      _id: sessionId,
      status: "Completed",
      $or: [{ requester: req.user._id }, { recipient: req.user._id }],
    });
    if (!session) {
      return res.status(403).json({ message: "Reviews are available after a completed session" });
    }

    const reviewee = String(session.requester) === String(req.user._id)
      ? session.recipient
      : session.requester;
    const existing = await Review.exists({ session: session._id, reviewer: req.user._id });
    if (existing) {
      return res.status(409).json({ message: "You already reviewed this session" });
    }

    const review = await Review.create({
      session: session._id,
      reviewer: req.user._id,
      reviewee,
      rating: numericRating,
      comment: String(comment || "").trim(),
    });
    await review.populate("reviewer", "name avatar");
    res.status(201).json(publicReview(review));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "You already reviewed this session" });
    }
    res.status(500).json({ message: "Could not submit review", detail: error.message });
  }
});

app.get(
  "/api/admin/summary",
  requireDatabase,
  requireAuth,
  async (req, res) => {
    try {
      if (req.user.role !== "admin")
        return res.status(403).json({ message: "Admin access required" });
      const [users, skills, activeMatches, reports] = await Promise.all([
        User.countDocuments(),
        Skill.countDocuments(),
        Request.countDocuments({ status: "Accepted" }),
        Request.countDocuments({ status: "Pending" }),
      ]);
      res.json({ users, skills, activeMatches, reports });
    } catch (error) {
      res.status(500).json({ message: "Could not fetch admin summary", detail: error.message });
    }
  },
);

async function seedDatabase() {
  const demoPassword = await bcrypt.hash("demo1234", 12);
  const userPassword = await bcrypt.hash("12345678", 12);

  const aarav = await User.findOneAndUpdate(
    { email: "aarav@skillswap.app" },
    {
      $setOnInsert: {
        name: "Aarav Mehta",
        email: "aarav@skillswap.app",
        passwordHash: demoPassword,
        department: "Computer Science",
        avatar: "AM",
        teaches: ["JavaScript", "Python"],
        learns: ["UI / UX Design"],
        whatsapp: "+911234567890",
      },
    },
    { upsert: true, new: true },
  );

  await User.findOneAndUpdate(
    { email: "admin@skillswap.app" },
    {
      $setOnInsert: {
        name: "SkillSwap Admin",
        email: "admin@skillswap.app",
        passwordHash: demoPassword,
        role: "admin",
        department: "Community Team",
        avatar: "SA",
        whatsapp: "",
      },
    },
    { upsert: true },
  );

  // Seed user shown on the login page demo banner
  const navdeep = await User.findOneAndUpdate(
    { email: "navdeep9557@gmail.com" },
    {
      $setOnInsert: {
        name: "Navdeep",
        email: "navdeep9557@gmail.com",
        passwordHash: userPassword,
        department: "Computer Science",
        avatar: "NB",
        teaches: ["JavaScript", "React"],
        learns: ["Python", "UI / UX Design"],
        whatsapp: "",
      },
    },
    { upsert: true },
  );

  const seedSkills = [
    {
      owner: aarav,
      skills: [
        ["JavaScript", "Development", "Intermediate", "coral", 24],
        ["UI / UX Design", "Design", "Advanced", "mint", 18],
        ["Public Speaking", "Communication", "Beginner", "yellow", 31],
        ["Photography", "Creative", "Intermediate", "lavender", 12],
      ],
    },
    {
      owner: navdeep,
      skills: [
        ["Python", "Development", "Advanced", "blue", 42],
        ["Digital Marketing", "Business", "Intermediate", "peach", 9],
        ["React", "Development", "Intermediate", "blue", 16],
        ["Content Writing", "Communication", "Beginner", "yellow", 11],
      ],
    },
  ];
  for (const { owner, skills } of seedSkills) {
    for (const [name, category, level, color, learners] of skills) {
      await Skill.findOneAndUpdate(
        { name, owner: owner._id },
        {
          $setOnInsert: {
            name,
            category,
            level,
            color,
            learners,
            owner: owner._id,
          },
        },
        { upsert: true },
      );
    }
  }
}

// Serve frontend build in production / single-service deployment if dist exists
const frontendDistPath = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.json({
      name: "SkillSwap API",
      status: "online",
      endpoints: {
        health: "/api/health",
        login: "POST /api/auth/login",
        register: "POST /api/auth/register",
        skills: "GET /api/skills",
      },
    });
  });
}

// 404 handler for API routes
app.all("/api/*", (_req, res) => {
  res.status(404).json({ message: "API endpoint not found" });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("Server error:", err);
  res.status(500).json({ message: "Internal server error", detail: err.message });
});

async function start() {
  if (!process.env.MONGODB_URI) {
    console.warn(
      "MONGODB_URI is not configured. API data routes will remain unavailable.",
    );
  } else {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
      });
      console.log("Connected to MongoDB");
      try {
        await seedDatabase();
        console.log("Seeded demo database records");
      } catch (seedErr) {
        console.warn("Database seed warning:", seedErr.message);
      }
      // Clean up legacy requests that were created without a `to` recipient field.
      // These old records polluted every user's dashboard.
      try {
        const stale = await Request.deleteMany({
          $or: [{ to: { $exists: false } }, { to: null }],
        });
        if (stale.deletedCount > 0) {
          console.log(`Cleaned up ${stale.deletedCount} legacy request(s) without a recipient.`);
        }
      } catch (cleanErr) {
        console.warn("Stale request cleanup warning:", cleanErr.message);
      }
    } catch (error) {
      console.error("MongoDB connection failed:", error.message);
    }
  }

  httpServer.listen(port, () =>
    console.log(`SkillSwap API running on port ${port}`),
  );
}

start();
