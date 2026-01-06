import { contextBridge, ipcRenderer } from "electron";

import type { ChatMessage } from "./llama/LlamaService";

// Store the current chunk handler - only one can be active at a time
let currentChunkHandler: ((chunk: string) => void) | null = null;

// Set up a single persistent listener for chunks
ipcRenderer.on("llm:chunk", (_event, chunk: string) => {
  if (currentChunkHandler) {
    currentChunkHandler(chunk);
  }
});

contextBridge.exposeInMainWorld("api", {
  createConversation: (title: string) =>
    ipcRenderer.invoke("db:createConversation", title),
  getConversations: () => ipcRenderer.invoke("db:getConversations"),
  addMessage: (conversationId: string, role: string, content: string) =>
    ipcRenderer.invoke("db:addMessage", conversationId, role, content),
  getMessages: (conversationId: string) =>
    ipcRenderer.invoke("db:getMessages", conversationId),
  llm: {
    chat: (messages: ChatMessage[], maxTokens?: number) =>
      ipcRenderer.invoke("llm:chat", messages, maxTokens),
    setChunkHandler: (callback: ((chunk: string) => void) | null) => {
      currentChunkHandler = callback;
    },
  },
  audio: {
    startRecording: () => ipcRenderer.invoke("audio:startRecording"),
    stopRecording: () => ipcRenderer.invoke("audio:stopRecording"),
  },
});
