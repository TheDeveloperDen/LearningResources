import { closest, distance } from "fastest-levenshtein";
import type { z } from "zod";

export type Diagnostic = {
	level: "error" | "warning";
	where: string;
	message: string;
};

/**
 * A `Validation` is either a Success containing a value of `A` and potentially some warnings,
 * or a Failure containing merely a list of errors & warnings.
 */
export type Validation<A> =
	| { ok: true; value: A; diagnostics: Diagnostic[] }
	| { ok: false; diagnostics: Diagnostic[] };

export const error = (where: string, message: string): Diagnostic => ({
	level: "error",
	where,
	message,
});

export const warning = (where: string, message: string): Diagnostic => ({
	level: "warning",
	where,
	message,
});

export const ok = <A>(
	value: A,
	diagnostics: Diagnostic[] = [],
): Validation<A> => ({ ok: true, value, diagnostics });

export const fail = <A = never>(diagnostics: Diagnostic[]): Validation<A> => ({
	ok: false,
	diagnostics,
});

/** binds/flatMaps/andThen's a Validation, merging the diagnostics in both elements.
 * yay monads!
 */
export function andThen<A, B>(
	validation: Validation<A>,
	next: (value: A) => Validation<B>,
): Validation<B> {
	if (!validation.ok) {
		return validation;
	}
	const result = next(validation.value);
	const diagnostics = [...validation.diagnostics, ...result.diagnostics];
	return result.ok
		? { ok: true, value: result.value, diagnostics }
		: { ok: false, diagnostics };
}

export const hasErrors = (diagnostics: Diagnostic[]): boolean =>
	diagnostics.some((d) => d.level === "error");

/**
 * Combines a list of independent Validations without stopping at the first failure,
 * returning a list of all the successes and all of the diagnostics
 */
export function partition<A>(items: Validation<A>[]): {
	values: A[];
	diagnostics: Diagnostic[];
} {
	return {
		values: items.flatMap((item) => (item.ok ? [item.value] : [])),
		diagnostics: items.flatMap((item) => item.diagnostics),
	};
}

/** Adapts a zod `safeParse` result, turning each issue into an error at `where`. */
export function fromZod<T>(
	result: z.ZodSafeParseResult<T>,
	where: string,
): Validation<T> {
	if (result.success) {
		return ok(result.data);
	}
	return fail(
		result.error.issues.map((issue) => {
			const path = issue.path.map(String).join(".");
			return error(where, path ? `${path}: ${issue.message}` : issue.message);
		}),
	);
}

/** Prints diagnostics, errors via `error()` and warnings via `warn()`. */
export function report(
	diagnostics: Diagnostic[],
	out: {
		error: (message: string) => void;
		warn: (message: string) => void;
	} = console,
): void {
	for (const d of diagnostics) {
		const line = `${d.level}: ${d.where}: ${d.message}`;
		(d.level === "error" ? out.error : out.warn)(line);
	}
}

/**
 * A ` (did you mean "x"?)` suffix naming the candidate closest to `name`, or an
 * empty string if none is close enough to be a plausible typo.
 */
export function suggest(name: string, candidates: Iterable<string>): string {
	const list = [...candidates];
	if (list.length === 0) {
		return "";
	}
	const lower = name.toLowerCase();
	const best = closest(lower, list);
	// (a swapped pair such as "rsut" counts as two edits, hence the rounding up)
	return distance(lower, best) <= Math.ceil(name.length / 3)
		? ` (did you mean "${best}"?)`
		: "";
}
