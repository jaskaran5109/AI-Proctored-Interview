const bcrypt = require("bcryptjs");

const { User } = require("../models");

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || "admin@aiproctor.local";
  const password = process.env.ADMIN_PASSWORD || "Admin12345!";
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
