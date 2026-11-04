import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PDFDocument } from 'pdf-lib';

// Keep the slide platform's landscape export contract intact, then extract
// the centred portrait artwork into true A4 pages for the final handout.
const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw new Error('Usage: node scripts/a4-pdf.mjs input.pdf output.pdf');
}
const source = await PDFDocument.load(await readFile(input));
const result = await PDFDocument.create();
const a4Width = 210 * 72 / 25.4;
const a4Height = 297 * 72 / 25.4;
for (const page of source.getPages()) {
  const { width, height } = page.getSize();
  if (Math.abs(width / height - 16 / 9) > 0.02) {
    throw new Error('Expected the original 16:9 slide export, not a cropped PDF.');
  }
  const portraitWidth = height * 210 / 297;
  const left = (width - portraitWidth) / 2;
  const artwork = await result.embedPage(page, {
    left, right: left + portraitWidth, bottom: 0, top: height,
  });
  result.addPage([a4Width, a4Height]).drawPage(artwork, {
    x: 0, y: 0, width: a4Width, height: a4Height,
  });
}
result.setTitle('JanSetu — Constituency Services');
result.setSubject('A4 portrait presentation');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, await result.save());
console.log(`Saved ${result.getPageCount()} A4 portrait pages to ${output}`);
