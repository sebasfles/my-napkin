import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(appDir, "src/app/icon.svg"), "utf8");

const lightPlate = "#3668b1";

const outputs = [
  { file: "src/app/icon.png", size: 32, scheme: "light", behind: "transparent" },
  { file: "src/app/apple-icon.png", size: 180, scheme: "light", behind: lightPlate },
  { file: "public/icon-192.png", size: 192, scheme: "light", behind: "transparent" },
  { file: "public/icon-512.png", size: 512, scheme: "light", behind: "transparent" },
];

function ico(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0);
  entry.writeUInt8(32, 1);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);

  return Buffer.concat([header, entry, png]);
}

const browser = await chromium.launch();

async function render({ size, scheme, behind }) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.emulateMedia({ colorScheme: scheme });
  await page.setContent(
    `<body style="margin:0;background:${behind}"><style>svg{display:block;width:${size}px;height:${size}px}</style>${source}</body>`,
  );

  const png = await page.screenshot({ omitBackground: behind === "transparent" });
  await page.close();

  return png;
}

for (const output of outputs) {
  const png = await render(output);
  const path = join(appDir, output.file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, png);
  console.log(`${output.file} ${png.length} bytes`);
}

const favicon = ico(await render({ size: 32, scheme: "light", behind: "transparent" }));
writeFileSync(join(appDir, "src/app/favicon.ico"), favicon);
console.log(`src/app/favicon.ico ${favicon.length} bytes`);

await browser.close();
