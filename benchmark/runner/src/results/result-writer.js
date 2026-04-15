const fs = require("fs");
const path = require("path");

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function sanitizeTimestamp(isoTimestamp) {
  return isoTimestamp.replace(/:/g, "-").replace(/\./g, "-");
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function escapeCsvValue(value) {
  const stringValue = String(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function writeCsv(filePath, rows) {
  if (!rows.length) {
    fs.writeFileSync(filePath, "", "utf8");
    return;
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];

  for (const row of rows) {
    const line = headers.map((header) => escapeCsvValue(row[header])).join(",");
    lines.push(line);
  }

  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
}

function buildSummaryRows(allExperimentResults) {
  return allExperimentResults.map((result) => ({
    backend: result.backend,
    scenarioId: result.scenarioId,
    stateName: result.stateName,
    concurrency: result.concurrency,
    throughput: result.aggregatedMetrics.throughput,
    latency_median: result.aggregatedMetrics.latency_median,
    latency_p90: result.aggregatedMetrics.latency_p90,
    latency_p99: result.aggregatedMetrics.latency_p99,
    error_rate: result.aggregatedMetrics.error_rate
  }));
}

function writeResults({ category, backend, allExperimentResults, runMetadata }) {
  const benchmarkDir = path.resolve(__dirname, "..", "..", "..");
  const timestamp = sanitizeTimestamp(new Date().toISOString());
  const runDirectory = path.join(
    benchmarkDir,
    "results",
    category,
    backend,
    timestamp
  );

  ensureDirectory(runDirectory);

  const rawResultsPath = path.join(runDirectory, "raw-results.json");
  const summaryCsvPath = path.join(runDirectory, "summary.csv");
  const runMetadataPath = path.join(runDirectory, "run-metadata.json");

  writeJson(rawResultsPath, allExperimentResults);

  const summaryRows = buildSummaryRows(allExperimentResults);
  writeCsv(summaryCsvPath, summaryRows);

  writeJson(runMetadataPath, runMetadata);

  return {
    runDirectory,
    rawResultsPath,
    summaryCsvPath,
    runMetadataPath
  };
}

module.exports = {
  writeResults
};