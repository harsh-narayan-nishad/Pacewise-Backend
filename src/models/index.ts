import { randomUUID } from "node:crypto";
import mongoose, { Schema, InferSchemaType } from "mongoose";

/**
 * All MongoDB collections. `_id` is a STRING (uuid, or an explicit id such
 * as "user-009" for demo users) and is exposed to API clients as `id`, so
 * response shapes stay identical to what the frontend already expects.
 */
const opts = {
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: (_doc: unknown, ret: Record<string, unknown>) => {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    },
  },
} as const;

const id = { type: String, default: () => randomUUID() };

// ---- Users & auth ---------------------------------------------------------
const userSchema = new Schema(
  {
    _id: id,
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    interests: { type: [String], default: [] },
    avatarUrl: { type: String, default: null },
    isDemoUser: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    /** "admin" can use the admin app. Everyone else is "user". */
    role: { type: String, enum: ["user", "admin"], default: "user" },
    /** Accounts made before approval existed have no status and count as active. */
    status: { type: String, enum: ["pending", "active", "rejected", "banned"], default: "active", index: true },
    statusNote: { type: String },
    statusChangedAt: { type: Date },
    statusChangedBy: { type: String },
    /** Last time this person's app talked to the API (throttled); drives online / offline. */
    lastSeenAt: { type: Date, index: true },
  },
  { ...opts, timestamps: true }
);
export const User = mongoose.model("User", userSchema);
export type UserDoc = InferSchemaType<typeof userSchema> & { _id: string };

const refreshSchema = new Schema(
  {
    _id: id,
    userId: { type: String, required: true, index: true },
    token: { type: String, required: true, unique: true },
    device: { type: String },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 60 * 60 * 24 * 7 } },
    revokedAt: { type: Date },
  },
  { ...opts, timestamps: true }
);
export const RefreshToken = mongoose.model("RefreshToken", refreshSchema);

/** One-time e-mailed tokens (verify e-mail, reset password). Only the SHA-256 HASH is stored, so a database leak cannot be used to reset anyone's password. */
export const AuthToken = mongoose.model(
  "AuthToken",
  new Schema(
    {
      _id: id,
      userId: { type: String, required: true, index: true },
      type: { type: String, enum: ["verify-email", "reset-password", "verify-otp", "reset-otp"], required: true },
      /** Wrong guesses so far (OTP types only); the code is cancelled after too many. */
      attempts: { type: Number, default: 0 },
      tokenHash: { type: String, required: true, unique: true },
      expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    },
    { ...opts, timestamps: true }
  )
);

// ---- Stories ----------------------------------------------------------------
const storySchema = new Schema(
  {
    _id: id,
    authorId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: String,
    level: { type: String, default: "beginner" },
    estimatedWPM: { type: Number, default: 250 },
    tags: { type: [String], default: [], index: true },
    paragraphs: { type: [String], default: [] },
    questions: { type: Schema.Types.Mixed, default: [] },
    media: { type: Schema.Types.Mixed },
  },
  { ...opts, timestamps: true }
);
storySchema.index({ createdAt: -1 });
export const Story = mongoose.model("Story", storySchema);

// ---- Social (API-native) ------------------------------------------------------
export const Reaction = mongoose.model(
  "Reaction",
  new Schema(
    { _id: id, storyId: { type: String, required: true }, userId: { type: String, required: true }, type: { type: String, enum: ["LIKE", "DISLIKE"], required: true } },
    { ...opts, timestamps: true }
  ).index({ storyId: 1, userId: 1 }, { unique: true })
);

export const Comment = mongoose.model(
  "Comment",
  new Schema(
    { _id: id, storyId: { type: String, required: true, index: true }, userId: { type: String, required: true }, text: { type: String, required: true } },
    { ...opts, timestamps: true }
  )
);

export const Share = mongoose.model(
  "Share",
  new Schema(
    { _id: id, storyId: { type: String, required: true }, senderId: { type: String, required: true }, receiverId: { type: String, required: true } },
    { ...opts, timestamps: true }
  ).index({ storyId: 1, senderId: 1, receiverId: 1 }, { unique: true })
);

