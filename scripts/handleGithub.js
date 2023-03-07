#!/usr/bin/env node

const { exec, spawn } = require("child_process");
const path = require("path");
const collection_js = path.resolve(__dirname, "collection.js");

const program = require("commander");

function actionErrorHandler(error) {
  console.log(error.stack);
  throw error;
}

function actionRunner(fn) {
  return (...args) => Promise.resolve(fn(...args)).catch(actionErrorHandler);
}

var githubContext = JSON.parse(process.env.GITHUB_CONTEXT || "{}"), // GITHUB_CONTEXT: ${{ github }}
  config = {},
  issueBodyConfig = {},
  eventAction = githubContext.event ? githubContext.event.action : "",
  eventIssue = githubContext.event ? githubContext.event.issue : {};

const formatMapping = {
  "OpenAPI 3.0": "openapi_3",
  default: "openapi_3",
};



process.on("exit", function () {
  console.log("Exiting with " + (process.exitCode || 0));
});


program
  .command("issue")
  .description("add api from issue")
  .action(actionRunner(addApiFromIssue));

program.parse(process.argv);


function addApiFromIssue() {
  if (!!eventIssue.body) {
    issueBodyConfig = Object.fromEntries(
      eventIssue.body
        .replaceAll("*", "")
        .split("\n")
        .filter(Boolean)
        .map((s) => {
          var [key, value] = s
            .trim()
            .split(": ", 2)
            .map((s) => s.trim());
          return [
            key
              .toLowerCase()
              .replaceAll(/[^ a-z]/g, "")
              .trim(),
            value,
          ];
        })
    );
    console.debug("Parsing issue: ");
    console.debug(issueBodyConfig);
  } else {
    console.warn("Issue has no body");
  }

  config.category = issueBodyConfig.category || "";
  config.url = issueBodyConfig.url || "";
  config.logo = issueBodyConfig.logo || "";
  config.slug = (issueBodyConfig.slug || issueBodyConfig.name || "")
    .toLowerCase()
    .replaceAll(" ", "-");
  config.format =
    formatMapping[issueBodyConfig.format] || formatMapping.default;

  try {
    config.host = new URL(issueBodyConfig.url).host
      .split(".")
      .slice(-2)
      .join(".");
  } catch (error) {
    console.error("%s: %s", error.message, issueBodyConfig.url);
    process.exit(1);
  }

  var commandArgs = []
    .concat(config.category ? ["-c", config.category] : [])
    .concat(config.host ? ["-h", config.host] : [])
    .concat(config.slug ? ["-s", config.slug] : [])
    .concat(config.logo ? ["-l", config.logo] : []);

  var command = [
    "node",
    collection_js,
    "add",
    ...commandArgs,
    config.format,
    config.url,
  ].join(" ");

  console.log(command);

  const child = spawn("node", [
    collection_js,
    "add",
    ...commandArgs,
    config.format,
    config.url,
  ]);

  child.stdout.on("data", (data) => {
    process.stdout.write(data);
  });

  child.stderr.on("data", (data) => {
    process.stderr.write(data);
  });
}