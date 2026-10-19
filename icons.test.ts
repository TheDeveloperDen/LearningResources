import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import {
	applyDarkFill,
	discoverIcons,
	type IconManifest,
	IconManifestSchema,
} from "./icons";
import { useTmpDirs, VALID_SVG } from "./test-helpers";
import { ok } from "./validation";

const tmp = useTmpDirs();

describe("applyDarkFill", () => {
	test("sets fill on the root element", () => {
		expect(applyDarkFill(VALID_SVG, "#ffffff")).toBe(
			VALID_SVG.replace('128">', '128" fill="#ffffff">'),
		);
	});
});

describe("ManifestSchema", () => {
	test("accepts devicon entries with a dark fill and custom entries with a license", () => {
		const result = IconManifestSchema.safeParse({
			rust: { source: "devicon", name: "rust", dark: { fill: "#ffffff" } },
			general: { source: "custom", license: "CC0" },
		});
		expect(result.success).toBe(true);
	});

	test("rejects entity ids, icon names and variants that could escape the icons directory", () => {
		const base = { source: "devicon", name: "rust" };
		expect(IconManifestSchema.safeParse({ "../x": base }).success).toBe(false);
		expect(IconManifestSchema.safeParse({ "a/b": base }).success).toBe(false);
		expect(
			IconManifestSchema.safeParse({ rust: { ...base, name: "../../etc" } })
				.success,
		).toBe(false);
		expect(
			IconManifestSchema.safeParse({ rust: { ...base, variant: "a/b" } })
				.success,
		).toBe(false);
	});

	test("rejects a dark fill that is not a hex colour", () => {
		const result = IconManifestSchema.safeParse({
			rust: {
				source: "devicon",
				name: "rust",
				dark: { fill: '"><script>x()</script>' },
			},
		});
		expect(result.success).toBe(false);
	});

	test("accepts an iconify entry and rejects unsafe or extra keys", () => {
		const iconify = { source: "iconify", set: "twemoji", name: "books" };
		expect(IconManifestSchema.safeParse({ general: iconify }).success).toBe(
			true,
		);
		expect(
			IconManifestSchema.safeParse({ general: { ...iconify, name: "../x" } })
				.success,
		).toBe(false);
		expect(
			IconManifestSchema.safeParse({ general: { ...iconify, set: "a/b" } })
				.success,
		).toBe(false);
		expect(
			IconManifestSchema.safeParse({
				general: { ...iconify, dark: { fill: "#ffffff" } },
			}).success,
		).toBe(false);
	});

	test("rejects a custom entry without a license", () => {
		expect(
			IconManifestSchema.safeParse({ general: { source: "custom" } }).success,
		).toBe(false);
	});
});

describe("discoverIcons", () => {
	const manifest: IconManifest = {
		rust: { source: "devicon", name: "rust" },
		cpp: { source: "devicon", name: "cplusplus" },
	};

	const iconsDirWith = (files: Record<string, string>) => {
		const dir = tmp("icons-");
		for (const [name, content] of Object.entries(files)) {
			fs.writeFileSync(path.join(dir, name), content);
		}
		return dir;
	};

	test("maps default and dark files to repo-relative paths", () => {
		const dir = iconsDirWith({
			"rust.svg": VALID_SVG,
			"rust.dark.svg": VALID_SVG,
		});
		expect(discoverIcons(dir, ["rust", "cpp"], manifest)).toEqual(
			ok({
				rust: { default: "icons/rust.svg", dark: "icons/rust.dark.svg" },
			}),
		);
	});

	test("reports every file whose name matches no entity", () => {
		const dir = iconsDirWith({ "Rust.svg": VALID_SVG, "c++.svg": VALID_SVG });
		const result = discoverIcons(dir, ["rust", "cpp"], manifest);
		expect(result.ok).toBe(false);
		expect(result.diagnostics.map((d) => d.where).toSorted()).toEqual([
			"icons/Rust.svg",
			"icons/c++.svg",
		]);
	});

	test("reports a dark variant with no default", () => {
		const dir = iconsDirWith({ "rust.dark.svg": VALID_SVG });
		const result = discoverIcons(dir, ["rust"], manifest);
		expect(result.ok).toBe(false);
		expect(result.diagnostics.some((d) => d.message.includes("default"))).toBe(
			true,
		);
	});

	test("reports an icon with no manifest entry", () => {
		const dir = iconsDirWith({ "rust.svg": VALID_SVG });
		const result = discoverIcons(dir, ["rust"], {});
		expect(result.ok).toBe(false);
		expect(result.diagnostics.some((d) => d.message.includes("manifest"))).toBe(
			true,
		);
	});

	test("treats a missing icons directory as no icons", () => {
		const missing = path.join(tmp("icons-"), "does-not-exist");
		expect(discoverIcons(missing, ["rust"], manifest)).toEqual(ok({}));
	});

	test("ignores non-svg files such as the manifest and licence", () => {
		const dir = iconsDirWith({
			"manifest.yaml": "",
			"LICENSE.devicon": "MIT",
			"rust.svg": VALID_SVG,
		});
		expect(discoverIcons(dir, ["rust"], manifest)).toEqual(
			ok({ rust: { default: "icons/rust.svg" } }),
		);
	});
});
