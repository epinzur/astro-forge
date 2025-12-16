//import "../instrument";
import { mastra } from "./index";
import { stat, readFile } from "fs/promises";

const filePath =
  "/Users/epinzur/src/github.com/epinzur/astro-forge/shared/memory_leak.png";

function formatMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

function formatMs(ms: number): string {
  return ms.toFixed(0) + "ms";
}

function getHeapUsed(): number {
  return process.memoryUsage().heapUsed;
}

async function runTest() {
  const workflow = mastra.getWorkflow("memLeakTestWorkflow");

  // Get file size for logging
  const fileStats = await stat(filePath);
  const fileBuffer = await readFile(filePath);
  const base64Size = fileBuffer.toString("base64").length;

  console.log(`[mem-leak-test] File Size: ${formatMB(fileStats.size)}`);
  console.log(`[mem-leak-test] Base64 Attachment Size: ${formatMB(base64Size)}`);

  const iterationTimes: number[] = [];
  const totalStartTime = performance.now();

  for (let i = 1; i <= 30; i++) {
    console.log(`\n[mem-leak-test] === Run ${i} ===`);

    // Force garbage collection if available (run with --expose-gc)
    if (global.gc) {
      global.gc();
    }

    const heapBefore = getHeapUsed();
    console.log(
      `[mem-leak-test] DEBUG: Heap Before Workflow: ${formatMB(heapBefore)}`
    );

    const iterStartTime = performance.now();
    const run = await workflow.createRunAsync();
    const result = await run.start({ inputData: { filePath } });
    const iterEndTime = performance.now();
    const iterDuration = iterEndTime - iterStartTime;
    iterationTimes.push(iterDuration);

    const heapAfter = getHeapUsed();
    console.log(
      `[mem-leak-test] DEBUG: Heap After Workflow: ${formatMB(heapAfter)}`
    );
    console.log(
      `[mem-leak-test] DEBUG: Heap Delta: ${formatMB(heapAfter - heapBefore)}`
    );
    console.log(
      `[mem-leak-test] DEBUG: Iteration Time: ${formatMs(iterDuration)}`
    );

    if (result.status === "success") {
      const responseLength =
        (result.result?.response?.length ?? 0) / 1024 / 1024;
      console.log(
        `[mem-leak-test] DEBUG: Response text length: ${responseLength.toFixed(4)} MB`
      );
    } else {
      console.log(`[mem-leak-test] DEBUG: Workflow status: ${result.status}`);
      console.log(
        `[mem-leak-test] DEBUG: Result:`,
        JSON.stringify(result, null, 2)
      );
    }
  }

  const totalEndTime = performance.now();
  const totalDuration = totalEndTime - totalStartTime;
  const avgDuration = totalDuration / iterationTimes.length;

  // Final memory snapshot
  if (global.gc) {
    global.gc();
  }
  console.log(`\n[mem-leak-test] === Final ===`);
  console.log(`[mem-leak-test] DEBUG: Final Heap: ${formatMB(getHeapUsed())}`);
  console.log(`\n[mem-leak-test] === Timing Summary ===`);
  console.log(`[mem-leak-test] Total Time: ${formatMs(totalDuration)}`);
  console.log(`[mem-leak-test] Average per Iteration: ${formatMs(avgDuration)}`);
  console.log(`[mem-leak-test] First Iteration: ${formatMs(iterationTimes[0])}`);
  console.log(`[mem-leak-test] Last Iteration: ${formatMs(iterationTimes[iterationTimes.length - 1])}`);
  console.log(`[mem-leak-test] Min Iteration: ${formatMs(Math.min(...iterationTimes))}`);
  console.log(`[mem-leak-test] Max Iteration: ${formatMs(Math.max(...iterationTimes))}`);
}

runTest().catch(console.error);
