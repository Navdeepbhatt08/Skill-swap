const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["student", "admin"], default: "student" },
    department: { type: String, default: "Student" },
    avatar: { type: String, default: "SS" },
    bio: { type: String, trim: true, maxlength: 500, default: "" },
    profileImage: { type: String, trim: true, default: "" },
    teaches: { type: [String], default: [] },
    learns: { type: [String], default: [] },
    available: { type: Boolean, default: true },
    whatsapp: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
