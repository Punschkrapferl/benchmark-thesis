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

function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createTitle(sequenceNumber) {
  return `benchmark-todo-${sequenceNumber}`;
}

function createCompletedValue(sequenceNumber) {
  return sequenceNumber % 2 === 0;
}

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

    result[key] = value;
  }

  return result;
}

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