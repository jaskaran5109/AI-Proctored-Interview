const bcrypt = require("bcryptjs");

const { User } = require("../models");

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const existing = await User.findOne({ email });
  if (existing) return;

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    name: "Platform Admin",
    email,
    passwordHash,
    role: "admin",
  });
}

module.exports = { seedAdmin };
