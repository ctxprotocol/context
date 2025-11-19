import { createOpenAI } from "@ai-sdk/openai";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

// Create Kimi provider (OpenAI-compatible) for direct SDK access
// This enables future BYOK (Bring Your Own Key) and cost-passthrough features
// Moonshot API requires full /v1 path in baseURL
// Note: Using global endpoint (.ai) not China endpoint (.cn)
const kimi = createOpenAI({
  baseURL: process.env.KIMI_BASE_URL || "https://api.moonshot.ai/v1",
  apiKey: process.env.KIMI_API_KEY,
});

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        "chat-model": kimi.chat("kimi-k2-turbo-preview"),
        "chat-model-reasoning": wrapLanguageModel({
          model: kimi.chat("kimi-k2-turbo-preview"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "title-model": kimi.chat("kimi-k2-turbo-preview"),
        "artifact-model": kimi.chat("kimi-k2-turbo-preview"),
      },
    });

// PREVIOUS GROK CONFIGURATION (commented out for rollback):
// import { gateway } from "@ai-sdk/gateway";
//
// export const myProvider = isTestEnvironment
//   ? (() => {
//       const {
//         artifactModel,
//         chatModel,
//         reasoningModel,
//         titleModel,
//       } = require("./models.mock");
//       return customProvider({
//         languageModels: {
//           "chat-model": chatModel,
//           "chat-model-reasoning": reasoningModel,
//           "title-model": titleModel,
//           "artifact-model": artifactModel,
//         },
//       });
//     })()
//   : customProvider({
//       languageModels: {
//         "chat-model": gateway.languageModel("xai/grok-2-vision-1212"),
//         "chat-model-reasoning": wrapLanguageModel({
//           model: gateway.languageModel("xai/grok-3-mini"),
//           middleware: extractReasoningMiddleware({ tagName: "think" }),
//         }),
//         "title-model": gateway.languageModel("xai/grok-2-1212"),
//         "artifact-model": gateway.languageModel("xai/grok-2-1212"),
//       },
//     });
