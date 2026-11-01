const bcrypt = require("bcryptjs");
const express = require("express");
const User = require("../models/User");
const { createToken, requireAuth } = require("../middleware/auth");
const { requireDatabase } = require("../middleware/database");
const { publicUser } = require("../utils/serializers");

const router = express.Router();

router.post("/register", requireDatabase, async (req, res) => {
  try {
    const { name, email, password, department } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const user = await User.create({
      name,
      email,
      department: department || "Student",
      passwordHash: await bcrypt.hash(password, 12),
      avatar: name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    });
    res.status(201).json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: "Could not create account", detail: error.message });
  }
});

router.post("/login", requireDatabase, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email?.toLowerCase() }).select("+passwordHash");
    const passwordMatches = user && (await bcrypt.compare(req.body.password || "", user.passwordHash));
    if (!passwordMatches) return res.status(401).json({ message: "Incorrect email or password" });
    res.json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: "Could not log in", detail: error.message });
  }
});

router.get("/me", requireDatabase, requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

router.patch("/me", requireDatabase, requireAuth, async (req, res) => {
  try {
    const allowed = ["whatsapp", "department", "teaches", "learns", "available", "bio", "profileImage", "name"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: "Could not update profile", detail: error.message });
  }
});

module.exports = router;
