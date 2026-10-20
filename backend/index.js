const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

// Load backend .env first, then root .env if present
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const bcrypt = require("bcryptjs");
const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const Skill = require("./models/Skill");
const Request = require("./models/Request");
const { createToken, requireAuth } = require("./middleware/auth");

const app = express();
const port = process.env.PORT || 5000;

// CORS configuration for deployment
const allowedOrigins = process.env.CLIENT_URL || process.env.FRONTEND_URL || process.env.CORS_ORIGIN;
if (allowedOrigins) {
  const originList = allowedOrigins.split(",").map((o) => o.trim());
  app.use(cors({ origin: originList, credentials: true }));
} else {
  app.use(cors());
}

app.use(express.json());

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    avatar: user.avatar,
    teaches: user.teaches,
    learns: user.learns,
    available: user.available,
  };
}

function requireDatabase(_req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: "MongoDB is not connected" });
  }
  next();
}

app.get("/api/health", (_req, res) =>
  res.json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "mongodb" : "disconnected",
  }),
);

app.post("/api/auth/register", requireDatabase, async (req, res) => {
  try {
    const { name, email, password, department } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser)
      return res
        .status(409)
        .json({ message: "An account with this email already exists" });

    const user = await User.create({
      name,
      email,
      department: department || "Student",
      passwordHash: await bcrypt.hash(password, 12),
      avatar: name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    });
    res.status(201).json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Could not create account", detail: error.message });
  }
});

app.post("/api/auth/login", requireDatabase, async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.body.email?.toLowerCase(),
    }).select("+passwordHash");
    const passwordMatches =
      user &&
      (await bcrypt.compare(req.body.password || "", user.passwordHash));
    if (!passwordMatches)
      return res.status(401).json({ message: "Incorrect email or password" });
    res.json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Could not log in", detail: error.message });
  }
});

app.get("/api/auth/me", requireDatabase, requireAuth, (req, res) =>
  res.json({ user: publicUser(req.user) }),
);

app.get("/api/skills", requireDatabase, requireAuth, async (_req, res) => {
  try {
    const skills = await Skill.find().sort({ createdAt: 1 });
    res.json(skills);
  } catch (error) {
    res.status(500).json({ message: "Could not fetch skills", detail: error.message });
  }
});

app.post("/api/skills", requireDatabase, requireAuth, async (req, res) => {
  try {
    const skill = await Skill.create({
      name: req.body.name,
      category: req.body.category || "Other",
      level: req.body.level || "Beginner",
      owner: req.user._id,
    });
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { teaches: skill.name },
    });
    res.status(201).json(skill);
  } catch (error) {
    res.status(500).json({ message: "Could not create skill", detail: error.message });
  }
});

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

app.get("/api/requests", requireDatabase, requireAuth, async (_req, res) => {
  try {
    const requests = await Request.find()
      .populate("from", "name")
      .sort({ createdAt: -1 });
    res.json(
      requests.map((request) => ({
        id: request._id,
        from: request.from?.name || "Student",
        skill: request.skill,
        type: request.type,
        status: request.status,
        date: request.createdAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      })),
    );
  } catch (error) {
    res.status(500).json({ message: "Could not fetch requests", detail: error.message });
  }
});

app.post("/api/requests", requireDatabase, requireAuth, async (req, res) => {
  try {
    const request = await Request.create({
      from: req.user._id,
      skill: req.body.skill || "New skill",
      type: req.body.type || "Learn",
    });
    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ message: "Could not create request", detail: error.message });
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
      },
    },
    { upsert: true },
  );

  // Seed user shown on the login page demo banner
  await User.findOneAndUpdate(
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
      },
    },
    { upsert: true },
  );

  const seedSkills = [
    ["JavaScript", "Development", "Intermediate", "coral", 24],
    ["UI / UX Design", "Design", "Advanced", "mint", 18],
    ["Public Speaking", "Communication", "Beginner", "yellow", 31],
    ["Photography", "Creative", "Intermediate", "lavender", 12],
    ["Python", "Development", "Advanced", "blue", 42],
    ["Digital Marketing", "Business", "Intermediate", "peach", 9],
  ];
  for (const [name, category, level, color, learners] of seedSkills) {
    await Skill.findOneAndUpdate(
      { name },
      {
        $setOnInsert: {
          name,
          category,
          level,
          color,
          learners,
          owner: aarav._id,
        },
      },
      { upsert: true },
    );
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
    } catch (error) {
      console.error("MongoDB connection failed:", error.message);
    }
  }

  app.listen(port, () =>
    console.log(`SkillSwap API running on port ${port}`),
  );
}

start();
