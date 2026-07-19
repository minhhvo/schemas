import fs from 'node:fs/promises';
import path from 'node:path';
import { bundle } from "@hyperjump/json-schema/bundle";
import { pathToFileURL } from "node:url";
import { env } from 'node:process';

import { addMediaTypePlugin } from "@hyperjump/browser";
import { buildSchemaDocument } from "@hyperjump/json-schema/experimental";

addMediaTypePlugin("application/schema+json", {
    parse: async (response) => {
        return buildSchemaDocument(await response.json(), response.url);
    },
    fileMatcher: (filePath) => filePath.endsWith(".json")
});

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
        const fileUrl = pathToFileURL(path.resolve(inputPath)).href;

        console.log(`Bundling: ${inputPath} -> ${outputFile}`);
        const bundledSchema = await bundle(fileUrl);

        stripAnnotations(bundledSchema);
        mutateId(bundledSchema, inputPath, outputFile);

        await fs.writeFile(outputFile, JSON.stringify(bundledSchema, null, 4), 'utf-8');
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