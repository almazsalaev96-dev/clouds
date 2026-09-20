/* Sorting a table the model wrote, and handing it to a spreadsheet.
 *
 * Both of these are quietly wrong in most implementations, in ways nobody
 * notices until the data matters: a column of figures sorted as text puts 100
 * before 2, and a CSV that does not quote its commas splits one name into two
 * columns from that row down.
 *
 *   npx jiti test-table.ts */
import { asNumber, columnIsNumeric, sortRows, toCsv } from "./lib/table";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nA cell is a number only when it honestly is one");
{
  check(asNumber("1,200") === 1200, "grouping commas come out", String(asNumber("1,200")));
  check(asNumber("£1200") === 1200, "and one leading currency symbol");
  check(asNumber("12.5%") === 12.5, "and a trailing per cent");
  check(asNumber("-3.5") === -3.5, "negatives and decimals survive");
  check(asNumber("3 of 4") === null, "“3 of 4” is not a number, whatever it starts with");
  check(asNumber("Q3") === null, "nor is a quarter");
  check(asNumber("£1.2m") === null, "and a suffix is a guess about what was meant, so it is refused");
  check(asNumber("") === null && asNumber("  ") === null, "blank is not zero");
}

console.log("\nOne “n/a” does not turn a column of figures into text");
{
  check(columnIsNumeric(["1", "2", "3"]), "a plain column of numbers is numeric");
  check(columnIsNumeric(["1", "n/a", "3", "—", ""]),
    "and stays numeric through the blanks and the non-answers");
  check(!columnIsNumeric(["1", "Q3", "3"]), "but one real word makes it text");
  check(!columnIsNumeric(["", "n/a"]), "and a column of nothing is not numeric");
}

console.log("\nFigures sort as figures, not as strings");
{
  const rows = [["a", "100"], ["b", "2"], ["c", "30"]];
  const asc = sortRows(rows, 1, "asc").map((i) => rows[i][0]).join("");
  check(asc === "bca", "2 before 30 before 100 — the thing text sorting gets wrong", asc);
  const desc = sortRows(rows, 1, "desc").map((i) => rows[i][0]).join("");
  check(desc === "acb", "and the other way round", desc);
}

console.log("\nBlanks go last whichever way the column points");
{
  const rows = [["a", ""], ["b", "5"], ["c", "n/a"], ["d", "9"]];
  const asc = sortRows(rows, 1, "asc").map((i) => rows[i][0]).join("");
  const desc = sortRows(rows, 1, "desc").map((i) => rows[i][0]).join("");
  check(asc === "bdac", "ascending: the figures, then the blanks", asc);
  check(desc === "dbac", "descending: still the figures first — a column that opens with six empty cells has buried its own answer", desc);
}

console.log("\nAnd the same press twice is a reversal, not a reshuffle");
{
  /* A stable sort is what makes this true: rows that tie keep the order they
     were in, so the eye can follow one of them across a re-sort. */
  const rows = [["a", "1"], ["b", "1"], ["c", "1"], ["d", "0"]];
  check(sortRows(rows, 1, "asc").map((i) => rows[i][0]).join("") === "dabc", "ties keep their order");
  check(sortRows(rows, 1, "desc").map((i) => rows[i][0]).join("") === "abcd", "and keep it the other way too");
}

console.log("\nText sorts the way a person would order it");
{
  const rows = [["Item 10"], ["Item 2"], ["item 1"]];
  const asc = sortRows(rows, 0, "asc").map((i) => rows[i][0]).join(" · ");
  check(asc === "item 1 · Item 2 · Item 10",
    "2 before 10, and case is not a sort order", asc);
}

console.log("\nThe CSV is one a spreadsheet will read back correctly");
{
  const csv = toCsv(["Name", "Note"], [["Smith, J.", 'He said "hello"'], ["Ada", "two\nlines"]]);
  check(csv.includes('"Smith, J."'), "a comma in a field is quoted — otherwise the row grows a column",
    csv.split("\n")[1]);
  check(csv.includes('"He said ""hello"""'), "a quote inside a quoted field is doubled");
  check(csv.includes('"two\nlines"'), "and a newline keeps the field together");
  check(csv.split("\n")[0] === "Name,Note", "while a plain field is left plain");
  check(toCsv(["A"], [[undefined as unknown as string]]) === "A\n", "and a missing cell is empty, not “undefined”",
    JSON.stringify(toCsv(["A"], [[undefined as unknown as string]])));
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
