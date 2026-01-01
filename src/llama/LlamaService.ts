import type { Llama, LlamaModel } from "node-llama-cpp";
import path from "path";
import { app } from "electron";

const MODEL = "LFM2 8B A1B GGUF.gguf";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function loadLlamaCpp() {
  const importDynamic = new Function("modulePath", "return import(modulePath)");
  return (await importDynamic(
    "node-llama-cpp"
  )) as typeof import("node-llama-cpp");
}

/**
 * Get the path to the models directory.
 * In development: ./resources/models
 * In production: {resourcesPath}/resources/models
 */
function getModelsPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "resources", "models");
  }
  return path.join(__dirname, "..", "..", "resources", "models");
}

class LlamaService {
  private llama: Llama | null = null;
  private model: LlamaModel | null = null;
  private isReady = false;
  private llamaCpp: Awaited<ReturnType<typeof loadLlamaCpp>> | null = null;

  private getModelPath(): string {
    return path.join(getModelsPath(), MODEL);
  }

  async start(): Promise<void> {
    if (this.isReady) {
      console.log("LlamaService: Already running");
      return;
    }

    const modelPath = this.getModelPath();
    console.log(`LlamaService: Loading model from ${modelPath}`);

    // Use dynamic import for ESM module
    this.llamaCpp = await loadLlamaCpp();
    this.llama = await this.llamaCpp.getLlama();
    this.model = await this.llama.loadModel({ modelPath });

    this.isReady = true;
    console.log("LlamaService: Model loaded and ready");
  }

  async stop(): Promise<void> {
    if (this.model) {
      await this.model.dispose();
      this.model = null;
    }
    if (this.llama) {
      await this.llama.dispose();
      this.llama = null;
    }
    this.isReady = false;
    console.log("LlamaService: Stopped");
  }

  async chat(
    messages: ChatMessage[],
    maxTokens?: number,
    onTextChunk?: (text: string) => void
  ): Promise<{ stopReason: string; responseText: string }> {
    if (!this.isReady || !this.model || !this.llamaCpp) {
      throw new Error("LlamaService: Not ready");
    }

    const context = await this.model.createContext();

    try {
      const session = new this.llamaCpp.LlamaChatSession({
        contextSequence: context.getSequence(),
      });

      const systemMessage = messages.find((m) => m.role === "system");

      const conversationMessages = messages.filter((m) => m.role !== "system");
      const historyMessages = conversationMessages.slice(0, -1);
      const lastUserMessage =
        conversationMessages[conversationMessages.length - 1];

      if (!lastUserMessage || lastUserMessage.role !== "user") {
        throw new Error("LlamaService: Last message must be from user");
      }

      // Set initial history with system prompt if present
      const chatHistory: Parameters<typeof session.setChatHistory>[0] = [];
      if (systemMessage) {
        chatHistory.push({ type: "system", text: systemMessage.content });
      }

      // Add previous conversation turns
      for (const msg of historyMessages) {
        if (msg.role === "user") {
          chatHistory.push({ type: "user", text: msg.content });
        } else if (msg.role === "assistant") {
          chatHistory.push({ type: "model", response: [msg.content] });
        }
      }

      if (chatHistory.length > 0) {
        session.setChatHistory(chatHistory);
      }

      const result = await session.promptWithMeta(lastUserMessage.content, {
        onTextChunk,
        maxTokens,
      });

      return {
        stopReason: result.stopReason,
        responseText: result.responseText,
      };
    } finally {
      await context.dispose();
    }
  }
}

export const llamaService = new LlamaService();
