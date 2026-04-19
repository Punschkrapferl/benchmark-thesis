// Resolve the base URL for the selected backend.
// The benchmark runner uses this to know where to send benchmark traffic.
function resolveTarget(backend) {
  const targets = {
    express: {
      backend: "express",
      baseUrl: "http://127.0.0.1:3001"
    },
    springboot: {
      backend: "springboot",
      baseUrl: "http://127.0.0.1:8080"
    },
    aspnet: {
      backend: "aspnet",
      baseUrl: "http://127.0.0.1:8081"
    },
    fastapi: {
      backend: "fastapi",
      baseUrl: "http://127.0.0.1:8082"
    }
  };

  const target = targets[backend];

  if (!target) {
    throw new Error(`Unsupported backend "${backend}"`);
  }

  return target;
}

module.exports = {
  resolveTarget
};