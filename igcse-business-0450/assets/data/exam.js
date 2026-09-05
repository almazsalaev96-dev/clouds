/* Command words and exam technique */
window.COMMANDS = [
  { w: "Define", m: "2 marks", ao: "AO1", time: "1 min",
    means: "State precisely what a term means.",
    how: "One sentence. Give the meaning, then add the distinguishing feature that earns the second mark. Never write a paragraph — there is no third mark to win.",
    good: "<b>Define 'added value'.</b> Added value is the difference between the selling price of a product and the cost of the bought-in materials and components used to make it <span class='mk1'>(1)</span>. It is not the same as profit, because other costs such as wages and rent still have to be paid out of it <span class='mk1'>(1)</span>.",
    bad: "'Added value is when a business makes its product better so people pay more.' Vague, no reference to the cost of inputs — 0 or 1 mark." },

  { w: "Identify / State", m: "2 marks", ao: "AO1", time: "1 min",
    means: "Name the things asked for. No explanation is wanted.",
    how: "Two short items, numbered or on separate lines. Explanation earns nothing here and burns time you will need for the 6-markers.",
    good: "<b>Identify two fixed costs for the hotel.</b> 1. Rent of the hotel building. 2. The manager's salary.",
    bad: "Three sentences on why rent does not vary with output. Correct, but worth zero extra and costs you two minutes." },

  { w: "Outline", m: "4 marks", ao: "AO1 + AO2", time: "4 min",
    means: "Give two points and develop each one, usually by linking it to the business in the question.",
    how: "Two points x (1 mark for the point + 1 mark for development) = 4. Use the shape: 'Point ... which means for [named business] that ...'.",
    good: "<b>Outline two benefits to Mohammed's bakery of all workers being able to do every job.</b> If one worker is off sick another can cover their task <span class='mk1'>(1)</span>, so bread production does not stop and Mohammed still has stock to sell that morning <span class='mk1'>(1)</span>. Workers can also be moved to whichever task is busiest <span class='mk1'>(1)</span>, which shortens the queue at the counter at peak times and avoids losing customers <span class='mk1'>(1)</span>.",
    bad: "Two bare points with no development. Capped at 2 out of 4." },

  { w: "Explain", m: "6 marks", ao: "AO1 + AO2 + AO3", time: "7 min",
    means: "Two points, each applied to the business and each analysed through to a consequence.",
    how: "Two paragraphs. In each: state the point, apply it to the named business, then follow the chain of cause and effect to a business consequence — cost, revenue, profit, motivation, market share, cash flow. The chain is what separates 4 marks from 6.",
    good: "<b>Explain two ways Mohammed could increase added value.</b> He could serve cakes on plates with tea and coffee <span class='mk1'>(point)</span>. Customers in a small town bakery will pay more for the experience of sitting down <span class='mk1'>(application)</span>, so the price per cake rises from $1 to $1.50 while the flour and sugar still cost 30c. Added value per cake rises by 50c, and provided the second-hand tables cost less than the extra revenue they generate, weekly profit rises <span class='mk1'>(analysis)</span>.",
    bad: "Listing four ways with one line each. Breadth is not rewarded here — depth is. Two developed points beat four thin ones every time." },

  { w: "Do you think...? / Justify your answer", m: "6 marks", ao: "AO1-AO4", time: "8 min",
    means: "Argue both sides, then decide and say why.",
    how: "FOR (one developed reason) then AGAINST (one developed reason) then JUDGEMENT. The judgement must (a) choose, (b) give a reason grounded in this business's specific situation, and (c) say why the rejected option lost.",
    good: "'...Overall Sabrina should write the business plan first. Her shop is small, but she is risking her parents' savings as well as her own, and without a forecast she cannot show the bank the cash flow — and clothing retail ties up a lot of cash in stock before any of it sells. Her friend's point would only hold if she needed no outside finance at all, which is not the case here.'",
    bad: "'In conclusion there are advantages and disadvantages, so it depends on the situation.' This is the single most common way capable students lose the top band." },

  { w: "Explain (Paper 2, part a)", m: "8 marks", ao: "AO1 + AO2 + AO3", time: "10 min",
    means: "Usually 'explain two...' or 'explain four...'. Read the number before you write a word.",
    how: "Let the number set the depth. Four points asked for = 8/4 = 2 marks each = point + application, short. Two points asked for = 8/2 = 4 marks each = point + application + analysis, deep.",
    good: "Count the marks, divide by the number of points demanded, and size each paragraph to the answer. This one arithmetic step protects more marks than any revision fact.",
    bad: "Writing four beautifully analysed points when the question asked for two — half of your writing is unmarked, and you have stolen the time from the 12-marker." },

  { w: "Consider / Recommend / Which should...?", m: "12 marks", ao: "AO1-AO4", time: "18 min",
    means: "The decider. Two or three options; weigh them and recommend one.",
    how: "Take each option in turn — advantages applied, then disadvantages applied. Then a full judgement paragraph: which one, why, on what evidence from the case, why the others were rejected, and what would change your mind. About one and a half sides.",
    good: "Judgement template: '[Option X] is better for [business] because [reason tied to a specific case fact or figure]. The main risk is [drawback], but that matters less here than [reason] because [business circumstance]. [Option Y] was rejected because [decisive reason]. This assumes [condition]; if [condition] changed, Y would become the stronger choice.'",
    bad: "Describing every option fairly and then declining to choose. Evaluation marks require a decision — a fence-sitting conclusion caps you two bands below the top." },

  { w: "Calculate", m: "2-4 marks", ao: "AO1 + AO2", time: "3 min",
    means: "Work a number out from the data given.",
    how: "Formula, then substitution, then answer with units ($, %, units, months). Method marks survive an arithmetic slip; a bare wrong number scores zero.",
    good: "Break-even = Fixed costs / Contribution per unit = $50,000 / ($8 - $2) = $50,000 / $6 = <b>8,334 units per year</b>.",
    bad: "Writing '8334' alone. If the figure is wrong you score nothing; with working shown you would have kept the method marks." }
];

