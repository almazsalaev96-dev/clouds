/* A picture, asked for in words: what counts as asking, and what to draw.
 *   npx jiti test-image.ts */
import { wantsPicture, pictureSubject } from "./lib/image";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nAsking for a picture");
{
  for (const t of ["Draw me a picture of a plant cell", "make an image of the water cycle, labelled", "Can you generate a poster for the exam?", "Create an illustration showing osmosis", "paint a portrait of Marie Curie"])
    check(wantsPicture(t), `“${t}” asks for one`);
  for (const t of ["What is in this picture?", "Explain the diagram above", "Describe the image I attached", "How do I draw a Lewis structure?", "Make a list of the planets", "Is this photo of a mitochondrion?", "write me a poem"])
    check(!wantsPicture(t), `“${t}” does not`);
}

console.log("\nWhat to draw");
{
  check(pictureSubject("Draw me a picture of a plant cell") === "a plant cell", "the asking comes off the front", pictureSubject("Draw me a picture of a plant cell"));
  check(pictureSubject("Can you make an illustration showing osmosis in a red blood cell") === "osmosis in a red blood cell", "however it was asked", pictureSubject("Can you make an illustration showing osmosis in a red blood cell"));
  check(pictureSubject("a poster for the exam") === "a poster for the exam", "and a bare description is kept whole");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
