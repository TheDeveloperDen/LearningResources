import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { IconManifest } from "./icons";
import { syncIcons } from "./sync-icons";

const SVG =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path d="M0 0h1v1z"/></svg>';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "sync-icons-"));

/** Builds a fake devicon package containing the given `icons/<name>/<name>-<variant>.svg` files. */
const fakeDevicon = (icons: Record<string, string>) => {
	const dir = tmp();
	fs.writeFileSync(path.join(dir, "LICENSE"), "MIT License");
	for (const [file, content] of Object.entries(icons)) {
		const name = file.split("-")[0] ?? file;
		fs.mkdirSync(path.join(dir, "icons", name), { recursive: true });
		fs.writeFileSync(path.join(dir, "icons", name, `${file}.svg`), content);
	}
	return dir;
};

describe("syncIcons", () => {
	test("copies the original variant and the devicon licence", () => {
		const deviconDir = fakeDevicon({ "foo-original": SVG });
		const outDir = tmp();
		const manifest: IconManifest = { foo: { source: "devicon", name: "foo" } };

		syncIcons({ manifest, deviconDir, outDir });

		expect(fs.readFileSync(path.join(outDir, "foo.svg"), "utf-8")).toBe(SVG);
		expect(fs.readFileSync(path.join(outDir, "LICENSE.devicon"), "utf-8")).toBe(
			"MIT License",
		);
	});

	test("uses an explicit variant", () => {
		const deviconDir = fakeDevicon({
			"foo-original": SVG,
			"foo-line": SVG.replace("M0 0h1v1z", "M1 1h1v1z"),
		});
		const outDir = tmp();

		syncIcons({
			manifest: { foo: { source: "devicon", name: "foo", variant: "line" } },
			deviconDir,
			outDir,
		});

		expect(fs.readFileSync(path.join(outDir, "foo.svg"), "utf-8")).toContain(
			"M1 1h1v1z",
		);
	});

	test("writes a dark variant with the requested root fill", () => {
		const deviconDir = fakeDevicon({ "foo-original": SVG });
		const outDir = tmp();

		syncIcons({
			manifest: {
				foo: { source: "devicon", name: "foo", dark: { fill: "#ffffff" } },
			},
			deviconDir,
			outDir,
		});

		const dark = fs.readFileSync(path.join(outDir, "foo.dark.svg"), "utf-8");
		expect(dark.match(/<svg\b[^>]*>/)?.[0]).toContain('fill="#ffffff"');
	});

	test("is idempotent", () => {
		const deviconDir = fakeDevicon({ "foo-original": SVG });
		const outDir = tmp();
		const opts = {
			manifest: {
				foo: { source: "devicon", name: "foo", dark: { fill: "#ffffff" } },
			} satisfies IconManifest,
			deviconDir,
			outDir,
		};
		const read = () =>
			fs
				.readdirSync(outDir)
				.toSorted()
				.map((f) => [f, fs.readFileSync(path.join(outDir, f), "utf-8")]);

		syncIcons(opts);
		const first = read();
		syncIcons(opts);

		expect(read()).toEqual(first);
	});

	test("writes nothing when any manifest entry names a missing icon", () => {
		const deviconDir = fakeDevicon({ "good-original": SVG });
		const outDir = tmp();
		const manifest: IconManifest = {
			good: { source: "devicon", name: "good" },
			bad: { source: "devicon", name: "nonexistent" },
		};

		expect(() => syncIcons({ manifest, deviconDir, outDir })).toThrow(/bad/);
		expect(fs.readdirSync(outDir)).toEqual([]);
	});

	test("throws when a source svg fails validation", () => {
		const deviconDir = fakeDevicon({
			"foo-original": SVG.replace("<path", "<script>x()</script><path"),
		});

		expect(() =>
			syncIcons({
				manifest: { foo: { source: "devicon", name: "foo" } },
				deviconDir,
				outDir: tmp(),
			}),
		).toThrow(/foo/);
	});

	test("skips custom entries", () => {
		const outDir = tmp();

		syncIcons({
			manifest: { general: { source: "custom", license: "CC0" } },
			deviconDir: fakeDevicon({}),
			outDir,
		});

		expect(fs.readdirSync(outDir).filter((f) => f.endsWith(".svg"))).toEqual(
			[],
		);
	});
});
