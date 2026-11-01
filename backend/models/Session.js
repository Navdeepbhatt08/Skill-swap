const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    skill: { type: String, required: true, trim: true },
    title: { type: String, trim: true, maxlength: 120, default: "" },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Declined", "Cancelled", "Completed"],
      default: "Pending",
    },
  },
  { timestamps: true },
);

sessionSchema.index({ requester: 1, recipient: 1, startAt: 1 });

module.exports = mongoose.model("Session", sessionSchema);
