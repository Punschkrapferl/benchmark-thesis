const { createRequestGenerator } = require("./request-generators");

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