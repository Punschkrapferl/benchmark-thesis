const http = require("http");
const { loadConfig } = require("./config-loader");
const { createScenarioRuntime } = require("./workload/scenario-runtime");

function sendRequest({ baseUrl, requestConfig }) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: requestConfig.path,
      method: requestConfig.method,
      headers: requestConfig.headers || {}
    };

    const req = http.request(options, (res) => {
      let responseBody = "";

      res.setEncoding("utf8");

      res.on("data", (chunk) => {
        responseBody += chunk;
      });

      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseBody
        });
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    if (typeof requestConfig.body === "string") {
      req.write(requestConfig.body);
    }

    req.end();
  });
}

async function main() {
  const config = loadConfig();

  const scenario = config.scenarios["s1-read-only"];
  const state = {
    ...config.dataStates.small,
    name: "small"
  };

  const scenarioRuntime = createScenarioRuntime({
    scenario,
    state
  });

  const baseUrl = "http://127.0.0.1:8080";

  for (let i = 1; i <= 20; i += 1) {
    const requestConfig = scenarioRuntime.generateNextRequest();

    console.log("");
    console.log(`Request ${i}`);
    console.log(requestConfig);

    try {
      const response = await sendRequest({
        baseUrl,
        requestConfig
      });

      console.log(`Status: ${response.statusCode}`);
      console.log(`Body preview: ${response.body.slice(0, 300)}`);
    } catch (error) {
      console.log(`Request failed: ${error.message}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});