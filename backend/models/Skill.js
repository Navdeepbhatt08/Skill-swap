const mongoose = require("mongoose");

const skillSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, default: "Other", trim: true },
    level: { type: String, default: "Beginner" },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    tags: { type: [String], default: [] },
    availability: {
      type: [{
        day: { type: String, trim: true },
        start: { type: String, trim: true },
        end: { type: String, trim: true },
      }],
      default: [],
    },
    color: { type: String, default: "mint" },
    learners: { type: Number, default: 0 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

skillSchema.index({ owner: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Skill", skillSchema);
