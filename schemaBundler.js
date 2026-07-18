import fs from 'node:fs/promises';
import path from 'node:path';
import $RefParser from '@apidevtools/json-schema-ref-parser';

import { env } from 'node:process';

const BASE_URI = (env.REPO_BASE_URI || "").replace(/\/$/, "");

if (!BASE_URI) {
    console.warn("WARNING: env.vars `REPO_BASE_URI` is not defined. Falling back to relative `$id`.");
}

function stripAnnotations(obj, parentKey = null) {
    if (!obj || typeof obj !== "object") return;

    const isDictionary = ["properties", "patternProperties", "$defs", "definitions", "dependentSchemas"].includes(parentKey);

    if (!isDictionary && !Array.isArray(obj)) {
        delete obj.description;
        delete obj.$comment;
        delete obj.examples;
        delete obj.deprecated;
        delete obj.readOnly;
        delete obj.writeOnly;
    }

    for (const key in obj) {
        stripAnnotations(obj[key], key);
    }
}

function mutateId(schema, inputPath, outputFilename) {
    if (!schema.$id) return;
    
    const versionDir = path.basename(path.dirname(inputPath));
    const baseName = path.basename(outputFilename);
    
    schema.$id = BASE_URI 
    ? `${BASE_URI}/${versionDir}/${baseName}`
    : `${versionDir}/${baseName}`;
}

async function processSchema(inputPath) {
    const file = path.basename(inputPath);
    
    if (file.startsWith("bundle-")) {
      return;
    }

    try {
        const dir = path.dirname(inputPath);
        const outputFile = path.join(dir, `bundle-${file}`);

        console.log(`Bundling: ${inputPath} -> ${outputFile}`);
        const bundledSchema = await $RefParser.bundle(inputPath);

        stripAnnotations(bundledSchema);
        mutateId(bundledSchema, inputPath, outputFile);

        fs.writeFileSync(outputFile, JSON.stringify(bundledSchema, null, 4));
    } catch (err) {
        console.error(`Bundling failed for ${inputPath}:`, err);
        process.exitCode = 1;
    }
}


async function run() {
    const targetFiles = process.argv.slice(2);

    // 1. Fail fast if no arguments are provided
    if (targetFiles.length === 0) {
        console.error("Error: No input schemas specified.");
        console.log("Usage: node schemaBundler.js <path-to-schema> [additional-schemas...]");
        console.log("Example: node schemaBundler.js ./v1/*.schema.json");
        process.exitCode = 1;
        return;
    }

    // 2. Process whatever was explicitly passed
    for (const file of targetFiles) {
        await processSchema(file);
    }
}

run();