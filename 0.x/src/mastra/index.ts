import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { BraintrustExporter } from '@mastra/braintrust';
import { LangfuseExporter } from '@mastra/langfuse';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import { z } from 'zod';
import { DefaultExporter } from '@mastra/core/ai-tracing';
import { memLeakTestWorkflow } from './mem-leak';
import { mockModel } from './mock-model';

const shipGen = new Agent({
  name: 'Spaceship Generator',
  instructions: 'Forge unique spaceship names fitting the requested theme and style. Keep them sci-fi, original, and easy to say. Return one name and a quick rationale.',
  model: 'openai/gpt-4o-mini',
});

const charGen = new Agent({
  name: 'Character Generator',
  instructions: 'Create a character name fitting the requested theme and tone, but different from any existing name. Keep them memorable, pronounceable, and original. Return one name and a brief rationale.',
  model: 'openai/gpt-5-nano',
});

export const numberTool = createTool({
  id: 'number-tool',
  description: 'Used determine the number of characters to generate',
  outputSchema: z.number().describe("The number of characters to generate"),

  execute: async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    // returns 2, 3, or 4 (inclusive)
    return Math.floor(Math.random() * 3) + 2;
  },
});


const memLeakTestAgent = new Agent({
  name: 'Memory Leak Test Agent',
  instructions: 'You are a simple test agent. Briefly describe what you see in the attachment in one sentence.',
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

const astroForge = new Agent({
  id: 'astro-forge',
  name: 'Astro Forge',
  instructions: `
  You are AstroForge, a story-forging coordinator.
	1.	First, use the number-tool to determine how many crew members to create.
	2.	Use the ship-gen/Spaceship Generator agent once to name the spaceship.
	3.	Use the char-gen/Character Generator agent exactly as many times as the number-tool result to name each crew member.
	4.	Then write a cohesive sci-fi story (around 1,000 characters, not words) that features this spaceship and its crew, using all generated names.
Make the story vivid but concise, easy to follow, and consistent in tone. Do not mention the tools or agents you used—only present the final story.`,
  model: 'openai/o1',
  agents: { shipGen, charGen },
  tools: { numberTool },
  defaultGenerateOptions: {
    maxSteps: 8,
  },
  defaultStreamOptions: {
    maxSteps: 8,
  },
  defaultVNextStreamOptions: {
    maxSteps: 8,
  },
})

export const mastra = new Mastra({
  agents: { astroForge, memLeakTestAgent },
  workflows: { memLeakTestWorkflow },
  telemetry: { enabled: false },
  observability: {
    configs: {
      default: {
        serviceName: 'astro-forge-main',
        exporters: [
          // new BraintrustExporter({
          //   apiKey: process.env.BRAINTRUST_API_KEY,
          //   projectName: 'main',
          // }),
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