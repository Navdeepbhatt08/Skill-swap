const jwt = require("jsonwebtoken");
const User = require("../models/User");

const secret = process.env.JWT_SECRET || "skillswap-development-secret";

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Login required" });

  try {
    const payload = jwt.verify(token, secret);
    req.user = await User.findById(payload.userId);
    if (!req.user) return res.status(401).json({ message: "User not found" });
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired login" });
  }
}

function createToken(user) {
  return jwt.sign({ userId: user._id.toString() }, secret, { expiresIn: "7d" });
}

module.exports = { createToken, requireAuth };
