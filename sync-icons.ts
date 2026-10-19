import fs from "node:fs";
import path from "node:path";
import { getIconData, iconToSVG } from "@iconify/utils";
import { YAML } from "bun";
import {
	applyDarkFill,
	type IconManifest,
	IconManifestSchema,
} from "./icons";

/** The parts of an `@iconify-json/<set>` package's exports that we use. */
type IconSetPackage = {
	icons: Parameters<typeof getIconData>[0];
	info: {
		name: string;
		author: { name: string; url?: string };
		license: { title: string; url?: string };
	};
};

const requireIconSet = (set: string): IconSetPackage =>
	require(`@iconify-json/${set}`);

const withUrl = (text: string, url?: string) =>
	url ? `${text} (${url})` : text;

/**
 * Copies the icons named in `manifest` from the installed Devicon package and
 * `@iconify-json/*` packages into `outDir`.
 */
export function syncIcons(opts: {
	manifest: IconManifest;
	deviconDir: string;
	/** Loads an `@iconify-json/<set>` package. */
	loadIconSet?: (set: string) => IconSetPackage;
	outDir: string;
}): void {
	const { manifest, deviconDir, loadIconSet = requireIconSet, outDir } = opts;
	const pending = new Map<string, string>();
	const iconSets = new Map<string, IconSetPackage>();

	for (const [id, entry] of Object.entries(manifest)) {
		if (entry.source === "devicon") {
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

			pending.set(`${id}.svg`, svg);
			if (entry.dark) {
				pending.set(`${id}.dark.svg`, applyDarkFill(svg, entry.dark.fill));
			}
		} else if (entry.source === "iconify") {
			let iconSet = iconSets.get(entry.set);
			if (!iconSet) {
				try {
					iconSet = loadIconSet(entry.set);
				} catch (cause) {
					throw new Error(
						`${id}: could not load @iconify-json/${entry.set} (is it installed?): ${cause}`,
					);
				}
				iconSets.set(entry.set, iconSet);
			}

			const data = getIconData(iconSet.icons, entry.name);
			if (!data) {
				throw new Error(
					`${id}: icon "${entry.name}" not found in @iconify-json/${entry.set}`,
				);
			}
			const { attributes, body } = iconToSVG(data, { height: "unset" });
			pending.set(
				`${id}.svg`,
				`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${attributes.viewBox}">${body}</svg>`,
			);
		}
	}

	if (Object.values(manifest).some((entry) => entry.source === "devicon")) {
		pending.set(
			"LICENSE.devicon",
			fs.readFileSync(path.join(deviconDir, "LICENSE"), "utf-8"),
		);
	}
	if (iconSets.size > 0) {
		const lines = [...iconSets.values()]
			.map(
				({ info }) =>
					`- ${info.name}: ${withUrl(info.author.name, info.author.url)}, ${withUrl(info.license.title, info.license.url)}`,
			)
			.toSorted();
		pending.set("NOTICE.md", `Icons from:\n${lines.join("\n")}\n`);
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
