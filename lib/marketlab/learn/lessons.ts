/**
 * The learning corpus.
 *
 * Written from scratch for MarketLab. It uses the terminology a Cambridge
 * AS/A-level student will meet in the syllabus because that is the vocabulary
 * the subject is examined in, but nothing here is taken from, or claims to
 * reproduce, any exam board's materials. The practice questions are original
 * and are not past-paper questions.
 *
 * Every lesson carries the same seven parts, and the two that most teaching
 * material leaves out are the two that do the most work: the common mistakes,
 * and an activity that is a real model rather than a quiz.
 */

export interface Definition {
  term: string;
  meaning: string;
}

export interface Formula {
  label: string;
  expression: string;
  note?: string;
}

export interface Question {
  prompt: string;
  options: string[];
  /** Index into `options`. */
  answer: number;
  explain: string;
}

export interface Activity {
  label: string;
  href: string;
  description: string;
}

export interface Lesson {
  slug: string;
  title: string;
  strand: "economics" | "business";
  /** Syllabus grouping, used for the index. */
  unit: string;
  summary: string;
  minutes: number;
  /** Paragraphs of plain explanation. */
  explanation: string[];
  definitions: Definition[];
  formulae: Formula[];
  example: string;
  activity: Activity | null;
  mistakes: string[];
  questions: Question[];
  related: string[];
}

