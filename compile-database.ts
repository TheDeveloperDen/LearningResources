import fs from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { YAML } from "bun";
import type { z } from "zod";
import {
	type Database,
	DatabaseSchema,
	type EntityIcon,
	fileNameToId,
	type Meta,
	MetaSchema,
	type Resource,
	ResourceSchema,
} from ".";
import { discoverIcons, IconManifestSchema } from "./icons";
import {
	andThen,
	type Diagnostic,
	error,
	fail,
	fromZod,
	hasErrors,
	ok,
	partition,
	report,
	type Validation,
	warning,
} from "./validation";

type DatabaseMetadata = {
	id: string;
	icon?: EntityIcon;
} & Meta;

async function readYaml<T>(
	filePath: string,
	schema: z.ZodType<T>,
	where: string,
): Promise<Validation<T>> {
	const content = await fs.promises.readFile(filePath, "utf-8");
	return fromZod(schema.safeParse(YAML.parse(content)), where);
}

async function yamlFiles(dir: string) {
	const files = await readdir(dir, { recursive: true });
	return files.filter((f) => f.endsWith(".yaml")).toSorted();
}

async function buildDatabase() {
	const metaDir = path.join(__dirname, "./metadata");
	const resourcesDir = path.join(__dirname, "./resources");
	const iconsDir = path.join(__dirname, "./icons");
	const manifestPath = path.join(iconsDir, "manifest.yaml");

	const diagnostics: Diagnostic[] = [];
	const finish = (): never => {
		report(diagnostics);
		console.error("Build failed due to validation errors.");
		process.exit(1);
	};

	const metaResults = await Promise.all(
		(await yamlFiles(metaDir)).map(async (file) =>
			andThen(
				await readYaml(
					path.join(metaDir, file),
					MetaSchema,
					`metadata/${file}`,
				),
				(meta) => ok({ id: fileNameToId(file), ...meta }),
			),
		),
	);
	const { values: metadata, diagnostics: metaDiagnostics } =
		partition<DatabaseMetadata>(metaResults);
	diagnostics.push(...metaDiagnostics);

	const manifest = fs.existsSync(manifestPath)
		? await readYaml(manifestPath, IconManifestSchema, "icons/manifest.yaml")
		: ok({});
	const icons = andThen(manifest, (m) =>
		discoverIcons(
			iconsDir,
			metadata.map((meta) => meta.id),
			m,
		),
	);
	diagnostics.push(...icons.diagnostics);
	if (icons.ok) {
		for (const meta of metadata) {
			const icon = icons.value[meta.id];
			if (icon) {
				meta.icon = icon;
			} else if (meta.category.type === "Language") {
				diagnostics.push(
					warning(`metadata/${meta.id}`, "language has no icon"),
				);
			}
		}
	}

	const validTags = new Set(metadata.map((meta) => meta.id));

	const resourceResults = await Promise.all(
		(await yamlFiles(resourcesDir)).map(async (file) => {
			const where = `resources/${file}`;
			return andThen(
				await readYaml(path.join(resourcesDir, file), ResourceSchema, where),
				(resource) => {
					const unknown = resource.teaches.filter((tag) => !validTags.has(tag));
					return unknown.length > 0
						? fail<Resource>([
								error(
									where,
									`unknown tags in 'teaches': [${unknown.join(", ")}]. Ensure a corresponding metadata file exists.`,
								),
							])
						: ok(resource);
				},
			);
		}),
	);
	const { values: resources, diagnostics: resourceDiagnostics } =
		partition(resourceResults);
	diagnostics.push(...resourceDiagnostics);

	if (hasErrors(diagnostics)) {
		return finish();
	}

	// verify the entire database against the schema before writing
	const database = { metadata, resources } satisfies Database;
	const final = fromZod(DatabaseSchema.safeParse(database), "database");
	diagnostics.push(...final.diagnostics);
	if (!final.ok) {
		return finish();
	}

	report(diagnostics);
	const outputPath = path.join(__dirname, "./database.json");
	await fs.promises.writeFile(outputPath, JSON.stringify(database, null, 2));

	console.log(
		`Success! Compiled ${metadata.length} entities and ${resources.length} resources.`,
	);
}

buildDatabase().catch((err) => {
	console.error("Unexpected error during build:", err);
	process.exit(1);
});
