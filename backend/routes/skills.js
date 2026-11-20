const express = require("express");
const Skill = require("../models/Skill");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");
const { requireDatabase } = require("../middleware/database");

const router = express.Router();

router.get("/", requireDatabase, requireAuth, async (_req, res) => {
  try {
    const skills = await Skill.find().populate("owner", "name email avatar department bio profileImage available availability").sort({ createdAt: 1 });
    res.json(skills.map((skill) => ({
      _id: skill._id,
      name: skill.name,
      category: skill.category,
      level: skill.level,
      description: skill.description,
      tags: skill.tags,
      availability: skill.availability,
      color: skill.color,
      learners: skill.learners,
      owner: skill.owner
        ? {
          id: skill.owner._id,
          name: skill.owner.name,
          email: skill.owner.email,
          avatar: skill.owner.avatar,
          department: skill.owner.department,
          bio: skill.owner.bio,
          profileImage: skill.owner.profileImage,
          available: skill.owner.available,
          availability: skill.owner.availability || [],
        }
        : null,
      createdAt: skill.createdAt,
    })));
  } catch (error) {
    res.status(500).json({ message: "Could not fetch skills", detail: error.message });
  }
});

router.post("/", requireDatabase, requireAuth, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name || name.length > 80) {
      return res.status(400).json({ message: "Skill name is required and must be 80 characters or fewer" });
    }
    const tags = Array.isArray(req.body.tags)
      ? [...new Set(req.body.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))].slice(0, 12)
      : [];
    const skill = await Skill.create({
      name,
      category: String(req.body.category || "Other").trim().slice(0, 80),
      level: ["Beginner", "Intermediate", "Advanced"].includes(req.body.level) ? req.body.level : "Beginner",
      description: String(req.body.description || "").trim().slice(0, 500),
      tags,
      availability: Array.isArray(req.body.availability) ? req.body.availability.slice(0, 14) : [],
      owner: req.user._id,
    });

    router.patch("/:id", requireDatabase, requireAuth, async (req, res) => {
      try {
        const updates = {};
        for (const key of ["name", "category", "level", "description"]) {
          if (req.body[key] !== undefined) updates[key] = String(req.body[key]).trim();
        }
        if (updates.level && !["Beginner", "Intermediate", "Advanced"].includes(updates.level)) {
          return res.status(400).json({ message: "Invalid proficiency level" });
        }
        if (req.body.tags !== undefined) {
          updates.tags = [...new Set((Array.isArray(req.body.tags) ? req.body.tags : [])
            .map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))].slice(0, 12);
        }
        if (req.body.availability !== undefined) {
          updates.availability = Array.isArray(req.body.availability) ? req.body.availability.slice(0, 14) : [];
        }
        const existing = await Skill.findOne({ _id: req.params.id, owner: req.user._id });
        if (!existing) return res.status(404).json({ message: "Skill not found or not owned by you" });
        const previousName = existing.name;
        Object.assign(existing, updates);
        await existing.save();
        const skill = existing;
        if (updates.name) {
          await User.findByIdAndUpdate(req.user._id, { $pull: { teaches: previousName } });
          await User.findByIdAndUpdate(req.user._id, { $addToSet: { teaches: updates.name } });
        }
        res.json(skill);
      } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: "You already added this skill" });
        res.status(500).json({ message: "Could not update skill", detail: error.message });
      }
    });
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { teaches: skill.name } });
    res.status(201).json(skill);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "You already added this skill" });
    }
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
