import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { DefaultExporter, Observability } from '@mastra/observability';
import { BraintrustExporter } from '@mastra/braintrust';
import { LangfuseExporter } from '@mastra/langfuse';
import { ArizeExporter } from '@mastra/arize';
import { PosthogExporter } from '@mastra/posthog';
import { LangSmithExporter } from '@mastra/langsmith';
import { LibSQLStore } from "@mastra/libsql";
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { CHARACTER_GENERATION_PROMPT, SPACESHIP_NAME_PROMPT } from './instructions';
import { LogLevel } from '@mastra/core/logger';

export const numberTool = createTool({
  id: 'number-tool',
  description: 'Used determine the number of characters to generate',
  outputSchema: z.number().describe("The number of characters to generate"),

  execute: async (_inputData, context) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Number tool is running!');
    if (context?.agent?.toolCallId) {
      console.log('Number tool call ID:', context.agent.toolCallId);
    }
    // returns 2, 3, or 4 (inclusive)
    return Math.floor(Math.random() * 3) + 2;
  },
});

const shipGen = new Agent({
  id: 'ship-gen',
  name: 'Spaceship Generator',
  instructions: 'Forge unique spaceship names fitting the requested theme and style. Keep them sci-fi, original, and easy to say. Return one name and a quick rationale.',
  model: 'openai/gpt-4o-mini',
});

const charGen = new Agent({
  id: 'char-gen',
  name: 'Character Generator',
  instructions: {
    role: "system",
    content: CHARACTER_GENERATION_PROMPT,
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral" } },
    }
  },
  model: 'anthropic/claude-sonnet-4-5',
  defaultOptions: {
    maxSteps: 8,
    tracingOptions: {
      tags: ["charGen"]
    },
  }
});

const instructions = `
  You are AstroForge, a story-forging coordinator.
	1.	First, use the number-tool to determine how many crew members to create.
	2.	Use the ship-gen/Spaceship Generator agent once to name the spaceship.
	3.	Use the char-gen/Character Generator agent exactly as many times as the number-tool result to name each crew member.
	4.	Then write a cohesive sci-fi story (around 1,000 characters, not words) that features this spaceship and its crew, using all generated names.
Make the story vivid but concise, easy to follow, and consistent in tone. Do not mention the tools or agents you used—only present the final story.`

const astroForge = new Agent({
  id: 'astro-forge',
  name: 'Astro Forge',
  instructions: {
    type: "text",
    text: instructions,
    cache_control: { "type": "ephemeral" },
  },
  model: 'anthropic/claude-haiku-4-5',
  agents: { shipGen, charGen },
  tools: { numberTool },
  defaultOptions: {
    maxSteps: 8,
    tracingOptions: {
      tags: ["nachos", "pizza"]
    }
  }
})

export const mastra = new Mastra({
  agents: { astroForge, charGen },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'astro-forge-main',
        exporters: [
          new BraintrustExporter({
            apiKey: process.env.BRAINTRUST_API_KEY,
            projectName: 'main',
          }),
          new LangfuseExporter({
            publicKey: process.env.LANGFUSE_PUBLIC_KEY,
            secretKey: process.env.LANGFUSE_SECRET_KEY,
            baseUrl: "https://us.cloud.langfuse.com",
          }),
          new ArizeExporter({
            // For Phoenix (local or cloud)
            endpoint: process.env.PHOENIX_COLLECTOR_ENDPOINT,
            // For Arize AX (optional, use spaceId + apiKey instead of endpoint)
            // spaceId: process.env.ARIZE_SPACE_ID,
            // apiKey: process.env.ARIZE_API_KEY,
          }),
          new PosthogExporter({
            apiKey: process.env.POSTHOG_API_KEY!,
            host: process.env.POSTHOG_HOST, // defaults to https://app.posthog.com
            logLevel: LogLevel.DEBUG,
            flushAt: 1,           // Flush after every event
            flushInterval: 1000,  // Flush every 1 second
          }),
          new LangSmithExporter({
            apiKey: process.env.LANGSMITH_API_KEY,
            projectName: 'astro-forge',
          }),
          new DefaultExporter(),
        ],
      },
    },
  }),
  storage: new LibSQLStore({
      id: "mem_store",
      url: "file::memory",
    }),
});
