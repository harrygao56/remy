import { db } from "./index";
import { conversations, messages } from "./schema";
import { eq, desc } from "drizzle-orm";

export function createConversation(title: string) {
  return db.insert(conversations).values({ title }).returning().get();
}

export function getConversations() {
  return db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.updatedAt))
    .all();
}

export function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string
) {
  const inserted = db
    .insert(messages)
    .values({ conversationId, role, content })
    .returning()
    .get();

  db.update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId))
    .run();

  return inserted;
}

export function getMessages(conversationId: string) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt)
    .all();
}
