import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { readFile } from "fs/promises";

const step1 = createStep({
  id: "agent-with-attachment",
  inputSchema: z.object({
    filePath: z.string(),
    prompt: z.string().optional(),
  }),
  outputSchema: z.object({
    response: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { filePath, prompt = "Describe this image briefly." } = inputData;

    // Get agent from mastra context
    const agent = mastra?.getAgent("memLeakTestAgent");
    if (!agent) {
      throw new Error("memLeakTestAgent not found in mastra context");
    }

    // Read file and convert to base64
    const fileBuffer = await readFile(filePath);
    const base64Data = fileBuffer.toString("base64");

    // 0.24.5 has a bug with image attachments, so send base64 as text instead
    const largePrompt = `${prompt}\n\nHere is the base64 encoded file data:\n${base64Data}`;

    // Call agent with large text prompt and memory context
    const result = await agent.generate(
      [
        {
          role: "user",
          content: largePrompt,
        },
      ],
      {
        modelSettings: {
          temperature: 1,
        },
        memory: {
          thread: "mem-leak-test-thread",
          resource: "mem-leak-test-resource",
        },
      }
    );

    console.log(`[mem-leak-workflow] Agent response: ${result.text}`);

    return {
      response: result.text ?? "",
    };
  },
});

export const memLeakTestWorkflow = createWorkflow({
  id: "mem-leak-test",
  description:
    "A workflow for testing memory leaks in the Mastra system. Reads a file, converts to base64, and sends it to an agent.",
  inputSchema: z.object({
    filePath: z.string(),
    prompt: z.string().optional(),
  }),
  outputSchema: z.object({
    response: z.string(),
  }),
})
  .then(step1)
  .commit();
