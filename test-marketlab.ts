/* Every number MarketLab shows a student, checked against arithmetic done by
 * hand. An economics teaching tool that is confidently wrong is worse than no
 * tool, so this suite is deliberately heavier on the edges — zeroes, negative
 * contributions, price controls that do not bind — than on the happy path.
 *
 *   npx jiti test-marketlab.ts */
import { divide, midpointChange, near, niceStep, pctChange, percent, money, round, ticks, signedPercent, units, compact } from "./lib/marketlab/num";
import {
  BAND_LABEL, classify, constantElasticityQuantity, elasticity, linearDemandQuantity,
  quantityFromElasticity, revenue,
} from "./lib/marketlab/elasticity";
import { applyControl, areaUnderSupply, compare, demandPrice, shockNarrative, solve, supplyPrice } from "./lib/marketlab/market";
import { bestScenario, marketingUplift, profit, profitCurve, runScenarios } from "./lib/marketlab/profit";
import { bestResponsePrice, compete, concentration, concentrationLabel, ownPriceCurve, shares, type Firm, type MarketAssumptions } from "./lib/marketlab/competition";
import { researchProgress, toMarkdown, emptyProject, SECTIONS } from "./lib/marketlab/research";
import { INDICATORS, demoSeries } from "./lib/marketlab/data/indicators";
import { LESSONS } from "./lib/marketlab/learn/lessons";
import { EXPERIMENTS } from "./lib/marketlab/experiments";
import { answerLocally } from "./lib/marketlab/assistant";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nArithmetic that refuses rather than lying");
{
  check(divide(1, 0) === null, "dividing by zero returns null, not Infinity");
  check(divide(0, 0) === null, "and nought over nought is not nought");
  check(pctChange(0, 5) === null, "a percentage change from zero is undefined");
  check(near(pctChange(10, 12)!, 0.2), "+20% from 10 to 12", String(pctChange(10, 12)));
  check(near(pctChange(12, 10)!, -1 / 6), "and −16.67% back again");
  // The midpoint formula's whole point: same magnitude in both directions.
  check(near(midpointChange(10, 12)!, -midpointChange(12, 10)!), "midpoint change is symmetric, base change is not");
  check(near(midpointChange(10, 12)!, 2 / 11), "10→12 by midpoint is 2/11", String(midpointChange(10, 12)));
  check(round(2.675, 2) === 2.68, "rounding does not lose the half-penny", String(round(2.675, 2)));
  check(percent(0.125) === "12.5%", "a fraction renders as a percentage", percent(0.125));
  check(percent(null) === "—", "and nothing renders as an em dash, never as 0%");
  check(signedPercent(-0.2) === "−20.0%", "a fall carries a real minus sign", signedPercent(-0.2));
  check(money(1234.5, "GBP") === "£1,235", "four figures drop the pennies", money(1234.5, "GBP"));
  check(money(12.5, "GBP") === "£12.50", "small money keeps them", money(12.5, "GBP"));
  check(money(-40, "GBP") === "−£40.00", "and a loss reads as a loss", money(-40, "GBP"));
  check(units(1234.7) === "1,235", "units are whole and grouped", units(1234.7));
  check(compact(1_500_000) === "1.5m" && compact(2400) === "2.4k", "axis labels compact", `${compact(1_500_000)} / ${compact(2400)}`);
  check(niceStep(97) === 20, "an axis step is a round number", String(niceStep(97)));
  const t = ticks(0, 100, 5);
  check(t[0] === 0 && t[t.length - 1] === 100, "ticks span the range", t.join(","));
  check(ticks(5, 5).length === 1, "a zero-width range yields one tick, not an infinite loop");
}

