/**
 * The experiment registry.
 *
 * Every experiment in MarketLab carries the same shape, and the shape is the
 * argument: a research question, an objective, the theory it rests on, the
 * variables it lets you move, and — the part most interactive charts leave
 * out — what it cannot tell you. A model whose limitations are not written
 * down is being passed off as a measurement.
 */

export type ExperimentSlug = "elasticity" | "supply-demand" | "profit" | "competition";

export interface ExperimentMeta {
  slug: ExperimentSlug;
  title: string;
  /** One line, for cards. */
  summary: string;
  /** The question the experiment is built to answer. */
  question: string;
  objective: string;
  /** The economics or business theory, in the student's own register. */
  concept: string;
  /** The formulae the experiment evaluates, exactly as it evaluates them. */
  formulae: Array<{ label: string; expression: string; note?: string }>;
  /** What the model cannot support. Shown on the experiment itself, not hidden in a footer. */
  limitations: string[];
  /** Cambridge syllabus areas this touches. */
  topics: string[];
  difficulty: "Introductory" | "Core" | "Extension";
  minutes: number;
}

export const EXPERIMENTS: ExperimentMeta[] = [
  {
    slug: "elasticity",
    title: "Price elasticity & revenue",
    summary: "Change a price and watch what elasticity does to total revenue.",
    question: "How does a change in price affect total revenue at different price elasticities of demand?",
    objective:
      "Measure the price elasticity of demand from two price–quantity observations, then test whether the textbook revenue rule — inelastic demand means a price rise raises revenue, elastic demand means it lowers revenue — holds for the numbers you have entered.",
    concept:
      "Price elasticity of demand measures how responsive quantity demanded is to a change in price. Because total revenue is price multiplied by quantity, and a price change moves those two in opposite directions for a normal good, elasticity decides which of the two effects wins. That is the entire mechanism, and it is worth seeing it rather than memorising it.",
    formulae: [
      { label: "Price elasticity of demand", expression: "PED = %Δ quantity demanded ÷ %Δ price" },
      { label: "Midpoint (arc) percentage change", expression: "%Δx = (x₁ − x₀) ÷ ((x₁ + x₀) ÷ 2)", note: "Gives the same magnitude in both directions, which the base-year method does not." },
      { label: "Total revenue", expression: "TR = P × Q" },
      { label: "Constant-elasticity demand curve", expression: "Q(P) = Q₀ × (P ÷ P₀)^PED", note: "Used only to draw the revenue curve. It assumes elasticity is the same at every price, which real demand curves rarely are." },
    ],
    limitations: [
      "Elasticity is estimated from two points. A real estimate needs many observations and a way of holding other influences still.",
      "Everything other than price is assumed constant — incomes, rivals' prices, tastes, the weather. In any real market at least one of them moved as well.",
      "The revenue curve assumes elasticity stays the same at every price. Along a straight-line demand curve it does not: it falls as you move down the curve.",
      "Revenue is not profit. Nothing here accounts for the cost of supplying the extra units.",
    ],
    topics: ["Elasticity", "Demand", "Revenue"],
    difficulty: "Core",
    minutes: 10,
  },
  {
    slug: "supply-demand",
    title: "Supply, demand & market equilibrium",
    summary: "Shift either curve, add a price control, and read the new equilibrium.",
    question: "How do demand and supply shocks, and price controls, change the equilibrium price and quantity in a market?",
    objective:
      "Find the equilibrium of a linear market, shift either curve, and measure the resulting change in price, quantity and welfare — then impose a price ceiling or floor and quantify the shortage or surplus it creates.",
    concept:
      "Equilibrium is the single price at which the quantity buyers want equals the quantity sellers offer. Anything that changes willingness to buy shifts the demand curve; anything that changes the cost or ease of supplying shifts the supply curve. A price control does not shift either curve — it stops the price reaching the level where they meet, and the gap between the two quantities at that fixed price is the shortage or surplus.",
    formulae: [
      { label: "Demand", expression: "Qd = a − b × P", note: "a is quantity demanded at a price of zero; b is how many units are lost per unit of price." },
      { label: "Supply", expression: "Qs = c + d × P" },
      { label: "Equilibrium price", expression: "P* = (a − c) ÷ (b + d)", note: "From setting Qd = Qs." },
      { label: "Equilibrium quantity", expression: "Q* = a − b × P*" },
      { label: "Consumer surplus", expression: "CS = ½ × Q* × (a/b − P*)" },
      { label: "Deadweight loss under a binding control", expression: "DWL = ½ × (Q* − Q_traded) × (P_demand − P_supply at Q_traded)" },
    ],
    limitations: [
      "Both curves are straight lines. Real demand and supply curves are not, and the welfare triangles depend on that shape.",
      "The model is comparative-static: it shows the old equilibrium and the new one, and says nothing about how long the market takes to get there, or whether it does.",
      "Shocks are parallel shifts. A real shock usually changes the slope as well as the position.",
      "Consumer and producer surplus assume everyone in the market is a price-taker and that willingness to pay can be read off the demand curve.",
      "Shortages and surpluses are measured in units, not in queues, rationing, black markets or waste — which is usually what a shortage actually looks like.",
    ],
    topics: ["Demand", "Supply", "Equilibrium", "Government intervention"],
    difficulty: "Core",
    minutes: 12,
  },
  {
    slug: "profit",
    title: "Business profit simulator",
    summary: "Price, volume, costs and marketing — and the quantity where the business breaks even.",
    question: "How do price, volume, costs and marketing spend combine to determine profit and the break-even point?",
    objective:
      "Build a simple cost and revenue structure for a small business, find its break-even quantity and margin of safety, and compare low, medium and high price scenarios under assumptions you set and can state.",
    concept:
      "A business covers its fixed costs out of the contribution each unit makes — the selling price less the variable cost of making that unit. Break-even is the quantity at which the accumulated contribution exactly equals fixed costs. Everything a business can do to profit is somewhere in that sentence: raise price, cut variable cost, cut fixed cost, or sell more.",
    formulae: [
      { label: "Total revenue", expression: "TR = P × Q" },
      { label: "Total cost", expression: "TC = FC + VC × Q", note: "Marketing spend is added to fixed costs." },
      { label: "Profit", expression: "Profit = TR − TC" },
      { label: "Contribution per unit", expression: "Contribution = P − VC" },
      { label: "Break-even quantity", expression: "BEQ = FC ÷ (P − VC)", note: "Undefined when price is at or below variable cost: there is then no quantity at which the business breaks even." },
      { label: "Margin of safety", expression: "MoS = (Q − BEQ) ÷ Q" },
      { label: "Marketing response (optional assumption)", expression: "uplift(S) = maxUplift × (1 − e^(−S × ln2 ÷ halfSpend))" },
    ],
    limitations: [
      "Costs are linear. Real variable costs move with volume — bulk discounts, overtime, capacity limits — and real fixed costs step up rather than staying flat.",
      "Quantity sold is an input, not a forecast. Unless you switch the marketing response on, nothing in the model predicts how many units you will actually sell.",
      "The marketing response, when switched on, is an assumption you chose. It is not an estimate from data, and it should be labelled as an assumption in any write-up.",
      "One product, one price, one period. No stock, no seasonality, no credit, no tax.",
      "A profitable period is not a viable business: cash flow, not profit, is what runs out first.",
    ],
    topics: ["Costs", "Revenue", "Break-even", "Profitability"],
    difficulty: "Introductory",
    minutes: 10,
  },
  {
    slug: "competition",
    title: "Competition & pricing",
    summary: "Set your price against rivals and see share, revenue and profit move.",
    question: "How does a firm's pricing decision affect its market share and profit when rivals' prices and non-price competitiveness are held constant?",
    objective:
      "Explore the trade-off at the centre of pricing in a competitive market: a lower price wins share but earns less on each sale. Find the price that maximises your modelled profit against a fixed set of rivals, and test how much that answer depends on how price-sensitive you assume customers are.",
    concept:
      "In a market with differentiated products, customers weigh price against everything else they care about — brand, quality, service, convenience. A firm that cuts price gains share but gives up contribution on every unit, including the ones it would have sold anyway. Where the best price sits depends almost entirely on how sensitive customers are to price, which is exactly the quantity nobody knows for certain.",
    formulae: [
      { label: "Attractiveness of firm i", expression: "uᵢ = appealᵢ − β × priceᵢ", note: "β is the price sensitivity you set." },
      { label: "Market share", expression: "shareᵢ = e^(uᵢ) ÷ (e^(u₀) + Σⱼ e^(uⱼ))", note: "u₀ is the appeal of buying nothing, so the market is not a fixed prize." },
      { label: "Quantity", expression: "Qᵢ = market size × shareᵢ" },
      { label: "Profit", expression: "Profitᵢ = (Pᵢ − VCᵢ) × Qᵢ − FCᵢ" },
      { label: "Concentration", expression: "HHI = Σ (share as a percentage)²" },
    ],
    limitations: [
      "This is an illustrative model, not a prediction of any real market's behaviour. No part of it is estimated from data.",
      "Rivals do not respond. In a real market a price cut is usually matched, and the share gain shown here largely disappears.",
      "Price sensitivity (β) is an assumption you set. Change it and the profit-maximising price changes with it — which is the most important thing to notice.",
      "The logit share rule assumes every customer chooses independently and that products differ only by price and a single appeal score.",
      "Costs are constant per unit, so nothing captures economies of scale, capacity limits or the cost of winning share.",
    ],
    topics: ["Market structures", "Pricing", "Competition", "Profitability"],
    difficulty: "Extension",
    minutes: 12,
  },
];

export function findExperiment(slug: string): ExperimentMeta | undefined {
  return EXPERIMENTS.find((e) => e.slug === slug);
}
