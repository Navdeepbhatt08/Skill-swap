const express = require("express");
const Skill = require("../models/Skill");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");
const { requireDatabase } = require("../middleware/database");

const router = express.Router();

router.get("/", requireDatabase, requireAuth, async (_req, res) => {
  try {
    const skills = await Skill.find().populate("owner", "name email").sort({ createdAt: 1 });
    res.json(skills.map((skill) => ({
      _id: skill._id,
      name: skill.name,
      category: skill.category,
      level: skill.level,
      color: skill.color,
      learners: skill.learners,
      owner: skill.owner
        ? { id: skill.owner._id, name: skill.owner.name, email: skill.owner.email }
        : null,
      createdAt: skill.createdAt,
    })));
  } catch (error) {
    res.status(500).json({ message: "Could not fetch skills", detail: error.message });
  }
});

router.post("/", requireDatabase, requireAuth, async (req, res) => {
  try {
    const skill = await Skill.create({
      name: req.body.name,
      category: req.body.category || "Other",
      level: req.body.level || "Beginner",
      owner: req.user._id,
    });
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { teaches: skill.name } });
    res.status(201).json(skill);
  } catch (error) {
    res.status(500).json({ message: "Could not create skill", detail: error.message });
  }
});

router.delete("/:id", requireDatabase, requireAuth, async (req, res) => {
  try {
    const skill = await Skill.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!skill) return res.status(404).json({ message: "Skill not found or not owned by you" });
    await User.findByIdAndUpdate(req.user._id, { $pull: { teaches: skill.name } });
    res.json({ id: skill._id });
  } catch (error) {
    res.status(500).json({ message: "Could not delete skill", detail: error.message });
  }
});

module.exports = router;
