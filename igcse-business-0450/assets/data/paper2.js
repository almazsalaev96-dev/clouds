/* Paper 2 — full case study practice papers */
window.PAPER2 = [{
id: 'ke',
code: 'Practice Paper 2',
title: 'Ketu Electric Ltd (KE)',
sub: 'Electric motorbike assembly · Country N',
time: '1 hour 30 minutes',
marks: 80,
instructions: [
  "Read the case study and all the appendices before you begin.",
  "Answer **all four** questions. Each has a part (a) worth 8 marks and a part (b) worth 12 marks.",
  "Refer to the case study wherever possible — application marks are worth 20% of the paper and they are free.",
  "Aim to spend about 6 minutes reading and roughly 28 minutes on each question. That totals more than 90 minutes, so you must keep part (a) answers tight to protect the 12-markers."
],

insert: [
 {t:"p", x:"Ketu Mensah trained as a motorcycle mechanic. In 2016 he began converting petrol motorbikes to run on electricity, working alone in a rented workshop in Danko, the second city of Country N. He operated as a **sole trader**."},
 {t:"p", x:"Demand grew quickly. Petrol prices in Country N rose by 40% between 2019 and 2024, and in 2023 the government banned petrol motorbikes from the centre of the capital, Aburi, in order to reduce air pollution. In 2021 Ketu converted the business into a **private limited company**, Ketu Electric Ltd (KE), selling 30% of the shares to his sister and two former colleagues in order to raise capital. Ketu still owns 70%."},

 {t:"h", x:"The products"},
 {t:"p", x:"KE now assembles two models."},
 {t:"ul", x:[
   "**The Danko** — a basic electric motorbike aimed at the mass market. It is bought mainly by delivery riders and taxi operators, who care about price and running cost. It is sold through 40 independent motorcycle dealers across Country N.",
   "**The Aburi Pro** — a higher-specification model with a much longer battery range, aimed at higher-income private customers in the capital. It is sold only from KE's own showroom in Aburi and through KE's website."
 ]},

 {t:"h", x:"Operations and people"},
 {t:"p", x:"KE employs 60 people, of whom 48 work in assembly. It uses **batch production**: a batch of Dankos is assembled, the line is then reset, and a batch of Aburi Pros follows. Assembly workers are paid a **time rate**. Ketu takes all significant decisions himself and rarely holds meetings with staff."},
 {t:"p", x:"Labour turnover in the assembly department reached **31% last year**, and Ketu has had real difficulty recruiting skilled electrical technicians, who are scarce in Country N."},

 {t:"h", x:"Supplies and payment"},
 {t:"p", x:"Batteries and electric motors are **imported** from a specialist supplier in Country S. Frames, wheels, seats and wiring are all made in Country N. Last year Country N's currency, the *pula*, **depreciated by 12%** against the currency of Country S."},
 {t:"p", x:"To win dealers away from petrol motorbike brands, KE gives them **90 days' credit**. KE's own battery supplier requires **payment within 30 days**. KE has an agreed bank overdraft limit of **$150,000** and has come close to exceeding it three times in the last year."},

 {t:"h", x:"The decision"},
 {t:"p", x:"KE is profitable, but Ketu is worried. 'Sales have never been higher,' he says, 'and yet I have never had less money in the bank.' He wants to expand, and has narrowed the choice to the two options set out in **Appendix 4**."}
],

appendices: [
{ n: 1, title: "Financial information for KE", blocks: [
  {t:"table", head:["$000", "Year ended 31 March 2024", "Year ended 31 March 2025"], num:[1,2], rows:[
    ["Revenue", "4,200", "5,600"],
    ["Cost of sales", "2,730", "3,808"],
    ["**Gross profit**", "**1,470**", "**1,792**"],
    ["Expenses", "1,050", "1,456"],
    ["**Net profit**", "**420**", "**336**"],
    ["", "", ""],
    ["Non-current assets", "1,900", "2,600"],
    ["Inventories", "520", "910"],
    ["Accounts receivable", "690", "1,150"],
    ["Cash", "140", "20"],
    ["Current liabilities", "810", "1,600"],
    ["Non-current liabilities", "900", "1,400"],
    ["**Shareholders' equity**", "**1,540**", "**1,680**"]
  ]}
]},

{ n: 2, title: "Cost and sales data by model, year ended 31 March 2025", blocks: [
  {t:"table", head:["", "The Danko", "The Aburi Pro"], num:[1,2], rows:[
    ["Selling price per unit", "$900", "$2,000"],
    ["Variable cost per unit", "$620", "$1,300"],
    ["Units sold", "4,800", "640"],
    ["Fixed costs allocated to the model", "$1,036,000", "$420,000"]
  ]}
]},

{ n: 3, title: "KE cash flow forecast, April to July ($000)", blocks: [
  {t:"table", head:["", "April", "May", "June", "July"], num:[1,2,3,4], rows:[
    ["Cash inflows", "380", "410", "520", "560"],
    ["Cash outflows", "495", "470", "505", "530"],
    ["Opening balance", "20", "?", "?", "?"],
    ["Net cash flow", "?", "?", "?", "?"],
    ["Closing balance", "?", "?", "?", "?"]
  ]},
  {t:"p", x:"KE's agreed overdraft limit is **$150,000**."}
]},

{ n: 4, title: "The two expansion options", blocks: [
  {t:"h4", x:"Option A — build a larger factory in Aburi"},
  {t:"ul", x:[
    "Cost: **$2.4 million**",
    "Would allow **flow production** of the Danko, cutting its variable cost from $620 to **$520** per unit",
    "Capacity: **12,000 Dankos per year** (KE sold 4,800 last year)",
    "A government **grant of $300,000** is available, because the outer districts of Aburi have high unemployment",
    "Would require recruiting **40 more assembly workers**; skilled technicians are scarce in Country N",
    "KE's fixed costs would rise by **$700,000 per year**"
  ]},
  {t:"h4", x:"Option B — license a partner in Country S to assemble the Danko"},
  {t:"ul", x:[
    "Cost to KE: **$250,000** in set-up and training",
    "KE would receive a licence fee of **$60 for every bike the partner assembles**; the partner forecasts **6,000 bikes a year**",
    "No batteries would need to be transported, because they are made in Country S",
    "The partner is an established vehicle assembler with its own trained workforce",
    "KE would have **no control over assembly quality**",
    "Country S has **no ban** on petrol motorbikes"
  ]}
]}
],

questions: [
/* ===================== QUESTION 1 ===================== */
{
n: "1 (a)", cmd: "Explain", m: 8,
q: "Explain **four** ways in which Ketu could reduce the high rate of labour turnover in KE's assembly department.",
plan: [
  "8 marks ÷ 4 ways = 2 marks each. So each way needs a **point + one application to KE** — not a full analysis chain. Do not over-write.",
  "Draw the ways from the case: time rate pay, no meetings, batch production, autocratic style, scarce technicians.",
  "Every way must be linked to something the case actually says."
],
model: [
  "**Change the payment system.** Assembly workers are currently paid a time rate, so a fast, careful worker earns exactly the same as a slow one. Introducing a bonus linked to the number of bikes completed to the required quality standard would reward the effort that is currently invisible, giving good workers a reason to stay.",
  "**Introduce teamworking or job rotation.** Batch assembly of the same model is repetitive. Giving small teams responsibility for completing a whole bike, or rotating workers between stages, would add variety and a sense of achievement — Herzberg's motivators — which pay alone cannot supply.",
  "**Offer training and promotion.** The case says skilled electrical technicians are scarce in Country N. Training existing assembly workers to become technicians would give them personal growth and a career path inside KE, and would solve Ketu's recruitment problem at the same time.",
  "**Consult the workforce.** Ketu takes all significant decisions himself and rarely holds meetings. Regular briefings in which assembly workers can raise problems and suggest improvements would give recognition and make workers feel valued, which is one of the strongest predictors of whether people stay."
],
marker: "8 marks: 1 mark for each valid way identified (4) and 1 for each development applied to KE (4). The examiner has planted four clues — time rate, no meetings, batch production, scarce technicians. Take the planted evidence. Writing two deeply analysed ways instead of four scores a maximum of 4, because half the marks are unearned."
},
{
n: "1 (b)", cmd: "Recommend", m: 12,
q: "Ketu takes all significant decisions himself. Consider the advantages and disadvantages of him adopting a more **democratic leadership style**. Recommend whether he should. Justify your answer.",
plan: [
  "Advantages, applied to KE: 48 assembly workers see problems Ketu cannot; motivation and turnover; buy-in for the coming expansion; better decisions.",
  "Disadvantages, applied to KE: slow when a decision is urgent; Ketu owns 70% and carries the risk; workers may lack the information to judge a $2.4m investment; some decisions (redundancies, the expansion choice) cannot be voted on.",
  "Judgement: decide, and say **which decisions** should be democratic and which should not. That distinction is the top-band move.",
  "Use a case fact as the decisive evidence — 31% turnover is the strongest."
],
model: [
  "**The case for a more democratic style.** KE's most urgent people problem is a 31% labour turnover in assembly, and one likely cause is that workers have no voice: Ketu decides everything and rarely holds meetings. Consulting workers would give them recognition and responsibility, which Herzberg identifies as genuine motivators in a way that pay is not. It would probably also produce better decisions — 48 people assembling bikes every day know where the line is slow and where quality problems start, and Ketu cannot see that from the office. This matters especially now, because KE is about to expand: change imposed on a workforce that already leaves at 31% a year is likely to be resisted, whereas change the workforce has helped design is far more likely to work.",
  "**The case against.** A democratic style is slow, and some of KE's decisions cannot wait — if the battery supplier raises prices or a shipment is delayed, Ketu has to act that day. There are also decisions on which consultation is inappropriate: Ketu owns 70% of the company and is personally exposed to the risk of a $2.4 million factory, so the expansion choice is properly his. Assembly workers also do not have the financial information to judge between Option A and Option B, and no workforce votes for its own redundancy. There is a further risk that raising expectations by consulting, and then overruling the workforce, damages morale more than never consulting at all.",
  "**Recommendation.** Ketu should adopt a more democratic style, but **selectively**. He should consult the assembly workers on everything that concerns how the work is done — line layout, shift patterns, quality problems, the design of any new bonus scheme — while keeping strategic and financial decisions, including the choice between Option A and Option B, to himself and his fellow shareholders.",
  "The decisive evidence is the 31% turnover figure. That is not a minor irritation: KE is losing roughly one assembly worker in three every year, in a country where skilled technicians are already scarce, so it is paying repeatedly to recruit and train people who then leave. Consultation is the cheapest available response — it costs almost nothing compared with a bonus scheme or a pay rise, and it addresses the cause rather than the symptom. A fully democratic style was rejected because KE is about to make the largest financial commitment in its history and Ketu carries that risk personally; a purely autocratic style was rejected because it is producing the turnover that is now the business's biggest operational weakness. If turnover fell to a normal level and the expansion were complete, the argument for widening consultation further would become stronger."
],
marker: "12 marks. Advantages applied to KE (up to 4), disadvantages applied to KE (up to 4), and a judgement that decides, uses case evidence and rejects the alternatives with reasons (up to 4). The move that separates the top band is refusing the yes/no framing and specifying **which decisions** should be democratic — supported by the 31% figure as decisive evidence."
},

/* ===================== QUESTION 2 ===================== */
{
n: "2 (a)", cmd: "Explain", m: 8,
q: "Explain **four** ways in which the marketing mix for the Aburi Pro differs from the marketing mix for the Danko.",
plan: [
  "Four ways, 2 marks each. The obvious structure is the four Ps — one difference per P. That guarantees four distinct points and stops you repeating yourself.",
  "Every difference must name both models and use case detail: $2,000 vs $900, own showroom vs 40 dealers, private customers vs delivery riders."
],
model: [
  "**Product.** The Aburi Pro has a much longer battery range and a higher specification, because it is aimed at higher-income private customers who value performance and comfort. The Danko is a basic machine, because delivery riders and taxi operators buy on price and running cost rather than on features.",
  "**Price.** The Aburi Pro sells at $2,000 against the Danko's $900 — more than double. The high price is part of the Aburi Pro's positioning, signalling quality to private buyers, whereas the Danko must stay competitive against petrol motorbikes that commercial riders could buy instead.",
  "**Place.** The Aburi Pro is sold only through KE's own showroom in the capital and its website, which keeps the buying experience exclusive and lets KE control how it is presented. The Danko is distributed through 40 independent dealers across Country N, because delivery riders and taxi operators are spread across the whole country and need a dealer near them.",
  "**Promotion.** The Aburi Pro is aimed at a small, identifiable, higher-income segment in one city, so targeted promotion — the website, the showroom itself, social media aimed at Aburi professionals — is cost-effective. The Danko needs promotion through the dealer network to reach commercial buyers nationally, emphasising running costs and reliability rather than image."
],
marker: "8 marks: 1 for each difference identified (4) and 1 for each explanation applied to the two models (4). Using the four Ps as the structure is the safest way to guarantee four genuinely distinct points. Quoting the figures ($900/$2,000, 40 dealers) secures the application marks."
},
{
n: "2 (b)", cmd: "Recommend", m: 12,
q: "Using Appendix 2, consider whether KE should **stop making the Aburi Pro** and concentrate only on the Danko. Justify your recommendation with calculations.",
plan: [
  "Calculate for both models: contribution per unit, break-even output, margin of safety, and profit contribution.",
  "Danko: contribution $280; BE = 1,036,000/280 = 3,700 units; sold 4,800; MoS 1,100 units (22.9%).",
  "Aburi Pro: contribution $700; BE = 420,000/700 = 600 units; sold 640; MoS only 40 units (6.25%).",
  "The trap: Aburi Pro looks risky — but it still earns positive profit, and its fixed costs may not disappear if it is dropped.",
  "Judgement must weigh risk against contribution, and question whether the allocated fixed costs are avoidable."
],
model: [
  "**The Danko.** Contribution per unit = $900 − $620 = **$280**. Break-even output = $1,036,000 ÷ $280 = **3,700 units**. KE sold 4,800, so the margin of safety is 1,100 units, or **22.9%** of sales. Profit from the Danko = (4,800 × $280) − $1,036,000 = **$308,000**.",
  "**The Aburi Pro.** Contribution per unit = $2,000 − $1,300 = **$700**. Break-even output = $420,000 ÷ $700 = **600 units**. KE sold 640, so the margin of safety is only 40 units, or **6.25%** of sales. Profit from the Aburi Pro = (640 × $700) − $420,000 = **$28,000**.",
  "**The case for dropping it.** The Aburi Pro is plainly the riskier model. A fall in sales of just 40 units — 6.25% — pushes it into loss, and it contributes only $28,000 of KE's $336,000 net profit, less than 9%, despite requiring its own batch runs, its own showroom and a separate marketing effort. Dropping it would also end the line resets between batches, which cost KE output every time they happen, and would free management attention at exactly the moment KE is undertaking a major expansion.",
  "**The case for keeping it.** The decisive objection is that the $420,000 of fixed costs allocated to the Aburi Pro would not all disappear if the model were dropped. Rent, Ketu's salary, insurance and much of the administration are costs of the business, not of the model; if, say, $300,000 of them simply transferred to the Danko, KE would lose the Aburi Pro's $448,000 of contribution and save only $120,000 of genuinely avoidable cost — leaving it **worse off by over $300,000**. The Aburi Pro also earns $700 of contribution per unit against the Danko's $280, so every unit sold is worth two and a half Dankos, and it is the model that gives KE a presence among higher-income customers and a reputation for quality that supports the whole brand.",
  "**Recommendation.** KE should **keep the Aburi Pro**, but should act on the risk the figures reveal rather than ignore it. The decisive point is the distinction between allocated and avoidable fixed costs: a margin of safety of 6.25% looks alarming, but the model is only genuinely unprofitable if dropping it would remove the whole $420,000, and most of that spending would remain. What the analysis does justify is management attention — KE should either raise Aburi Pro sales above 640 units, where its high $700 contribution makes it very profitable very quickly, or reduce the fixed costs allocated to it, for example by selling it alongside the Danko through the dealer network in the capital rather than maintaining a separate showroom. Dropping the model was rejected because it would almost certainly reduce total profit, not increase it — the intuitive answer that the small margin of safety invites is the wrong one."
],
marker: "12 marks. Correct calculations for both models (up to 4), analysis of the risk and the contribution (up to 4), and a judgement that decides with reasons (up to 4). The distinction between **allocated** and **avoidable** fixed costs is the highest-value insight available in this question — candidates who simply see a 6.25% margin of safety and recommend dropping the model reach the middle band at best."
},

/* ===================== QUESTION 3 ===================== */
{
n: "3 (a)", cmd: "Calculate", m: 8,
q: "Using Appendix 1, calculate for the year ended 31 March 2025: (i) gross profit margin, (ii) net profit margin, (iii) return on capital employed, (iv) the acid test ratio. Explain what has happened to KE's performance.",
plan: [
  "Show formula, substitution and answer with units for each — method marks survive an arithmetic slip.",
  "Calculate the 2024 figures too, even though only 2025 is asked for; a ratio with nothing to compare it to means nothing, and the explanation is worth marks.",
  "The explanation must connect the ratios to each other and to the case: revenue up, every ratio down."
],
model: [
  "**(i) Gross profit margin** = (Gross profit ÷ Revenue) × 100 = (1,792 ÷ 5,600) × 100 = **32.0%** (2024: 1,470 ÷ 4,200 = 35.0%)",
  "**(ii) Net profit margin** = (Net profit ÷ Revenue) × 100 = (336 ÷ 5,600) × 100 = **6.0%** (2024: 420 ÷ 4,200 = 10.0%)",
  "**(iii) Capital employed** = shareholders' equity + non-current liabilities = 1,680 + 1,400 = 3,080. **ROCE** = (336 ÷ 3,080) × 100 = **10.9%** (2024: 420 ÷ 2,440 = 17.2%)",
  "**(iv) Current assets** = 910 + 1,150 + 20 = 2,080. **Acid test** = (2,080 − 910) ÷ 1,600 = 1,170 ÷ 1,600 = **0.73** (2024: 830 ÷ 810 = 1.02)",
  "**What has happened.** KE's revenue grew by a third, from $4.2m to $5.6m, and yet **every single ratio has worsened**. Gross margin fell three percentage points, which is consistent with the pula's 12% depreciation raising the cost of imported batteries and motors. Net margin fell much further, from 10% to 6%, because expenses rose 39% — faster than revenue — so overheads are growing out of control as well. ROCE has fallen from 17.2% to 10.9%: KE has put substantially more capital into the business, mostly borrowed, and is earning less from it than before.",
  "The most serious figure is the acid test, which has dropped from a healthy 1.02 to **0.73**. Excluding inventories, KE can now cover only about three quarters of its short-term debts. The reason is visible in the statement: inventories rose 75% and accounts receivable rose 67%, while cash collapsed from $140,000 to $20,000. KE is growing sales by giving dealers 90 days' credit while paying its own supplier in 30, so the cash is tied up in stock and in money owed by dealers. This is the classic pattern of **overtrading** — expanding faster than the business can finance — and it is exactly what Ketu means when he says sales have never been higher and he has never had less money in the bank."
],
marker: "8 marks: 1 for each correct calculation (4) and up to 4 for the explanation. The explanation is where most candidates lose marks. Full credit needs three things: the comparison with 2024, the link between separate ratios (falling gross margin ↔ the depreciation; falling acid test ↔ rising receivables and inventories), and the naming of overtrading, supported by Ketu's own quotation from the case."
},
{
n: "3 (b)", cmd: "Recommend", m: 12,
q: "KE needs finance to expand and is already close to its overdraft limit. Consider **three** sources of finance KE could use, and recommend which it should choose. Justify your answer.",
plan: [
  "KE is a private limited company, so it can sell shares privately but NOT to the general public. Say this — it earns a mark and rules out one common wrong answer.",
  "Pick three that genuinely fit: a long-term bank loan, a share issue to new private investors, and reducing working capital tied up in receivables (shortening dealer credit / debt factoring).",
  "Apply the ratios from 3(a): gearing is already rising and the acid test is 0.73 — that shapes the whole answer.",
  "Judgement should note that the finance problem and the cash flow problem are different problems."
],
model: [
  "**A long-term bank loan.** This is the obvious source for a $2.4 million factory, it is quick to arrange, and the factory itself would provide security. But KE's non-current liabilities have already risen from $900,000 to $1.4 million in a single year while net profit **fell**, so gearing is rising as the ability to service debt falls. A bank looking at an acid test of 0.73 and a cash balance of $20,000 may well refuse, and if it lends, the interest must be paid every month whether or not the new capacity sells any bikes.",
  "**Selling more shares privately.** As a private limited company KE cannot offer shares to the general public, but it can sell them to family, employees or a private investor — as Ketu did in 2021. Share capital never has to be repaid and carries no interest, which suits a business whose profits are falling and whose cash position is fragile; in a bad year KE simply pays no dividend. The cost is control: Ketu owns 70%, and issuing enough shares to raise a substantial sum could take him below the level at which he can decide matters alone.",
  "**Releasing the cash already tied up in the business.** This is the source the ratios point to and most candidates miss. KE has $1,150,000 owed by dealers and $910,000 sitting in inventories — over $2 million of its own money it cannot use. Reducing dealer credit from 90 days towards 60, or factoring some of the debts, would release a large sum without any interest or any loss of control. The risk is commercial: the 90-day credit is how KE persuades dealers to stock an electric bike instead of a familiar petrol brand, so tightening it too far could cost sales.",
  "**Recommendation.** KE should raise the expansion finance through a **private share issue**, and simultaneously tighten its working capital — but it should fix the working capital **first**. The decisive reason is that KE has two different problems and they need different answers. The expansion needs long-term finance, and with ROCE down to 10.9% and gearing already rising, taking on more debt to fund a $2.4 million factory would be dangerous: shares carry no repayment obligation, which is exactly what a business with a 0.73 acid test needs.",
  "But no new finance will help for long if the underlying cash leak continues. KE is putting money into stock and dealer credit faster than it comes back, and a share issue that simply funds a bigger version of the same problem will be consumed just as the last round of borrowing was. Recovering even a third of the $1,150,000 owed by dealers would release more cash than the government grant attached to Option A. The bank loan was rejected on gearing and on the difficulty of servicing fixed interest from a falling net profit — though it becomes viable again if the working capital position is repaired first and the acid test returns above 1.0."
],
marker: "12 marks. Three sources developed with advantages and disadvantages applied to KE (up to 8), plus a judgement that decides and rejects the alternatives with reasons (up to 4). Two moves lift this into the top band: stating explicitly that a private limited company cannot sell shares to the public, and separating the **expansion finance** problem from the **working capital** problem rather than treating them as one."
},

/* ===================== QUESTION 4 ===================== */
{
n: "4 (a)", cmd: "Explain", m: 8,
q: "Explain **four** ways in which the 12% depreciation of the pula affects KE.",
plan: [
  "Depreciation = the currency buys less. Imports cost MORE; exports become CHEAPER abroad.",
  "KE imports batteries and motors but sells almost entirely inside Country N — so the cost effect dominates and there is almost no export benefit. That asymmetry is the key insight.",
  "Four effects: higher input costs; falling gross margin (evidenced in Appendix 1); pressure on price or profit; effect on the two expansion options."
],
model: [
  "**The cost of imported components rises.** Batteries and motors are bought from Country S, so after a 12% depreciation KE must hand over roughly 12% more pula for exactly the same components. Since these are the most expensive parts of an electric motorbike, KE's variable cost per bike rises directly.",
  "**Gross profit margin falls.** This is visible in Appendix 1: gross margin dropped from 35.0% to 32.0% in the year the pula fell. KE has evidently absorbed most of the increase rather than passing it on, so the depreciation has cost it real profit.",
  "**KE faces a difficult pricing decision.** It could raise prices to restore the margin, but the Danko is sold to delivery riders and taxi operators who buy on cost and who could switch back to a petrol motorbike. Raising the price risks sales; holding it means continuing to absorb higher costs.",
  "**There is almost no offsetting benefit.** A depreciation normally helps exporters, but KE sells its bikes almost entirely inside Country N, so it gains very little on that side while bearing the full cost increase on its imports. The depreciation also makes **Option B more attractive**, since a partner in Country S would buy batteries in its own currency and KE's licence fee would be earned in the stronger currency."
],
marker: "8 marks: 1 for each effect identified (4) and 1 for each development applied to KE (4). The strongest answers make the asymmetry explicit — KE imports but barely exports, so a depreciation is almost all cost and almost no benefit. Quoting the 35% → 32% gross margin fall from Appendix 1 as evidence is a high-value application mark."
},
{
n: "4 (b)", cmd: "Recommend", m: 12,
q: "Using Appendix 4 and the rest of the case, recommend whether Ketu should choose **Option A** or **Option B**. Justify your answer.",
plan: [
  "Quantify both. Option A: variable cost falls $620 → $520, so contribution rises $280 → $380. But capacity is 12,000 and KE sells 4,800 — capacity is not demand.",
  "Option B: $250,000 once, then 6,000 × $60 = $360,000 a year. Payback in under a year.",
  "Weigh against KE's actual condition: acid test 0.73, cash $20,000, ROCE falling, 31% turnover, scarce technicians.",
  "The decisive question is whether KE can finance and staff Option A — and whether the demand exists.",
  "A strong answer notes Option B's strategic risk: teaching a bigger assembler to build your bike."
],
model: [
  "**Option A — the new factory.** The operational gain is real. Flow production would cut the Danko's variable cost from $620 to $520, raising contribution per unit from $280 to $380 — a 36% improvement on every bike. If KE could sell 12,000 Dankos, contribution would be 12,000 × $380 = $4,560,000 against $1,344,000 today, and even after the extra $700,000 of fixed costs the business would be transformed. A $300,000 government grant reduces the cost, and owning the factory keeps quality and the brand entirely under Ketu's control.",
  "**But capacity is not demand.** KE sold 4,800 Dankos last year. Option A builds capacity for 12,000 — two and a half times current sales — and nothing in the case suggests demand of that size exists or that KE has the marketing to create it. At current volumes the new factory would deliver only 4,800 × $380 = $1,824,000 of contribution against $1,344,000 now, an improvement of $480,000, from which $700,000 of extra fixed costs must be paid: **KE would be $220,000 a year worse off.** It would also need to recruit 40 more assembly workers in a business already losing 31% of them annually, in a country where skilled technicians are scarce. And it must find $2.1 million net when its cash balance is $20,000 and its acid test is 0.73.",
  "**Option B — licensing.** The arithmetic is far kinder to KE's actual position. A one-off $250,000 buys an income of 6,000 × $60 = **$360,000 a year**, so the outlay is recovered in under nine months and everything after that is close to pure profit, on capital KE can plausibly raise. The partner supplies its own trained workforce, which sidesteps both the recruitment problem and the turnover problem. Because batteries are made in Country S, the arrangement is also insulated from the pula's depreciation — the very pressure that cut KE's gross margin from 35% to 32%.",
  "**Option B's risks.** KE would have no control over assembly quality, and a badly built bike carrying the KE name damages the brand in every market, not just Country S. The partner is an established vehicle assembler, so KE would be teaching a larger and better-resourced business exactly how to build its product — a licensee can become a competitor. And Country S has no ban on petrol motorbikes, so the demand that drives KE's sales at home may simply not exist there, which makes the 6,000-bike forecast the partner's optimism rather than a fact.",
  "**Recommendation — Option B, for now.** The decisive consideration is not which option is better in principle but which one **this business, in this condition, can survive**. KE is overtrading: revenue up a third, every ratio down, cash at $20,000, an acid test of 0.73 and an overdraft it has nearly breached three times. Option A asks that business to find $2.1 million, take on $700,000 of additional annual fixed costs, and recruit 40 workers it cannot currently retain — and on present sales volumes it would lose money doing so. Option B asks for $250,000 and returns $360,000 a year without needing a single extra employee.",
  "Option A was rejected on timing rather than on merit. Flow production is genuinely the right long-term destination for the Danko, and the $380 contribution proves it — but it becomes the right decision only once KE has repaired its working capital and can show demand approaching 12,000 bikes. Ketu should protect himself on Option B by writing quality standards, inspection rights and a fixed term into the licence agreement, so that the brand is defended and the arrangement can be ended if the partner becomes a rival. If Danko sales in Country N reach roughly 9,000 units and the acid test returns above 1.0, Option A should be revisited immediately."
],
marker: "12 marks. Both options developed with advantages and disadvantages applied to KE (up to 8), plus a judgement that decides using case evidence and rejects the alternative with a reason (up to 4). The single highest-value move is calculating what Option A does **at current sales volumes** rather than at full capacity — it reverses the intuitive answer and shows the option would lose money. Recommending contractual protections on Option B, and stating the conditions under which Option A becomes right, are what secure the very top of the band."
}
]
}];
