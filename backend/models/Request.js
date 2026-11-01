const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    skill: { type: String, required: true, trim: true },
    skillId: { type: mongoose.Schema.Types.ObjectId, ref: "Skill" },
    type: { type: String, enum: ["Learn", "Exchange"], default: "Learn" },
    offeredSkill: { type: String, trim: true, default: "" },
    wantedSkill: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Declined", "Cancelled"],
      default: "Pending",
    },
    message: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Request", requestSchema);
