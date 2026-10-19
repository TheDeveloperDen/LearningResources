import { afterAll } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const VALID_SVG =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path d="M0 0h1v1z"/></svg>';

/**
 * Call once at the top of a test file. Returns a function that makes temp
 * directories, which are removed when that file's tests finish.
 */
export function useTmpDirs(): (prefix?: string) => string {
	const dirs: string[] = [];
	afterAll(() => {
		for (const dir of dirs) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
	return (prefix = "test-") => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
		dirs.push(dir);
		return dir;
	};
}
