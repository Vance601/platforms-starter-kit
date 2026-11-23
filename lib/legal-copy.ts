import fs from "fs";
import path from "path";

export function readLegalFile(name: string): string {
  const file = path.join(process.cwd(), "content/legal", name);
  return fs.readFileSync(file, "utf8");
}
