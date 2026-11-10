/**
 * Creates/updates the demo accounts in MongoDB (ids like "user-009"), so
 * the web app's existing demo login also signs in to this backend.
 *   npm run seed
 * Safe to re-run: accounts are upserted by id and passwords re-hashed.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../src/models";

interface Demo { id: string; name: string; username: string; password: string; interests: string[] }

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Set MONGODB_URI in .env first");
  const users: Demo[] = JSON.parse(readFileSync(resolve(__dirname, "../seed/demo-users.json"), "utf8"));
  await mongoose.connect(uri);
  await User.syncIndexes();
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await User.updateOne(
      { _id: u.id },
      { $set: { username: u.username, email: `${u.username}@demo.pacewise.local`, name: u.name, interests: u.interests, passwordHash, isDemoUser: true, emailVerified: true } },
      { upsert: true }
    );
  }
  console.log(`Seeded ${users.length} demo users`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