console.log("\nPrice elasticity of demand");
{
  // Worked by hand, midpoint method:
  //   %ΔQ = (80−100)/90 = −0.2222…   %ΔP = (12−10)/11 = 0.18181…
  //   PED = −0.2222/0.18181 = −1.2222…
  const r = elasticity({ initialPrice: 10, initialQuantity: 100, newPrice: 12, newQuantity: 80 });
  check(near(r.ped!, -1.2222222, 5), "midpoint PED for 10→12, 100→80 is −1.222", String(r.ped));
  check(r.magnitude !== null && near(r.magnitude, 1.2222222, 5), "the magnitude drops the sign");
  check(r.band === "elastic", "and |PED| > 1 is elastic", String(r.band));
  check(r.anomalousSign === false, "quantity fell as price rose, which is the ordinary case");

  const base = elasticity({ initialPrice: 10, initialQuantity: 100, newPrice: 12, newQuantity: 80, method: "base" });
  check(near(base.ped!, -1), "the base method gives exactly −1 for the same two points", String(base.ped));
  check(base.band === "unit-elastic", "which the base method classifies as unit elastic");
  check(base.ped !== r.ped, "the two methods disagree, which is why the method is shown");

  const flat = elasticity({ initialPrice: 10, initialQuantity: 100, newPrice: 10, newQuantity: 90 });
  check(flat.ped === null && /did not change/.test(flat.problem ?? ""), "no price change means no elasticity, and it says why");
  const zeroQ = elasticity({ initialPrice: 10, initialQuantity: 0, newPrice: 12, newQuantity: 5, method: "base" });
  check(zeroQ.ped === null && /quantity is zero/.test(zeroQ.problem ?? ""), "a zero starting quantity has no base-year percentage change");
  // The midpoint method divides by the average of the two, which is not zero
  // here, so the same inputs do have an arc elasticity. That difference is
  // real economics, not a bug, and the interface names the method for it.
  const zeroQMid = elasticity({ initialPrice: 10, initialQuantity: 0, newPrice: 12, newQuantity: 5 });
  check(zeroQMid.ped !== null, "but the midpoint method still has one", String(zeroQMid.ped));
  const negative = elasticity({ initialPrice: -1, initialQuantity: 10, newPrice: 2, newQuantity: 5 });
  check(negative.ped === null && /negative/.test(negative.problem ?? ""), "negative prices are refused");

  const veblen = elasticity({ initialPrice: 10, initialQuantity: 100, newPrice: 12, newQuantity: 110 });
  check(veblen.anomalousSign === true, "quantity rising with price is flagged, not hidden");
  check(veblen.ped! > 0, "and the coefficient keeps its positive sign");

  const perfectly = elasticity({ initialPrice: 10, initialQuantity: 100, newPrice: 12, newQuantity: 100 });
  check(perfectly.band === "perfectly-inelastic" && perfectly.ped === 0, "unchanged quantity is perfectly inelastic");

  check(classify(0.999999) === "unit-elastic", "float dust near 1 still reads as unit elastic");
  check(classify(null) === null, "and an absent magnitude has no band");
  check(BAND_LABEL.elastic === "Elastic", "every band has a label");
}

console.log("\nTotal revenue, and the rule it is supposed to demonstrate");
{
  const rev = revenue(10, 100, 12, 80)!;
  check(rev.initialRevenue === 1000 && rev.newRevenue === 960, "TR = P × Q, both times", `${rev.initialRevenue} → ${rev.newRevenue}`);
  check(rev.change === -40 && rev.direction === "down", "a £40 fall");
  check(near(rev.changeFraction!, -0.04), "−4%", String(rev.changeFraction));

  // The textbook claim, tested rather than asserted: with elastic demand a
  // price rise cuts revenue; with inelastic demand it raises it.
  const inelastic = revenue(10, 100, 12, 95)!;
  check(inelastic.direction === "up", "inelastic demand: a price rise raises revenue");
  const elasticCase = revenue(10, 100, 12, 70)!;
  check(elasticCase.direction === "down", "elastic demand: a price rise lowers revenue");

  // Unit elastic under the base method: Q falls by exactly the same fraction.
  const unit = revenue(10, 100, 12, 100 / 1.2)!;
  check(unit.direction === "flat", "unit elastic: revenue does not move", String(unit.change));
}

