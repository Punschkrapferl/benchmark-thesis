const fs = require("fs");
const path = require("path");

// Create the target directory recursively if it does not exist yet.
function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

// Convert ISO timestamps into filesystem-safe folder names.
function sanitizeTimestamp(isoTimestamp) {
  return isoTimestamp.replace(/:/g, "-").replace(/\./g, "-");
}

// Write formatted JSON to disk.
function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

// Escape CSV values when they contain commas, quotes, or line breaks.
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

// Write a list of objects into a CSV file.
// The object keys of the first row are used as the header order.
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

// Build a compact per-experiment summary table for CSV output.
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

// Write the benchmark run output into the results directory.
// For each run, this function writes:
// - raw-results.json
// - summary.csv
// - run-metadata.json
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