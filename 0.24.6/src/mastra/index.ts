import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { LangfuseExporter } from "@mastra/langfuse";
import { DefaultExporter } from "@mastra/core/ai-tracing";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { memLeakTestWorkflow } from "./mem-leak";
import { mockModel } from "./mock-model";

const memLeakTestAgent = new Agent({
  name: "Memory Leak Test Agent",
  instructions:
    "You are a simple test agent. Briefly describe what you see in the attachment in one sentence.",
  model: mockModel,
  memory: new Memory({
    storage: new LibSQLStore({
      url: "file:mem-leak-test.db",
    }),
    options: {
      lastMessages: 20,
    },
  }),
});

export const mastra = new Mastra({
  agents: { memLeakTestAgent },
  workflows: { memLeakTestWorkflow },
  telemetry: { enabled: false },
  observability: {
    configs: {
      default: {
        serviceName: "mem-leak-test-0.24.6",
        exporters: [
          // new LangfuseExporter({
          //   publicKey: process.env.LANGFUSE_PUBLIC_KEY,
          //   secretKey: process.env.LANGFUSE_SECRET_KEY,
          //   baseUrl: "https://us.cloud.langfuse.com",
          // }),
          new DefaultExporter(),
        ],
      },
    },
  },
  storage: new LibSQLStore({
    url: "file:mastra.db",
  }),
});
