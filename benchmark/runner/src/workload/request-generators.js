// Expand weighted operations into a fixed-size array of 100 entries.
// Example:
// - operation A with weight 80 appears 80 times
// - operation B with weight 20 appears 20 times
//
// Picking a random index from that expanded array gives the intended distribution.
function createWeightedOperationPicker(operations) {
  const expandedOperations = [];

  for (const operation of operations) {
    for (let i = 0; i < operation.weight; i += 1) {
      expandedOperations.push(operation);
    }
  }

  if (expandedOperations.length !== 100) {
    throw new Error(
      `Operation weights must expand to exactly 100 entries, got ${expandedOperations.length}`
    );
  }

  return function pickOperation() {
    const index = Math.floor(Math.random() * expandedOperations.length);
    return expandedOperations[index];
  };
}

// Return a random integer between min and max, inclusive.
function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Build a deterministic benchmark title value for synthetic todo payloads.
function createTitle(sequenceNumber) {
  return `benchmark-todo-${sequenceNumber}`;
}

// Alternate completed=true/false values across requests.
function createCompletedValue(sequenceNumber) {
  return sequenceNumber % 2 === 0;
}

// Resolve placeholder paths such as "/todos/:id" into concrete IDs.
// The ID is chosen randomly from the configured state range.
function resolvePath(pathTemplate, state) {
  if (!pathTemplate.includes(":id")) {
    return pathTemplate;
  }

  if (
    state.rowCount === 0 ||
    state.idMin === null ||
    state.idMax === null ||
    state.idMin === undefined ||
    state.idMax === undefined
  ) {
    throw new Error(
      `Cannot resolve ":id" in path "${pathTemplate}" because state "${state.name}" has no valid id range`
    );
  }

  const id = randomIntInclusive(state.idMin, state.idMax);
  return pathTemplate.replace(":id", String(id));
}

// Build a request body from a scenario body template.
// Special placeholders are replaced dynamically based on sequence number.
function buildBodyFromTemplate(bodyTemplate, sequenceNumber) {
  if (!bodyTemplate) {
    return null;
  }

  const result = {};

  for (const [key, value] of Object.entries(bodyTemplate)) {
    if (value === "{{title}}") {
      result[key] = createTitle(sequenceNumber);
      continue;
    }

    if (value === "{{order}}") {
      result[key] = sequenceNumber;
      continue;
    }

    if (value === "{{completed}}") {
      result[key] = createCompletedValue(sequenceNumber);
      continue;
    }

    // Keep literal values unchanged.
    result[key] = value;
  }

  return result;
}

// Create a generator that produces one request at a time
// according to the selected scenario definition and current benchmark state.
function createRequestGenerator({ scenario, state }) {
  const pickOperation = createWeightedOperationPicker(scenario.operations);
  let sequenceNumber = 0;

  return function generateNextRequest() {
    sequenceNumber += 1;

    const operation = pickOperation();
    const path = resolvePath(operation.path, state);
    const bodyObject = buildBodyFromTemplate(operation.bodyTemplate, sequenceNumber);

    const request = {
      operationName: operation.name,
      method: operation.method,
      path,
      headers: {}
    };

    // Only attach a JSON body when the selected operation requires one.
    if (bodyObject !== null) {
      request.body = JSON.stringify(bodyObject);
      request.headers["content-type"] = "application/json";
    }

    return request;
  };
}

module.exports = {
  createRequestGenerator
};