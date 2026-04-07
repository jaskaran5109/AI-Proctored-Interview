const jwt = require("jsonwebtoken");

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET || "development-secret",
    { expiresIn: "8h" },
  );
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET || "development-secret");
}

module.exports = { signAccessToken, verifyToken };
