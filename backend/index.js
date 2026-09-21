const bcrypt = require("bcryptjs");
const cors = require("cors");
const dotenv = require("dotenv");
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const path = require("path");
const User = require("./models/User");
const Skill = require("./models/Skill");
const Request = require("./models/Request");
const { createToken, requireAuth } = require("./middleware/auth");

dotenv.config({ path: path.join(__dirname, ".env") });
const app = express();
const port = process.env.PORT || 5000;
const appSecret = process.env.JWT_SECRET || "skillswap-development-secret";

app.use(cors());
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
  res.json(await Skill.find().sort({ createdAt: 1 }));
});

app.post("/api/skills", requireDatabase, requireAuth, async (req, res) => {
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
});

app.get("/api/users", requireDatabase, requireAuth, async (_req, res) => {
  const users = await User.find()
    .select("name role department avatar teaches learns available")
    .sort({ createdAt: 1 });
  res.json(
    users.map((user) => ({ ...publicUser(user), role: user.department })),
  );
});

app.get("/api/requests", requireDatabase, requireAuth, async (_req, res) => {
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
});

app.post("/api/requests", requireDatabase, requireAuth, async (req, res) => {
  const request = await Request.create({
    from: req.user._id,
    skill: req.body.skill || "New skill",
    type: req.body.type || "Learn",
  });
  res.status(201).json(request);
});

app.get(
  "/api/admin/summary",
  requireDatabase,
  requireAuth,
  async (req, res) => {
    if (req.user.role !== "admin")
      return res.status(403).json({ message: "Admin access required" });
    const [users, skills, activeMatches, reports] = await Promise.all([
      User.countDocuments(),
      Skill.countDocuments(),
      Request.countDocuments({ status: "Accepted" }),
      Request.countDocuments({ status: "Pending" }),
    ]);
    res.json({ users, skills, activeMatches, reports });
  },
);

async function seedDatabase() {
  const demoPassword = await bcrypt.hash("demo1234", 12);
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

async function start() {
  if (!process.env.MONGODB_URI) {
    console.warn(
      "MONGODB_URI is not configured. API data routes will remain unavailable.",
    );
  } else {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
      await seedDatabase();
      console.log("Connected to MongoDB and seeded demo data");
    } catch (error) {
      console.error("MongoDB connection failed:", error.message);
    }
  }
  app.listen(port, () =>
    console.log(`SkillSwap API running on http://localhost:${port}`),
  );
}

start();