window.TECHNIQUE = {
  timing: [
    { p: "Paper 1", rows: [
      ["Read the whole business scenario", "2 min", "Underline the business name, what it sells, its size and any figures."],
      ["(a) Define — 2 marks", "1 min", "One sentence plus the distinguishing feature."],
      ["(b) Identify — 2 marks", "1 min", "Two items. Do not explain."],
      ["(c) Outline — 4 marks", "4 min", "Two points, each developed and linked to the business."],
      ["(d) Explain — 6 marks", "7 min", "Two points, each applied and analysed to a consequence."],
      ["(e) Justify — 6 marks", "7 min", "For, against, then a decided judgement."],
      ["Total per question", "~22 min", "Four questions x 22 min = 88 of your 90 minutes. There is no slack — the clock is the real examiner."]
    ]},
    { p: "Paper 2", rows: [
      ["Read the case study insert", "8 min", "Read it twice. Annotate: objectives, numbers, problems, the people named."],
      ["Question (a) — 8 marks", "10 min", "Count the points demanded; size the answer to the marks."],
      ["Question (b) — 12 marks", "18 min", "Both/all options, then a judgement paragraph that decides."],
      ["Four questions x 28 min", "112 min", "That exceeds 90 minutes — so you must be faster than this. Cut reading to 6 minutes and keep (a) answers tight."]
    ]}
  ],
  rules: [
    { t: "Apply or lose half the marks", d: "AO2 is 20% of the paper and it is free. Name the business, its product, its owner, its numbers, its town. 'This would increase costs' scores less than 'this would increase costs for Mohammed's bakery, which is already struggling to raise its prices because customers can buy the same bread cheaper elsewhere.'" },
    { t: "Two developed points beat five listed ones", d: "Examiners reward depth on 6- and 12-mark questions. Every extra unanalysed point is time spent for zero marks." },
    { t: "Always finish with a decision", d: "On every 'justify', 'recommend' or 'do you think' question, the final paragraph must choose and must say why the alternative was rejected. Without that you are capped." },
    { t: "Show every calculation", d: "Formula, substitution, answer, units. You keep method marks even when the arithmetic slips." },
    { t: "Answer the question that was asked", d: "'Two advantages to the employee' is not 'two advantages to the business'. Circle the stakeholder in the question before writing." },
    { t: "Use the numbers in the case", d: "If the case gives you a price, a cost, a market share or a ratio, use it. Quoting a figure is one of the cheapest application marks available." },
    { t: "Never leave a part blank", d: "A partly right 6-mark answer scores 2 or 3. A blank scores 0. If you are running out of time, write bullet points — examiners mark content, not prose." }
  ],
  connectives: {
    analysis: ["which means that...", "this leads to...", "as a result...", "the consequence for [business] is...", "so [business] would...", "therefore...", "this in turn causes...", "the knock-on effect is..."],
    evaluation: ["however, this depends on...", "the more important factor is...", "in the short run... but in the long run...", "this only holds if...", "on balance...", "the decisive point is...", "[Option B] was rejected because...", "this assumes that..."]
  }
};
