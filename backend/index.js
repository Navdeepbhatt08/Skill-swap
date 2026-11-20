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
      .select("name role department avatar bio profileImage teaches learns available availability bookmarks mentorCapacity")
      .sort({ createdAt: 1 });
    res.json(
      users.map((user) => ({ ...publicUser(user), role: user.department })),
    );
  } catch (error) {
    res.status(500).json({ message: "Could not fetch users", detail: error.message });
  }
});

function tokenize(value) {
  return String(value || "").toLowerCase().match(/[a-z0-9]+/g) || [];
}

function tfidfCosine(left, right, corpus) {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  const terms = [...new Set([...leftTokens, ...rightTokens])];
  if (!terms.length) return 0;
  const documents = corpus.map((item) => new Set(tokenize(item)));
  const vector = (tokens) => terms.map((term) => {
    const termFrequency = tokens.filter((token) => token === term).length / Math.max(tokens.length, 1);
    const documentFrequency = documents.filter((document) => document.has(term)).length;
    return termFrequency * Math.log((documents.length + 1) / (documentFrequency + 1));
  });
  const a = vector(leftTokens);
  const b = vector(rightTokens);
  const magnitude = (values) => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  const denominator = magnitude(a) * magnitude(b);
  return denominator ? a.reduce((sum, value, index) => sum + value * b[index], 0) / denominator : 0;
}

function availabilityOverlap(left = [], right = []) {
  return left.some((first) => right.some((second) => (
    first.day === second.day && first.start < second.end && second.start < first.end
  )));
}

function proficiencyBonus(learnerLevel, mentorLevel) {
  const levels = { Beginner: 1, Intermediate: 2, Advanced: 3 };
  const learner = levels[learnerLevel] || 1;
  const mentor = levels[mentorLevel] || 1;
  return mentor >= learner ? 0.1 : -0.05;
}

function matchingProfile(viewer, candidate, offeredSkill = null, offeredLevel = "Intermediate") {
  const wanted = (viewer.learns || []).map((skill) => String(skill).trim());
  const offers = offeredSkill ? [offeredSkill] : (candidate.teaches || []);
  const corpus = [...wanted, ...offers, ...wanted.flatMap((skill) => tokenize(skill))];
  const scored = offers.map((offer) => ({
    skill: offer,
    similarity: Math.max(...wanted.map((want) => tfidfCosine(want, offer, corpus)), 0),
  })).sort((a, b) => b.similarity - a.similarity)[0];
  const reciprocal = (candidate.learns || []).some((want) =>
    (viewer.teaches || []).some((offer) => tfidfCosine(want, offer, corpus) >= 0.2));
  const overlap = availabilityOverlap(viewer.availability, candidate.availability);
  const similarity = scored?.similarity || 0;
  const score = Math.max(0, Math.min(1, similarity + (overlap ? 0.12 : 0) + (reciprocal ? 0.1 : 0)
    + proficiencyBonus("Beginner", offeredLevel)));
  return {
    score: Math.round(score * 100),
    matchedSkills: scored ? [scored.skill] : [],
    reciprocal,
    availabilityOverlap: overlap,
  };
}

