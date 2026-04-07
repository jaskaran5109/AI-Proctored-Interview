function notFoundHandler(_req, res) {
  res.status(404).json({ detail: "Route not found" });
}

function errorHandler(err, _req, res, _next) {
  const status = err.statusCode || 500;
  res.status(status).json({
    detail: err.message || "Internal server error",
    ...(err.extra || {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
