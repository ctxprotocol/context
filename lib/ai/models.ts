export const DEFAULT_CHAT_MODEL: string = "chat-model";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "chat-model",
    name: "Kimi K2",
    description: "Advanced multimodal model with long context understanding",
  },
  {
    id: "chat-model-reasoning",
    name: "Kimi K2 Thinking",
    description:
      "Uses advanced chain-of-thought reasoning with extended thinking process",
  },
];
