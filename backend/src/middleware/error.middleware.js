const { logger } = require("../utils/logger");

function notFoundHandler(_req, res) {
  res.status(404).json({ detail: "Route not found" });
}

function errorHandler(err, _req, res, _next) {
  const status = err.statusCode || 500;
  if (status >= 500) {
    logger.error(err.message || "Internal server error", {
      stack: err.stack,
      extra: err.extra,
    });
  }
  res.status(status).json({
    detail: err.message || "Internal server error",
    ...(err.extra || {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
