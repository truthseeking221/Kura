import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputDir = resolve(process.cwd(), "dist-pwa");
await copyFile(resolve(outputDir, "pwa.html"), resolve(outputDir, "index.html"));
