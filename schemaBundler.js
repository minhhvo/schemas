const $RefParser = require("@apidevtools/json-schema-ref-parser");
const fs = require("fs");

// 1. Point the parser at your Root Conductor schema
const rootSchema = "./v1/bibtex.schema.json";
const outputFile = "./v1/bibtex.bundle.json";

// 2. Run the bundler
$RefParser.bundle(rootSchema)
  .then((bundledSchema) => {
    // 3. Save the new monolithic file for production/web use
    fs.writeFileSync(outputFile, JSON.stringify(bundledSchema, null, 4));
  })
  .catch((err) => {
    console.error("Bundling failed:", err);
  });