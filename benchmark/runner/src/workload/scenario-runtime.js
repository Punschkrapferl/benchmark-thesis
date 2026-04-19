const { createRequestGenerator } = require("./request-generators");

// Create one scenario runtime object.
// This is a small wrapper around the request generator that keeps
// scenario and state metadata together with the generation function.
function createScenarioRuntime({ scenario, state }) {
  const generateNextRequest = createRequestGenerator({ scenario, state });

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    stateName: state.name,
    generateNextRequest
  };
}

module.exports = {
  createScenarioRuntime
};