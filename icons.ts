import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { EntityIcon } from "./index";

export const MAX_ICON_BYTES = 50 * 1024;

const ROOT_TAG = /<svg\b[^>]*>/i;

/**
 * Checks an icon SVG against the dataset's rules. Returns a list of problems, with an empty list indicating success.
 */
export function validateIconSvg(svg: string): string[] {
	const problems: string[] = [];

	const bytes = Buffer.byteLength(svg);
	if (bytes > MAX_ICON_BYTES) {
		problems.push(`is ${bytes} bytes so over the ${MAX_ICON_BYTES} byte limit`);
	}

	const root = svg.match(ROOT_TAG)?.[0];
	if (!root) {
		problems.push("has no <svg> root element");
	} else if (!/\sviewBox\s*=/.test(root)) {
		problems.push("root <svg> has no viewBox");
	}

	for (const tag of ["script", "image", "foreignObject"]) {
		if (new RegExp(`<${tag}\\b`, "i").test(svg)) {
			problems.push(`contains a <${tag}> element`);
		}
	}

	if (/\son[a-z]+\s*=/i.test(svg)) {
		problems.push("contains an event handler attribute");
	}

	if (/\b(?:xlink:)?href\s*=\s*["'](?!#)/i.test(svg)) {
		problems.push("contains an external href");
	}
	if (/url\(\s*["']?(?!#)/i.test(svg)) {
		problems.push("contains an external url() reference");
	}

	return problems;
}

/**
 * Returns the SVG with `fill` set on the root element, for use on dark
 * backgrounds. Only safe for icons whose shapes inherit their fill, so it
 * will throw an error if any descendant sets one explicitly.
 */
export function applyDarkFill(svg: string, fill: string): string {
	const root = svg.match(ROOT_TAG);
	if (!root) {
		throw new Error("cannot recolour: no <svg> root element");
	}

	const rest = svg.slice((root.index ?? 0) + root[0].length);
	if (/\sfill\s*=/i.test(rest)) {
		throw new Error("cannot recolour: icon has explicit fill attributes");
	}

	const rootWithoutFill = root[0].replace(
		/\sfill\s*=\s*(?:"[^"]*"|'[^']*')/i,
		"",
	);
	const recoloured = rootWithoutFill.replace(
		/\s*(\/?)>$/,
		` fill="${fill}"$1>`,
	);
	return svg.replace(root[0], recoloured);
}

// A safe name suitable for e.g. a file name
const SafeName = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/);
const HexColor = z.string().regex(/^#[0-9a-fA-F]{3,8}$/);

const DeviconSourceSchema = z.strictObject({
	source: z.literal("devicon"),
	name: SafeName.describe("The icon's directory name in the devicon package."),
	variant: SafeName.optional().describe(
		"The devicon variant to use. Defaults to 'original'.",
	),
	dark: z
		.strictObject({ fill: HexColor })
		.optional()
		.describe(
			"If set, generate a dark-background variant with this root fill.",
		),
});

const CustomSourceSchema = z.strictObject({
	source: z.literal("custom"),
	license: z
		.string()
		.describe("The licence the hand-made icon is released under."),
});

/** Maps of icons to their source information. */
export const IconManifestSchema = z.record(
	SafeName,
	z.discriminatedUnion("source", [DeviconSourceSchema, CustomSourceSchema]),
);
export type IconManifest = z.infer<typeof IconManifestSchema>;

const ICON_FILE = /^(.+?)(\.dark)?\.svg$/;

/**
 * Finds `<id>.svg` / `<id>.dark.svg` files in `iconsDir` and maps them to the
 * entities they belong to. 
 * @returns a map of successful icons and a list of errors.
 */
export function discoverIcons(
	iconsDir: string,
	entityIds: string[],
	manifest: IconManifest,
): { icons: Record<string, EntityIcon>; errors: string[] } {
	const icons: Record<string, EntityIcon> = {};
	const errors: string[] = [];

	if (!fs.existsSync(iconsDir)) {
		return { icons, errors };
	}

	const files = fs
		.readdirSync(iconsDir)
		.filter((f) => f.endsWith(".svg"))
		.toSorted();
	const known = new Set(entityIds);
	const defaults = new Set<string>();
	const invalid = new Set<string>();

	for (const file of files) {
		const [, id, dark] = file.match(ICON_FILE) ?? [];
		if (!id || !known.has(id)) {
			errors.push(`icons/${file}: does not match any metadata entity`);
			continue;
		}
		if (!manifest[id]) {
			errors.push(
				`icons/${file}: entity "${id}" has no entry in icons/manifest.yaml`,
			);
			invalid.add(id);
			continue;
		}

		const problems = validateIconSvg(
			fs.readFileSync(path.join(iconsDir, file), "utf-8"),
		);
		if (problems.length > 0) {
			for (const problem of problems) {
				errors.push(`icons/${file}: ${problem}`);
			}
			invalid.add(id);
			continue;
		}

		if (dark) {
			icons[id] = { ...icons[id], dark: `icons/${file}` } as EntityIcon;
		} else {
			defaults.add(id);
			icons[id] = { ...icons[id], default: `icons/${file}` };
		}
	}

	for (const id of Object.keys(icons)) {
		if (!defaults.has(id) && !invalid.has(id)) {
			errors.push(`icons/${id}.dark.svg: entity "${id}" has no default icon`);
		}
		if (!defaults.has(id) || invalid.has(id)) {
			delete icons[id];
		}
	}

	return { icons, errors };
}
