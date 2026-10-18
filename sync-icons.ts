import fs from "node:fs";
import path from "node:path";
import { YAML } from "bun";
import {
	applyDarkFill,
	type IconManifest,
	IconManifestSchema,
	validateIconSvg,
} from "./icons";

/**
 * Copies the icons named in `manifest` from an installed Devicon package into
 * `outDir`
 */
export function syncIcons(opts: {
	manifest: IconManifest;
	deviconDir: string;
	outDir: string;
}): void {
	const { manifest, deviconDir, outDir } = opts;
	const pending = new Map<string, string>();

	for (const [id, entry] of Object.entries(manifest)) {
		if (entry.source !== "devicon") {
			continue;
		}

		const variant = entry.variant ?? "original";
		const sourcePath = path.join(
			deviconDir,
			"icons",
			entry.name,
			`${entry.name}-${variant}.svg`,
		);
		if (!fs.existsSync(sourcePath)) {
			throw new Error(`${id}: devicon icon not found at ${sourcePath}`);
		}

		const svg = fs.readFileSync(sourcePath, "utf-8");
		const problems = validateIconSvg(svg);
		if (problems.length > 0) {
			throw new Error(`${id}: ${sourcePath} ${problems.join("; ")}`);
		}

		pending.set(`${id}.svg`, svg);
		if (entry.dark) {
			try {
				pending.set(`${id}.dark.svg`, applyDarkFill(svg, entry.dark.fill));
			} catch (error) {
				throw new Error(`${id}: ${(error as Error).message}`);
			}
		}
	}

	if (pending.size > 0) {
		pending.set(
			"LICENSE.devicon",
			fs.readFileSync(path.join(deviconDir, "LICENSE"), "utf-8"),
		);
	}

	fs.mkdirSync(outDir, { recursive: true });
	for (const [file, content] of pending) {
		fs.writeFileSync(path.join(outDir, file), content);
	}
}

if (import.meta.main) {
	const iconsDir = path.join(__dirname, "icons");
	const manifest = IconManifestSchema.parse(
		YAML.parse(fs.readFileSync(path.join(iconsDir, "manifest.yaml"), "utf-8")),
	);
	syncIcons({
		manifest,
		deviconDir: path.join(__dirname, "node_modules", "devicon"),
		outDir: iconsDir,
	});
	console.log(`Synced icons for ${Object.keys(manifest).length} entities.`);
}
