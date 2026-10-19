import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import type { IconManifest } from "./icons";
import { syncIcons } from "./sync-icons";
import { useTmpDirs, VALID_SVG } from "./test-helpers";

const tmp = useTmpDirs();

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
		const deviconDir = fakeDevicon({ "foo-original": VALID_SVG });
		const outDir = tmp();
		const manifest: IconManifest = { foo: { source: "devicon", name: "foo" } };

		syncIcons({ manifest, deviconDir, outDir });

		expect(fs.readFileSync(path.join(outDir, "foo.svg"), "utf-8")).toBe(
			VALID_SVG,
		);
		expect(fs.readFileSync(path.join(outDir, "LICENSE.devicon"), "utf-8")).toBe(
			"MIT License",
		);
	});

	test("uses an explicit variant", () => {
		const deviconDir = fakeDevicon({
			"foo-original": VALID_SVG,
			"foo-line": VALID_SVG.replace("M0 0h1v1z", "M1 1h1v1z"),
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
		const deviconDir = fakeDevicon({ "foo-original": VALID_SVG });
		const outDir = tmp();

		syncIcons({
			manifest: {
				foo: { source: "devicon", name: "foo", dark: { fill: "#ffffff" } },
			},
			deviconDir,
			outDir,
		});

		const dark = fs.readFileSync(path.join(outDir, "foo.dark.svg"), "utf-8");
		expect(dark.match(/<svg[^>]*>/)?.[0]).toContain('fill="#ffffff"');
	});

	test("is idempotent", () => {
		const deviconDir = fakeDevicon({ "foo-original": VALID_SVG });
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
		const deviconDir = fakeDevicon({ "good-original": VALID_SVG });
		const outDir = tmp();
		const manifest: IconManifest = {
			good: { source: "devicon", name: "good" },
			bad: { source: "devicon", name: "nonexistent" },
		};

		expect(() => syncIcons({ manifest, deviconDir, outDir })).toThrow(/bad/);
		expect(fs.readdirSync(outDir)).toEqual([]);
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

	describe("stale files", () => {
		const devicon = (dark = false): IconManifest => ({
			foo: {
				source: "devicon",
				name: "foo",
				...(dark ? { dark: { fill: "#ffffff" } } : {}),
			},
		});
		const ls = (dir: string) => fs.readdirSync(dir).toSorted();

		test("removes a dark variant the manifest no longer asks for", () => {
			const deviconDir = fakeDevicon({ "foo-original": VALID_SVG });
			const outDir = tmp();
			syncIcons({ manifest: devicon(true), deviconDir, outDir });

			const removed = syncIcons({ manifest: devicon(), deviconDir, outDir });

			expect(ls(outDir)).toEqual(["LICENSE.devicon", "foo.svg"]);
			expect(removed).toEqual(["foo.dark.svg"]);
		});

		test("removes icons for entries deleted from the manifest", () => {
			const deviconDir = fakeDevicon({
				"foo-original": VALID_SVG,
				"bar-original": VALID_SVG,
			});
			const outDir = tmp();
			const both: IconManifest = {
				...devicon(),
				bar: { source: "devicon", name: "bar" },
			};
			syncIcons({ manifest: both, deviconDir, outDir });

			syncIcons({ manifest: devicon(), deviconDir, outDir });

			expect(ls(outDir)).toEqual(["LICENSE.devicon", "foo.svg"]);
		});

		test("removes the licence and notice once nothing needs them", () => {
			const deviconDir = fakeDevicon({ "foo-original": VALID_SVG });
			const outDir = tmp();
			fs.writeFileSync(path.join(outDir, "NOTICE.md"), "old");

			syncIcons({ manifest: devicon(), deviconDir, outDir });
			expect(ls(outDir)).toEqual(["LICENSE.devicon", "foo.svg"]);

			syncIcons({
				manifest: { foo: { source: "custom", license: "MIT" } },
				deviconDir,
				outDir,
			});
			expect(ls(outDir)).toEqual(["foo.svg"]);
		});

		test("keeps hand-made icons of custom entries, and files it doesn't manage", () => {
			const outDir = tmp();
			for (const f of ["foo.svg", "foo.dark.svg", "manifest.yaml"]) {
				fs.writeFileSync(path.join(outDir, f), "mine");
			}

			const removed = syncIcons({
				manifest: { foo: { source: "custom", license: "MIT" } },
				deviconDir: fakeDevicon({}),
				outDir,
			});

			expect(ls(outDir)).toEqual(["foo.dark.svg", "foo.svg", "manifest.yaml"]);
			expect(removed).toEqual([]);
		});

		test("removes an svg that belongs to no manifest entry", () => {
			const outDir = tmp();
			fs.writeFileSync(path.join(outDir, "ghost.svg"), VALID_SVG);

			const removed = syncIcons({
				manifest: {},
				deviconDir: fakeDevicon({}),
				outDir,
			});

			expect(ls(outDir)).toEqual([]);
			expect(removed).toEqual(["ghost.svg"]);
		});

		test("removes nothing when the sync fails", () => {
			const outDir = tmp();
			fs.writeFileSync(path.join(outDir, "ghost.svg"), VALID_SVG);

			expect(() =>
				syncIcons({
					manifest: devicon(),
					deviconDir: fakeDevicon({}),
					outDir,
				}),
			).toThrow();

			expect(ls(outDir)).toEqual(["ghost.svg"]);
		});
	});

	describe("iconify", () => {
		/** A fake loader serving the given sets, as `@iconify-json/<set>` would. */
		const fakeIconify =
			(sets: Record<string, Record<string, string>>) => (set: string) => {
				const icons = sets[set];
				if (!icons) {
					throw new Error(`Cannot find module '@iconify-json/${set}'`);
				}
				return {
					icons: {
						prefix: set,
						width: 36,
						height: 36,
						icons: Object.fromEntries(
							Object.entries(icons).map(([name, body]) => [name, { body }]),
						),
					},
					info: {
						name: `${set} set`,
						author: { name: "Some Author", url: "https://author.test" },
						license: {
							title: "CC BY 4.0",
							spdx: "CC-BY-4.0",
							url: "https://license.test",
						},
					},
				};
			};
		const manifest: IconManifest = {
			general: { source: "iconify", set: "fake", name: "books" },
		};

		test("wraps the icon body in an svg with the set's viewBox", () => {
			const outDir = tmp();

			syncIcons({
				manifest,
				deviconDir: fakeDevicon({}),
				loadIconSet: fakeIconify({ fake: { books: '<path d="M0 0h1v1z"/>' } }),
				outDir,
			});

			expect(fs.readFileSync(path.join(outDir, "general.svg"), "utf-8")).toBe(
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M0 0h1v1z"/></svg>',
			);
		});

		test("writes a notice crediting each set used, from its metadata", () => {
			const outDir = tmp();

			syncIcons({
				manifest: {
					...manifest,
					other: { source: "iconify", set: "second", name: "x" },
				},
				deviconDir: fakeDevicon({}),
				loadIconSet: fakeIconify({
					fake: { books: "<path/>" },
					second: { x: "<path/>" },
				}),
				outDir,
			});

			const notice = fs.readFileSync(path.join(outDir, "NOTICE.md"), "utf-8");
			expect(notice).toContain("fake set");
			expect(notice).toContain("second set");
			expect(notice).toContain("Some Author");
			expect(notice).toContain("https://author.test");
			expect(notice).toContain("CC BY 4.0");
			expect(notice).toContain("https://license.test");
		});

		test("writes no notice when no iconify icons are used", () => {
			const outDir = tmp();

			syncIcons({
				manifest: { foo: { source: "devicon", name: "foo" } },
				deviconDir: fakeDevicon({ "foo-original": VALID_SVG }),
				outDir,
			});

			expect(fs.existsSync(path.join(outDir, "NOTICE.md"))).toBe(false);
		});

		test("writes nothing when a named icon is missing from its set", () => {
			const outDir = tmp();

			expect(() =>
				syncIcons({
					manifest: {
						...manifest,
						good: { source: "iconify", set: "fake", name: "brain" },
					},
					deviconDir: fakeDevicon({}),
					loadIconSet: fakeIconify({ fake: { brain: "<path/>" } }),
					outDir,
				}),
			).toThrow(/general.*books/);
			expect(fs.readdirSync(outDir)).toEqual([]);
		});

		test("throws naming the set when its package is not installed", () => {
			expect(() =>
				syncIcons({
					manifest,
					deviconDir: fakeDevicon({}),
					loadIconSet: fakeIconify({}),
					outDir: tmp(),
				}),
			).toThrow(/@iconify-json\/fake/);
		});

		test("loads each set once however many icons use it", () => {
			let loads = 0;
			const load = fakeIconify({ fake: { a: "<path/>", b: "<path/>" } });

			syncIcons({
				manifest: {
					one: { source: "iconify", set: "fake", name: "a" },
					two: { source: "iconify", set: "fake", name: "b" },
				},
				deviconDir: fakeDevicon({}),
				loadIconSet: (set) => {
					loads++;
					return load(set);
				},
				outDir: tmp(),
			});

			expect(loads).toBe(1);
		});
	});
});
