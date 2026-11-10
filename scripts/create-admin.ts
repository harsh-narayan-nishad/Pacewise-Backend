/**
 * Creates (or promotes) an administrator. This is how the FIRST admin is made; after that, admins can make others in the admin app.
 *   npm run admin:create -- you@gmail.com "YourPassword123" "Your Name"
 * If the e-mail already has an account it becomes an admin (and is activated); the password is only changed when you pass one.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../src/models";

async function main() {
  const [emailArg, password, nameArg] = process.argv.slice(2);
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Set MONGODB_URI in .env first");
  if (!emailArg || !emailArg.includes("@")) throw new Error('Usage: npm run admin:create -- you@gmail.com "Password123" "Your Name"');
  const email = emailArg.trim().toLowerCase();
  await mongoose.connect(uri);
  const existing = await User.findOne({ email });
  if (!existing && (!password || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))) {
    throw new Error("A new admin needs a password: 8+ characters with a letter and a digit.");
  }
  if (existing) {
    const patch: Record<string, unknown> = { role: "admin", status: "active", emailVerified: true };
    if (password) patch.passwordHash = await bcrypt.hash(password, 12);
    await User.updateOne({ _id: existing._id }, { $set: patch });
    console.log(`${email} is now an admin.`);
  } else {
    const base = email.split("@")[0].replace(/[^a-z0-9_]/g, "").slice(0, 20) || "admin";
    let username = base;
    for (let i = 1; await User.exists({ username }); i++) username = `${base}${i}`;
    await User.create({ email, username, name: nameArg ?? "Admin", passwordHash: await bcrypt.hash(password, 12), role: "admin", status: "active", emailVerified: true });
    console.log(`Admin created: ${email} (username ${username}).`);
  }
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