console.log("\nThe demand curves the charts are drawn from");
{
  check(near(constantElasticityQuantity(10, 10, 100, -1.5)!, 100), "the constant-elasticity curve passes through its own base point");
  const q = constantElasticityQuantity(20, 10, 100, -1)!;
  check(near(q, 50), "unit elasticity halves quantity when price doubles", String(q));
  check(constantElasticityQuantity(0, 10, 100, -1) === null, "and it is undefined at a price of zero");

  check(near(linearDemandQuantity(11, 10, 100, 12, 80)!, 90), "the straight line through two points sits halfway at the midpoint");
  check(linearDemandQuantity(11, 10, 100, 10, 80) === null, "two points at the same price define no line");
  check(linearDemandQuantity(100, 10, 100, 12, 80) === 0, "quantity is clamped at zero, never negative");

  // Inverting the elasticity formula has to land back on the input.
  const q1 = quantityFromElasticity(10, 100, 12, -1.2222222, "midpoint")!;
  check(near(q1, 80, 3), "midpoint inversion recovers the observed quantity", String(q1));
  const q1b = quantityFromElasticity(10, 100, 12, -1, "base")!;
  check(near(q1b, 80), "and so does the base method", String(q1b));
  check(quantityFromElasticity(10, 100, 12, -11, "midpoint") === 0, "an impossible fall bottoms out at zero rather than going negative");
}

console.log("\nSupply, demand and equilibrium");
{
  // Qd = 200 − 5P, Qs = 50 + 5P  ⇒  P* = 15, Q* = 125
  const s = solve({ demandIntercept: 200, demandSlope: 5, supplyIntercept: 50, supplySlope: 5 });
  check(s.equilibrium !== null, "the curves cross");
  check(near(s.equilibrium!.price, 15) && near(s.equilibrium!.quantity, 125), "P* = 15, Q* = 125", JSON.stringify(s.equilibrium));
  check(near(s.chokePrice!, 40), "the choke price is a/b = 40", String(s.chokePrice));
  // CS = ½ · 125 · (40 − 15) = 1562.5
  check(near(s.consumerSurplus!, 1562.5), "consumer surplus is the triangle above the price", String(s.consumerSurplus));
  // Supply is positive at P = 0, so PS = P*Q* − (Q*−c)²/(2d) = 1875 − 75²/10 = 1312.5
  check(near(s.producerSurplus!, 1312.5), "producer surplus nets off the area under the supply curve", String(s.producerSurplus));
  check(near(s.totalSurplus!, 2875), "and the two add up");

  const down = solve({ demandIntercept: 200, demandSlope: -5, supplyIntercept: 50, supplySlope: 5 });
  check(down.equilibrium === null && /downwards/.test(down.problem ?? ""), "an upward-sloping demand curve is refused");
  const flat = solve({ demandIntercept: 200, demandSlope: 5, supplyIntercept: 50, supplySlope: 0 });
  check(flat.equilibrium === null && /upwards/.test(flat.problem ?? ""), "a vertical supply slope of zero is refused");
  const never = solve({ demandIntercept: 20, demandSlope: 5, supplyIntercept: 80, supplySlope: 5 });
  check(never.equilibrium === null && /negative price/.test(never.problem ?? ""), "a crossing at a negative price is reported, not drawn");

  check(near(demandPrice(200, 5, 125)!, 15), "inverse demand agrees with the equilibrium");
  check(near(supplyPrice(50, 5, 125)!, 15), "so does inverse supply");
  check(areaUnderSupply(50, 5, 40) === 0, "no cost area when every unit is supplied free");
  // Qs = −50 + 5P starts at P = 10 and reaches Q = 100 at P = 30, so the area
  // under it is the trapezium ½(10 + 30) × 100 = 2000.
  check(near(areaUnderSupply(-50, 5, 100)!, 2000), "a trapezium when supply starts above a price of zero", String(areaUnderSupply(-50, 5, 100)));
  // And it agrees with the triangle formula the textbook uses for that case.
  const above = solve({ demandIntercept: 400, demandSlope: 10, supplyIntercept: -50, supplySlope: 5 });
  check(near(above.producerSurplus!, 0.5 * (above.equilibrium!.price - above.supplyFloorPrice) * above.equilibrium!.quantity),
    "producer surplus matches the triangle when supply starts above zero", String(round(above.producerSurplus!, 2)));
}

