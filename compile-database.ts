import path from "path";
import fs from "fs";
import { readdir } from "node:fs/promises";
import { DatabaseSchema, fileNameToId, MetaSchema, ResourceSchema, type Database, type Meta, type Resource } from ".";
import { YAML } from "bun";

type DatabaseMetadata = {
    id: string;
} & Meta


async function buildDatabase() {
    const metaDir = path.join(__dirname, "./metadata");
    const resourcesDir = path.join(__dirname, "./resources");

    const allMetaFiles = (await readdir(metaDir, { recursive: true, })).toSorted();
    const allResourceFiles = (await readdir(resourcesDir, { recursive: true, })).toSorted();

    const database = {
        metadata: [] as DatabaseMetadata[],
        resources: [] as Resource[]
    } satisfies Database;
    let hasErrors = false;

    for (const file of allMetaFiles.filter(f => f.endsWith(".yaml"))) {
        const filePath = path.join(metaDir, file);
        const fileContent = await fs.promises.readFile(filePath, "utf-8");

        const entityId = fileNameToId(file);

        const data = YAML.parse(fileContent);
        const result = MetaSchema.safeParse(data);

        if (!result.success) {
            console.error(`Validation Error in Metadata: ${file}`);
            console.error(result.error.issues);
            hasErrors = true;
        } else {
            database.metadata.push({ id: entityId, ...result.data });
        }
    }

    const validTags = new Set(database.metadata.map(meta => meta.id));

    for (const file of allResourceFiles.filter(f => f.endsWith(".yaml"))) {
        const filePath = path.join(resourcesDir, file);
        const fileContent = await fs.promises.readFile(filePath, "utf-8");

        const data = YAML.parse(fileContent);
        const result = ResourceSchema.safeParse(data);

        if (!result.success) {
            console.error(`Validation Error in Resource: ${file}`);
            console.error(result.error.issues);
            hasErrors = true;
            continue;
        }

        const invalidTags = result.data.teaches.filter(tag => !validTags.has(tag));
        if (invalidTags.length > 0) {
            console.error(`Relational Error in Resource: ${file}`);
            console.error(`Unknown tags in 'teaches': [${invalidTags.join(", ")}]`);
            console.error(`Ensure a corresponding metadata file exists.`);
            hasErrors = true;
            continue;
        }

        database.resources.push(result.data);
    }

    if (hasErrors) {
        console.error("Build failed due to validation errors.");
        process.exit(1);
    }

    // verify the entire database against the schema before writing
    const finalResult = DatabaseSchema.safeParse(database);
    if (!finalResult.success) {
        console.error("Final Database Validation Error:");
        console.error(finalResult.error.issues);
        process.exit(1);
    }

    const outputPath = path.join(__dirname, "./database.json");
    await fs.promises.writeFile(outputPath, JSON.stringify(database, null, 2));

    console.log(`Success! Compiled ${database.metadata.length} entities and ${database.resources.length} resources.`);
}

buildDatabase().catch(err => {
    console.error("Unexpected error during build:", err);
    process.exit(1);
});
