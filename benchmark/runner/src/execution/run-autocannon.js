const autocannon = require("autocannon");

function applyDynamicRequest(rawRequest, nextRequest) {
  rawRequest.method = nextRequest.method;
  rawRequest.path = nextRequest.path;

  if (!rawRequest.headers || typeof rawRequest.headers !== "object") {
    rawRequest.headers = {};
  }

  const desiredHeaders = nextRequest.headers || {};

  const existingHeaderNames = Object.keys(rawRequest.headers);
  for (const headerName of existingHeaderNames) {
    delete rawRequest.headers[headerName];
  }

  for (const [headerName, headerValue] of Object.entries(desiredHeaders)) {
    rawRequest.headers[headerName] = headerValue;
  }

  if (typeof nextRequest.body === "string") {
    rawRequest.body = nextRequest.body;
  } else {
    rawRequest.body = undefined;
  }

  return rawRequest;
}

function runAutocannon({ baseUrl, concurrency, durationSeconds, scenarioRuntime, title }) {
  let debugCounter = 0;
  let responseDebugCounter = 0;

  return new Promise((resolve, reject) => {
    const instance = autocannon({
      url: baseUrl,
      connections: concurrency,
      duration: durationSeconds,
      pipelining: 1,
      requests: [
        {
          method: "GET",
          path: "/todos",
          setupRequest(rawRequest) {
            const nextRequest = scenarioRuntime.generateNextRequest();

            if (debugCounter < 20) {
              console.log("[autocannon debug] generated request:", nextRequest);
              debugCounter += 1;
            }

            return applyDynamicRequest(rawRequest, nextRequest);
          },
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

    autocannon.track(instance, {
      renderProgressBar: true,
      renderLatencyTable: true,
      renderResultsTable: true
    });

    instance.on("done", (result) => {
      resolve({
        title,
        raw: result
      });
    });

    instance.on("error", (error) => {
      reject(error);
    });
  });
}

module.exports = {
  runAutocannon
};