import { contextBridge, ipcRenderer } from "electron";

import type { ChatMessage } from "./llama/LlamaService";

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
    onChunk: (callback: (chunk: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, chunk: string) =>
        callback(chunk);
      ipcRenderer.on("llm:chunk", handler);
      return () => ipcRenderer.removeListener("llm:chunk", handler);
    },
  },
  audio: {
    startRecording: () => ipcRenderer.invoke("audio:startRecording"),
    stopRecording: () => ipcRenderer.invoke("audio:stopRecording"),
  },
});
