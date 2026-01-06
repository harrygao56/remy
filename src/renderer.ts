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
  audio: {
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<string | null>;
  };
}

declare global {
  interface Window {
    api: Api;
  }
}

let currentConversationId: string | null = null;
let isStreaming = false;

type RecordingState = "idle" | "recording" | "confirm";
let recordingState: RecordingState = "idle";
let currentTranscription = "";

const chatListEl = document.getElementById("chat-list") as HTMLDivElement;
const messagesEl = document.getElementById("messages") as HTMLDivElement;
const recordBtn = document.getElementById("record-btn") as HTMLButtonElement;
const transcriptionPreview = document.getElementById(
  "transcription-preview"
) as HTMLDivElement;
const transcriptionText = document.getElementById(
  "transcription-text"
) as HTMLDivElement;
const confirmBtn = document.getElementById("confirm-btn") as HTMLButtonElement;
const retryBtn = document.getElementById("retry-btn") as HTMLButtonElement;
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
  resetRecordingUI();
  loadConversations();
}

function resetRecordingUI() {
  recordingState = "idle";
  currentTranscription = "";
  recordBtn.textContent = "Start Recording";
  recordBtn.classList.remove("recording");
  recordBtn.disabled = false;
  recordBtn.style.display = "block";
  transcriptionPreview.style.display = "none";
}

function updateRecordingUI(state: RecordingState) {
  recordingState = state;

  if (state === "idle") {
    recordBtn.textContent = "Start Recording";
    recordBtn.classList.remove("recording");
    recordBtn.disabled = false;
    recordBtn.style.display = "block";
    transcriptionPreview.style.display = "none";
  } else if (state === "recording") {
    recordBtn.textContent = "Stop Recording";
    recordBtn.classList.add("recording");
    recordBtn.disabled = false;
    recordBtn.style.display = "block";
    transcriptionPreview.style.display = "none";
  } else if (state === "confirm") {
    recordBtn.textContent = "Start Recording";
    recordBtn.classList.remove("recording");
    recordBtn.disabled = false;
    recordBtn.style.display = "none";
    transcriptionText.textContent =
      currentTranscription || "(No speech detected)";
    transcriptionPreview.style.display = "flex";
  }
}

async function sendMessage(content: string) {
  const trimmedContent = content.trim();
  if (!trimmedContent || isStreaming) return;

  if (!currentConversationId) {
    let title: string;
    try {
      title = await generateChatName(trimmedContent);
    } catch (err) {
      console.error("Failed to generate chat name:", err);
    }

    const conversation = await window.api.createConversation(title);
    currentConversationId = conversation.id;
    await loadConversations();
  }

  // Add user message
  await window.api.addMessage(currentConversationId, "user", trimmedContent);
  appendMessage("user", trimmedContent);
  resetRecordingUI();
  scrollToBottom();

  // Get all messages for context
  const messages = await window.api.getMessages(currentConversationId);
  const chatMessages = [
    {
      role: "system" as const,
      content: `You are Remy, a friendly AI cooking assistant. You help users with cooking questions, provide recipes, suggest ingredient substitutions, and offer culinary tips . Always format your responses in Markdown.`,
    },
    ...messages.map((m: Message) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  // Start streaming response
  isStreaming = true;
  recordBtn.disabled = true;

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
    recordBtn.disabled = false;
  }
}

async function handleRecordClick() {
  if (isStreaming) return;

  if (recordingState === "idle") {
    // Start recording
    try {
      updateRecordingUI("recording");
      await window.api.audio.startRecording();
    } catch (err) {
      console.error("Failed to start recording:", err);
      updateRecordingUI("idle");
    }
  } else if (recordingState === "recording") {
    // Stop recording and transcribe
    try {
      recordBtn.disabled = true;
      recordBtn.textContent = "Processing...";
      const text = await window.api.audio.stopRecording();
      currentTranscription = text || "";
      updateRecordingUI("confirm");
    } catch (err) {
      console.error("Failed to stop recording:", err);
      updateRecordingUI("idle");
    }
  }
}

async function handleConfirm() {
  if (currentTranscription.trim()) {
    await sendMessage(currentTranscription);
  } else {
    resetRecordingUI();
  }
}

function handleRetry() {
  resetRecordingUI();
}

// Event listeners
newChatBtn.onclick = createNewChat;
recordBtn.onclick = handleRecordClick;
confirmBtn.onclick = handleConfirm;
retryBtn.onclick = handleRetry;

// Initial load
loadConversations();