export const Bookmark = mongoose.model(
  "Bookmark",
  new Schema({ _id: id, userId: { type: String, required: true }, storyId: { type: String, required: true } }, { ...opts, timestamps: true }).index(
    { userId: 1, storyId: 1 },
    { unique: true }
  )
);

export const Follow = mongoose.model(
  "Follow",
  new Schema({ _id: id, followerId: { type: String, required: true, index: true }, followingId: { type: String, required: true, index: true } }, { ...opts, timestamps: true }).index(
    { followerId: 1, followingId: 1 },
    { unique: true }
  )
);

export const Notification = mongoose.model(
  "Notification",
  new Schema(
    {
      _id: id,
      recipientId: { type: String, required: true },
      senderId: { type: String, required: true },
      type: { type: String, enum: ["FOLLOW", "LIKE", "COMMENT", "SHARE"], required: true },
      message: { type: String, required: true },
      storyId: String,
      read: { type: Boolean, default: false },
    },
    { ...opts, timestamps: true }
  ).index({ recipientId: 1, createdAt: -1 })
);

// ---- Playlists --------------------------------------------------------------
export const Playlist = mongoose.model(
  "Playlist",
  new Schema(
    {
      _id: id,
      userId: { type: String, required: true, index: true },
      name: { type: String, required: true },
      isPublic: { type: Boolean, default: false },
      items: { type: [{ storyId: String, addedAt: { type: Date, default: Date.now }, _id: false }], default: [] },
    },
    { ...opts, timestamps: true }
  )
);

// ---- Reading history ------------------------------------------------------------
export const ReadingSession = mongoose.model(
  "ReadingSession",
  new Schema(
    {
      _id: id,
      userId: { type: String, required: true },
      storyId: String,
      title: String,
      wordCount: Number,
      wpm: Number,
      minutes: Number,
      completed: Boolean,
      breakMs: { type: Number, default: 0 },
      breakCount: { type: Number, default: 0 },
      effectiveWpm: Number,
      reductionPercent: Number,
      accuracy: Number,
      totalQuestions: Number,
      correctAnswers: Number,
      // Per-topic result of the test (strong/medium/weak is derived from these counts, see modules/history/topics.ts).
      topics: { type: [new Schema({ topic: { type: String, required: true }, correct: { type: Number, required: true }, total: { type: Number, required: true } }, { _id: false })], default: [] },
      topicsEditedAt: Date,
    },
    { ...opts, timestamps: true }
  ).index({ userId: 1, createdAt: -1 })
);

// ---- Calendar ---------------------------------------------------------------------
export const CalendarEvent = mongoose.model(
  "CalendarEvent",
  new Schema(
    {
      _id: id,
      userId: { type: String, required: true },
      title: { type: String, required: true },
      start: { type: Date, required: true },
      end: { type: Date, required: true },
      allDay: { type: Boolean, default: false },
      variant: { type: String, enum: ["primary", "secondary", "outline"], default: "primary" },
    },
    { ...opts, timestamps: true }
  ).index({ userId: 1, start: 1 })
);

// ---- Generic synced records (frontend social data) --------------------------------
/** One row per frontend record (reaction, comment, save, playlist, ...). `data`
 *  holds the record exactly as the frontend uses it, so the browser's
 *  existing logic keeps working while MongoDB is the source of truth. */
export const SyncRecord = mongoose.model(
  "SyncRecord",
  new Schema(
    {
      _id: { type: String }, // `${collection}:${recordId}`
      coll: { type: String, required: true },
      recordId: { type: String, required: true },
      ownerId: { type: String, required: true, index: true },
      /** Users who may READ it besides everyone-visible collections (e.g. a notification's recipient). */
      audience: { type: [String], default: [], index: true },
      data: { type: Schema.Types.Mixed, required: true },
      deleted: { type: Boolean, default: false },
      seq: { type: Number, required: true, index: true },
    },
    { ...opts, timestamps: true }
  ).index({ coll: 1, seq: 1 })
);

