// Resolve the base URL for the selected backend.
// k6 runs inside the Docker network (benchmark-net), so targets use service hostnames.
function resolveTarget(backend) {
  const targets = {
    express: {
      backend: "express",
      baseUrl: "http://express:3001"
    },
    springboot: {
      backend: "springboot",
      baseUrl: "http://springboot:8080"
    },
    aspnet: {
      backend: "aspnet",
      baseUrl: "http://aspnet:8081"
    },
    fastapi: {
      backend: "fastapi",
      baseUrl: "http://fastapi:8082"
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
