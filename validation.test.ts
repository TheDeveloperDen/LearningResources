import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
	andThen,
	error,
	fail,
	fromZod,
	hasErrors,
	ok,
	partition,
	report,
	suggest,
	type Validation,
	warning,
} from "./validation";

describe("partition", () => {
	test("keeps values from successes and every diagnostic from all items", () => {
		const items: Validation<number>[] = [
			ok(1, [warning("a", "careful")]),
			{ ok: false, diagnostics: [error("b", "bad"), error("b", "worse")] },
			ok(3),
		];

		const { values, diagnostics } = partition(items);

		expect(values).toEqual([1, 3]);
		expect(diagnostics).toEqual([
			warning("a", "careful"),
			error("b", "bad"),
			error("b", "worse"),
		]);
	});

	test("of nothing is empty", () => {
		expect(partition([])).toEqual({ values: [], diagnostics: [] });
	});
});

describe("andThen", () => {
	test("runs the next check on a success and keeps earlier warnings", () => {
		const result = andThen(ok(2, [warning("a", "w")]), (n) =>
			ok(n * 2, [warning("b", "w2")]),
		);
		expect(result).toEqual(ok(4, [warning("a", "w"), warning("b", "w2")]));
	});

	test("turns a success into a failure when the next check fails", () => {
		const result = andThen(ok(2, [warning("a", "w")]), () =>
			fail<number>([error("b", "no")]),
		);
		expect(result).toEqual(fail([warning("a", "w"), error("b", "no")]));
	});

	test("does not run the next check after a failure", () => {
		let called = false;
		const failed = fail<number>([error("a", "no")]);
		const result = andThen(failed, () => {
			called = true;
			return ok(1);
		});
		expect(called).toBe(false);
		expect(result).toEqual(failed);
	});
});

describe("hasErrors", () => {
	test("is false for warnings only and for nothing", () => {
		expect(hasErrors([])).toBe(false);
		expect(hasErrors([warning("a", "w")])).toBe(false);
	});

	test("is true when any diagnostic is an error", () => {
		expect(hasErrors([warning("a", "w"), error("b", "e")])).toBe(true);
	});
});

describe("fromZod", () => {
	const schema = z.strictObject({ name: z.string(), age: z.number() });

	test("returns the parsed value on success", () => {
		const result = fromZod(
			schema.safeParse({ name: "a", age: 1 }),
			"file.yaml",
		);
		expect(result).toEqual({
			ok: true,
			value: { name: "a", age: 1 },
			diagnostics: [],
		});
	});

	test("turns every zod issue into an error located at the file and path", () => {
		const result = fromZod(
			schema.safeParse({ name: 1, age: "x", extra: true }),
			"file.yaml",
		);

		expect(result.ok).toBe(false);
		expect(result.diagnostics).toHaveLength(3);
		expect(result.diagnostics.every((d) => d.level === "error")).toBe(true);
		expect(result.diagnostics.every((d) => d.where === "file.yaml")).toBe(true);
		const messages = result.diagnostics.map((d) => d.message).join("\n");
		expect(messages).toContain("name:");
		expect(messages).toContain("age:");
	});
});

describe("report", () => {
	test("sends errors to error() and warnings to warn(), tagged with location", () => {
		const out = { error: [] as string[], warn: [] as string[] };

		report([error("a.yaml", "broken"), warning("b", "meh")], {
			error: (m: string) => out.error.push(m),
			warn: (m: string) => out.warn.push(m),
		});

		expect(out.error).toEqual(["error: a.yaml: broken"]);
		expect(out.warn).toEqual(["warning: b: meh"]);
	});
});

describe("suggest", () => {
	test("offers the closest candidate for a typo", () => {
		expect(suggest("pyhton", ["rust", "python"])).toBe(
			' (did you mean "python"?)',
		);
	});

	test("ignores case", () => {
		expect(suggest("Rust", ["rust"])).toBe(' (did you mean "rust"?)');
	});

	test("offers nothing when no candidate is close", () => {
		expect(suggest("zzzzzz", ["rust", "python"])).toBe("");
		expect(suggest("x", [])).toBe("");
	});
});
