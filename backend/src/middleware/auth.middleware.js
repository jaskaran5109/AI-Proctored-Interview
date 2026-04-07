const { User } = require("../models");
const { verifyToken } = require("../utils/jwt");
const { AppError } = require("../utils/appError");

async function requireAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) throw new AppError(401, "Missing access token");

    const payload = verifyToken(token);
    const user = await User.findById(payload.sub).lean();
    if (!user) throw new AppError(401, "User not found");

    req.user = user;
    next();
  } catch (error) {
    next(error.statusCode ? error : new AppError(401, "Invalid token"));
  }
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, "Insufficient permissions"));
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
