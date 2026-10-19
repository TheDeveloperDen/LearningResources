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
	const rust: IconManifest = { rust: { source: "devicon", name: "rust" } };
	const both: IconManifest = {
		...rust,
		cpp: { source: "devicon", name: "cplusplus" },
	};

	const iconsDirWith = (files: Record<string, string>) => {
		const dir = tmp("icons-");
		for (const [name, content] of Object.entries(files)) {
			fs.writeFileSync(path.join(dir, name), content);
		}
		return dir;
	};

	const messages = (result: { diagnostics: { message: string }[] }) =>
		result.diagnostics.map((d) => d.message).join("\n");

	test("maps default and dark files to repo-relative paths", () => {
		const dir = iconsDirWith({
			"rust.svg": VALID_SVG,
			"rust.dark.svg": VALID_SVG,
		});
		const manifest: IconManifest = {
			rust: { source: "devicon", name: "rust", dark: { fill: "#ffffff" } },
		};
		expect(discoverIcons(dir, ["rust", "cpp"], manifest)).toEqual(
			ok({
				rust: { default: "icons/rust.svg", dark: "icons/rust.dark.svg" },
			}),
		);
	});

	test("reports every file whose name matches no entity", () => {
		const dir = iconsDirWith({ "Rust.svg": VALID_SVG, "c++.svg": VALID_SVG });
		const result = discoverIcons(dir, ["rust", "cpp"], {});
		expect(result.ok).toBe(false);
		expect(result.diagnostics.map((d) => d.where).toSorted()).toEqual([
			"icons/Rust.svg",
			"icons/c++.svg",
		]);
	});

	test("suggests the nearest entity for a misnamed file", () => {
		const dir = iconsDirWith({ "pyhton.svg": VALID_SVG });
		const result = discoverIcons(dir, ["python", "rust"], {});
		expect(messages(result)).toContain('did you mean "python"');
	});

	test("reports a dark variant with no default", () => {
		const dir = iconsDirWith({ "rust.dark.svg": VALID_SVG });
		const manifest: IconManifest = {
			rust: { source: "devicon", name: "rust", dark: { fill: "#ffffff" } },
		};
		const result = discoverIcons(dir, ["rust"], manifest);
		expect(result.ok).toBe(false);
		expect(result.diagnostics.map((d) => d.message)).toEqual([
			expect.stringContaining("no default icon"),
		]);
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
		expect(discoverIcons(missing, ["rust"], rust)).toEqual(ok({}));
	});

	test("ignores non-svg files such as the manifest and licence", () => {
		const dir = iconsDirWith({
			"manifest.yaml": "",
			"LICENSE.devicon": "MIT",
			"rust.svg": VALID_SVG,
		});
		expect(discoverIcons(dir, ["rust"], rust)).toEqual(
			ok({ rust: { default: "icons/rust.svg" } }),
		);
	});

	describe("manifest entries that don't line up with the folder", () => {
		test("a synced entry with no file says to run sync-icons", () => {
			const dir = iconsDirWith({ "rust.svg": VALID_SVG });
			const result = discoverIcons(dir, ["rust", "cpp"], both);
			expect(result.ok).toBe(false);
			expect(result.diagnostics).toEqual([
				{
					level: "error",
					where: "icons/manifest.yaml",
					message: expect.stringContaining("icons/cpp.svg is missing"),
				},
			]);
			expect(messages(result)).toContain("sync-icons");
		});

		test("a custom entry with no file says to add one by hand", () => {
			const dir = iconsDirWith({});
			const result = discoverIcons(dir, ["foo"], {
				foo: { source: "custom", license: "MIT" },
			});
			expect(result.ok).toBe(false);
			expect(messages(result)).toContain("icons/foo.svg is missing");
			expect(messages(result)).not.toContain("sync-icons");
		});

		test("an entry for something that is not an entity, with a suggestion", () => {
			const dir = iconsDirWith({});
			const result = discoverIcons(dir, ["rust"], {
				rsut: { source: "devicon", name: "rust" },
			});
			expect(result.ok).toBe(false);
			expect(result.diagnostics[0]?.where).toBe("icons/manifest.yaml");
			expect(messages(result)).toContain('"rsut" is not a metadata entity');
			expect(messages(result)).toContain('did you mean "rust"');
		});

		test("a configured dark variant that has no file", () => {
			const dir = iconsDirWith({ "rust.svg": VALID_SVG });
			const result = discoverIcons(dir, ["rust"], {
				rust: { source: "devicon", name: "rust", dark: { fill: "#ffffff" } },
			});
			expect(result.ok).toBe(false);
			expect(messages(result)).toContain("icons/rust.dark.svg is missing");
			expect(messages(result)).toContain("sync-icons");
		});

		test("a dark file the manifest entry no longer asks for", () => {
			const dir = iconsDirWith({
				"rust.svg": VALID_SVG,
				"rust.dark.svg": VALID_SVG,
			});
			const result = discoverIcons(dir, ["rust"], rust);
			expect(result.ok).toBe(false);
			expect(result.diagnostics[0]?.where).toBe("icons/rust.dark.svg");
			expect(messages(result)).toContain("sync-icons");
		});

		test("a custom entry may have a hand-made dark file", () => {
			const dir = iconsDirWith({
				"foo.svg": VALID_SVG,
				"foo.dark.svg": VALID_SVG,
			});
			const result = discoverIcons(dir, ["foo"], {
				foo: { source: "custom", license: "MIT" },
			});
			expect(result.ok).toBe(true);
		});
	});
});
