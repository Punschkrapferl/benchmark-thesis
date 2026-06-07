import cluster from "node:cluster";
import env from "./config/env.js";

// Production-style multi-process Express: one worker per allocated CPU.
// Each worker runs server.js with its own connection pool (see DB_POOL_MAX).
if (cluster.isPrimary) {
  console.log(`Express primary process starting ${env.webConcurrency} workers`);

  for (let workerIndex = 0; workerIndex < env.webConcurrency; workerIndex += 1) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code) => {
    if (code !== 0) {
      console.error(`Express worker ${worker.process.pid} exited with code ${code}`);
      cluster.fork();
    }
  });
} else {
  await import("./server.js");
}
