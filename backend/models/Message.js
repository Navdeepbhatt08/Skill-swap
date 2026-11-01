const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, default: "", trim: true, maxlength: 2000 },
    resource: {
      kind: { type: String, enum: ["link", "file"], default: "link" },
      label: { type: String, trim: true, maxlength: 120 },
      url: { type: String, trim: true, maxlength: 2048 },
      fileName: { type: String, trim: true, maxlength: 255 },
      mimeType: { type: String, trim: true, maxlength: 120 },
      size: { type: Number, min: 0 },
    },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

messageSchema.index({ from: 1, to: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);