console.log("\nShocks");
{
  const before = solve({ demandIntercept: 200, demandSlope: 5, supplyIntercept: 50, supplySlope: 5 });
  // Demand +50 at every price ⇒ P* = (250−50)/10 = 20, Q* = 250 − 100 = 150
  const after = solve({ demandIntercept: 200, demandSlope: 5, supplyIntercept: 50, supplySlope: 5, demandShock: 50 });
  check(near(after.equilibrium!.price, 20) && near(after.equilibrium!.quantity, 150), "a rightward demand shift raises both price and quantity", JSON.stringify(after.equilibrium));
  const c = compare(before.equilibrium, after.equilibrium)!;
  check(c.priceDirection === "up" && c.quantityDirection === "up", "and the comparison says so");

  const supplyUp = solve({ demandIntercept: 200, demandSlope: 5, supplyIntercept: 50, supplySlope: 5, supplyShock: 50 });
  const c2 = compare(before.equilibrium, supplyUp.equilibrium)!;
  check(c2.priceDirection === "down" && c2.quantityDirection === "up", "a rightward supply shift cuts price and raises quantity");

  check(/no shock/i.test(shockNarrative(0, 0, null)), "no shock, no story");
  check(/shifts right/.test(shockNarrative(50, 0, c)), "the narrative names the direction of the shift");
  const opposing = shockNarrative(50, -50, c);
  check(/depends on which shift is larger/.test(opposing), "opposing shifts carry the indeterminacy warning");
}

console.log("\nPrice controls");
{
  const s = solve({ demandIntercept: 200, demandSlope: 5, supplyIntercept: 50, supplySlope: 5 });
  // Ceiling at 10: Qd = 150, Qs = 100 ⇒ shortage 50, traded 100
  const ceiling = applyControl(s, "ceiling", 10)!;
  check(ceiling.binding && near(ceiling.shortage, 50), "a binding ceiling creates a shortage of 50", String(ceiling.shortage));
  check(near(ceiling.quantityTraded, 100), "only the short side trades", String(ceiling.quantityTraded));
  // DWL = ½ · (125 − 100) · (Pd(100) − Ps(100)) = ½ · 25 · (20 − 10) = 125
  check(near(ceiling.deadweightLoss!, 125), "and the welfare triangle is 125", String(ceiling.deadweightLoss));

  const loose = applyControl(s, "ceiling", 30)!;
  check(!loose.binding && loose.shortage === 0, "a ceiling above equilibrium does nothing");
  check(near(loose.price, 15), "and the market keeps its own price");

  // Floor at 20: Qs = 150, Qd = 100 ⇒ surplus 50
  const floor = applyControl(s, "floor", 20)!;
  check(floor.binding && near(floor.surplus, 50), "a binding floor creates a surplus of 50", String(floor.surplus));
  check(near(floor.quantityTraded, 100), "again only the short side trades");
  const looseFloor = applyControl(s, "floor", 5)!;
  check(!looseFloor.binding, "a floor below equilibrium does nothing");
  check(applyControl(s, "none", 0)!.deadweightLoss === 0, "no control, no deadweight loss");
}

