import type { LanguageModelV2 } from "@ai-sdk/provider-v5";

export const mockModel: LanguageModelV2 = {
  specificationVersion: "v2",
  provider: "mock",
  modelId: "mock-model",
  defaultObjectGenerationMode: "json",

  doGenerate: async () => {
    return {
      content: [{ type: "text", text: "Mock response describing the image." }],
      finishReason: "stop" as const,
      usage: { inputTokens: 100, outputTokens: 20 },
      warnings: [],
    };
  },

  doStream: async () => {
    const chunks = [
      { type: "text-delta" as const, delta: "Mock " },
      { type: "text-delta" as const, delta: "response " },
      { type: "text-delta" as const, delta: "describing " },
      { type: "text-delta" as const, delta: "the image." },
      { type: "finish" as const, finishReason: "stop" as const, usage: { inputTokens: 100, outputTokens: 20 } },
    ];

    let index = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (index < chunks.length) {
          controller.enqueue(chunks[index]);
          index++;
        } else {
          controller.close();
        }
      },
    });

    return { stream };
  },
};
