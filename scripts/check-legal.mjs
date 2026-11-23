// Fail if legal copy still has drafting placeholders or attorney-review notes.
import fs from "fs";
import path from "path";

const root = path.join(process.cwd(), "content/legal");
const forbidden = /\[PLACEHOLDER|attorney review|\[LEGAL ENTITY|\[CONTACT EMAIL\]|\[PHONE NUMBER\]|\[MAILING ADDRESS\]|\[EFFECTIVE DATE\]|\[LAST REVISED|\[PRIVACY CONTACT|\[PRIVACY POLICY URL\]|\[ARBITRATION |\[LIABILITY CAP|WeedDasher|Weeddasher|have an attorney/i;
let failed = false;
for (const name of fs.readdirSync(root).filter((f) => f.endsWith(".md"))) {
  const file = path.join(root, name);
  const lines = fs.readFileSync(file, "utf8").split(/\n/);
  lines.forEach((line, i) => {
    if (forbidden.test(line)) {
      console.error(`${name}:${i + 1}: ${line}`);
      failed = true;
    }
  });
}
if (failed) {
  process.exit(1);
}
console.log("Legal copy has no leftover placeholders.");
