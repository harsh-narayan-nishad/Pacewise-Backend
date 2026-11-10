import { Comment, Report, Story, User } from "@/models";
import { AppError, NotFoundError } from "@/utils/AppError";

type Input = { targetType: "story" | "comment" | "user"; targetId: string; reason: "spam" | "harassment" | "inappropriate" | "misinformation" | "impersonation" | "other"; details?: string };

/** A signed-in person reports a story, a comment or another person. Admins see it in the admin app (Reports). */
export async function createReport(reporterId: string, input: Input) {
  let ownerId: string | undefined;
  let snapshot = "";
  if (input.targetType === "story") {
    const s = await Story.findById(input.targetId).select("title authorId").lean();
    if (!s) throw new NotFoundError("Story");
    ownerId = s.authorId;
    snapshot = s.title;
  } else if (input.targetType === "comment") {
    const c = await Comment.findById(input.targetId).select("text userId").lean();
    if (!c) throw new NotFoundError("Comment");
    ownerId = c.userId;
    snapshot = c.text.slice(0, 300);
  } else {
    const u = await User.findById(input.targetId).select("username name").lean();
    if (!u) throw new NotFoundError("User");
    ownerId = u._id;
    snapshot = `@${u.username} (${u.name})`;
  }
  if (ownerId === reporterId) throw new AppError(409, "You can't report your own content.", "CONFLICT");
  const already = await Report.exists({ reporterId, targetType: input.targetType, targetId: input.targetId, status: { $in: ["open", "reviewing"] } });
  if (already) throw new AppError(409, "You already reported this. We are looking at it.", "CONFLICT");
  const r = await Report.create({ reporterId, targetType: input.targetType, targetId: input.targetId, targetOwnerId: ownerId, reason: input.reason, details: input.details ?? "", snapshot });
  return { id: r._id, status: r.status };
}
