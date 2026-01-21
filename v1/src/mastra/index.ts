import { Agent } from '@mastra/core/agent';
import { Memory } from "@mastra/memory";
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
import { OtelExporter } from '@mastra/otel-exporter';
import { LaminarExporter } from '@mastra/laminar';
import { SentryExporter } from '@mastra/sentry';

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

export const settingTool = createTool({
  id: 'setting-generator',
  description: 'Generates a sci-fi setting based on theme and era',
  inputSchema: z.object({
    theme: z.enum(['military', 'exploration', 'trade', 'pirate', 'scientific']).describe('The overall theme of the story'),
    era: z.enum(['near-future', 'distant-future', 'post-apocalyptic']).describe('The time period'),
  }),
  outputSchema: z.object({
    location: z.string().describe('The primary location/region of space'),
    atmosphere: z.string().describe('The mood and tone of the setting'),
    conflict: z.string().describe('The background tension in this setting'),
  }),

  execute: async (inputData) => {
    const { theme, era } = inputData;
    console.log('Setting tool is running!', { theme, era });

    const settings: Record<string, { location: string; atmosphere: string; conflict: string }> = {
      'military-near-future': {
        location: 'The contested Mars-Jupiter corridor',
        atmosphere: 'Tense, utilitarian, with constant alert status',
        conflict: 'Earth and Mars colonies vie for asteroid mining rights',
      },
      'military-distant-future': {
        location: 'The fortified border of the Orion Arm',
        atmosphere: 'Grim determination mixed with weary vigilance',
        conflict: 'An ancient enemy stirs beyond the galactic rim',
      },
      'exploration-distant-future': {
        location: 'The uncharted Kepler Expanse beyond known space',
        atmosphere: 'Mysterious, awe-inspiring, isolation mixed with wonder',
        conflict: 'Ancient alien artifacts hint at a long-dead civilization',
      },
      'pirate-near-future': {
        location: 'The lawless asteroid fields of the outer belt',
        atmosphere: 'Dangerous, opportunistic, every ship for itself',
        conflict: 'Corporate security forces close in on free traders',
      },
      'scientific-post-apocalyptic': {
        location: 'The ruins of orbital research stations',
        atmosphere: 'Haunting silence punctuated by desperate hope',
        conflict: 'Salvaging old-world tech before it falls from orbit',
      },
    };

    const key = `${theme}-${era}`;
    return settings[key] || {
      location: 'Deep space, sector unknown',
      atmosphere: 'Vast and unforgiving',
      conflict: 'Resources are scarce, trust is scarcer',
    };
  },
});

export const relationshipTool = createTool({
  id: 'relationship-generator',
  description: 'Generates relationships between crew members. Can simulate an error for testing if simulateError is true.',
  inputSchema: z.object({
    characterNames: z.array(z.string()).min(2).describe('Names of characters to create relationships for'),
    tone: z.enum(['friendly', 'tense', 'professional', 'chaotic']).describe('Overall crew dynamic'),
    simulateError: z.boolean().optional().describe('If true, throws an error for testing observability'),
  }),
  outputSchema: z.object({
    relationships: z.array(z.object({
      pair: z.tuple([z.string(), z.string()]),
      dynamic: z.string().describe('Description of their relationship'),
    })),
    crewMorale: z.enum(['high', 'medium', 'low']),
  }),

  execute: async (inputData) => {
    const { characterNames, tone, simulateError } = inputData;
    console.log('Relationship tool is running!', { characterNames, tone, simulateError });

    if (simulateError) {
      throw new Error('Simulated error for observability testing');
    }

    const dynamics: Record<string, string[]> = {
      friendly: ['old friends', 'found family', 'mutual respect'],
      tense: ['bitter rivals', 'unresolved grudge', 'competing for promotion'],
      professional: ['strictly business', 'mentor and student', 'efficient partners'],
      chaotic: ['love-hate', 'unpredictable allies', 'former enemies'],
    };

    const relationships: { pair: [string, string]; dynamic: string }[] = [];
    for (let i = 0; i < characterNames.length - 1; i++) {
      relationships.push({
        pair: [characterNames[i], characterNames[i + 1]],
        dynamic: dynamics[tone][i % dynamics[tone].length],
      });
    }

    return {
      relationships,
      crewMorale: tone === 'friendly' ? 'high' : tone === 'tense' ? 'low' : 'medium',
    };
  },
});

const shipGen = new Agent({
  id: 'ship-gen',
  name: 'Spaceship Generator',
  instructions: SPACESHIP_NAME_PROMPT,
  model: 'anthropic/claude-sonnet-4-5',
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
      tags: ["charGen", "tacos"]
    },
  }
});

const instructions = `
  You are AstroForge, a story-forging coordinator.
	1.	First, use the setting-generator tool to establish the story's setting (pick a theme and era).
	2.	Use the number-tool to determine how many crew members to create.
	3.	Use the ship-gen/Spaceship Generator agent once to name the spaceship.
	4.	Use the char-gen/Character Generator agent exactly as many times as the number-tool result to name each crew member.
	5.	Use the relationship-generator tool to create dynamics between the crew (pass the character names and pick a tone).
	6.	Then write a cohesive sci-fi story (around 1,000 characters, not words) that features this spaceship, its crew, their relationships, and the setting.
Make the story vivid but concise, easy to follow, and consistent in tone. Do not mention the tools or agents you used—only present the final story.`

const astroForge = new Agent({
  id: 'astro-forge',
  name: 'Astro Forge',
  instructions,
  model: 'openai/gpt-4-turbo',
  agents: { shipGen, charGen },
  tools: { numberTool, settingTool, relationshipTool },
  defaultOptions: {
    maxSteps: 20,
    tracingOptions: {
      tags: ["nachos", "pizza"]
    }
  },
  memory: new Memory({
    options: {
      lastMessages: 20,
    },
  }),
})



export const mastra = new Mastra({
  agents: { astroForge },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'astro-forge-main',
        exporters: [
          new BraintrustExporter(),
          new LangfuseExporter(),
          new ArizeExporter(),
          new PosthogExporter(),
          new LangSmithExporter(),
          new LaminarExporter(),
          new DefaultExporter(),
          new OtelExporter({ provider: { traceloop: {} } }),
          new SentryExporter(),
        ],
      },
    },
  }),
  storage: new LibSQLStore({
      id: "mem_store",
      url: "file::memory",
    }),
});

