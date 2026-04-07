const bcrypt = require("bcryptjs");

const { User } = require("../models");
const { signupSchema, loginSchema } = require("../validators/auth.validator");
const { signAccessToken } = require("../utils/jwt");
const { AppError } = require("../utils/appError");

function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    created_at: user.createdAt,
  };
}

async function signup(req, res, next) {
  try {
    const payload = signupSchema.parse(req.body);
    const existing = await User.findOne({ email: payload.email.toLowerCase() });
    if (existing) throw new AppError(400, "Email already registered");

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = await User.create({
      name: payload.name,
      email: payload.email.toLowerCase(),
      passwordHash,
      role: payload.role,
    });

    const accessToken = signAccessToken(user);
    res.json({
      user: serializeUser(user),
      tokens: {
        access_token: accessToken,
        refresh_token: accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const payload = loginSchema.parse(req.body);
    const user = await User.findOne({ email: payload.email.toLowerCase() });
    if (!user) throw new AppError(401, "Invalid email or password");

    const valid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!valid) throw new AppError(401, "Invalid email or password");

    const accessToken = signAccessToken(user);
    res.json({
      user: serializeUser(user),
      tokens: {
        access_token: accessToken,
        refresh_token: accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function me(req, res) {
  res.json(serializeUser(req.user));
}

module.exports = { login, me, serializeUser, signup };
