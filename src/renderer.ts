import { marked } from "marked";
import hljs from "highlight.js";

// Configure marked with syntax highlighting
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Custom renderer for code blocks with syntax highlighting
const renderer = new marked.Renderer();
renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
  const highlighted = hljs.highlight(text, { language }).value;
  return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
};

marked.use({ renderer });

interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

interface Api {
  createConversation: (title: string) => Promise<Conversation>;
  getConversations: () => Promise<Conversation[]>;
  addMessage: (
    conversationId: string,
    role: string,
    content: string
  ) => Promise<Message>;
  getMessages: (conversationId: string) => Promise<Message[]>;
  llm: {
    chat: (
      messages: { role: "user" | "assistant" | "system"; content: string }[],
      maxTokens?: number
    ) => Promise<string>;
    onChunk: (callback: (chunk: string) => void) => () => void;
  };
}

declare global {
  interface Window {
    api: Api;
  }
}

let currentConversationId: string | null = null;
let isStreaming = false;

const chatListEl = document.getElementById("chat-list") as HTMLDivElement;
const messagesEl = document.getElementById("messages") as HTMLDivElement;
const messageInput = document.getElementById(
  "message-input"
) as HTMLTextAreaElement;
const sendBtn = document.getElementById("send-btn") as HTMLButtonElement;
const newChatBtn = document.getElementById("new-chat-btn") as HTMLButtonElement;

async function loadConversations() {
  const conversations = await window.api.getConversations();
  chatListEl.innerHTML = "";

  for (const conv of conversations) {
    const item = document.createElement("div");
    item.className = `chat-item${conv.id === currentConversationId ? " active" : ""}`;
    item.textContent = conv.title;
    item.onclick = () => selectConversation(conv.id);
    chatListEl.appendChild(item);
  }
}

async function selectConversation(id: string) {
  currentConversationId = id;
  await loadConversations();
  await loadMessages();
}

async function loadMessages() {
  if (!currentConversationId) {
    messagesEl.innerHTML =
      '<div class="empty-state">Start a new conversation</div>';
    return;
  }

  const messages = await window.api.getMessages(currentConversationId);
  messagesEl.innerHTML = "";

  if (messages.length === 0) {
    messagesEl.innerHTML =
      '<div class="empty-state">No messages yet. Start the conversation!</div>';
    return;
  }

  for (const msg of messages) {
    appendMessage(msg.role, msg.content);
  }

  scrollToBottom();
}

function renderMarkdown(content: string): string {
  return marked.parse(content) as string;
}

function appendMessage(
  role: "user" | "assistant",
  content: string
): HTMLElement {
  // Remove empty state if present
  const emptyState = messagesEl.querySelector(".empty-state");
  if (emptyState) emptyState.remove();

  const msgEl = document.createElement("div");
  msgEl.className = `message ${role}`;

  // Use markdown for assistant messages, escape HTML for user messages
  const renderedContent =
    role === "assistant" ? renderMarkdown(content) : escapeHtml(content);

  msgEl.innerHTML = `
    <div class="message-role">${role}</div>
    <div class="message-content">${renderedContent}</div>
  `;
  messagesEl.appendChild(msgEl);
  return msgEl;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function generateChatName(userMessage: string): Promise<string> {
  const systemPrompt =
    "Generate a short, descriptive title (3-6 words) for a chat conversation based on the user's first message. Return only the title, nothing else.";

  const generatedTitle = await window.api.llm.chat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    20
  );

  return generatedTitle;
}

function createNewChat() {
  currentConversationId = null;
  messagesEl.innerHTML =
    '<div class="empty-state">Start a new conversation</div>';
  messageInput.value = "";
  loadConversations();
}

async function sendMessage() {
  const content = messageInput.value.trim();
  if (!content || isStreaming) return;

  if (!currentConversationId) {
    let title: string;
    try {
      title = await generateChatName(content);
    } catch (err) {
      console.error("Failed to generate chat name:", err);
    }

    console.log("title", title);

    const conversation = await window.api.createConversation(title);
    currentConversationId = conversation.id;
    await loadConversations();
  }

  // Add user message
  await window.api.addMessage(currentConversationId, "user", content);
  appendMessage("user", content);
  messageInput.value = "";
  scrollToBottom();

  // Get all messages for context
  const messages = await window.api.getMessages(currentConversationId);
  const chatMessages = messages.map((m: Message) => ({
    role: m.role,
    content: m.content,
  }));

  // Start streaming response
  isStreaming = true;
  sendBtn.disabled = true;

  const assistantMsgEl = appendMessage("assistant", "");
  const contentEl = assistantMsgEl.querySelector(
    ".message-content"
  ) as HTMLDivElement;
  let fullResponse = "";

  const unsubscribe = window.api.llm.onChunk((chunk: string) => {
    fullResponse += chunk;
    contentEl.innerHTML = renderMarkdown(fullResponse);
    scrollToBottom();
  });

  try {
    await window.api.llm.chat(chatMessages);
    // Save assistant message
    if (currentConversationId) {
      await window.api.addMessage(
        currentConversationId,
        "assistant",
        fullResponse
      );
    }
  } catch (err) {
    console.error("Chat error:", err);
    contentEl.textContent = "Error: Failed to get response";
  } finally {
    unsubscribe();
    isStreaming = false;
    sendBtn.disabled = false;
  }
}

// Event listeners
newChatBtn.onclick = createNewChat;
sendBtn.onclick = sendMessage;

messageInput.onkeydown = (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
};

// Auto-resize textarea
messageInput.oninput = () => {
  messageInput.style.height = "auto";
  messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + "px";
};

// Initial load
loadConversations();