/** Monotonic change counter so clients can ask "what changed since N". */
export const Counter = mongoose.model("Counter", new Schema({ _id: String, value: { type: Number, default: 0 } }, { versionKey: false }));
export async function nextSeq(): Promise<number> {
  const c = await Counter.findByIdAndUpdate("sync", { $inc: { value: 1 } }, { new: true, upsert: true });
  return c.value;
}

// ---- Reading time & consistency tracking --------------------------------------------
/** One row per (user, day, kind) — the raw material for streaks. */
export const DailyActivity = mongoose.model(
  "DailyActivity",
  new Schema(
    {
      _id: id,
      userId: { type: String, required: true },
      day: { type: String, required: true }, // client-local calendar day "YYYY-MM-DD"
      readMs: { type: Number, default: 0 },
      storyMs: { type: Number, default: 0 },
      docMs: { type: Number, default: 0 },
      readerMs: { type: Number, default: 0 },
      testsTaken: { type: Number, default: 0 },
      storiesRead: { type: Number, default: 0 },
      docsRead: { type: Number, default: 0 },
    },
    { ...opts, timestamps: true }
  ).index({ userId: 1, day: 1 }, { unique: true })
);

/** Per-item reading time (story or doc). */
export const ItemTime = mongoose.model(
  "ItemTime",
  new Schema(
    {
      _id: id,
      userId: { type: String, required: true },
      kind: { type: String, enum: ["story", "doc", "reader"], required: true },
      itemId: { type: String, required: true },
      title: String,
      totalMs: { type: Number, default: 0 },
      opens: { type: Number, default: 0 },
      lastReadAt: Date,
    },
    { ...opts, timestamps: true }
  ).index({ userId: 1, kind: 1, itemId: 1 }, { unique: true })
);

/** Generic per-user key/value blob (history, bookmarks, achievements, custom stories ...). */
export const UserBlob = mongoose.model(
  "UserBlob",
  new Schema({ _id: String, userId: { type: String, required: true, index: true }, key: String, value: Schema.Types.Mixed, rev: { type: Number, default: 0 } }, { ...opts, timestamps: true })
);


// ---- Admin: reports, audit trail, permanent bans --------------------------------------------------------------
export const Report = mongoose.model(
  "Report",
  new Schema(
    {
      _id: id,
      reporterId: { type: String, required: true, index: true },
      targetType: { type: String, enum: ["story", "comment", "user"], required: true },
      targetId: { type: String, required: true },
      /** The person who owns the reported thing (for a "user" report, that user). */
      targetOwnerId: { type: String, index: true },
      reason: { type: String, enum: ["spam", "harassment", "inappropriate", "misinformation", "impersonation", "other"], required: true },
      details: { type: String, default: "" },
      /** Short copy of what was reported, so the admin still sees it after the content is removed. */
      snapshot: { type: String, default: "" },
      status: { type: String, enum: ["open", "reviewing", "resolved", "dismissed"], default: "open", index: true },
      resolution: { type: String, default: "" },
      handledBy: { type: String },
      handledAt: { type: Date },
    },
    { ...opts, timestamps: true }
  ).index({ createdAt: -1 })
);

/** Every admin action, kept forever, so there is always an answer to "who did this and when". */
export const AuditLog = mongoose.model(
  "AuditLog",
  new Schema(
    {
      _id: id,
      actorId: { type: String, required: true, index: true },
      actorName: { type: String, required: true },
      action: { type: String, required: true },
      targetType: { type: String, required: true },
      targetId: { type: String, required: true },
      targetLabel: { type: String, default: "" },
      note: { type: String, default: "" },
    },
    { ...opts, timestamps: { createdAt: true, updatedAt: false } }
  ).index({ createdAt: -1 })
);

/** A banned person's e-mail in canonical form (dots / +tags removed), so they cannot just sign up again with a variation. */
export const BannedIdentity = mongoose.model(
  "BannedIdentity",
  new Schema(
    { _id: { type: String, required: true }, email: { type: String, required: true }, userId: { type: String }, reason: { type: String, default: "" } },
    { ...opts, timestamps: { createdAt: true, updatedAt: false } }
  )
);
