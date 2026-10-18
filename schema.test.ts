import { describe, expect, test } from "bun:test";
import { CompiledMetaSchema } from "./index";

const rust = {
	id: "rust",
	name: "Rust",
	description:
		"Rust is a multi-paradigm systems language designed by Graydon Hoare in 2010",
	emoji: "821824283965128774",
	domains: ["Systems Programming", "Web Development", "Game Development"],
	category: {
		type: "Language",
		paradigms: ["Procedural Programming", "Functional Programming"],
	},
};

describe("CompiledMetaSchema icon", () => {
	test("accepts default and dark icon paths", () => {
		const result = CompiledMetaSchema.safeParse({
			...rust,
			icon: { default: "icons/rust.svg", dark: "icons/rust.dark.svg" },
		});
		expect(result.success).toBe(true);
	});

	test("accepts an entity without an icon", () => {
		expect(CompiledMetaSchema.safeParse(rust).success).toBe(true);
	});

	test("rejects unknown icon keys", () => {
		const result = CompiledMetaSchema.safeParse({
			...rust,
			icon: { default: "icons/rust.svg", light: "icons/rust.light.svg" },
		});
		expect(result.success).toBe(false);
	});

	test("rejects an icon without a default", () => {
		const result = CompiledMetaSchema.safeParse({
			...rust,
			icon: { dark: "icons/rust.dark.svg" },
		});
		expect(result.success).toBe(false);
	});
});