console.log("\nProfit and break-even");
{
  // P 25, Q 900, VC 11, FC 9000  ⇒ TR 22 500, TC 18 900, profit 3 600
  const r = profit({ price: 25, unitsSold: 900, variableCostPerUnit: 11, fixedCosts: 9000 });
  check(r.revenue === 22_500 && r.totalCosts === 18_900 && r.profit === 3_600, "TR, TC and profit", `${r.revenue} / ${r.totalCosts} / ${r.profit}`);
  check(r.contributionPerUnit === 14, "contribution per unit is P − VC");
  check(near(r.breakEvenUnits!, 9000 / 14), "break-even quantity is FC ÷ contribution", String(r.breakEvenUnits));
  check(near(r.profitMargin!, 0.16), "profit margin is 16%", String(r.profitMargin));
  check(near(r.contributionMargin!, 0.56), "contribution margin is 56%");
  check(near(r.marginOfSafety!, 1 - 9000 / 14 / 900), "margin of safety compares actual to break-even");

  const marketed = profit({ price: 25, unitsSold: 900, variableCostPerUnit: 11, fixedCosts: 9000, marketingSpend: 2800 });
  check(marketed.fixedCosts === 11_800, "marketing spend joins fixed costs");
  check(marketed.profit === 800, "and comes straight off profit", String(marketed.profit));
  check(near(marketed.breakEvenUnits!, 11_800 / 14), "raising the break-even point with it");

  const loss = profit({ price: 10, unitsSold: 500, variableCostPerUnit: 10, fixedCosts: 4000 });
  check(loss.breakEvenUnits === null && /never covered/.test(loss.breakEvenNote), "price equal to variable cost has no break-even point, and it says why");
  const worse = profit({ price: 8, unitsSold: 500, variableCostPerUnit: 10, fixedCosts: 4000 });
  check(worse.breakEvenUnits === null && /below variable cost/.test(worse.breakEvenNote), "selling below variable cost has no break-even point either");
  check(worse.profit === -5000, "and the loss is the honest number", String(worse.profit));

  const nothing = profit({ price: 25, unitsSold: 0, variableCostPerUnit: 11, fixedCosts: 9000 });
  check(nothing.profitMargin === null, "no revenue means no margin, not a zero margin");
  check(nothing.profit === -9000, "and the loss is the whole fixed cost");
  const negativeInput = profit({ price: -5, unitsSold: 10, variableCostPerUnit: 1, fixedCosts: 0 });
  check(negativeInput.problem !== null, "a negative price is reported as a problem");

  const curve = profitCurve({ price: 25, unitsSold: 900, variableCostPerUnit: 11, fixedCosts: 9000 }, 1200, 13);
  check(curve.length === 13 && curve[0].q === 0, "the chart series starts at zero units");
  check(near(curve[0].profit, -9000), "where the loss is the fixed cost");
  const crossing = curve.find((p) => p.profit >= 0)!;
  check(crossing.q >= 9000 / 14, "and the line crosses zero at or after the break-even quantity");
}

console.log("\nMarketing, when the demand response is switched on");
{
  check(marketingUplift(0, 400, 2000) === 0, "no spend, no uplift");
  check(near(marketingUplift(2000, 400, 2000), 200), "the half-spend delivers half the maximum uplift", String(marketingUplift(2000, 400, 2000)));
  check(marketingUplift(1e9, 400, 2000) <= 400, "and the uplift never exceeds its ceiling");
  check(marketingUplift(500, 400, 2000) < marketingUplift(1000, 400, 2000), "more spend, more uplift");
  const a = marketingUplift(1000, 400, 2000) - marketingUplift(500, 400, 2000);
  const b = marketingUplift(1500, 400, 2000) - marketingUplift(1000, 400, 2000);
  check(b < a, "with diminishing returns all the way up");
  check(marketingUplift(-100, 400, 2000) === 0, "negative spend does nothing");
}