export const LESSONS: Lesson[] = [
  /* ===================== ECONOMICS ===================== */
  {
    slug: "demand-and-supply",
    title: "Demand and supply",
    strand: "economics",
    unit: "The price system",
    summary: "What each curve actually says, and the difference between moving along one and shifting it.",
    minutes: 8,
    explanation: [
      "A demand curve answers one question: at each possible price, how much of this good would buyers want to buy over some period? It slopes downwards for two reasons. The income effect — a higher price makes buyers poorer in real terms, so they buy less of everything, including this. And the substitution effect — a higher price makes rivals look better value, so some buyers switch.",
      "A supply curve answers the mirror question: at each possible price, how much would sellers be willing to offer? It slopes upwards because producing more usually costs more per unit, and because a higher price draws in sellers whose costs were previously too high to bother.",
      "The distinction that decides half of all exam marks is between a movement along a curve and a shift of the whole curve. A change in the good's own price moves you along the curve — that is a change in quantity demanded. A change in anything else moves the whole curve — that is a change in demand. Income, the price of substitutes and complements, tastes, population and expectations shift demand. Input costs, technology, taxes, subsidies, the number of sellers and the weather shift supply.",
    ],
    definitions: [
      { term: "Demand", meaning: "The quantity of a good buyers are willing and able to purchase at each price over a given period." },
      { term: "Quantity demanded", meaning: "The amount bought at one particular price — a single point on the demand curve." },
      { term: "Supply", meaning: "The quantity sellers are willing and able to offer at each price over a given period." },
      { term: "Substitute", meaning: "A good bought instead of another. A rise in the price of one raises demand for the other." },
      { term: "Complement", meaning: "A good bought alongside another. A rise in the price of one lowers demand for the other." },
      { term: "Ceteris paribus", meaning: "'Other things equal' — the assumption that lets a curve isolate the effect of price alone." },
    ],
    formulae: [
      { label: "Linear demand", expression: "Qd = a − b × P", note: "a is quantity demanded at a price of zero; b is how much quantity falls per unit of price." },
      { label: "Linear supply", expression: "Qs = c + d × P" },
    ],
    example:
      "When a poor coffee harvest raises the wholesale price of arabica beans, a café's supply curve shifts left — at every price it can now afford to offer less, because each cup costs more to make. The café's demand curve has not moved at all. What follows is a movement along the unchanged demand curve to a higher price and a lower quantity. Reading that as 'demand fell' is the single most common error in the topic: fewer cups were bought, but willingness to buy at each price was never touched.",
    activity: {
      label: "Shift a curve and watch equilibrium move",
      href: "/experiments/supply-demand",
      description: "Apply a demand or supply shock and read the new equilibrium price and quantity off the chart.",
    },
    mistakes: [
      "Saying 'demand fell' when the good's own price rose. That is a fall in quantity demanded — a movement along the curve, not a shift of it.",
      "Drawing a shift when the question describes a price change, or a movement when it describes a change in income or tastes.",
      "Forgetting that both curves are defined over a period of time. 'Quantity demanded is 500' means nothing without 'per week'.",
    ],
    questions: [
      {
        prompt: "The price of tea rises sharply. In the market for coffee, what happens?",
        options: [
          "Demand for coffee shifts right",
          "Quantity demanded of coffee falls",
          "Supply of coffee shifts left",
          "Nothing, because the price of coffee has not changed",
        ],
        answer: 0,
        explain: "Tea is a substitute for coffee. A higher tea price makes coffee relatively better value at every coffee price, so the whole demand curve for coffee shifts right.",
      },
      {
        prompt: "A government raises the tax paid by producers on every unit of a good. The effect on the supply curve is:",
        options: [
          "A movement up along it",
          "A shift to the left",
          "A shift to the right",
          "No effect — taxes affect demand, not supply",
        ],
        answer: 1,
        explain: "A per-unit tax raises the cost of supplying each unit, so at every price sellers offer less. The whole supply curve shifts left (equivalently, upwards by the amount of the tax).",
      },
      {
        prompt: "Which of these causes a movement along the demand curve rather than a shift of it?",
        options: ["A rise in consumer incomes", "A successful advertising campaign", "A fall in the good's own price", "A fall in the price of a complement"],
        answer: 2,
        explain: "Only the good's own price moves you along its own demand curve. Everything else shifts the whole curve.",
      },
    ],
    related: ["market-equilibrium", "elasticity", "government-intervention"],
  },
  {
    slug: "elasticity",
    title: "Elasticity",
    strand: "economics",
    unit: "The price system",
    summary: "How responsive one thing is to another — and why the sign and the method both matter.",
    minutes: 12,
    explanation: [
      "Elasticity measures responsiveness. Price elasticity of demand (PED) asks: if price changes by 1%, by what percentage does quantity demanded change? Because both parts are percentages, the answer is a pure number — it does not depend on whether you measured in pounds or pence, litres or gallons, which is exactly why economists use it instead of the slope.",
      "For a normal good PED is negative, because price and quantity move in opposite directions. Textbooks then classify demand using the magnitude, ignoring the sign: below 1 in magnitude is inelastic, above 1 is elastic, exactly 1 is unit elastic. Both facts are true at once, and writing 'PED = 1.2' when you mean 'PED = −1.2' loses marks. State the sign, then discuss the magnitude.",
      "The consequence that matters commercially is for revenue. Total revenue is price times quantity. When demand is inelastic, a price rise loses proportionally less quantity than it gains in price, so revenue rises. When demand is elastic, the quantity loss dominates and revenue falls. This is not a rule to memorise — it falls straight out of the arithmetic, which is what the elasticity experiment is for.",
      "The same idea applies elsewhere. Income elasticity of demand (YED) measures responsiveness to income and its sign tells you whether a good is normal or inferior. Cross elasticity (XED) measures responsiveness to another good's price and its sign tells you whether two goods are substitutes or complements. Price elasticity of supply (PES) measures how readily producers can respond, and depends mostly on spare capacity and time.",
    ],
    definitions: [
      { term: "Price elasticity of demand (PED)", meaning: "The percentage change in quantity demanded divided by the percentage change in price." },
      { term: "Elastic demand", meaning: "|PED| > 1. Quantity responds proportionally more than price." },
      { term: "Inelastic demand", meaning: "|PED| < 1. Quantity responds proportionally less than price." },
      { term: "Income elasticity of demand (YED)", meaning: "Percentage change in quantity demanded divided by percentage change in income. Negative for an inferior good." },
      { term: "Cross elasticity of demand (XED)", meaning: "Percentage change in demand for one good divided by percentage change in the price of another. Positive for substitutes, negative for complements." },
      { term: "Price elasticity of supply (PES)", meaning: "Percentage change in quantity supplied divided by percentage change in price. Higher when producers have spare capacity or more time." },
    ],
    formulae: [
      { label: "Price elasticity of demand", expression: "PED = %Δ Qd ÷ %Δ P" },
      { label: "Midpoint (arc) change", expression: "%Δx = (x₁ − x₀) ÷ ((x₁ + x₀) ÷ 2)", note: "Symmetric: gives the same magnitude whichever direction you travel." },
      { label: "Base-year change", expression: "%Δx = (x₁ − x₀) ÷ x₀", note: "Simpler, but the answer depends on which point you start from." },
      { label: "Total revenue", expression: "TR = P × Q" },
    ],
    example:
      "A bus operator raises a single fare from £2.00 to £2.40 — a 20% rise on the base-year method — and daily passengers fall from 5,000 to 4,600, a fall of 8%. PED is −8% ÷ 20% = −0.4: inelastic. Revenue rises from £10,000 to £11,040. Now suppose a competing rail line opens and the same fare rise costs 1,500 passengers instead. PED becomes −30% ÷ 20% = −1.5: elastic, and revenue falls to £8,400. Nothing about the bus changed. The availability of a substitute is what moved the elasticity, which is why 'how easily can buyers go elsewhere' is the first determinant to discuss.",
    activity: {
      label: "Run the elasticity experiment",
      href: "/experiments/elasticity",
      description: "Enter two price–quantity observations and watch PED, the band and total revenue update together.",
    },
    mistakes: [
      "Dropping the minus sign without saying you have. Write 'PED = −1.5 (elastic)', not 'PED = 1.5'.",
      "Using the slope instead of percentages. Elasticity is a ratio of proportional changes; the slope is a ratio of absolute ones and changes with the units.",
      "Assuming elasticity is a fixed property of a good. It varies along a straight-line demand curve, and varies with time, income and the number of substitutes available.",
      "Concluding a price rise is a good idea because demand is inelastic. Revenue rising is not the same as profit rising — you still have to look at costs.",
    ],
    questions: [
      {
        prompt: "A firm raises price by 10% and total revenue falls. What does this tell you about PED?",
        options: ["|PED| < 1", "|PED| = 1", "|PED| > 1", "PED is positive"],
        answer: 2,
        explain: "Revenue falling after a price rise means quantity fell proportionally more than price rose — demand is elastic, so |PED| > 1.",
      },
      {
        prompt: "Which of these would most likely make demand for a product more elastic?",
        options: [
          "The product becomes habit-forming",
          "A close substitute becomes widely available",
          "The product takes a smaller share of buyers' income",
          "The time period considered gets shorter",
        ],
        answer: 1,
        explain: "The easier it is to switch away, the more responsive quantity is to price. Availability of close substitutes is the strongest determinant of PED.",
      },
      {
        prompt: "The income elasticity of demand for a good is −0.6. The good is:",
        options: ["Normal and a luxury", "Normal and a necessity", "Inferior", "A complement"],
        answer: 2,
        explain: "A negative YED means demand falls as income rises, which is the definition of an inferior good.",
      },
      {
        prompt: "Using the midpoint method, price rises from £10 to £12 and quantity falls from 100 to 80. PED is approximately:",
        options: ["−1.00", "−1.22", "−0.82", "+1.22"],
        answer: 1,
        explain: "%ΔQ = −20/90 = −0.222; %ΔP = 2/11 = 0.182; PED = −0.222 ÷ 0.182 = −1.22. The base-year method would give exactly −1.00 for the same two points.",
      },
    ],
    related: ["demand-and-supply", "costs-and-revenue", "market-structures"],
  },
  {
    slug: "market-equilibrium",
    title: "Market equilibrium",
    strand: "economics",
    unit: "The price system",
    summary: "Where the curves cross, why price gets there, and what happens when it cannot.",
    minutes: 8,
    explanation: [
      "Equilibrium is the price at which quantity demanded equals quantity supplied. It is not a fair price or a good price — it is simply the only price at which the market clears, leaving no unsatisfied buyer willing to pay what a seller will accept.",
      "The mechanism that gets there is worth stating explicitly, because it is what a diagram hides. Above equilibrium, sellers offer more than buyers want; the unsold stock pushes sellers to cut price. Below it, buyers want more than is on offer; the queue lets sellers raise price. The price signal does two jobs at once — it rations the existing supply and it tells producers where to put resources next.",
      "When either curve shifts, the equilibrium moves to a new crossing point. If both shift at once and in the same direction, quantity moves predictably and price is indeterminate — it depends on which shift is larger. If they shift in opposite directions, price moves predictably and quantity is indeterminate. Being able to say which of the two is indeterminate, and why, is what separates a full answer from half of one.",
    ],
    definitions: [
      { term: "Equilibrium price", meaning: "The price at which quantity demanded equals quantity supplied, so the market clears." },
      { term: "Excess demand (shortage)", meaning: "Quantity demanded exceeds quantity supplied, which happens below equilibrium price." },
      { term: "Excess supply (surplus)", meaning: "Quantity supplied exceeds quantity demanded, which happens above equilibrium price." },
      { term: "Consumer surplus", meaning: "The difference between what buyers were willing to pay and what they actually paid, summed across all buyers." },
      { term: "Producer surplus", meaning: "The difference between the price received and the minimum sellers would have accepted, summed across all sellers." },
    ],
    formulae: [
      { label: "Equilibrium price", expression: "P* = (a − c) ÷ (b + d)", note: "From setting Qd = Qs with linear curves." },
      { label: "Equilibrium quantity", expression: "Q* = a − b × P*" },
      { label: "Consumer surplus (linear)", expression: "CS = ½ × Q* × (choke price − P*)" },
    ],
    example:
      "Take Qd = 200 − 5P and Qs = 50 + 5P. Setting them equal gives 200 − 5P = 50 + 5P, so 150 = 10P and P* = 15, with Q* = 125. Now suppose a new competitor's exit shifts demand right by 50 units at every price: Qd = 250 − 5P. The new equilibrium is P* = 20, Q* = 150. Price and quantity both rose, which is the signature of a rightward demand shift — and is different from the signature of a rightward supply shift, where price falls and quantity rises. Recognising which signature you are looking at lets you work backwards from data to a cause.",
    activity: {
      label: "Find an equilibrium and break it",
      href: "/experiments/supply-demand",
      description: "Set the curve parameters, apply shocks, and impose a ceiling or floor to see the shortage or surplus it creates.",
    },
    mistakes: [
      "Treating equilibrium as something a market is always at. It is where a market tends towards, and many markets never arrive.",
      "Saying 'supply equals demand' rather than 'quantity supplied equals quantity demanded'. Supply and demand are whole schedules; only the quantities can be equal.",
      "Forgetting to say which variable is indeterminate when both curves shift.",
    ],
    questions: [
      {
        prompt: "Demand shifts right and supply shifts left by a similar amount. What can you say with certainty?",
        options: ["Price rises; quantity is indeterminate", "Quantity rises; price is indeterminate", "Both rise", "Both fall"],
        answer: 0,
        explain: "Both shifts push price up, so price definitely rises. They push quantity in opposite directions, so the quantity effect depends on which shift is larger.",
      },
      {
        prompt: "At a price above equilibrium, a market has:",
        options: ["Excess demand, pushing price up", "Excess supply, pushing price down", "Excess demand, pushing price down", "No pressure on price"],
        answer: 1,
        explain: "Above equilibrium sellers offer more than buyers want. The unsold surplus pushes price back down towards equilibrium.",
      },
      {
        prompt: "With Qd = 120 − 4P and Qs = 20 + 6P, the equilibrium price is:",
        options: ["£8", "£10", "£12", "£14"],
        answer: 1,
        explain: "120 − 4P = 20 + 6P gives 100 = 10P, so P* = 10 and Q* = 80.",
      },
    ],
    related: ["demand-and-supply", "government-intervention", "market-failure"],
  },
  {
    slug: "government-intervention",
    title: "Government intervention",
    strand: "economics",
    unit: "Government and the price system",
    summary: "Ceilings, floors, taxes and subsidies — what each does, and what each costs.",
    minutes: 10,
    explanation: [
      "A maximum price (price ceiling) set below equilibrium holds price down. At that lower price buyers want more and sellers offer less, so the market develops a persistent shortage. Something other than price then has to do the rationing: queues, waiting lists, rationing by seller preference, or a black market. Rent controls are the standard example, and the standard finding is that the people helped are those who already hold a tenancy.",
      "A minimum price (price floor) set above equilibrium holds price up, producing a persistent surplus. Agricultural support prices and minimum wages are the usual examples — though a minimum wage operates in a labour market where the buyer may have market power, which can change the prediction entirely.",
      "An indirect tax raises the cost of supplying each unit and shifts supply left. Who actually bears it — the incidence — depends on the relative elasticities, not on who writes the cheque. The more inelastic side of the market bears more of the tax, because it has fewer alternatives. A subsidy works the same way in reverse.",
      "Every intervention has an efficiency cost, usually shown as a deadweight loss triangle, and that cost has to be weighed against whatever the intervention was for. The economic argument is almost never 'intervention is bad'; it is 'here is what it achieves, here is what it costs, and here is who bears each'.",
    ],
    definitions: [
      { term: "Maximum price (ceiling)", meaning: "A legal upper limit on price. It only binds if set below the equilibrium price." },
      { term: "Minimum price (floor)", meaning: "A legal lower limit on price. It only binds if set above the equilibrium price." },
      { term: "Indirect tax", meaning: "A tax on a good or service, paid by the seller, that shifts the supply curve left." },
      { term: "Tax incidence", meaning: "How the burden of a tax is split between buyers and sellers. The more inelastic side bears more." },
      { term: "Deadweight loss", meaning: "The value of mutually beneficial trades that no longer happen because of an intervention or market power." },
      { term: "Subsidy", meaning: "A payment to producers per unit, which shifts supply right and lowers the price buyers pay." },
    ],
    formulae: [
      { label: "Shortage under a binding ceiling", expression: "Shortage = Qd(P_ceiling) − Qs(P_ceiling)" },
      { label: "Surplus under a binding floor", expression: "Surplus = Qs(P_floor) − Qd(P_floor)" },
      { label: "Deadweight loss", expression: "DWL = ½ × (Q* − Q_traded) × (P_demand − P_supply at Q_traded)" },
    ],
    example:
      "In the market Qd = 200 − 5P, Qs = 50 + 5P, equilibrium is P* = 15 and Q* = 125. A ceiling at £10 is binding. At £10, quantity demanded is 150 and quantity supplied is 100 — a shortage of 50 units, with only 100 actually trading. The 25 units between 100 and 125 were trades where a buyer valued the good above what it cost to supply, and they no longer happen: that is the deadweight loss, worth £125 here. Notice what the model does not show — who gets the 100 units that do trade, and what the queue for them costs in time.",
    activity: {
      label: "Impose a price control",
      href: "/experiments/supply-demand",
      description: "Set a ceiling or a floor and read the shortage, surplus and deadweight loss it creates.",
    },
    mistakes: [
      "Drawing a ceiling above equilibrium or a floor below it and then describing an effect. A non-binding control does nothing at all.",
      "Saying the tax is paid by whoever hands the money to the government. Incidence depends on elasticities, not on administration.",
      "Treating deadweight loss as the whole case against intervention, without asking what the intervention achieved.",
    ],
    questions: [
      {
        prompt: "A maximum price is set above the current equilibrium price. The effect is:",
        options: ["A shortage", "A surplus", "No effect", "A rise in price to the maximum"],
        answer: 2,
        explain: "The control is not binding: the market price is already below the legal maximum, so nothing changes.",
      },
      {
        prompt: "An indirect tax is imposed on a good with very inelastic demand and elastic supply. Most of the burden falls on:",
        options: ["Producers", "Consumers", "Split exactly equally", "The government"],
        answer: 1,
        explain: "The more inelastic side has fewer alternatives and so bears more of the tax. Here that is consumers.",
      },
      {
        prompt: "A binding minimum wage in a competitive labour market is predicted to cause:",
        options: ["Excess demand for labour", "Excess supply of labour (unemployment)", "No change in employment", "A fall in the wage rate"],
        answer: 1,
        explain: "A floor above equilibrium raises quantity supplied and lowers quantity demanded, producing excess supply — in a labour market, unemployment. This prediction weakens if the employer has monopsony power.",
      },
    ],
    related: ["market-equilibrium", "market-failure", "elasticity"],
  },
  {
    slug: "market-failure",
    title: "Market failure",
    strand: "economics",
    unit: "Government and the price system",
    summary: "When the price signal misses something real — externalities, public goods, information gaps.",
    minutes: 10,
    explanation: [
      "Market failure means the free market allocates resources inefficiently — too much or too little of something is produced compared with what maximises social welfare. It is a technical claim about efficiency, not a complaint about outcomes being unfair, and the two are worth keeping separate.",
      "The most common cause is an externality: a cost or benefit falling on a third party who is not part of the transaction. A factory's emissions impose a cost on people downwind who neither bought nor sold anything, so the private cost of production is below the social cost and too much gets produced. A vaccination confers a benefit on people who were never vaccinated, so private benefit is below social benefit and too little is bought.",
      "Public goods fail differently. A good that is non-rival (my using it does not reduce what is left for you) and non-excludable (I cannot stop you using it) cannot easily be sold, because everyone can free-ride. Street lighting and national defence are the standard cases, and the usual response is public provision funded by taxation.",
      "Information failure is the third family. Where one side knows more than the other — asymmetric information — markets can unravel, as in the used-car market where buyers cannot tell good cars from bad and so will not pay for good ones. Where buyers systematically misjudge long-term costs, as with tobacco or pensions, the market clears at the wrong quantity even with no externality at all.",
    ],
    definitions: [
      { term: "Market failure", meaning: "An allocation of resources by the free market that does not maximise social welfare." },
      { term: "Negative externality", meaning: "A cost imposed on a third party outside the transaction. Social cost exceeds private cost." },
      { term: "Positive externality", meaning: "A benefit conferred on a third party outside the transaction. Social benefit exceeds private benefit." },
      { term: "Public good", meaning: "A good that is both non-rival and non-excludable, so the market under-provides or fails to provide it." },
      { term: "Free rider", meaning: "Someone who consumes a good without paying, possible whenever exclusion is impractical." },
      { term: "Asymmetric information", meaning: "One party to a transaction knows materially more than the other." },
      { term: "Merit good", meaning: "A good under-consumed relative to what is socially desirable, often because buyers undervalue its long-term benefit." },
    ],
    formulae: [
      { label: "Social cost", expression: "Social cost = private cost + external cost" },
      { label: "Social benefit", expression: "Social benefit = private benefit + external benefit" },
      { label: "Efficient output", expression: "Marginal social benefit = marginal social cost" },
    ],
    example:
      "A haulage firm chooses how many lorry journeys to run by comparing its own fuel, wages and maintenance with the revenue each journey earns. Congestion, road wear, noise and air pollution fall on everyone else. Because those costs never appear on the firm's own account, the private optimum is more journeys than the social optimum, and the gap is the market failure. A congestion charge set at the external cost per journey brings the two into line — which is why the policy instrument follows directly from the diagnosis rather than being chosen separately.",
    activity: null,
    mistakes: [
      "Calling anything you dislike a market failure. Inequality is a distributional question, not an efficiency one, though both can matter.",
      "Confusing non-rival with non-excludable. A cinema screening is non-rival up to capacity but perfectly excludable, so it is not a public good.",
      "Assuming government intervention fixes market failure without cost. Government failure — poor information, unintended effects, capture — is a real possibility and worth a sentence in any evaluation.",
    ],
    questions: [
      {
        prompt: "A good that is non-rival and non-excludable is:",
        options: ["A merit good", "A public good", "A demerit good", "A Giffen good"],
        answer: 1,
        explain: "Non-rival plus non-excludable is the definition of a pure public good. Merit goods are about under-consumption, not about these two properties.",
      },
      {
        prompt: "Where a negative production externality exists, the free market will:",
        options: ["Over-produce relative to the social optimum", "Under-produce relative to the social optimum", "Produce the socially optimal quantity", "Fail to produce at all"],
        answer: 0,
        explain: "Producers only face private costs, which are lower than social costs, so they produce more than the quantity where marginal social benefit equals marginal social cost.",
      },
      {
        prompt: "The 'free rider problem' is the reason markets struggle to provide:",
        options: ["Luxury goods", "Inferior goods", "Public goods", "Complementary goods"],
        answer: 2,
        explain: "If you cannot exclude non-payers, everyone has an incentive to let someone else pay, so too little is funded privately.",
      },
    ],
    related: ["government-intervention", "market-equilibrium"],
  },
  {
    slug: "costs-and-revenue",
    title: "Costs and revenue",
    strand: "economics",
    unit: "The firm",
    summary: "Fixed, variable, average, marginal — and why the marginal one decides everything.",
    minutes: 10,
    explanation: [
      "Fixed costs do not vary with output in the short run: rent, insurance, the salaried manager. Variable costs do: materials, hourly wages, power. Total cost is the two added together, and the useful derived measures are average cost (total cost divided by output) and marginal cost (the addition to total cost from producing one more unit).",
      "Marginal cost is the one that drives decisions, because every choice a firm faces is about doing a bit more or a bit less. Fixed costs, once incurred, are irrelevant to that choice — they are sunk. A firm deciding whether to accept one more order should compare the extra revenue with the extra cost, and the rent is in neither.",
      "On the revenue side, total revenue is price times quantity and average revenue is just price. Marginal revenue is the addition to total revenue from selling one more unit. For a firm that can sell any quantity at the going price, marginal revenue equals price. For a firm that has to cut price to sell more, marginal revenue is below price — because the price cut applies to every unit, not just the extra one.",
      "Profit is maximised where marginal revenue equals marginal cost. Before that point, an extra unit adds more than it costs; after it, an extra unit costs more than it adds. This is the single most reusable result in the subject.",
    ],
    definitions: [
      { term: "Fixed cost", meaning: "A cost that does not vary with output in the short run." },
      { term: "Variable cost", meaning: "A cost that varies directly with output." },
      { term: "Marginal cost", meaning: "The addition to total cost from producing one more unit." },
      { term: "Average cost", meaning: "Total cost divided by output — the cost per unit." },
      { term: "Marginal revenue", meaning: "The addition to total revenue from selling one more unit." },
      { term: "Sunk cost", meaning: "A cost already incurred that cannot be recovered, and which should therefore not affect any future decision." },
      { term: "Economies of scale", meaning: "Falls in long-run average cost as the scale of production rises." },
    ],
    formulae: [
      { label: "Total cost", expression: "TC = FC + VC" },
      { label: "Average cost", expression: "AC = TC ÷ Q" },
      { label: "Marginal cost", expression: "MC = ΔTC ÷ ΔQ" },
      { label: "Total revenue", expression: "TR = P × Q" },
      { label: "Profit maximisation", expression: "MR = MC" },
    ],
    example:
      "A print shop pays £2,000 a month in rent and £3 in materials per poster, and sells at £8. A customer offers £5 each for 200 posters that would otherwise not be printed. The average cost at current volume might be £9 a poster, which makes £5 look like a loss — but that average includes rent the shop pays either way. The marginal cost is £3, so the order adds £2 per poster of contribution, or £400 towards the rent. Accepting it is right. Rejecting it because £5 is 'below cost' is the sunk-cost error, and it is one of the most expensive mistakes a small business makes.",
    activity: {
      label: "Build a cost structure",
      href: "/experiments/profit",
      description: "Set fixed and variable costs and see total cost, contribution and the break-even point move.",
    },
    mistakes: [
      "Comparing price with average cost when making a marginal decision. Average cost includes costs you are paying anyway.",
      "Calling something a fixed cost because it is large. Fixed means it does not vary with output, nothing else.",
      "Treating economies of scale as automatic. They exist up to a point, after which diseconomies — coordination, communication, motivation — set in.",
    ],
    questions: [
      {
        prompt: "A firm's fixed costs are £5,000 and variable cost is £4 per unit. At 1,000 units, average cost is:",
        options: ["£4", "£5", "£9", "£9,000"],
        answer: 2,
        explain: "TC = 5,000 + 4 × 1,000 = £9,000. AC = 9,000 ÷ 1,000 = £9.",
      },
      {
        prompt: "Profit is maximised where:",
        options: ["Total revenue is highest", "Average cost is lowest", "Marginal revenue equals marginal cost", "Price equals average cost"],
        answer: 2,
        explain: "Below MR = MC each extra unit adds more than it costs; above it each extra unit costs more than it adds. The gap between TR and TC is widest exactly where they are equal.",
      },
      {
        prompt: "A cost already incurred and unrecoverable should:",
        options: ["Be spread across future output", "Be ignored in future decisions", "Be recovered by raising price", "Be added to marginal cost"],
        answer: 1,
        explain: "A sunk cost is the same whatever you decide next, so it cannot change which option is best.",
      },
    ],
    related: ["break-even-analysis", "profitability", "market-structures"],
  },
  {
    slug: "market-structures",
    title: "Market structures",
    strand: "economics",
    unit: "The firm",
    summary: "From perfect competition to monopoly, and what changes as you move along the spectrum.",
    minutes: 12,
    explanation: [
      "Market structures are classified by four things: how many firms there are, how similar their products are, how easy entry is, and how much information buyers have. The classification is a spectrum, and real markets rarely sit exactly on one of its named points.",
      "Perfect competition is the theoretical extreme: many small firms, an identical product, free entry, full information. Each firm is a price taker, so its demand curve is horizontal and marginal revenue equals price. In the long run, free entry competes supernormal profit away and firms earn only normal profit.",
      "Monopoly is the other extreme: one seller, high barriers to entry, and a downward-sloping demand curve that the firm can choose a point on. Because a price cut applies to every unit, marginal revenue falls below price, so the profit-maximising output is lower and the price higher than under competition. That is the standard efficiency criticism. The standard defence is that monopoly profit can fund research, and that some industries have such large economies of scale that one firm is genuinely cheapest — a natural monopoly.",
      "In between sit monopolistic competition — many firms, differentiated products, easy entry, so supernormal profit is competed away by imitation rather than by identical entrants — and oligopoly, where a few firms dominate and each has to anticipate the others' reactions. Oligopoly is the interesting case precisely because it is strategic: the best price depends on what rivals do, which is what the competition experiment lets you feel.",
    ],
    definitions: [
      { term: "Price taker", meaning: "A firm that must accept the market price, because it is too small to affect it." },
      { term: "Barrier to entry", meaning: "Anything that makes it costly or impossible for a new firm to enter — patents, scale, brand, legal restriction." },
      { term: "Supernormal profit", meaning: "Profit above the minimum needed to keep resources in their current use." },
      { term: "Normal profit", meaning: "The level of profit just sufficient to keep a firm in the industry. It counts as a cost." },
      { term: "Product differentiation", meaning: "Making a product distinguishable from rivals', by design, branding, quality or service." },
      { term: "Natural monopoly", meaning: "An industry where economies of scale are so large that one firm can supply the whole market more cheaply than several." },
      { term: "Concentration ratio", meaning: "The combined market share of the largest few firms, a standard indicator of how concentrated a market is." },
    ],
    formulae: [
      { label: "n-firm concentration ratio", expression: "CRₙ = sum of the market shares of the largest n firms" },
      { label: "Herfindahl–Hirschman Index", expression: "HHI = Σ (each firm's market share as a percentage)²", note: "Runs from near 0 to 10,000. Above 2,500 is usually called highly concentrated." },
      { label: "Profit maximisation", expression: "MR = MC", note: "Holds in every structure. What differs is the shape of the MR curve." },
    ],
    example:
      "Two supermarkets of similar size and similar quality compete on price. If one cuts price by 5% and the other does not respond, the first gains share — the logic of the competition model. But the second will respond, because not responding costs it share, and after both have cut, share is roughly where it started and both earn less on every item sold. That is why oligopolies often compete on things that are harder to match immediately: loyalty schemes, store location, own-brand ranges. The prediction 'a price cut wins share' is only true holding rivals' prices constant, which is exactly the assumption that fails in an oligopoly.",
    activity: {
      label: "Price against a rival",
      href: "/experiments/competition",
      description: "Set your price and appeal against competitors and see share, revenue and profit respond.",
    },
    mistakes: [
      "Saying a monopoly 'charges whatever it likes'. It still faces a demand curve — it chooses a point on it, and a higher price always means lower quantity.",
      "Treating normal profit as zero profit. Normal profit is a cost: the return needed to keep the resources where they are.",
      "Applying the perfect-competition long-run result to markets with obvious barriers to entry.",
    ],
    questions: [
      {
        prompt: "In perfect competition, a firm's marginal revenue equals:",
        options: ["Average cost", "Price", "Total revenue divided by two", "Marginal cost minus normal profit"],
        answer: 1,
        explain: "A price taker can sell any quantity at the market price without cutting it, so each extra unit adds exactly the price to revenue.",
      },
      {
        prompt: "Two firms each hold 50% of a market. The HHI is:",
        options: ["100", "2,500", "5,000", "10,000"],
        answer: 2,
        explain: "HHI = 50² + 50² = 2,500 + 2,500 = 5,000 — a highly concentrated market.",
      },
      {
        prompt: "Which feature most distinguishes monopolistic competition from perfect competition?",
        options: ["The number of firms", "Freedom of entry", "Product differentiation", "Profit maximisation"],
        answer: 2,
        explain: "Both have many firms and free entry. The difference is that products are differentiated, so each firm faces a downward-sloping demand curve of its own.",
      },
    ],
    related: ["costs-and-revenue", "elasticity", "business-strategy"],
  },
  {
    slug: "inflation",
    title: "Inflation",
    strand: "economics",
    unit: "The macroeconomy",
    summary: "What it measures, what causes it, and why the rate falling is not prices falling.",
    minutes: 9,
    explanation: [
      "Inflation is a sustained rise in the general price level, measured as the annual percentage change in a price index built from a basket of goods weighted by how much households actually spend on each. Two words in that sentence do a lot of work: 'sustained', which rules out a one-off jump, and 'general', which rules out one good getting dearer.",
      "Demand-pull inflation happens when aggregate demand grows faster than the economy's capacity to supply, so prices are bid up. Cost-push inflation happens when the cost of producing rises — imported energy, wages, a weaker exchange rate — and firms pass it on. The distinction matters because the policy response differs: raising interest rates addresses excess demand but does little about an oil shock except by crushing demand elsewhere.",
      "The costs of inflation are real but specific. It erodes the value of savings and fixed incomes; it redistributes from lenders to borrowers; it distorts decisions because relative prices become harder to read; and, if it becomes unpredictable, it discourages investment. Unexpected inflation is far more damaging than expected inflation, which is why central banks talk about anchoring expectations.",
      "Two pieces of vocabulary get confused constantly. Disinflation is a fall in the rate of inflation — prices still rising, just more slowly. Deflation is a fall in the price level itself, which brings its own problems: buyers delay purchases, real debt burdens rise, and the usual monetary tools work poorly.",
    ],
    definitions: [
      { term: "Inflation", meaning: "A sustained rise in the general price level of an economy." },
      { term: "Consumer price index (CPI)", meaning: "A weighted index of the price of a representative basket of household purchases." },
      { term: "Demand-pull inflation", meaning: "Inflation caused by aggregate demand growing faster than aggregate supply." },
      { term: "Cost-push inflation", meaning: "Inflation caused by rising costs of production being passed on in prices." },
      { term: "Disinflation", meaning: "A fall in the rate of inflation. Prices are still rising." },
      { term: "Deflation", meaning: "A sustained fall in the general price level." },
      { term: "Real value", meaning: "A nominal amount adjusted for inflation, so it measures purchasing power." },
    ],
    formulae: [
      { label: "Inflation rate", expression: "π = (CPI_this year − CPI_last year) ÷ CPI_last year × 100" },
      { label: "Real value", expression: "Real = nominal ÷ (price index ÷ 100)" },
      { label: "Real interest rate (approximation)", expression: "real ≈ nominal interest rate − inflation rate" },
    ],
    example:
      "If inflation falls from 9% to 4%, a shopper's bill is still rising — just less quickly. Someone whose wage rose 3% over the same year is still worse off in real terms, because 3% nominal growth against 4% inflation is a real fall of roughly 1%. This is why 'inflation is coming down' and 'things feel more expensive' are both true at the same time, and why the two get argued past each other.",
    activity: {
      label: "Look at an inflation series",
      href: "/data?indicator=FP.CPI.TOTL.ZG",
      description: "Plot consumer price inflation for a country and period, and read the year-on-year change.",
    },
    mistakes: [
      "Saying prices fell when the inflation rate fell. That is disinflation; prices only fall when inflation is negative.",
      "Comparing a nominal wage rise with nothing. Always compare it with inflation to get the real change.",
      "Assuming all inflation is demand-pull. Identify which it is before prescribing a policy.",
    ],
    questions: [
      {
        prompt: "Inflation falls from 6% to 2%. This means:",
        options: ["Prices have fallen", "Prices are rising more slowly", "The price level is unchanged", "The economy is in deflation"],
        answer: 1,
        explain: "A positive but lower inflation rate is disinflation. The price level is still rising, just at a slower pace.",
      },
      {
        prompt: "A worker's nominal wage rises 5% while inflation is 7%. Their real wage:",
        options: ["Rises by about 2%", "Falls by about 2%", "Rises by 12%", "Is unchanged"],
        answer: 1,
        explain: "Real change ≈ nominal change − inflation = 5% − 7% = −2%. Purchasing power fell.",
      },
      {
        prompt: "A sharp rise in world oil prices feeding into domestic prices is an example of:",
        options: ["Demand-pull inflation", "Cost-push inflation", "Disinflation", "Deflation"],
        answer: 1,
        explain: "The cause is a rise in production costs passed on to buyers, not excess demand.",
      },
    ],
    related: ["unemployment", "economic-growth", "exchange-rates"],
  },
  {
    slug: "unemployment",
    title: "Unemployment",
    strand: "economics",
    unit: "The macroeconomy",
    summary: "Who counts, what kinds there are, and why the rate can fall for a bad reason.",
    minutes: 9,
    explanation: [
      "The unemployment rate is the number of people without work who are available for and actively seeking it, as a percentage of the labour force. The labour force is everyone employed plus everyone unemployed — not the whole population. That definition has a consequence people find surprising: someone who stops looking for work stops being unemployed, and the rate falls, without anyone finding a job.",
      "Frictional unemployment is the short-term unemployment of people between jobs. It is unavoidable and, in moderation, a sign of a healthy labour market. Structural unemployment comes from a mismatch between the skills or locations of workers and the jobs available, and is the hardest kind to fix. Cyclical unemployment rises in a downturn when aggregate demand is weak. Seasonal unemployment follows the calendar.",
      "Naming the type is the whole point, because each responds to a different policy. Cyclical unemployment responds to demand-side policy — lower interest rates, higher government spending. Structural unemployment does not: retraining, relocation support and education are supply-side answers, and they work slowly.",
      "The costs are not only lost output. Long spells of unemployment erode skills and reduce future employability, a process called hysteresis, so a deep recession can raise unemployment permanently rather than temporarily.",
    ],
    definitions: [
      { term: "Labour force", meaning: "Everyone employed plus everyone unemployed and actively seeking work." },
      { term: "Unemployment rate", meaning: "The unemployed as a percentage of the labour force." },
      { term: "Frictional unemployment", meaning: "Short-term unemployment while moving between jobs." },
      { term: "Structural unemployment", meaning: "Unemployment from a mismatch of skills or location between workers and vacancies." },
      { term: "Cyclical unemployment", meaning: "Unemployment caused by a fall in aggregate demand during a downturn." },
      { term: "Discouraged worker", meaning: "Someone who has stopped looking for work and is therefore not counted as unemployed." },
      { term: "Participation rate", meaning: "The labour force as a percentage of the working-age population." },
    ],
    formulae: [
      { label: "Unemployment rate", expression: "u = unemployed ÷ labour force × 100" },
      { label: "Participation rate", expression: "participation = labour force ÷ working-age population × 100" },
    ],
    example:
      "A region loses its last large manufacturing employer. In the first months, workers are frictionally unemployed while looking for similar roles. A year later, those whose skills are specific to that industry and who cannot easily move are structurally unemployed, and the regional rate stays elevated even as the national economy recovers. A demand stimulus would help the second group much less than the first, which is why 'what type is it' has to come before 'what should be done'.",
    activity: {
      label: "Compare unemployment across countries",
      href: "/data?indicator=SL.UEM.TOTL.ZS",
      description: "Plot the unemployment rate over time and compare periods.",
    },
    mistakes: [
      "Using the whole population as the denominator. The rate is a share of the labour force.",
      "Reading a falling rate as good news without checking participation. Falling participation can mean discouraged workers left the count.",
      "Prescribing demand-side policy for structural unemployment.",
    ],
    questions: [
      {
        prompt: "A country has 1,000,000 employed and 80,000 unemployed. The unemployment rate is approximately:",
        options: ["8.0%", "7.4%", "80%", "Not calculable without the population"],
        answer: 1,
        explain: "Labour force = 1,080,000. Rate = 80,000 ÷ 1,080,000 = 7.4%.",
      },
      {
        prompt: "Unemployment caused by a mismatch between workers' skills and available jobs is:",
        options: ["Frictional", "Structural", "Cyclical", "Seasonal"],
        answer: 1,
        explain: "A skills or geographical mismatch is the definition of structural unemployment.",
      },
      {
        prompt: "The unemployment rate falls while the number of people in work is unchanged. The most likely explanation is:",
        options: ["More people found jobs", "Some unemployed people stopped looking for work", "Inflation fell", "The population grew"],
        answer: 1,
        explain: "People who stop actively seeking work leave the labour force and are no longer counted as unemployed, so the rate can fall with no new jobs.",
      },
    ],
    related: ["inflation", "economic-growth"],
  },
  {
    slug: "economic-growth",
    title: "Economic growth",
    strand: "economics",
    unit: "The macroeconomy",
    summary: "Actual versus potential growth, what drives each, and what GDP misses.",
    minutes: 9,
    explanation: [
      "Economic growth is usually measured as the annual percentage change in real GDP — 'real' meaning adjusted for inflation, so it captures a change in the volume of output rather than in prices. Comparing countries usually means GDP per capita, which divides by population.",
      "Actual growth is using existing capacity more fully — getting closer to the production possibility frontier. Potential growth is moving the frontier outward, which requires more or better factors of production: investment in capital, growth or skilling of the labour force, better technology, better institutions. A recovery from recession is mostly actual growth; a sustained rise in living standards over decades is potential growth.",
      "The benefits are real: higher incomes, more tax revenue for public services, usually lower unemployment. The costs are equally real: environmental damage, resource depletion, the possibility that the gains go mostly to those who already have most, and inflationary pressure if demand outpaces capacity.",
      "GDP is a measure of output, not of welfare. It omits unpaid household work and volunteering, counts spending on repairing damage as a positive, and says nothing about distribution or sustainability. Knowing what the number leaves out is part of knowing how to use it.",
    ],
    definitions: [
      { term: "Real GDP", meaning: "The value of output adjusted for price changes, so it measures volume." },
      { term: "Actual growth", meaning: "An increase in output using existing capacity more fully." },
      { term: "Potential growth", meaning: "An increase in the economy's productive capacity." },
      { term: "Production possibility frontier", meaning: "The combinations of goods an economy could produce using all its resources efficiently." },
      { term: "Recession", meaning: "Commonly defined as two consecutive quarters of falling real GDP." },
      { term: "Productivity", meaning: "Output per unit of input, most often per worker or per hour worked." },
    ],
    formulae: [
      { label: "Real GDP growth", expression: "g = (real GDP_this year − real GDP_last year) ÷ real GDP_last year × 100" },
      { label: "GDP per capita", expression: "GDP per capita = GDP ÷ population" },
      { label: "Rule of 70", expression: "Years to double ≈ 70 ÷ annual growth rate (%)" },
    ],
    example:
      "An economy growing at 2% a year doubles its output in about 35 years; at 4% it takes about 18. That gap looks small annually and enormous over a working lifetime, which is why economists care so much about the growth rate and why small, sustained differences in productivity growth matter more than large one-off changes in the level of output.",
    activity: {
      label: "Plot GDP growth",
      href: "/data?indicator=NY.GDP.MKTP.KD.ZG",
      description: "Chart annual real GDP growth for a country and read the cycle off the series.",
    },
    mistakes: [
      "Confusing a fall in the growth rate with a fall in output. Growth slowing from 3% to 1% is still growth.",
      "Comparing GDP between countries without adjusting for population, or for what a unit of currency buys locally.",
      "Treating GDP as a measure of wellbeing. It measures output, and knows nothing about distribution or sustainability.",
    ],
    questions: [
      {
        prompt: "Which of these raises potential rather than actual growth?",
        options: ["A fall in interest rates boosting consumer spending", "A rise in exports during a global boom", "Investment in training that raises workers' skills", "A drawdown of business stocks"],
        answer: 2,
        explain: "Training raises the economy's productive capacity, moving the frontier outwards. The others use existing capacity more fully.",
      },
      {
        prompt: "At 5% annual growth, roughly how long does output take to double?",
        options: ["7 years", "14 years", "20 years", "35 years"],
        answer: 1,
        explain: "By the rule of 70, 70 ÷ 5 = 14 years.",
      },
      {
        prompt: "Real GDP rises 3% while population rises 4%. GDP per capita:",
        options: ["Rises", "Falls", "Is unchanged", "Cannot be determined"],
        answer: 1,
        explain: "Output per person falls when population grows faster than output, even though total output rose.",
      },
    ],
    related: ["inflation", "unemployment", "exchange-rates"],
  },
  {
    slug: "exchange-rates",
    title: "Exchange rates",
    strand: "economics",
    unit: "The macroeconomy",
    summary: "What moves a currency, and what a weaker one does to trade and prices.",
    minutes: 9,
    explanation: [
      "An exchange rate is the price of one currency in terms of another, and like any price it is set by supply and demand. Demand for a currency comes from foreigners buying that country's exports, from investors buying its assets, and from speculators expecting it to rise. Supply comes from residents doing the same things abroad.",
      "Under a floating system the rate moves freely. A rise is an appreciation, a fall is a depreciation. Under a fixed or managed system the central bank intervenes, buying or selling its own currency from reserves, or changing interest rates to make holding it more or less attractive. A deliberate reduction of a fixed rate is a devaluation, not a depreciation — the words are not interchangeable.",
      "A depreciation makes exports cheaper abroad and imports dearer at home. Whether that improves the trade balance depends on elasticities: the Marshall–Lerner condition says it improves only if the combined price elasticities of demand for exports and imports exceed one. In the short run they often do not, because contracts and habits take time to change, which produces the J-curve — the balance worsens before it improves.",
      "The domestic cost of a depreciation is imported inflation. Everything bought from abroad, including inputs firms use, costs more in local currency, and that feeds through to consumer prices with a lag.",
    ],
    definitions: [
      { term: "Exchange rate", meaning: "The price of one currency expressed in another." },
      { term: "Appreciation", meaning: "A rise in a floating currency's value." },
      { term: "Depreciation", meaning: "A fall in a floating currency's value." },
      { term: "Devaluation", meaning: "A deliberate reduction in a fixed exchange rate by the authorities." },
      { term: "Marshall–Lerner condition", meaning: "A depreciation improves the current account only if the sum of export and import demand elasticities exceeds 1." },
      { term: "J-curve effect", meaning: "The tendency for a trade balance to worsen immediately after a depreciation before improving." },
    ],
    formulae: [
      { label: "Converting a price", expression: "Price in currency B = price in currency A × exchange rate (B per A)" },
      { label: "Marshall–Lerner", expression: "|PED exports| + |PED imports| > 1" },
    ],
    example:
      "Sterling falls from $1.40 to $1.20. A British software firm charging £100 now costs an American customer $120 instead of $140, so it becomes more competitive abroad. The same firm's imported servers and cloud services cost more in pounds. Which effect dominates depends on how much of its cost base is imported and how price-sensitive its overseas customers are — the same elasticity question, applied at the level of one business.",
    activity: null,
    mistakes: [
      "Using 'devaluation' for a floating currency's fall. A market-driven fall is a depreciation.",
      "Assuming a weaker currency always improves the trade balance. It depends on elasticities, and in the short run often does not.",
      "Forgetting the inflation cost. A depreciation that helps exporters also raises the price of every imported input.",
    ],
    questions: [
      {
        prompt: "The pound depreciates against the dollar. For a UK exporter selling to the US, this makes its goods:",
        options: ["More expensive in dollars", "Cheaper in dollars", "Unchanged in dollars", "Cheaper in pounds"],
        answer: 1,
        explain: "A weaker pound means each pound of the UK price converts into fewer dollars, so the dollar price falls and the exporter becomes more competitive.",
      },
      {
        prompt: "The Marshall–Lerner condition is about:",
        options: [
          "Whether a depreciation improves the current account",
          "Whether inflation will rise after a devaluation",
          "How central banks set interest rates",
          "The relationship between growth and unemployment",
        ],
        answer: 0,
        explain: "It states the elasticity condition under which a depreciation improves the current account balance.",
      },
      {
        prompt: "A currency's fall causes import prices to rise, feeding into domestic prices. This is:",
        options: ["Demand-pull inflation", "Imported (cost-push) inflation", "Disinflation", "Deflation"],
        answer: 1,
        explain: "The pressure comes from the cost side via dearer imports, which is a form of cost-push inflation.",
      },
    ],
    related: ["inflation", "economic-growth", "elasticity"],
  },

  /* ===================== BUSINESS ===================== */
  {
    slug: "business-objectives",
    title: "Business objectives",
    strand: "business",
    unit: "Business and its environment",
    summary: "What firms are actually trying to do, and why the answer is rarely just profit.",
    minutes: 8,
    explanation: [
      "The standard assumption is profit maximisation, and for many firms most of the time it is close enough. But it is an assumption, not an observation, and several common objectives are not it: survival, especially for a new business or in a downturn; growth in sales or market share, sometimes at the deliberate expense of short-run profit; and social or environmental objectives, which can be genuine, commercially motivated, or both.",
      "Objectives differ because control and ownership often differ. In a large company, managers make decisions but shareholders own the returns — the principal–agent problem. Managers may prefer growth, stability or size, which affect their own position, over the profit that would best serve owners. Recognising whose objective is being pursued explains a lot of otherwise puzzling corporate behaviour.",
      "A useful objective is specific enough to act on and to check. The SMART framework — specific, measurable, achievable, relevant, time-bound — is a checklist for that, and its real value is in turning 'improve customer service' into something you could tell whether you had achieved.",
      "Objectives also sit in a hierarchy. The mission says what the business is for; corporate objectives turn that into targets for the whole business; functional objectives turn those into targets for marketing, operations, finance and HR. When a functional target contradicts a corporate one — a sales team paid on volume while the company is chasing margin — the business will follow the incentive, not the mission statement.",
    ],
    definitions: [
      { term: "Mission statement", meaning: "A short statement of a business's purpose and what makes it distinct." },
      { term: "Corporate objective", meaning: "A medium-term goal for the whole business, derived from the mission." },
      { term: "SMART objective", meaning: "One that is specific, measurable, achievable, relevant and time-bound." },
      { term: "Profit satisficing", meaning: "Aiming for a satisfactory rather than maximum level of profit, common where owners and managers differ." },
      { term: "Principal–agent problem", meaning: "The conflict arising when those who make decisions are not those who bear the consequences." },
      { term: "Stakeholder", meaning: "Any group affected by a business's activity — owners, employees, customers, suppliers, community." },
    ],
    formulae: [
      { label: "Market share", expression: "Market share = firm's sales ÷ total market sales × 100" },
      { label: "Sales growth", expression: "Growth = (sales this year − sales last year) ÷ sales last year × 100" },
    ],
    example:
      "A subscription business deliberately prices below cost for its first two years to build a user base, accepting losses in exchange for share and for the switching costs that come with an established habit. Judged against profit maximisation this year, the strategy looks like a failure. Judged against a growth objective with a stated horizon, it may be working exactly as planned. You cannot evaluate a decision without knowing the objective it was taken against — which is why 'what is the business trying to do?' is the first question in any case study.",
    activity: {
      label: "Test an objective against the numbers",
      href: "/tools",
      description: "Use the pricing and break-even calculators to see what a growth objective costs in profit.",
    },
    mistakes: [
      "Assuming every firm maximises profit, then treating any other behaviour as irrational.",
      "Writing objectives with no measure or deadline. 'Increase customer satisfaction' cannot be assessed.",
      "Confusing the mission with an objective. A mission is a direction; an objective is a target with a number and a date.",
    ],
    questions: [
      {
        prompt: "Which of these is a SMART objective?",
        options: [
          "To be the best in the industry",
          "To increase online sales by 15% by 31 December",
          "To improve quality",
          "To grow as fast as possible",
        ],
        answer: 1,
        explain: "It is specific, measurable, plausibly achievable, relevant and time-bound. The others give nothing to measure against.",
      },
      {
        prompt: "The principal–agent problem arises because:",
        options: [
          "Customers know less than sellers",
          "Managers who make decisions are not the owners who bear the consequences",
          "Firms cannot forecast demand",
          "Employees are paid fixed wages",
        ],
        answer: 1,
        explain: "It is the divergence of interest between owners (principals) and the managers (agents) acting on their behalf.",
      },
      {
        prompt: "A business accepts lower profit now to win market share. This is best described as:",
        options: ["Profit maximisation", "A growth objective", "Profit satisficing", "Survival"],
        answer: 1,
        explain: "Trading current profit for share is a growth objective, usually justified by expected future returns.",
      },
    ],
    related: ["business-strategy", "profitability", "entrepreneurship"],
  },
  {
    slug: "marketing",
    title: "Marketing",
    strand: "business",
    unit: "Marketing",
    summary: "Segmentation, positioning and the marketing mix — and why price is the only one that earns money.",
    minutes: 10,
    explanation: [
      "Marketing starts with deciding who you are selling to. Segmentation splits a market by characteristics that predict buying behaviour — demographic, geographic, behavioural, psychographic. Targeting picks which segments to serve. Positioning decides what you want to be in the customer's mind relative to rivals, and it is a choice about being different, not about being better at everything.",
      "The marketing mix is the set of decisions that follow: product, price, promotion and place, extended for services with people, process and physical evidence. The mix has to be internally consistent — a premium price with discount-channel distribution and bargain packaging sends three contradictory signals, and the customer believes the cheapest one.",
      "Price deserves particular attention because it is the only element of the mix that generates revenue; every other element costs money. It is also the fastest to change and the easiest to get wrong. Pricing strategies include cost-plus (add a margin to unit cost), penetration (price low to win share), skimming (price high to early adopters then lower), and competitive or dynamic pricing. Each carries an assumption about elasticity that is worth making explicit and testing.",
      "Market research supports all of this. Primary research is collected first-hand for your question — surveys, interviews, experiments — and is expensive but exactly relevant. Secondary research already exists and is cheap but was collected for someone else's purpose. Both have sampling and bias problems worth stating rather than glossing over.",
    ],
    definitions: [
      { term: "Market segmentation", meaning: "Dividing a market into groups with distinct needs or behaviours." },
      { term: "Positioning", meaning: "The place a product occupies in the customer's mind relative to competitors." },
      { term: "Marketing mix", meaning: "The combination of product, price, promotion and place (plus people, process, physical evidence for services)." },
      { term: "Penetration pricing", meaning: "Setting a low initial price to win market share quickly." },
      { term: "Price skimming", meaning: "Setting a high initial price to capture buyers who value the product most, then lowering it." },
      { term: "Cost-plus pricing", meaning: "Setting price by adding a fixed margin to unit cost." },
      { term: "USP", meaning: "Unique selling point — the reason a customer chooses you over the alternative." },
    ],
    formulae: [
      { label: "Cost-plus price", expression: "Price = unit cost × (1 + mark-up)" },
      { label: "Mark-up on cost", expression: "Mark-up = (price − cost) ÷ cost" },
      { label: "Margin on price", expression: "Margin = (price − cost) ÷ price", note: "A 50% mark-up is a 33% margin. They are not the same number." },
      { label: "Market share", expression: "Share = firm's sales ÷ total market sales × 100" },
    ],
    example:
      "A new coffee shop prices a flat white at £3.60 by adding a 60% mark-up to its £2.25 unit cost. Cost-plus is simple, but it contains no information about what customers will pay or what rivals charge — it is arithmetic dressed as a strategy. The shop next door charges £3.20 and is busy; a survey of 40 nearby office workers suggests most would switch for a 30p difference. That implies fairly elastic demand, which is a reason to price competitively rather than on cost. The test of a pricing decision is whether it was informed by demand, not whether the arithmetic was right.",
    activity: {
      label: "Compare pricing strategies",
      href: "/tools",
      description: "Put a low, medium and high price side by side and see what each does to revenue and profit.",
    },
    mistakes: [
      "Confusing mark-up with margin. A 50% mark-up on cost is a 33% margin on price.",
      "Treating cost-plus pricing as customer-focused. It ignores both demand and competitors.",
      "Generalising from a small convenience sample. Forty people outside one office is not the market.",
    ],
    questions: [
      {
        prompt: "A product costs £20 to make and sells for £25. The margin on price is:",
        options: ["25%", "20%", "5%", "125%"],
        answer: 1,
        explain: "Margin = (25 − 20) ÷ 25 = 20%. The mark-up on cost would be 5 ÷ 20 = 25%.",
      },
      {
        prompt: "Launching at a deliberately low price to build market share quickly is:",
        options: ["Price skimming", "Penetration pricing", "Cost-plus pricing", "Predatory pricing"],
        answer: 1,
        explain: "Penetration pricing sacrifices early margin to win volume and establish a position.",
      },
      {
        prompt: "Primary market research is best described as:",
        options: [
          "Data that already exists, collected by someone else",
          "Data collected first-hand for your specific question",
          "Data from government statistics",
          "Data about your main competitor",
        ],
        answer: 1,
        explain: "Primary research is original data gathered for your own purpose; secondary research already exists.",
      },
    ],
    related: ["business-strategy", "elasticity", "profitability"],
  },
  {
    slug: "break-even-analysis",
    title: "Break-even analysis",
    strand: "business",
    unit: "Finance and accounting",
    summary: "The quantity that covers your costs, and the three ways the calculation misleads.",
    minutes: 9,
    explanation: [
      "Break-even is the output at which total revenue exactly equals total cost, so profit is zero. The mechanism is contribution: each unit sold contributes its selling price less its own variable cost towards covering the fixed costs. Divide fixed costs by contribution per unit and you have the number of units needed.",
      "The margin of safety is how far current or forecast output sits above break-even, usually as a percentage of output. It answers the question a break-even figure on its own does not: how much could sales fall before this business is in trouble?",
      "The calculation fails in one specific case, and it is worth knowing why rather than just seeing an error. If the selling price is at or below variable cost, contribution is zero or negative and there is no break-even quantity at all — every additional unit makes the loss larger. Software that returns a negative break-even quantity here is telling you something false; the honest answer is that the question has no solution until price or variable cost changes.",
      "Break-even is genuinely useful for a quick feasibility check and for comparing options. It is not a forecast. It assumes costs are linear, that everything produced is sold at one price, and that the cost split into fixed and variable is clean — three assumptions that are approximately true for a simple business and increasingly false as one grows.",
    ],
    definitions: [
      { term: "Contribution per unit", meaning: "Selling price minus variable cost per unit — what each sale contributes to fixed costs and profit." },
      { term: "Break-even point", meaning: "The output at which total revenue equals total cost, so profit is zero." },
      { term: "Margin of safety", meaning: "The amount by which actual or forecast output exceeds the break-even output." },
      { term: "Total contribution", meaning: "Contribution per unit multiplied by units sold." },
    ],
    formulae: [
      { label: "Contribution per unit", expression: "Contribution = selling price − variable cost per unit" },
      { label: "Break-even quantity", expression: "BEQ = fixed costs ÷ contribution per unit", note: "Undefined when contribution is zero or negative." },
      { label: "Break-even revenue", expression: "Break-even revenue = BEQ × selling price" },
      { label: "Margin of safety", expression: "MoS = (actual output − BEQ) ÷ actual output × 100" },
      { label: "Target profit output", expression: "Q = (fixed costs + target profit) ÷ contribution per unit" },
    ],
    example:
      "A market stall pays £180 a week in pitch fees and £4.20 in ingredients per box, selling at £7.50. Contribution is £3.30, so break-even is 180 ÷ 3.30 = 55 boxes a week. Selling 90 gives a margin of safety of 39%. Now the pitch fee rises to £240: break-even moves to 73 boxes, and the margin of safety falls to 19% — a much more fragile business from a change that touched neither price nor ingredients. Break-even analysis is at its most useful exactly here, showing how sensitive viability is to one number.",
    activity: {
      label: "Find a break-even point",
      href: "/tools",
      description: "Enter fixed costs, price and variable cost, and see the break-even quantity, revenue and margin of safety.",
    },
    mistakes: [
      "Including variable costs in the fixed cost figure, or vice versa. Sort every cost by whether it changes with output.",
      "Reporting a break-even quantity when price is below variable cost. There isn't one.",
      "Treating break-even as a target. It is the point at which you stop losing money, not a goal.",
    ],
    questions: [
      {
        prompt: "Fixed costs are £12,000, price £30, variable cost £18. Break-even output is:",
        options: ["400 units", "667 units", "1,000 units", "1,200 units"],
        answer: 2,
        explain: "Contribution = 30 − 18 = £12. BEQ = 12,000 ÷ 12 = 1,000 units.",
      },
      {
        prompt: "A business sells at £9 with a variable cost of £11 per unit. Its break-even output is:",
        options: ["Zero", "Fixed costs ÷ 2", "There is none — every unit increases the loss", "Infinite but calculable"],
        answer: 2,
        explain: "Contribution is negative, so no quantity ever covers fixed costs. Price or variable cost has to change first.",
      },
      {
        prompt: "Output is 5,000 and break-even is 4,000. The margin of safety is:",
        options: ["20%", "25%", "80%", "1,000%"],
        answer: 0,
        explain: "MoS = (5,000 − 4,000) ÷ 5,000 = 20%.",
      },
    ],
    related: ["costs-and-revenue", "profitability", "finance"],
  },
  {
    slug: "profitability",
    title: "Profitability",
    strand: "business",
    unit: "Finance and accounting",
    summary: "Three margins, what each one isolates, and why profit is not cash.",
    minutes: 9,
    explanation: [
      "Profit is revenue minus costs, but which costs you subtract changes what the number tells you. Gross profit subtracts only the direct cost of the goods sold, so the gross margin measures how much is left after making the thing — it is about pricing and production efficiency. Operating profit also subtracts overheads, so the operating margin measures how well the business is run. Net profit subtracts interest and tax as well, and is what is actually left for the owners.",
      "A margin is more informative than a profit figure, because it is comparable. £50,000 of profit says nothing until you know whether it came from £200,000 or £5m of revenue. Comparing margins across years, or against a competitor of a different size, is where the analysis actually happens.",
      "Return on capital employed goes one step further and asks what the profit is relative to the money tied up in generating it. A business earning a 4% return on capital when a savings account pays 5% is destroying value regardless of how the profit figure looks.",
      "The most important distinction in this whole topic: profit is not cash. A sale made on credit is profit today and cash in ninety days; a machine bought for cash is an asset, not an expense. Profitable businesses fail regularly because the cash to pay this month's wages had not arrived yet, which is why cash flow forecasting sits alongside profitability rather than beneath it.",
    ],
    definitions: [
      { term: "Gross profit", meaning: "Revenue minus the cost of goods sold." },
      { term: "Operating profit", meaning: "Gross profit minus operating expenses (overheads)." },
      { term: "Net profit", meaning: "Operating profit minus interest and tax — what is left for owners." },
      { term: "Profit margin", meaning: "Profit as a percentage of revenue." },
      { term: "Return on capital employed (ROCE)", meaning: "Operating profit as a percentage of the capital used to generate it." },
      { term: "Liquidity", meaning: "The ability to meet short-term obligations as they fall due." },
    ],
    formulae: [
      { label: "Gross profit margin", expression: "Gross margin = gross profit ÷ revenue × 100" },
      { label: "Operating profit margin", expression: "Operating margin = operating profit ÷ revenue × 100" },
      { label: "Net profit margin", expression: "Net margin = net profit ÷ revenue × 100" },
      { label: "ROCE", expression: "ROCE = operating profit ÷ capital employed × 100" },
      { label: "Current ratio", expression: "Current ratio = current assets ÷ current liabilities" },
    ],
    example:
      "Two shops both report £60,000 net profit. One turns over £400,000, a 15% net margin; the other turns over £2m, a 3% net margin. The second is far more exposed — a 3% rise in costs wipes out its entire profit, while the first can absorb it. The absolute profit figures are identical and tell you almost nothing. This is the single strongest argument for always converting a profit to a margin before drawing a conclusion from it.",
    activity: {
      label: "Calculate margins",
      href: "/tools",
      description: "Use the pricing calculator to see revenue, profit and margin move together as you change price and cost.",
    },
    mistakes: [
      "Comparing absolute profits between businesses of different sizes.",
      "Using net margin to judge operational efficiency. Interest and tax depend on financing and jurisdiction, not on how well the business is run.",
      "Assuming a profitable business has cash. Profit and cash are different statements for a reason.",
    ],
    questions: [
      {
        prompt: "Revenue £500,000, cost of sales £300,000, overheads £120,000. The operating profit margin is:",
        options: ["16%", "40%", "24%", "60%"],
        answer: 0,
        explain: "Gross profit = 200,000; operating profit = 200,000 − 120,000 = 80,000. Margin = 80,000 ÷ 500,000 = 16%.",
      },
      {
        prompt: "Which measure best isolates how efficiently a business is run, before financing decisions?",
        options: ["Gross margin", "Operating margin", "Net margin", "Revenue growth"],
        answer: 1,
        explain: "Operating margin includes overheads but excludes interest and tax, which reflect financing and jurisdiction rather than operations.",
      },
      {
        prompt: "A profitable business runs out of money to pay wages. The most likely cause is:",
        options: ["Its margins are too high", "A liquidity problem — cash has not arrived yet", "Its revenue fell", "It paid too little tax"],
        answer: 1,
        explain: "Profit is recognised when a sale is made, not when cash is received. A business can be profitable and illiquid at the same time.",
      },
    ],
    related: ["break-even-analysis", "finance", "costs-and-revenue"],
  },
  {
    slug: "finance",
    title: "Business finance",
    strand: "business",
    unit: "Finance and accounting",
    summary: "Where the money comes from, what each source costs, and why cash flow kills first.",
    minutes: 9,
    explanation: [
      "Sources of finance split into internal — retained profit, selling assets, tighter working capital — and external. External splits again into debt (loans, overdrafts, bonds, leasing) and equity (issuing shares, venture capital). Each has a cost, and the costs are not all monetary: debt costs interest and must be repaid on a schedule; equity costs a share of future profits and usually some control.",
      "The right source depends on what the money is for and how long it is needed. Long-term assets should be funded long-term; using an overdraft to buy a building is a classic mismatch that ends badly. Short-term gaps in working capital are what overdrafts and trade credit are for.",
      "Cash flow forecasting is the discipline of predicting when money actually moves, as opposed to when a sale is recorded. Most young businesses fail from running out of cash rather than from being unprofitable, and the gap between the two is created by the ordinary business of giving customers thirty days to pay while suppliers want paying in fourteen.",
      "Working capital is current assets minus current liabilities — the money circulating in day-to-day operations. Managing it means collecting receivables faster, holding less stock, and negotiating longer payment terms. It is unglamorous and it is often where a struggling business finds the most room.",
    ],
    definitions: [
      { term: "Retained profit", meaning: "Profit kept in the business rather than distributed. The cheapest source of finance, but limited." },
      { term: "Working capital", meaning: "Current assets minus current liabilities — the funds available for day-to-day operations." },
      { term: "Trade credit", meaning: "Buying from suppliers now and paying later — in effect an interest-free short-term loan." },
      { term: "Overdraft", meaning: "A facility to go negative on a bank account up to a limit. Flexible and expensive." },
      { term: "Equity finance", meaning: "Raising money by selling a share of ownership." },
      { term: "Gearing", meaning: "The proportion of capital that is debt rather than equity. High gearing raises both risk and potential return." },
      { term: "Cash flow forecast", meaning: "A projection of cash receipts and payments over a period, used to spot shortfalls in advance." },
    ],
    formulae: [
      { label: "Working capital", expression: "Working capital = current assets − current liabilities" },
      { label: "Net cash flow", expression: "Net cash flow = cash inflows − cash outflows" },
      { label: "Closing balance", expression: "Closing balance = opening balance + net cash flow" },
      { label: "Gearing ratio", expression: "Gearing = non-current liabilities ÷ (non-current liabilities + equity) × 100" },
    ],
    example:
      "A supplier to retailers wins a large order: £80,000 of goods to be delivered in March, payable in 60 days. The materials cost £48,000 and must be paid for in February. On the profit statement March looks excellent. In the cash flow forecast, February shows a £48,000 outflow and no inflow until May. If the closing balance goes negative in February, the order that made the year could also end the business — which is why the forecast is built month by month on cash, not on sales.",
    activity: {
      label: "Model the cost side",
      href: "/experiments/profit",
      description: "See how fixed costs, variable costs and marketing spend combine before any of them is financed.",
    },
    mistakes: [
      "Funding a long-term asset with short-term finance.",
      "Treating a cash flow forecast as a profit forecast. They answer different questions.",
      "Assuming equity is free because there is no interest. It costs a permanent share of future profits.",
    ],
    questions: [
      {
        prompt: "Opening balance £4,000, inflows £22,000, outflows £27,000. The closing balance is:",
        options: ["−£1,000", "£1,000", "−£5,000", "£9,000"],
        answer: 0,
        explain: "Net cash flow = 22,000 − 27,000 = −5,000. Closing = 4,000 − 5,000 = −£1,000.",
      },
      {
        prompt: "Which is an internal source of finance?",
        options: ["Bank loan", "Retained profit", "Venture capital", "Trade credit"],
        answer: 1,
        explain: "Retained profit comes from within the business. The others all come from outside it.",
      },
      {
        prompt: "A highly geared business is one that:",
        options: ["Has high profit margins", "Relies heavily on debt relative to equity", "Holds a lot of stock", "Has many shareholders"],
        answer: 1,
        explain: "Gearing measures debt as a proportion of total capital. High gearing raises both risk and potential return to equity.",
      },
    ],
    related: ["profitability", "break-even-analysis", "entrepreneurship"],
  },
  {
    slug: "operations",
    title: "Operations management",
    strand: "business",
    unit: "Operations management",
    summary: "Turning inputs into outputs — productivity, capacity, quality and stock.",
    minutes: 8,
    explanation: [
      "Operations is the function that converts inputs into the product or service a customer receives. Its central measures are productivity (output per unit of input), capacity utilisation (how much of what you could produce you actually are), quality, and cost per unit.",
      "Capacity utilisation has a trade-off that students often miss. Running near 100% spreads fixed costs over the most units, so unit cost falls — but it leaves no slack for maintenance, for a rush order, or for a machine breaking, and it tends to raise stress and error rates. Very low utilisation wastes fixed cost. Most businesses aim for somewhere in the high eighties or low nineties.",
      "Quality management has moved from inspecting defects out at the end to building them out of the process — total quality management, quality assurance, continuous improvement. The economic argument is simple: a defect found by a customer costs far more than the same defect found at the workstation that created it.",
      "Stock control balances the cost of holding inventory against the cost of not having it. Just-in-time minimises holding costs and frees up capital, but leaves no buffer when a supplier fails — a trade-off that global supply disruptions have made very concrete. Just-in-case does the opposite. Neither is right in general; the right answer depends on how costly a stockout is and how reliable supply is.",
    ],
    definitions: [
      { term: "Productivity", meaning: "Output per unit of input, most commonly output per worker or per hour." },
      { term: "Capacity utilisation", meaning: "Actual output as a percentage of maximum possible output." },
      { term: "Just-in-time (JIT)", meaning: "Holding minimal stock and receiving inputs as they are needed." },
      { term: "Quality assurance", meaning: "Building quality into the process rather than inspecting for defects afterwards." },
      { term: "Economies of scale", meaning: "Falls in average cost as output rises, from bulk buying, specialisation or spreading fixed costs." },
      { term: "Lean production", meaning: "Systematically removing activity that does not add value for the customer." },
    ],
    formulae: [
      { label: "Labour productivity", expression: "Productivity = total output ÷ number of workers" },
      { label: "Capacity utilisation", expression: "Utilisation = actual output ÷ maximum output × 100" },
      { label: "Unit cost", expression: "Unit cost = total cost ÷ output" },
    ],
    example:
      "A bakery with a maximum of 1,200 loaves a day bakes 900, a utilisation of 75%. Fixed costs of £450 a day spread over 900 loaves is £0.50 each; at 1,100 it would be £0.41. The £0.09 saving looks like free money until you notice that at 1,100 there is no oven time left for the wholesale order that arrives twice a week, and no slack if an oven fails. The right utilisation is the one that leaves enough slack for the variability the business actually faces — which is an empirical question about this bakery, not a rule.",
    activity: null,
    mistakes: [
      "Treating 100% capacity utilisation as the goal. It minimises unit cost and maximises fragility.",
      "Confusing productivity with production. Production is total output; productivity is output per input.",
      "Presenting JIT as strictly better than holding stock. It transfers risk to the supply chain.",
    ],
    questions: [
      {
        prompt: "A factory can produce 2,000 units a week and produces 1,500. Capacity utilisation is:",
        options: ["50%", "66%", "75%", "133%"],
        answer: 2,
        explain: "1,500 ÷ 2,000 = 75%.",
      },
      {
        prompt: "The main risk of just-in-time stock control is:",
        options: ["High storage costs", "Obsolete stock", "Vulnerability to supply disruption", "Excess working capital"],
        answer: 2,
        explain: "With minimal buffer stock, a late or failed delivery stops production immediately.",
      },
      {
        prompt: "Output rises from 800 to 900 units with the same 20 workers. Labour productivity:",
        options: ["Rises from 40 to 45 units per worker", "Falls", "Is unchanged", "Cannot be calculated"],
        answer: 0,
        explain: "800 ÷ 20 = 40; 900 ÷ 20 = 45 units per worker.",
      },
    ],
    related: ["costs-and-revenue", "profitability", "business-strategy"],
  },
  {
    slug: "human-resources",
    title: "Human resources",
    strand: "business",
    unit: "People in organisations",
    summary: "Motivation, structure and leadership — the parts of a business that are people.",
    minutes: 8,
    explanation: [
      "Human resource management covers recruiting, developing, organising and motivating people. The theories worth knowing are not competing answers to one question; they answer different questions. Maslow arranges needs in a hierarchy and says a satisfied need stops motivating. Herzberg separates hygiene factors — pay, conditions, supervision — which cause dissatisfaction when poor but do not motivate when good, from motivators like achievement, recognition and responsibility. Taylor's scientific management assumes money is the motivator and designs work accordingly.",
      "The practical conclusion from Herzberg is the one most often misapplied: raising pay fixes dissatisfaction, not motivation. A business with a retention problem caused by dull work will not solve it with a bonus, and will have spent the money.",
      "Organisational structure — how many layers, how wide each manager's span of control, how much authority is delegated — shapes how fast decisions are made and how well information travels. Tall structures give close supervision and clear progression but slow communication; flat structures speed it up and push responsibility down, which works when people are capable and trusted, and badly when they are not.",
      "Leadership style interacts with all of this. Autocratic decision-making is fast and works in a crisis; democratic styles are slower but produce better commitment to the decision; laissez-faire works with experts and fails with novices. The useful claim is contingent: the right style depends on the task, the people and the time available.",
    ],
    definitions: [
      { term: "Motivation", meaning: "The internal drive to act towards a goal, and in a workplace, to work effectively." },
      { term: "Hygiene factors", meaning: "Herzberg's term for conditions whose absence dissatisfies but whose presence does not motivate." },
      { term: "Span of control", meaning: "The number of people directly reporting to one manager." },
      { term: "Delegation", meaning: "Passing authority to carry out a task down the hierarchy, while accountability remains." },
      { term: "Labour turnover", meaning: "The rate at which employees leave and are replaced." },
      { term: "Job enrichment", meaning: "Redesigning a role to include more responsibility and scope, to make it motivating in itself." },
    ],
    formulae: [
      { label: "Labour turnover", expression: "Turnover = leavers in a period ÷ average number employed × 100" },
      { label: "Absenteeism rate", expression: "Absence = days lost ÷ total working days available × 100" },
      { label: "Labour productivity", expression: "Output ÷ number of employees" },
    ],
    example:
      "A call centre with 45% annual labour turnover raises pay by 8% and sees turnover fall to 38% for two quarters, then drift back. Exit interviews mention monotony, no control over calls, and no route to anything else. In Herzberg's terms the pay rise addressed a hygiene factor, which removed a source of dissatisfaction but added no motivator. Job enrichment — broader responsibility, ownership of a customer relationship, a visible path to a different role — addresses the actual complaint, and costs less than the pay rise did.",
    activity: null,
    mistakes: [
      "Treating pay as the answer to every motivation problem.",
      "Confusing a wide span of control with a flat structure. The span is one manager's reports; the structure is the number of layers.",
      "Presenting one leadership style as universally best rather than fitting it to the situation.",
    ],
    questions: [
      {
        prompt: "In Herzberg's theory, improving pay and working conditions will:",
        options: ["Motivate strongly", "Reduce dissatisfaction without motivating", "Have no effect", "Reduce productivity"],
        answer: 1,
        explain: "Pay and conditions are hygiene factors: poor ones dissatisfy, but improving them removes dissatisfaction rather than creating motivation.",
      },
      {
        prompt: "30 staff leave during a year from an average workforce of 120. Labour turnover is:",
        options: ["4%", "25%", "30%", "40%"],
        answer: 1,
        explain: "30 ÷ 120 = 25%.",
      },
      {
        prompt: "A flat organisational structure typically has:",
        options: ["Many layers and narrow spans of control", "Few layers and wide spans of control", "Many layers and wide spans", "No delegation"],
        answer: 1,
        explain: "Fewer layers of hierarchy mean each manager has more direct reports — a wider span of control.",
      },
    ],
    related: ["business-objectives", "operations", "business-strategy"],
  },
  {
    slug: "business-strategy",
    title: "Business strategy",
    strand: "business",
    unit: "Strategic management",
    summary: "Choosing where to compete and how — and the tools that structure that choice.",
    minutes: 9,
    explanation: [
      "Strategy is the set of choices about where a business competes and how it intends to win there. It is distinguished from tactics by scope and reversibility: a price promotion is a tactic, a decision to be the low-cost operator in a segment is a strategy.",
      "The analytical tools are frameworks for organising evidence, not for generating answers. SWOT sorts what you know into internal strengths and weaknesses and external opportunities and threats — its weakness is that it invites lists rather than judgements. PESTLE structures the external environment into political, economic, social, technological, legal and environmental factors. Porter's five forces assesses how much profit an industry is likely to allow, by looking at rivalry, new entrants, substitutes, and the bargaining power of buyers and suppliers.",
      "Porter's generic strategies frame the core choice: cost leadership, differentiation, or focus on a narrow segment with either. The warning attached is that trying to be both cheapest and most distinctive usually results in being neither, though there are well-known exceptions and the claim is contested.",
      "Ansoff's matrix frames growth options by combining existing or new products with existing or new markets: market penetration, product development, market development and diversification, in roughly ascending order of risk. It is useful precisely because it makes the risk ordering explicit — diversification asks a business to learn two unfamiliar things at once.",
    ],
    definitions: [
      { term: "Strategy", meaning: "The long-term direction and scope of a business, and how it intends to compete." },
      { term: "SWOT analysis", meaning: "A framework sorting internal strengths and weaknesses from external opportunities and threats." },
      { term: "PESTLE analysis", meaning: "A framework for the external environment: political, economic, social, technological, legal, environmental." },
      { term: "Porter's five forces", meaning: "A framework assessing industry attractiveness through rivalry, entrants, substitutes and buyer and supplier power." },
      { term: "Cost leadership", meaning: "Competing by having the lowest cost base in the industry." },
      { term: "Differentiation", meaning: "Competing by offering something buyers value enough to pay more for." },
      { term: "Ansoff's matrix", meaning: "A framework for growth options across existing and new products and markets." },
    ],
    formulae: [
      { label: "Market growth rate", expression: "Growth = (market size this year − last year) ÷ last year × 100" },
      { label: "Relative market share", expression: "Your share ÷ largest competitor's share" },
    ],
    example:
      "An independent bookshop cannot win on cost against an online retailer with vastly greater scale — cost leadership is not available to it. What is available is focus plus differentiation: a narrow segment, deep curation, events, staff who have read the stock, and a physical experience that cannot be delivered by post. The strategic insight is not 'be different for its own sake' but 'compete where your structural disadvantage does not apply', which is what the five forces analysis is for.",
    activity: {
      label: "Model competitive pricing",
      href: "/experiments/competition",
      description: "See how price and non-price competitiveness trade off against each other in a simplified market.",
    },
    mistakes: [
      "Producing a SWOT list and stopping. The analysis is in what follows from it.",
      "Putting an external factor in 'strengths' or an internal one in 'opportunities'. Internal versus external is the whole structure.",
      "Recommending diversification casually. It is the highest-risk quadrant of the Ansoff matrix for good reason.",
    ],
    questions: [
      {
        prompt: "Selling an existing product into a new geographical market is, in Ansoff's matrix:",
        options: ["Market penetration", "Product development", "Market development", "Diversification"],
        answer: 2,
        explain: "Existing product, new market is market development. New product into a new market would be diversification.",
      },
      {
        prompt: "Which of the five forces is strongest when buyers are few, large and well informed?",
        options: ["Threat of new entrants", "Bargaining power of buyers", "Threat of substitutes", "Supplier power"],
        answer: 1,
        explain: "Concentrated, informed buyers can push prices down, which is exactly high buyer bargaining power.",
      },
      {
        prompt: "In a SWOT analysis, a new competitor entering the market is:",
        options: ["A weakness", "A threat", "An opportunity", "A strength"],
        answer: 1,
        explain: "It is external and unfavourable, which makes it a threat. Weaknesses are internal.",
      },
    ],
    related: ["market-structures", "business-objectives", "marketing"],
  },
  {
    slug: "entrepreneurship",
    title: "Entrepreneurship",
    strand: "business",
    unit: "Business and its environment",
    summary: "What an entrepreneur actually does, and why most new businesses fail for the same few reasons.",
    minutes: 8,
    explanation: [
      "An entrepreneur organises the other factors of production and bears the risk of the venture. The economic function is risk-bearing and coordination, not invention: plenty of successful businesses are built on somebody else's idea, executed better or aimed at a market the originator missed.",
      "Opportunity recognition usually comes from noticing a problem that people already pay to work around, rather than from a flash of originality. The discipline that follows is testing whether the problem is real and widespread before committing money — a small, honest test with real potential customers beats a confident forecast every time.",
      "The failure causes are consistent and boring: running out of cash, misjudging demand, underpricing, and expanding faster than the operation or the working capital can support. Every one of them is a question a business plan is supposed to force you to answer with a number rather than an adjective.",
      "A business plan is a thinking tool first and a fundraising document second. Its most valuable sections are the ones people skip: the cash flow forecast month by month, the break-even calculation, and an honest list of what has to be true for the plan to work. Those are also the sections a careful reader turns to first.",
    ],
    definitions: [
      { term: "Entrepreneur", meaning: "Someone who organises factors of production and bears the risk of a business venture." },
      { term: "Opportunity cost", meaning: "The value of the next best alternative given up — for a founder, usually the salary not earned." },
      { term: "Business plan", meaning: "A document setting out the business idea, market, operations and financial forecasts." },
      { term: "Start-up capital", meaning: "The money needed to get a business to the point where it can fund itself." },
      { term: "Limited liability", meaning: "A legal structure in which owners' losses are capped at what they invested." },
      { term: "Unlimited liability", meaning: "A structure where the owner is personally liable for all business debts, as in a sole trader." },
    ],
    formulae: [
      { label: "Start-up break-even", expression: "BEQ = fixed costs ÷ (price − variable cost)" },
      { label: "Runway", expression: "Runway (months) = cash available ÷ net monthly cash outflow" },
      { label: "Founder's opportunity cost", expression: "Salary forgone + return forgone on capital invested" },
    ],
    example:
      "A student launches a print-on-demand clothing brand with £900. Unit cost is £11, price £24, and a website and initial marketing cost £600 up front. Contribution is £13 a unit, so break-even is 600 ÷ 13 ≈ 47 items — a concrete, testable target rather than a hope. With £300 left, the runway question becomes: can 47 items be sold before the remaining cash covering listing fees and returns runs out? Framing the launch as those two numbers is more useful than any amount of forecasting, and both can be checked against reality within a month.",
    activity: {
      label: "Build the numbers for a venture",
      href: "/tools",
      description: "Use the pricing, break-even and scenario tools to turn an idea into a set of figures you can defend.",
    },
    mistakes: [
      "Ignoring the founder's own opportunity cost. A business that pays you less than the job you gave up is not yet profitable in economic terms.",
      "Forecasting revenue optimistically and costs precisely. Both deserve the same scepticism.",
      "Confusing a large market with an addressable one. The relevant number is who you can actually reach and serve.",
    ],
    questions: [
      {
        prompt: "The most common immediate cause of new business failure is:",
        options: ["Poor product design", "Running out of cash", "Excessive competition", "Regulation"],
        answer: 1,
        explain: "Whatever the underlying problem, the event that ends most young businesses is being unable to meet obligations as they fall due.",
      },
      {
        prompt: "A sole trader has unlimited liability. This means:",
        options: [
          "They can raise unlimited finance",
          "Their personal assets are at risk for business debts",
          "They pay no tax",
          "They cannot employ staff",
        ],
        answer: 1,
        explain: "Unlimited liability means there is no legal separation between the owner and the business, so personal assets can be used to settle business debts.",
      },
      {
        prompt: "A founder has £6,000 of cash and a net outflow of £1,500 a month. Their runway is:",
        options: ["2 months", "4 months", "6 months", "9 months"],
        answer: 1,
        explain: "6,000 ÷ 1,500 = 4 months before the cash is gone.",
      },
    ],
    related: ["finance", "break-even-analysis", "business-objectives"],
  },
];

export function findLesson(slug: string): Lesson | undefined {
  return LESSONS.find((l) => l.slug === slug);
}

export function lessonsByStrand(strand: "economics" | "business"): Lesson[] {
  return LESSONS.filter((l) => l.strand === strand);
}

export function units(strand: "economics" | "business"): string[] {
  return Array.from(new Set(lessonsByStrand(strand).map((l) => l.unit)));
}
