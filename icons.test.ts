import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import {
	applyDarkFill,
	discoverIcons,
	type IconManifest,
	IconManifestSchema,
	MAX_ICON_BYTES,
	ROOT_TAG,
	validateIconSvg,
} from "./icons";
import { svgWith, useTmpDirs, VALID_SVG } from "./test-helpers";
import { ok } from "./validation";

const tmp = useTmpDirs();

describe("validateIconSvg", () => {
	test("accepts a minimal valid svg", () => {
		expect(validateIconSvg(VALID_SVG)).toEqual([]);
	});

	test("reports a missing viewBox", () => {
		const problems = validateIconSvg("<svg><path d=''/></svg>");
		expect(problems.some((p) => p.includes("viewBox"))).toBe(true);
	});

	test("reports input with no svg root", () => {
		expect(validateIconSvg("<div></div>")).not.toEqual([]);
	});

	test("reports input over the size cap", () => {
		const big = svgWith(`<path d="${"M0 0".repeat(MAX_ICON_BYTES)}"/>`);
		expect(validateIconSvg(big).some((p) => p.includes("bytes"))).toBe(true);
	});

	const forbidden: [string, string][] = [
		["script element", "<script>alert(1)</script>"],
		["image element", '<image href="data:image/png;base64,AAAA"/>'],
		["foreignObject element", "<foreignObject><div/></foreignObject>"],
		["event handler attribute", '<path onload="x()" d=""/>'],
		["external use href", '<use href="https://evil.test/a.svg#b"/>'],
		["external xlink href", '<use xlink:href="http://evil.test/a.svg#b"/>'],
		["external css url", '<path style="fill:url(https://x.test/g)" d=""/>'],
	];
	for (const [name, inner] of forbidden) {
		test(`rejects ${name}`, () => {
			expect(validateIconSvg(svgWith(inner))).not.toEqual([]);
		});
	}

	test("allows internal references", () => {
		const inner =
			'<defs><linearGradient id="g"/></defs><path fill="url(#g)" d=""/><use href="#a"/>';
		expect(validateIconSvg(svgWith(inner))).toEqual([]);
	});
});

describe("applyDarkFill", () => {
	const rootTag = (svg: string) => svg.match(ROOT_TAG)?.[0] ?? "";

	test("sets fill on the root element", () => {
		expect(rootTag(applyDarkFill(VALID_SVG, "#ffffff"))).toContain(
			'fill="#ffffff"',
		);
	});

	test("replaces an existing root fill", () => {
		const out = applyDarkFill(
			'<svg viewBox="0 0 1 1" fill="#000"><path d=""/></svg>',
			"#ffffff",
		);
		expect(rootTag(out).match(/fill=/g)).toHaveLength(1);
		expect(rootTag(out)).toContain('fill="#ffffff"');
	});

	test("throws when a descendant has an explicit fill", () => {
		expect(() =>
			applyDarkFill(
				'<svg viewBox="0 0 1 1"><path fill="#f00" d=""/></svg>',
				"#ffffff",
			),
		).toThrow(/explicit fill/);
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

	test("reports every problem in an invalid svg, and the errors from other files too", () => {
		const dir = iconsDirWith({
			"rust.svg": svgWith("<script>x()</script>"),
			"cpp.svg": "<svg></svg>",
		});
		const result = discoverIcons(dir, ["rust", "cpp"], manifest);
		expect(result.ok).toBe(false);
		expect(
			result.diagnostics.filter((d) => d.where === "icons/rust.svg"),
		).toHaveLength(1);
		expect(result.diagnostics.some((d) => d.where === "icons/cpp.svg")).toBe(
			true,
		);
		expect(result.diagnostics.every((d) => d.level === "error")).toBe(true);
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