console.log("\nScenario comparison");
{
  const rows = runScenarios([
    { id: "low", label: "Low", input: { price: 18, unitsSold: 1400, variableCostPerUnit: 11, fixedCosts: 9000 } },
    { id: "mid", label: "Medium", input: { price: 25, unitsSold: 900, variableCostPerUnit: 11, fixedCosts: 9000 } },
    { id: "high", label: "High", input: { price: 34, unitsSold: 520, variableCostPerUnit: 11, fixedCosts: 9000 } },
  ]);
  check(rows.length === 3, "three scenarios run");
  check(rows[0].result.profit === 800 && rows[1].result.profit === 3600 && rows[2].result.profit === 2960,
    "each profit is computed independently", rows.map((r) => r.result.profit).join(" / "));
  check(bestScenario(rows)!.id === "mid", "the middle price wins here");
  const tied = runScenarios([
    { id: "a", label: "A", input: { price: 20, unitsSold: 100, variableCostPerUnit: 5, fixedCosts: 100 } },
    { id: "b", label: "B", input: { price: 20, unitsSold: 100, variableCostPerUnit: 5, fixedCosts: 100 } },
  ]);
  check(bestScenario(tied) === null, "an exact tie has no winner rather than an arbitrary one");
}

console.log("\nCompetition");
{
  const firms: Firm[] = [
    { id: "a", name: "You", price: 20, appeal: 5, variableCost: 8, fixedCost: 2000 },
    { id: "b", name: "Rival", price: 20, appeal: 5, variableCost: 8, fixedCost: 2000 },
  ];
  const m: MarketAssumptions = { marketSize: 10_000, priceSensitivity: 0.15, outsideAppeal: 0 };
  const s = shares(firms, m)!;
  check(near(s[0], s[1]), "identical firms split the market exactly", s.map((v) => round(v, 4)).join(" / "));
  const out = compete(firms, m);
  check(near(out.firms[0].share + out.firms[1].share + out.noPurchaseShare, 1), "shares and non-buyers add to one");
  check(out.firms[0].quantity > 0 && near(out.totalQuantity, out.firms[0].quantity * 2), "quantity follows share");

  const undercut = compete([{ ...firms[0], price: 18 }, firms[1]], m);
  check(undercut.firms[0].share > undercut.firms[1].share, "the cheaper firm takes more of the market");
  check(undercut.firms[0].share > out.firms[0].share, "and more than it had at parity");

  const insensitive = compete([{ ...firms[0], price: 18 }, firms[1]], { ...m, priceSensitivity: 0 });
  check(near(insensitive.firms[0].share, insensitive.firms[1].share), "with no price sensitivity, undercutting wins nothing");

  const better = compete([{ ...firms[0], appeal: 7 }, firms[1]], m);
  check(better.firms[0].share > better.firms[1].share, "non-price competitiveness works too");

  // The overflow case that breaks a naive logit.
  const extreme = compete([{ ...firms[0], price: 0, appeal: 900 }, firms[1]], m);
  check(extreme.problem === null && Number.isFinite(extreme.firms[0].share), "an extreme appeal does not overflow to NaN", String(extreme.firms[0].share));

  const curve = ownPriceCurve(firms, m, "a", 8, 40, 33);
  check(curve.length === 33 && curve.every((p) => Number.isFinite(p.profit)), "the own-price profit curve is finite throughout");
  const best = bestResponsePrice(firms, m, "a", 8, 40)!;
  check(best.price > 8 && best.price < 40, "the best response is an interior price", String(round(best.price, 2)));
  const atBest = compete([{ ...firms[0], price: best.price }, firms[1]], m);
  check(atBest.firms[0].profit >= out.firms[0].profit - 1e-6, "and it is at least as profitable as the starting price");

  check(near(concentration(out)!, 5000, 0), "two equal sellers give an HHI of 5000", String(round(concentration(out)!, 1)));
  check(concentrationLabel(5000) === "Highly concentrated", "which is a highly concentrated market");
  check(concentrationLabel(null) === "—", "and an absent index says nothing");
  check(compete([], m).problem !== null, "no firms, no market");
}

