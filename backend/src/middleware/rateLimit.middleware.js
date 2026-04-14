const { AppError } = require("../utils/appError");

function createRateLimiter({
  keyPrefix,
  windowMs,
  max,
  message,
}) {
  const bucket = new Map();

  return (req, _res, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${req.ip}:${req.body?.session_token || req.body?.session_id || "anon"}`;
    const entry = bucket.get(key);

    if (!entry || now > entry.resetAt) {
      bucket.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (entry.count >= max) {
      next(new AppError(429, message));
      return;
    }

    entry.count += 1;
    next();
  };
}

module.exports = { createRateLimiter };
