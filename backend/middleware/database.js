const mongoose = require("mongoose");

function requireDatabase(_req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: "MongoDB is not connected" });
  }
  next();
}

module.exports = { requireDatabase };
