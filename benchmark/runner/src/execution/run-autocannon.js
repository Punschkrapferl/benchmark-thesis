const autocannon = require("autocannon");

// Apply the dynamically generated benchmark request
// to the reusable raw request object that autocannon gives us.
//
// This allows one running autocannon instance to send
// different HTTP methods, paths, headers, and bodies over time
// according to the selected scenario.
function applyDynamicRequest(rawRequest, nextRequest) {
  rawRequest.method = nextRequest.method;
  rawRequest.path = nextRequest.path;

  // Ensure headers always exist as an object.
  if (!rawRequest.headers || typeof rawRequest.headers !== "object") {
    rawRequest.headers = {};
  }

  const desiredHeaders = nextRequest.headers || {};

  // Clear previously used headers so requests do not leak data
  // from earlier iterations.
  const existingHeaderNames = Object.keys(rawRequest.headers);
  for (const headerName of existingHeaderNames) {
    delete rawRequest.headers[headerName];
  }

  // Apply the headers required for the next request.
  for (const [headerName, headerValue] of Object.entries(desiredHeaders)) {
    rawRequest.headers[headerName] = headerValue;
  }

  // Set or clear the body depending on the operation.
  if (typeof nextRequest.body === "string") {
    rawRequest.body = nextRequest.body;
  } else {
    rawRequest.body = undefined;
  }

  return rawRequest;
}

// Run one autocannon benchmark instance for a specific duration,
// against one backend, one concurrency level, and one scenario runtime.
function runAutocannon({ baseUrl, concurrency, durationSeconds, scenarioRuntime, title }) {
  let debugCounter = 0;
  let responseDebugCounter = 0;

  return new Promise((resolve, reject) => {
    const instance = autocannon({
      url: baseUrl,
      connections: concurrency,
      duration: durationSeconds,

      // Keep pipelining at 1 so the benchmark reflects simple comparable request handling
      // rather than advanced HTTP pipelining behavior.
      pipelining: 1,

      // Autocannon requires an initial request definition.
      // We override it dynamically inside setupRequest().
      requests: [
        {
          method: "GET",
          path: "/todos",

          // Before each outgoing request, generate the next request
          // from the scenario runtime and apply it to the reusable raw request.
          setupRequest(rawRequest) {
            const nextRequest = scenarioRuntime.generateNextRequest();

            // Debug output only for the first few generated requests.
            if (debugCounter < 20) {
              console.log("[autocannon debug] generated request:", nextRequest);
              debugCounter += 1;
            }

            return applyDynamicRequest(rawRequest, nextRequest);
          },

          // Optional response debug output for the first few responses.
          onResponse(status, body, context, headers) {
            if (responseDebugCounter < 10) {
              console.log("[autocannon debug] response status:", status);
              console.log(
                "[autocannon debug] response body preview:",
                typeof body === "string" ? body.slice(0, 300) : body
              );
              responseDebugCounter += 1;
            }
          }
        }
      ]
    });

    // Render benchmark progress and result tables to the terminal.
    autocannon.track(instance, {
      renderProgressBar: true,
      renderLatencyTable: true,
      renderResultsTable: true
    });

    // Resolve with raw benchmark result once autocannon finishes.
    instance.on("done", (result) => {
      resolve({
        title,
        raw: result
      });
    });

    // Reject on benchmark execution error.
    instance.on("error", (error) => {
      reject(error);
    });
  });
}

module.exports = {
  runAutocannon
};