console.log("\nThe research workspace");
{
  const p = emptyProject("Does price affect revenue?");
  check(p.title === "Does price affect revenue?", "a project keeps its title");
  check(SECTIONS.length >= 12, "the report has every section the brief asks for", String(SECTIONS.length));
  check(SECTIONS.some((s) => s.id === "limitations"), "limitations among them");
  check(researchProgress(p).completed === 0, "a new project is at zero progress");
  const filled = { ...p, sections: { ...p.sections, question: "How does price affect estimated revenue?" } };
  const prog = researchProgress(filled);
  check(prog.completed === 1 && prog.fraction > 0 && prog.fraction < 1, "and one written section moves it", `${prog.completed}/${prog.total}`);

  const md = toMarkdown(filled);
  check(md.startsWith("# Does price affect revenue?"), "markdown export opens with the title");
  check(md.includes("## Research question"), "and carries the section headings");
  check(md.includes("How does price affect estimated revenue?"), "with the text written into them");
  check(!/\bLorem\b/i.test(md) && !md.includes("undefined"), "empty sections are left empty, never filled in for you");
  check(/Generated by MarketLab/.test(md), "and the export says where it came from");
}

console.log("\nThe data layer");
{
  check(INDICATORS.length >= 6, "there are indicators to choose from", String(INDICATORS.length));
  check(INDICATORS.every((i) => i.source.length > 0 && i.explanation.length > 40), "each names its source and explains itself");
  check(INDICATORS.every((i) => /^[A-Z]{2,3}\./.test(i.code) || i.code.includes(".")), "each carries a real World Bank indicator code", INDICATORS[0].code);
  const series = demoSeries(INDICATORS[0].code, "GBR", 2010, 2020);
  check(series.length === 11, "a demo series covers the requested years", String(series.length));
  check(series.every((p) => Number.isFinite(p.value)), "with a finite value at every point");
  check(series[0].year === 2010 && series[series.length - 1].year === 2020, "in ascending order");
  check(demoSeries("nonsense.code", "GBR", 2010, 2012).length === 0, "an unknown indicator yields nothing rather than invented numbers");
}

console.log("\nThe learning section");
{
  check(LESSONS.length >= 15, "there are lessons", String(LESSONS.length));
  check(LESSONS.every((l) => l.definitions.length > 0), "each has key definitions");
  check(LESSONS.every((l) => l.example.length > 40), "each has a real-world example");
  check(LESSONS.every((l) => l.mistakes.length > 0), "each names a common mistake");
  check(LESSONS.every((l) => l.questions.length >= 2), "each has practice questions");
  check(LESSONS.every((l) => l.questions.every((q) => q.options[q.answer] !== undefined)), "every question's answer indexes a real option");
  check(new Set(LESSONS.map((l) => l.slug)).size === LESSONS.length, "no two lessons share a slug");
  check(LESSONS.some((l) => l.strand === "economics") && LESSONS.some((l) => l.strand === "business"), "both strands are covered");
}

console.log("\nThe experiment registry");
{
  check(EXPERIMENTS.length === 4, "four experiments", String(EXPERIMENTS.length));
  check(EXPERIMENTS.every((e) => e.question.endsWith("?")), "each states a research question");
  check(EXPERIMENTS.every((e) => e.limitations.length >= 2), "each lists at least two limitations");
  check(new Set(EXPERIMENTS.map((e) => e.slug)).size === 4, "slugs are unique");
}

console.log("\nThe assistant's offline answers");
{
  const a = answerLocally("what is price elasticity of demand?", null);
  check(a.body.length > 80, "a concept question gets a real answer offline");
  check(a.kind === "explanation", "labelled as an explanation");
  check(a.followUp.length > 0, "and it asks something back");
  const b = answerLocally("is my hypothesis any good", null);
  check(b.kind === "critique", "a hypothesis gets a critique rather than a compliment");
  const c = answerLocally("qwertyuiop zxcvbnm", null);
  check(/could not find/i.test(c.body) || /not sure/i.test(c.body), "and an unknown question says so instead of inventing an answer");
  check(!/according to .*\(20\d\d\)/i.test(c.body), "no invented citations anywhere");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
