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
      enum: ["Pending", "Accepted", "Rejected", "Declined", "Cancelled"],
      default: "Pending",
    },
    message: { type: String, default: "" },
    counterProposal: {
      day: { type: String, default: "" },
      start: { type: String, default: "" },
      end: { type: String, default: "" },
      note: { type: String, default: "" },
    },
    history: [{
      status: { type: String, required: true },
      note: { type: String, default: "" },
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      changedAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Request", requestSchema);