function stableMentorAssignments(learners, mentors) {
  const queues = new Map(learners.map((learner) => [
    String(learner._id),
    mentors
      .map((mentor) => ({ mentor, score: matchingProfile(learner, mentor).score }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => String(entry.mentor._id)),
  ]));
  const assigned = new Map();
  const held = new Map(mentors.map((mentor) => [String(mentor._id), []]));
  const free = learners.map((learner) => String(learner._id));
  while (free.length) {
    const learnerId = free.shift();
    const preferenceQueue = queues.get(learnerId) || [];
    const mentorId = preferenceQueue.shift();
    if (!mentorId) continue;
    const mentor = mentors.find((item) => String(item._id) === mentorId);
    const proposals = [...(held.get(mentorId) || []), learnerId]
      .sort((left, right) => matchingProfile(
        learners.find((item) => String(item._id) === left),
        mentor,
      ).score - matchingProfile(
        learners.find((item) => String(item._id) === right),
        mentor,
      ).score)
      .reverse();
    const capacity = mentor.mentorCapacity || 3;
    held.set(mentorId, proposals.slice(0, capacity));
    proposals.slice(capacity).forEach((rejected) => {
      assigned.delete(rejected);
      if ((queues.get(rejected) || []).length) free.push(rejected);
    });
    held.get(mentorId).forEach((accepted) => assigned.set(accepted, mentorId));
  }
  return assigned;
}

app.get("/api/matches", requireDatabase, requireAuth, async (req, res) => {
  try {
    const candidates = await User.find({ _id: { $ne: req.user._id } })
      .select("name email role department avatar bio profileImage teaches learns available availability mentorCapacity")
      .sort({ createdAt: 1 });
    const candidateSkills = await Skill.find({ owner: { $in: candidates.map((candidate) => candidate._id) } })
      .select("owner name level");
    const skillLevels = new Map(candidateSkills.map((skill) => [`${skill.owner}:${skill.name.toLowerCase()}`, skill.level]));
    const assignments = stableMentorAssignments([req.user], candidates);
    const matches = candidates
      .map((candidate) => {
        const provisional = matchingProfile(req.user, candidate);
        const skill = provisional.matchedSkills[0] || candidate.teaches?.[0] || "";
        const level = skillLevels.get(`${candidate._id}:${skill.toLowerCase()}`) || "Intermediate";
        const profile = matchingProfile(req.user, candidate, skill, level);
        return {
          user: publicUser(candidate),
          offeredSkill: skill,
          wantedSkill: req.user.learns?.[0] || "",
          proficiency: level,
          availability: candidate.availability || [],
          ...profile,
          stable: assignments.get(String(req.user._id)) === String(candidate._id),
        };
      })
      .filter((match) => match.score > 0 && match.stable)
      .sort((a, b) => b.score - a.score);
    res.json(matches);
  } catch (error) {
    res.status(500).json({ message: "Could not calculate matches", detail: error.message });
  }
});

app.get("/api/discover", requireDatabase, requireAuth, async (req, res) => {
  try {
    const query = String(req.query.query || "").trim().toLowerCase();
    const category = String(req.query.category || "").trim();
    const level = String(req.query.level || "").trim();
    const availability = req.query.availability === "true";
    const skills = await Skill.find({ owner: { $ne: req.user._id } })
      .populate("owner", "name email avatar department bio profileImage available availability bookmarks mentorCapacity")
      .sort({ createdAt: -1 });
    const results = skills.filter((skill) => {
      const owner = skill.owner;
      const haystack = [skill.name, skill.category, skill.description, ...(skill.tags || []), owner?.name].join(" ").toLowerCase();
      return (!query || haystack.includes(query))
        && (!category || skill.category === category)
        && (!level || skill.level === level)
        && (!availability || Boolean(owner?.available && owner?.availability?.length));
    }).map((skill) => ({
      _id: skill._id,
      name: skill.name,
      category: skill.category,
      level: skill.level,
      description: skill.description,
      tags: skill.tags,
      availability: skill.availability,
      owner: skill.owner ? { ...publicUser(skill.owner), availability: skill.owner.availability || [] } : null,
    }));
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Could not discover skills", detail: error.message });
  }
});

app.patch("/api/bookmarks/:userId", requireDatabase, requireAuth, async (req, res) => {
  try {
    if (String(req.params.userId) === String(req.user._id)) return res.status(400).json({ message: "You cannot bookmark yourself" });
    const exists = (req.user.bookmarks || []).some((id) => String(id) === String(req.params.userId));
    const update = exists
      ? { $pull: { bookmarks: req.params.userId } }
      : { $addToSet: { bookmarks: req.params.userId } };
    await User.findByIdAndUpdate(req.user._id, update);
    res.json({ bookmarked: !exists, userId: req.params.userId });
  } catch (error) {
    res.status(500).json({ message: "Could not update bookmark", detail: error.message });
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

app.get("/api/requests", requireDatabase, requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const requests = await Request.find({
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
        counterProposal: r.counterProposal || null,
        history: r.history || [],
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
      status: { $in: ["Pending", "Accepted"] },
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
      history: [{ status: "Pending", changedBy: req.user._id }],
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
      offeredSkill: request.offeredSkill || "",
      wantedSkill: request.wantedSkill || "",
      status: request.status,
      history: request.history || [],
      isMine: true,
      date: "Just now",
    });
  } catch (error) {
    res.status(500).json({ message: "Could not create request", detail: error.message });
  }
});

app.patch("/api/requests/:id", requireDatabase, requireAuth, async (req, res) => {
  try {
    const { status, counterProposal } = req.body;
    if (!["Pending", "Accepted", "Rejected", "Declined", "Cancelled"].includes(status)) {
      return res.status(400).json({ message: "Status must be Accepted, Rejected, Declined, or Cancelled" });
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

    const previousStatus = requestDoc.status;
    requestDoc.status = status;
    if (counterProposal && isRecipient && previousStatus === "Pending") {
      requestDoc.counterProposal = {
        day: String(counterProposal.day || ""),
        start: String(counterProposal.start || ""),
        end: String(counterProposal.end || ""),
        note: String(counterProposal.note || "").slice(0, 500),
      };
    }
    requestDoc.history.push({ status, note: counterProposal?.note || "", changedBy: req.user._id });
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
      offeredSkill: requestDoc.offeredSkill || "",
      wantedSkill: requestDoc.wantedSkill || "",
      status: requestDoc.status,
      counterProposal: requestDoc.counterProposal || null,
      history: requestDoc.history || [],
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
      const userId = String(other._id);
      const current = users.get(userId) || { ...publicUser(other), exchangeSkills: [] };
      if (request.skill && !current.exchangeSkills.includes(request.skill)) {
        current.exchangeSkills.push(request.skill);
      }
      users.set(userId, current);
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
      } catch (seedErr) {
        console.warn("Database seed warning:", seedErr.message);
      }

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
