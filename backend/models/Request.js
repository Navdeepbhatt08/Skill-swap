const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    skill: { type: String, required: true, trim: true },
    type: { type: String, enum: ["Learn", "Exchange"], default: "Learn" },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Declined"],
      default: "Pending",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Request", requestSchema);
