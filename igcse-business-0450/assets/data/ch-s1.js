/* SECTION 1 — Understanding business activity (chapters 1-5) */
window.CH = (window.CH || []).concat([

/* ==================== CHAPTER 1 ==================== */
{
n: "1", s: 1,
title: "Business activity",
sub: "Needs and wants, scarcity, opportunity cost, specialisation, added value",
obj: [
  "Explain the concepts of needs, wants, scarcity and opportunity cost",
  "Explain the importance of specialisation and the division of labour",
  "Explain the purpose of business activity",
  "Explain added value and how a business can increase it"
],
defs: [
  ["Need", "A good or service that is essential for living, such as food, clean water, clothing and shelter."],
  ["Want", "A good or service that people would like to have but which is not essential for living. Wants are unlimited."],
  ["The economic problem", "There are unlimited wants but only limited resources to produce the goods and services that would satisfy them. This creates scarcity."],
  ["Scarcity", "The lack of sufficient products to fulfil the total wants of the population."],
  ["Factors of production", "The four resources needed to produce goods or services: land, labour, capital and enterprise. All are limited in supply."],
  ["Opportunity cost", "The next best alternative given up by choosing another item."],
  ["Specialisation", "When people and businesses concentrate on what they are best at."],
  ["Division of labour", "When the production process is split into different tasks and each worker performs one of these tasks. It is a form of specialisation."],
  ["Business", "An organisation that combines the factors of production to make goods or services which satisfy people's needs and wants."],
  ["Added value", "The difference between the selling price of a product and the cost of the bought-in materials and components used to make it."]
],
blocks: [
{
h2: "The economic problem",
c: [
 {t:"p", x:"Every economy in the world faces the same problem. People's [[wants]] are unlimited, but the resources available to satisfy them are not. That gap is [[scarcity]], and it is the reason business exists at all."},
 {t:"h", x:"Needs versus wants"},
 {t:"table", head:["", "Needs", "Wants"], rows:[
   ["Definition", "Essential for living", "Would like to have, not essential"],
   ["Examples", "Clean water, food, shelter, basic clothing", "A smartphone, a holiday abroad, a luxury car"],
   ["Quantity", "Finite — there is a level at which they are met", "Unlimited — always another want behind the last one"]
 ]},
 {t:"trap", x:"Students often say the economic problem is caused by 'not enough money'. It is not. If a government printed twice as much money, there would not be one extra house, school or car — prices would simply rise. The problem is a shortage of **real resources**, not of currency."},
 {t:"h", x:"The four factors of production"},
 {t:"table", head:["Factor", "What it is", "Example for a bakery"], rows:[
   ["**Land**", "All natural resources provided by nature — fields, forests, oil, gas, minerals, and the site itself", "The site the shop stands on; wheat grown in a field"],
   ["**Labour**", "The people available to make products, and their skills", "The three bakers and the counter assistant"],
   ["**Capital**", "The finance, machinery and equipment used in production", "The ovens, mixers, delivery van and the money invested"],
   ["**Enterprise**", "The skill and risk-taking of the person who brings the other three together", "Mohammed, the owner, who took the risk of opening it"]
 ]},
 {t:"key", x:"All four factors are **limited in supply** in every country and in the world as a whole. That is the real cause of scarcity."}
]},
{
h2: "Choice and opportunity cost",
c: [
 {t:"p", x:"Because resources are limited, every economic actor — a consumer, a business or a government — must choose. Every choice means giving something up, and the value of the **next best alternative** foregone is the [[opportunity cost]]."},
 {t:"table", head:["Who chooses", "The decision", "The opportunity cost"], rows:[
   ["A student", "Spend $10 on a textbook", "The bus fares that $10 would have paid for"],
   ["An entrepreneur", "Leave a job to start a business", "The salary and job security given up"],
   ["A business", "Buy a new delivery van", "A new oven that would have raised output"],
   ["A government", "Build a new hospital", "The schools that could have been built instead"]
 ]},
 {t:"tip", x:"Opportunity cost questions are worth 2 marks and are among the easiest on Paper 1. Two rules: (1) name **one specific alternative**, not a vague list; (2) make it something the person in the case realistically would have done. 'Sabrina could have kept her savings in the bank and earned interest' beats 'she could have done other things'."},
 {t:"eg", x:"A sole trader has $10,000. She spends it on shop fittings. The opportunity cost is not 'the $10,000' — money is not the cost. It is the **best thing she could have bought with it instead**: for example, the stock of clothes she now cannot afford."}
]},
{
h2: "Specialisation and the division of labour",
c: [
 {t:"p", x:"Two hundred and fifty years ago a carpenter cut his own timber, built a table, sold it and delivered it — one table a week. Today the wood is cut by a specialist machine, assemblers build the frames, a polishing department finishes them and a haulage business delivers them. Output is many times higher from the same number of people."},
 {t:"h", x:"Why specialisation has spread"},
 {t:"ul", x:[
   "Specialised machinery and technology are now widely available and affordable",
   "Competition forces businesses to keep costs low, and specialisation lowers cost per unit",
   "Higher living standards follow from higher productivity"
 ]},
 {t:"h", x:"Division of labour — the balance sheet"},
 {t:"pc",
  adv:[
   "Workers are trained in one task and become fast and skilful at it, so **output per worker rises**",
   "Less time is wasted moving between different jobs and different workbenches",
   "Training is **quicker and cheaper** because fewer skills need to be taught to each worker",
   "It allows the use of specialised, expensive equipment on a single repeated task"
  ],
  dis:[
   "Doing one job all day is **boring**, so motivation and efficiency can fall (see Herzberg, Chapter 6)",
   "If one worker is absent and nobody else can do that job, **the whole line stops**",
   "Workers become dependent on one narrow skill — if the job disappears they are hard to redeploy",
   "Quality can fall because no one worker feels responsible for the finished product"
  ]},
 {t:"tip", x:"When a question asks about division of labour in a small business, always mention the **absence risk**. In a four-person bakery, one person off sick with no cover is a far bigger problem than in a 400-person factory. That is applied analysis and it is where the marks are."}
]},
{
h2: "The purpose of business activity",
c: [
 {t:"p", x:"Pulling the chain together: wants are unlimited, resources are limited, so choice is necessary, and specialisation makes the best use of what exists. Businesses are the mechanism that converts scarce resources into things people want."},
 {t:"formula", lbl:"What every business does", x:"LAND + LABOUR + CAPITAL + ENTERPRISE &rarr; GOODS &amp; SERVICES that satisfy needs and wants"},
 {t:"p", x:"Business activity therefore does three things at once:"},
 {t:"ol", x:[
   "It **combines scarce factors of production** to produce output",
   "It **produces goods and services** that satisfy the population's needs and wants",
   "It **employs people and pays them wages**, which is what allows those people to consume the goods other businesses make"
 ]},
 {t:"key", x:"Goods are physical items you can touch — cars, shoes, bread. Services are intangible — insurance, banking, tourism, hairdressing. Both are 'products' and both satisfy wants."}
]},
{
h2: "Added value",
c: [
 {t:"p", x:"[[Added value]] is one of the most testable ideas in Section 1, and one students most often confuse with profit."},
 {t:"formula", lbl:"Added value", x:"Added value = Selling price &minus; Cost of bought-in materials and components"},
 {t:"worked", title:"Worked example — a newly built house", steps:[
   "Selling price of the house = **$100,000**",
   "Cost of bought-in bricks, cement, timber and other materials = **$15,000**",
   "Added value = $100,000 &minus; $15,000 = **$85,000**",
   "This is **not** profit. Out of that $85,000 the builder must still pay wages, machinery hire, insurance, marketing and interest. Whatever is left after those is profit."
 ]},
 {t:"h", x:"Why added value matters"},
 {t:"ul", x:[
   "It is the money available to pay **all the other costs** — labour, management, power, advertising",
   "If those other costs total less than the added value, the business makes a **profit**",
   "If a business adds no value to what it buys in, it cannot survive"
 ]},
 {t:"h", x:"The two ways to increase added value"},
 {t:"table", head:["Method", "How it works", "The risk"], rows:[
   ["**Raise the selling price**, keep material costs the same", "Build a higher-quality image: expert staff, luxurious shop fittings, premium packaging, a strong brand. Customers pay more for the same inputs.", "Creating that image itself costs money (staff, decor, packaging), so other costs rise. And if customers are not convinced, sales volume falls and total profit may drop."],
   ["**Reduce material costs**, keep the price the same", "Find a cheaper supplier, negotiate a bulk discount, use cheaper timber or thinner packaging, cut waste.", "Cheaper inputs often mean lower quality. Will customers still pay the old price for a product they believe is worse? Brand reputation can be damaged permanently."]
 ]},
 {t:"eg", x:"**Rakesh's bakery.** A cake uses 30c of flour, sugar and butter and sells for $1 &rarr; added value 70c. His wife adds two small tables and serves the same cake on a plate with tea for $1.50 &rarr; added value 80c per cake, plus the profit on the drink. He changed nothing about the cake — he changed the **experience** around it."},
 {t:"trap", x:"Never write 'added value is the profit'. It is the amount available **before** other costs are deducted. Examiners look for that distinction and it is often the second mark in a 2-mark definition."},
 {t:"tip", x:"Adding value is not easy — if it were, every business would be rich. Strong answers acknowledge the trade-off: a jewellery shop that hires expert staff and refits the shop in gold does add value per item, **but** its wage bill and rent have both gone up. Whether profit rises depends on whether the extra revenue exceeds the extra cost."}
]}
],
mcq: [
 {q:"Which of these is a need rather than a want?", o:["A luxury car","Clean drinking water","A foreign holiday","A games console"], a:1, why:"Needs are essential for living. Water is essential; the other three are desirable but survivable without."},
 {q:"The real cause of the economic problem is:", o:["A shortage of money in the economy","Governments not printing enough currency","Limited factors of production against unlimited wants","Too many businesses competing"], a:2, why:"Printing money creates no extra goods — it only raises prices. Scarcity comes from limited land, labour, capital and enterprise."},
 {q:"A baker uses her $5,000 savings to buy a new oven instead of a delivery van. Her opportunity cost is:", o:["The $5,000","The delivery van","The new oven","The interest on the savings account"], a:1, why:"Opportunity cost is the next best alternative given up — here, the van. The money itself is not the cost, and the oven is what she chose."},
 {q:"Which is NOT a factor of production?", o:["Enterprise","Money","Labour","Land"], a:1, why:"Money is not itself a factor of production; it is a means of buying them. Capital in this sense means machinery, equipment and the finance invested."},
 {q:"A firm sells a chair for $80. Bought-in timber and fabric cost $22. Wages on the chair are $18. Added value is:", o:["$40","$58","$80","$22"], a:1, why:"Added value = selling price − bought-in materials = $80 − $22 = $58. Wages are deducted after added value, not before, so $40 is the trap answer."},
 {q:"A disadvantage of the division of labour is that:", o:["Training becomes more expensive","Workers may become bored and less efficient","Output per worker falls","Less specialised machinery can be used"], a:1, why:"Repetition causes boredom and demotivation. Training actually becomes cheaper and output per worker rises — those are advantages."},
 {q:"A shop raises its prices to increase added value. The most likely risk is:", o:["Material costs rise","Sales volume falls and total profit drops","Added value per unit falls","The business becomes a public limited company"], a:1, why:"Higher price raises added value per unit, but if customers buy less the total profit can still fall. This trade-off is what earns evaluation marks."},
 {q:"Which activity would NOT increase added value for a hotel?", o:["Offering airport transfers at a charge","Buying cheaper bed linen at the same room rate","Refurbishing rooms and raising the nightly rate","Paying a higher price for the same laundry service"], a:3, why:"Paying more for identical inputs raises the cost of bought-in supplies without raising price, so added value falls."}
],
exam: [
 {cmd:"Define", m:2,
  q:"Define 'opportunity cost'.",
  ctx:"",
  plan:["One sentence stating the meaning.","A second element — that it is the *next best* alternative, not all alternatives."],
  model:["Opportunity cost is the next best alternative that is given up when a choice is made (1). It exists because resources are scarce, so choosing one option always means going without another (1)."],
  marker:"Two marks: 1 for 'alternative given up', 1 for 'next best' or a correct link to scarcity/choice. A vague answer such as 'what it costs you' scores 0."},

 {cmd:"Outline", m:4,
  q:"Outline two disadvantages to a small furniture workshop of using the division of labour.",
  ctx:"Jack runs a workshop with six employees making handmade tables. He is considering splitting the work so that each employee performs only one task.",
  plan:["Point 1: boredom → falling motivation → falling quality/output.","Point 2: absence risk → in a six-person workshop no cover exists → production stops.","Each point needs development linked to Jack's small workshop."],
  model:[
   "Workers repeating one task all day may become bored (1). In a workshop of only six people the jobs are already fairly varied, so narrowing them to a single task could reduce motivation and the care taken over handmade tables, lowering quality (1).",
   "If one worker is absent there may be nobody else trained to do their task (1). With only six employees Jack has no spare capacity, so the whole table-making process could stop for a day and orders would be delivered late (1)."],
  marker:"4 marks: 2 identified disadvantages (1 each) + 2 developments applied to a small workshop (1 each). Generic disadvantages with no link to Jack's size are capped at 2."},

 {cmd:"Explain", m:6,
  q:"Explain two ways in which Rakesh could increase the added value of his bakery.",
  ctx:"Rakesh owns a small bakery selling bread, cakes and biscuits. The business is only just surviving. A cake uses 30 cents of ingredients and sells for $1.",
  plan:["Method 1: raise price by changing the experience (café seating, plates, coffee). Apply to the cake numbers. Analyse to profit.","Method 2: reduce input costs (bulk buying, cheaper supplier, less waste). Apply. Analyse to the risk of quality.","Each: point → application (use the 30c / $1 figures) → consequence."],
  model:[
   "Rakesh could add a small café area and serve the cakes on plates with tea and coffee. Customers are willing to pay more for the experience of sitting down than for a cake in a paper bag, so the price of the same cake could rise from $1 to $1.50 while the ingredients still cost 30 cents. Added value per cake would rise from 70 cents to $1.20, and provided the second-hand tables and coffee machine cost less than the extra revenue they generate, his weekly profit would rise.",
   "Alternatively he could reduce the cost of bought-in ingredients by buying flour, sugar and butter in bulk from a wholesaler rather than in small quantities. If bulk buying cut the ingredient cost per cake from 30 cents to 22 cents while the price stayed at $1, added value would rise by 8 cents on every cake sold. However, if the cheaper flour produced a noticeably worse cake, regular customers in a small town would notice quickly and he could lose the sales that keep the bakery alive."],
  marker:"6 marks: up to 2 for each valid method identified, plus application (using the 30c/$1 figures or the bakery context) and analysis (a consequence for profit). Two well-developed methods score 6; four listed methods with no development score 2."},

 {cmd:"Justify", m:6,
  q:"Rakesh has opened the small café inside his bakery. Does this mean his weekly profit must have increased? Justify your answer.",
  ctx:"",
  plan:["Yes side: added value per cake up 50c; extra revenue from drinks; existing customers stay longer and spend more.","No side: added value is not profit; new fixed costs (tables, coffee machine, possibly extra staff hours, more electricity); fewer customers may fit in the shop; some customers only ever wanted a quick loaf.","Judgement: decide, with a condition."],
  model:[
   "It is likely that revenue has risen. Each cake now earns $1.50 rather than $1 for the same 30 cents of ingredients, so added value per cake has risen by 50 cents, and customers who sit down also buy tea or coffee, which adds a second sale that did not exist before.",
   "However, added value is not the same as profit. Rakesh had to buy second-hand café equipment and furniture, and running a café adds costs he did not have before — more electricity, more washing up, and possibly paid hours for someone to serve at the tables. Two tables also take up floor space in a small shop, so at busy times customers wanting to buy a loaf quickly may leave rather than wait.",
   "On balance, profit has probably increased, because the equipment was bought second-hand and therefore cheap, and the extra 50 cents per cake plus the margin on drinks is earned on every seated customer. But this only holds if enough customers actually use the tables. If the café were used by only two or three people a day, the extra fixed costs would outweigh the extra added value and profit would fall."],
  marker:"6 marks: analysis of both sides (up to 4) plus a supported judgement (2). The judgement must decide AND give a condition or reason grounded in the case. 'It depends' with no decision scores 0 for evaluation."}
]
},

/* ==================== CHAPTER 2 ==================== */
{
n: "2", s: 1,
title: "Classification of businesses",
sub: "Primary, secondary and tertiary sectors; the mixed economy; privatisation",
obj: [
  "Explain the differences between primary, secondary and tertiary production",
  "Explain the reasons for the changing importance of business classification in developed and developing economies",
  "Explain the differences between public sector and private sector business enterprises in a mixed economy"
],
defs: [
  ["Primary sector", "The sector of industry that extracts and uses the Earth's natural resources — farming, fishing, forestry, mining and oil extraction."],
  ["Secondary sector", "The sector of industry that manufactures goods using the raw materials provided by the primary sector — construction, car making, food processing, computer assembly."],
  ["Tertiary sector", "The sector of industry that provides services to consumers and to the other sectors — transport, banking, retail, insurance, hotels, tourism."],
  ["De-industrialisation", "A decline in the importance of the secondary (manufacturing) sector of industry in a country."],
  ["Mixed economy", "An economy that has both a private sector and a public (state) sector."],
  ["Private sector", "Businesses that are owned and run by private individuals or shareholders, usually with profit as a main objective."],
  ["Public sector", "Business organisations and services owned and controlled by the government or a state authority."],
  ["Privatisation", "The sale of public sector businesses owned by the government to private sector owners."],
  ["Nationalisation", "When a government purchases a business that was previously privately owned, bringing it into the public sector."]
],
blocks: [
{
h2: "The three sectors of economic activity",
c: [
 {t:"p", x:"Follow a wooden table from forest to living room and you pass through all three stages of production."},
 {t:"table", head:["Stage", "Sector", "What happens", "Examples"], rows:[
   ["1", "**Primary**", "Natural resources are extracted or grown", "Forestry, farming, fishing, coal mining, oil extraction, quarrying"],
   ["2", "**Secondary**", "Raw materials are converted into manufactured or processed goods", "Furniture making, car assembly, house building, bread baking, oil refining"],
   ["3", "**Tertiary**", "Services are provided to consumers and to other businesses", "Transport, retail, banking, insurance, hotels, hairdressing, IT services"]
 ]},
 {t:"tip", x:"Classify by **what the business does**, not what it sells. A bakery that bakes bread is secondary. A shop that only sells bread baked elsewhere is tertiary. A café that bakes and serves is doing both, but is normally classed as tertiary because the service dominates."},
 {t:"h", x:"Measuring the relative importance of the sectors"},
 {t:"p", x:"Two measures are used, and they can point in different directions:"},
 {t:"ul", x:[
   "**Employment** — the percentage of a country's workers employed in each sector",
   "**Output** — the value of goods and services produced, as a share of total national output (GDP)"
 ]},
 {t:"trap", x:"These two measures often disagree, and examiners love that gap. In India around 47% of workers were in the primary sector but it produced only about 17% of output. Why? Because farming there is **labour-intensive and low-productivity** — many people, low value each. Say so, and you have an analysis mark."}
]},
{
h2: "Why sector importance differs between countries",
c: [
 {t:"table", head:["Type of economy", "Typical pattern", "Reason"], rows:[
   ["**Developing** (e.g. Papua New Guinea, parts of Africa)", "Large primary sector by employment; small secondary sector", "Manufacturing has only recently been established; most people live in rural areas on low incomes, so demand for services is limited"],
   ["**Newly industrialised** (e.g. China, India, Brazil, Mexico)", "Rapidly growing secondary sector; tertiary now expanding fastest", "Low labour costs attract manufacturing; rising incomes then create demand for services"],
   ["**Developed** (e.g. UK, USA, Japan)", "Small primary sector; shrinking secondary; tertiary above 75% of employment", "Manufacturing has moved to lower-cost countries; high incomes mean people spend a larger share on travel, restaurants and finance"]
 ]},
 {t:"h", x:"Case comparison — the classic contrast"},
 {t:"table", head:["Country", "Primary %", "Secondary %", "Tertiary %"], num:[1,2,3], rows:[
   ["Papua New Guinea", "35", "13", "52"],
   ["India", "17", "26", "57"],
   ["Bangladesh (1970)", "53", "15", "32"],
   ["Bangladesh (2017)", "15", "29", "56"]
 ]},
 {t:"p", x:"Bangladesh in one lifetime is the whole syllabus point in a single table: a primary-dominated economy in 1970, transformed by clothing and food-processing manufacture, with services now over half of output."},
 {t:"h", x:"Reasons the sectors change importance over time"},
 {t:"ol", x:[
   "**Primary resources become depleted.** Timber, oil, gas and minerals run out. Somalia lost most of its forests; a mining town dies when the seam is exhausted.",
   "**Developed economies lose competitiveness in manufacturing** to newly industrialised countries with lower wage costs — this is [[de-industrialisation]].",
   "**Rising incomes shift spending towards services.** As a country gets richer, people spend a higher *proportion* of income on travel, restaurants, healthcare and entertainment.",
   "**Technology** raises productivity in primary and secondary sectors, so the same output needs far fewer workers."
 ]},
 {t:"tip", x:"When asked to discuss the effect of a declining sector, always mention **structural unemployment**: the workers who lose factory jobs often do not have the skills that service industries want, so unemployment can persist even while the economy grows. That is a strong analysis point."}
]},
{
h2: "The mixed economy: private and public sectors",
c: [
 {t:"p", x:"Almost every country in the world runs a [[mixed economy]] — some business is privately owned, some is state owned."},
 {t:"table", head:["", "Private sector", "Public sector"], rows:[
   ["Owned by", "Individuals, partners or shareholders", "The government or a local authority"],
   ["Main objective", "Usually profit; also growth and market share", "Providing a service; social objectives; sometimes breaking even"],
   ["Who decides what to produce", "The owners and managers", "Government ministers and appointed boards"],
   ["How it is funded", "Sales revenue, owners' capital, loans", "Taxation and, sometimes, charges to users"],
   ["Examples", "Shops, banks, factories, farms, most companies", "State schools and hospitals, defence, water supply, public transport"]
 ]},
 {t:"h", x:"Industries commonly kept in the public sector"},
 {t:"ul", x:[
   "**Health** and **education** — considered too important to depend on ability to pay",
   "**Defence** — cannot sensibly be sold to individual customers",
   "**Water and electricity supply** — natural monopolies where duplicate networks would be wasteful",
   "**Public transport** — socially necessary routes may be unprofitable"
 ]},
 {t:"key", x:"A **natural monopoly** is an industry where it would be wasteful to have competitors — two sets of railway track or two water pipe networks to the same town. Governments often own these so that a private monopolist cannot exploit consumers."}
]},
{
h2: "Privatisation",
c: [
 {t:"p", x:"[[Privatisation]] is the sale of state-owned businesses to private owners. Water, electricity and public transport have been privatised across much of Europe and Asia."},
 {t:"pc",
  labels:["Arguments for privatisation", "Arguments against privatisation"],
  adv:[
   "Private businesses have **profit as an objective**, so costs must be controlled — this usually raises efficiency",
   "Private owners can **invest more capital** than a government that has many competing demands on tax revenue",
   "**Competition** between private firms improves quality and widens consumer choice",
   "The sale itself raises **revenue for the government**, which can be spent elsewhere",
   "Removes the risk of decisions being taken for **political** rather than commercial reasons"
  ],
  dis:[
   "Private firms cut costs by making workers **redundant**, raising unemployment",
   "Social objectives are dropped — **unprofitable but socially necessary** rural bus routes get cut",
   "A privatised natural monopoly can **exploit consumers** with high prices unless regulated",
   "Profits flow to shareholders rather than back to the taxpayer",
   "Prices often rise for consumers who previously benefited from government subsidy"
  ]},
 {t:"trap", x:"Do not confuse **privatisation** with turning a sole trader into a private limited company. Both sole traders and private limited companies are already in the private sector. Privatisation means moving from **public sector to private sector**."},
 {t:"tip", x:"For a 12-mark 'should the government privatise X?' question, the decisive factor is usually **what kind of industry it is**. A competitive industry (an airline, a hotel chain) benefits most from privatisation. A natural monopoly (water supply) is the hardest case, because the efficiency gain has to be weighed against the risk of monopoly pricing. Naming that distinction is a top-band move."}
]}
],
mcq: [
 {q:"A business that extracts copper ore from a mine operates in which sector?", o:["Primary","Secondary","Tertiary","Public"], a:0, why:"Extraction of natural resources is primary. Refining the ore into copper would be secondary."},
 {q:"De-industrialisation means:", o:["A rise in tertiary output","A decline in the importance of the manufacturing sector","The closure of all primary industry","Privatisation of state industry"], a:1, why:"It specifically means the secondary/manufacturing sector shrinking in relative importance."},
 {q:"In India 47% of workers were in the primary sector but it produced only 17% of output. The best explanation is:", o:["Primary products are exported","Farming is labour-intensive with low productivity per worker","There are too few farms","The government owns the farms"], a:1, why:"Many workers producing low value each means high employment share but low output share."},
 {q:"Which is a feature of the public sector?", o:["Owned by shareholders","Always makes a profit","Owned and controlled by the government","Cannot employ workers"], a:2, why:"Public sector means state ownership and control. Profit is often not the main objective."},
 {q:"A likely disadvantage of privatising a country's water supply is:", o:["Costs will be better controlled","A private monopoly could raise prices to consumers","More capital may be invested","Decisions become commercial rather than political"], a:1, why:"Water is a natural monopoly, so without regulation a private owner faces no competitive pressure on price."},
 {q:"As a country becomes richer, you would expect:", o:["The primary sector to grow fastest","The tertiary sector to take a larger share of output","Manufacturing to become the largest employer","Total output to fall"], a:1, why:"Rising incomes are spent disproportionately on services — travel, restaurants, finance, healthcare."},
 {q:"Which of these is NOT a reason a government keeps an industry in the public sector?", o:["It is a natural monopoly","It is essential to the whole population","It would maximise shareholder dividends","A failing but important business needs rescuing"], a:2, why:"Maximising dividends for shareholders is a private sector objective — public corporations have no private shareholders."}
],
exam: [
 {cmd:"Define", m:2,
  q:"Define 'public sector'.",
  ctx:"",
  plan:["State ownership.","Add the control/objective element for the second mark."],
  model:["The public sector consists of business organisations and services that are owned and controlled by the government or a local state authority (1), such as state hospitals and schools, where providing a service rather than making a profit is usually the main objective (1)."],
  marker:"1 mark for government/state ownership; 1 for control, a correct example or the service objective. Answers that say 'businesses owned by the public' score 0 — that is a public limited company, which is private sector."},

 {cmd:"Outline", m:4,
  q:"Outline two reasons why the tertiary sector is becoming more important in most economies.",
  ctx:"",
  plan:["Reason 1: rising incomes → higher proportion spent on services.","Reason 2: manufacturing moving abroad to lower-cost countries → workers reabsorbed into services.","Each needs a development sentence."],
  model:[
   "As a country's wealth and living standards rise, consumers spend a higher proportion of their income on services (1) such as foreign travel, restaurants and insurance rather than on additional manufactured goods, so demand for tertiary businesses grows faster than for factories (1).",
   "Developed countries have lost competitiveness in manufacturing to newly industrialised countries with lower wage costs (1), so as factories close the remaining employment and output shift into service industries such as finance, retail and IT (1)."],
  marker:"4 marks: 2 valid reasons (1 each) with 2 developments (1 each)."},

 {cmd:"Explain", m:6,
  q:"Explain two likely reasons why the relative importance of the primary sector in Country X has declined over the last twenty years.",
  ctx:"Country X had an economy dominated by agriculture and coal mining twenty years ago. Consumer incomes are now rising rapidly and Ade's Engineering Company makes car parts there for export.",
  plan:["Reason 1: resource depletion — the coal is running out.","Reason 2: growth of manufacturing (AEC) and rising incomes pull resources into secondary/tertiary; primary falls in *relative* terms.","Apply to Country X: name coal, name AEC, name rising incomes."],
  model:[
   "Coal is a finite natural resource, and after twenty years of extraction the most accessible seams in Country X are likely to be depleted. As mines become exhausted or more expensive to work, output falls and mines close, so the primary sector produces a smaller share of the country's total output even if nothing else changed.",
   "At the same time the secondary and tertiary sectors have grown quickly. Businesses like Ade's Engineering Company are manufacturing car parts for export, which draws workers and capital out of agriculture and mining and into factories. Because consumer incomes are rising, spending is also shifting towards services. The primary sector may therefore be producing a similar absolute amount, but it has fallen in *relative* importance because the other two sectors have grown much faster."],
  marker:"6 marks. Note the word 'relative' — the strongest answers explain that primary output need not have fallen absolutely; it has been outgrown. That distinction is worth an analysis mark."},

 {cmd:"Justify", m:6,
  q:"A government minister said: 'The public sector always produces goods and services more efficiently than privately owned businesses.' Do you agree? Justify your answer.",
  ctx:"In Country Y the private sector produces 55% of total output, mainly in services such as transport, tourism and finance.",
  plan:["Agree side: public corporations can pursue social objectives, avoid wasteful duplication in natural monopolies, keep essential services running.","Disagree side: no profit motive or shareholder pressure; subsidies remove the incentive to cut costs; no competition means little incentive to improve service; political interference.","Judgement: the word 'always' is the weak point — attack it."],
  model:[
   "There is something in the minister's argument for certain industries. In a natural monopoly such as water supply, public ownership avoids the waste of duplicate pipe networks and prevents a private monopolist charging excessive prices, so in that narrow sense state provision can be more efficient for the country as a whole.",
   "However, the general claim is hard to defend. Public corporations have no private shareholders demanding high profits, so the pressure to control costs is weaker. Government subsidies can make managers complacent, because they know losses will be covered. Where there is no close competitor there is also little incentive to improve customer service. Governments may even take decisions for political reasons, such as creating jobs before an election, which is not efficient.",
   "I do not agree with the minister, chiefly because of the word 'always'. Efficiency depends on the industry, not on who owns it. In Country Y the private sector already produces 55% of output in competitive service industries such as tourism and transport, where competition drives efficiency far harder than state ownership could. The minister's case only holds for natural monopolies and essential services, which is a small part of the economy — so as a general rule the statement is wrong."],
  marker:"6 marks. Top band requires (a) both sides argued, (b) a decision, and (c) a reason grounded in Country Y. Attacking the absolute word 'always' is exactly the kind of critical move that earns the top evaluation mark."}
]
},

/* ==================== CHAPTER 3 ==================== */
{
n: "3", s: 1,
title: "Enterprise, business growth and size",
sub: "Entrepreneurs, business plans, measuring size, growth, integration, business failure",
obj: [
  "Explain the benefits and drawbacks of being an entrepreneur and the characteristics of successful ones",
  "Explain the contents of a business plan and how it assists entrepreneurs",
  "Explain why and how governments support business start-ups",
  "Explain the methods of measuring business size and their limitations",
  "Explain why and how businesses grow, and the problems growth causes",
  "Explain why some businesses remain small and why some fail"
],
defs: [
  ["Entrepreneur", "A person who organises, operates and takes the risk for a new business venture."],
  ["Business plan", "A document containing the business objectives and important details about the operations, finance and owners of a new business."],
  ["Capital employed", "The total value of capital used in a business — shareholders' funds plus long-term liabilities."],
  ["Internal growth", "When a business expands its own existing operations, for example by opening new outlets, usually funded from retained profit. Also called organic growth."],
  ["External growth", "When a business takes over or merges with another business. Also called integration."],
  ["Takeover (acquisition)", "When one business buys out the owners of another business, which then becomes part of the predator business."],
  ["Merger", "When the owners of two businesses agree to join their businesses together to form one business."],
  ["Horizontal integration", "When one business merges with or takes over another in the same industry at the same stage of production."],
  ["Vertical integration", "When one business merges with or takes over another in the same industry but at a different stage of production. It can be forward (towards the consumer) or backward (towards the supplier)."],
  ["Conglomerate integration", "When one business merges with or takes over a business in a completely different industry. Also called diversification."]
],
blocks: [
{
h2: "Enterprise and entrepreneurship",
c: [
 {t:"pc",
  labels:["Benefits of being an entrepreneur", "Drawbacks of being an entrepreneur"],
  adv:[
   "**Independence** — you choose how to use your time and money",
   "You can put **your own ideas** into practice",
   "Potentially **higher income** than working as an employee, and you keep the profit",
   "You can build on **personal interests and skills**",
   "Possible fame and status if the business grows"
  ],
  dis:[
   "**Risk** — a high proportion of new businesses fail, especially where planning is poor",
   "**Capital** — you must invest your own money and find other sources",
   "**Lack of knowledge and experience** of running a business",
   "**Opportunity cost** — the salary and security given up by leaving a job",
   "Long hours, short holidays, and no sick pay"
  ]},
 {t:"h", x:"Characteristics of successful entrepreneurs"},
 {t:"table", head:["Characteristic", "Why it matters"], rows:[
   ["**Hard working**", "Long hours and short holidays are normal in the first years"],
   ["**Risk taker**", "Producing goods people might not buy is inherently risky"],
   ["**Creative**", "A new business needs ideas that differentiate it from existing firms"],
   ["**Optimistic**", "Belief in a better future sustains effort through early losses"],
   ["**Self-confident**", "You must convince banks, lenders and customers that this will work"],
   ["**Innovative**", "Turning new ideas into practical products and processes"],
   ["**Independent / self-motivated**", "Often working alone before you can afford employees"],
   ["**Effective communicator**", "Talking clearly to banks, suppliers, customers and agencies raises the profile of the business"]
 ]},
 {t:"tip", x:"In a question like 'outline two characteristics Sabrina seems to have', **quote the case**. If the case says she 'was prepared to risk her own savings' and 'had exciting ideas for the shop layout', name the characteristics **risk taker** and **creative** and cite those exact phrases. That is a free application mark."}
]},
{
h2: "The business plan",
c: [
 {t:"p", x:"A bank will almost always demand a [[business plan]] before lending. Writing one forces the entrepreneur to think ahead."},
 {t:"table", head:["Section", "What it contains"], rows:[
   ["1. Description of the business", "A brief history, summary and the objectives of the business"],
   ["2. Products and services", "What is sold, how it is made and distributed, and how the range will develop"],
   ["3. The market", "Total market size, predicted growth, target market, competitor analysis, forecast sales revenue, market research data and marketing strategy"],
   ["4. Location and distribution", "The physical site, or internet/mail order; how products reach customers"],
   ["5. Organisation and management", "Organisational structure, management, number and skill level of employees needed"],
   ["6. Financial information", "Forecast income statements and statements of financial position; sources of capital; fixed and variable costs; cash flow forecast and working capital; profitability and liquidity ratios"],
   ["7. Business strategy", "How the business will satisfy customer needs and build brand loyalty, and a summary of why it will succeed"]
 ]},
 {t:"h", x:"Why a bank cares about each part"},
 {t:"ul", x:[
   "**Market research results** show whether real demand exists — without it the sales forecast is a guess",
   "**Experience of the owners** shows whether they can actually run the business (a chef of 15 years is a better risk than an enthusiast)",
   "**Forecast profit and cash flow** show whether the loan and its interest can be repaid, and when",
   "**Owners' own investment** shows commitment — a bank rarely lends to someone risking nothing themselves"
 ]},
 {t:"trap", x:"A plan does not guarantee a loan. If the bank manager thinks the cash flow forecast is unrealistic or the market research is thin, the loan is still refused. Say that in evaluation questions — it is the balanced point most students miss."}
]},
{
h2: "Government support for business start-ups",
c: [
 {t:"table", head:["Why governments help", "How they help"], rows:[
   ["**Reduce unemployment** — new firms create jobs", "**Ideas and advice**: training courses, mentoring by experienced business people"],
   ["**Increase competition** — more choice for consumers, pressure on established firms", "**Premises**: enterprise zones offering low-cost sites"],
   ["**Increase output** — more goods and services in the economy", "**Finance**: low-interest loans; grants for starting up in areas of high unemployment"],
   ["**Benefit society** — social enterprises support disadvantaged groups", "**Labour**: grants to train employees and raise productivity"],
   ["**Future growth** — every large firm was small once", "**Research**: encouraging universities to open research facilities to new firms"]
 ]}
]},
{
h2: "Measuring the size of a business",
c: [
 {t:"p", x:"There is no perfect measure. Each one distorts in a predictable way, and knowing the distortion is what earns the marks."},
 {t:"table", head:["Measure", "Best used for", "Limitation"], rows:[
   ["**Number of employees**", "Quick, easy comparison; labour-intensive industries", "A capital-intensive automated factory has huge output but few workers, so it looks small. Also: do two part-timers count as one employee or two?"],
   ["**Value of output**", "Comparing manufacturers in the same industry", "A firm making a few very expensive items (aircraft engines) out-scores a firm making millions of cheap ones. Output also differs from sales if goods are unsold."],
   ["**Value of sales**", "Comparing retailers selling similar products (supermarkets)", "Misleading across different products — a perfume retailer and a market stall selling sweets cannot be compared this way."],
   ["**Value of capital employed**", "Capital-intensive industries", "The mirror image of the employee problem: a labour-intensive firm with many workers uses little capital and looks small."]
 ]},
 {t:"key", x:"**Capital-intensive** = uses a lot of machinery relative to labour. **Labour-intensive** = uses a lot of people relative to machinery. Almost every 'limitations of measuring size' answer runs off this distinction."},
 {t:"tip", x:"When given a table of four companies and asked which is biggest, the correct answer is almost never one number. Say: 'By employees, A is largest; by capital employed and output, D is largest. Because A employs 20,000 people to produce $100m of output while D employs 15,000 to produce $150m, A is probably labour-intensive and D capital-intensive. Using more than one measure together is the only reliable approach.' That is a top-band answer."},
 {t:"h", x:"Who wants to compare business size, and why"},
 {t:"ul", x:[
   "**Investors** — deciding where to put their savings",
   "**Governments** — tax rates often differ for small and large businesses",
   "**Competitors** — to compare their own importance in the industry",
   "**Workers** — how many people they might be working with, and job security",
   "**Banks** — how large a loan is relative to the size of the business"
 ]}
]},
{
h2: "Business growth",
c: [
 {t:"h", x:"Why owners want to grow"},
 {t:"ul", x:[
   "The possibility of **higher profits**",
   "**Status and higher salaries** for owners and managers of bigger businesses",
   "**Lower average costs** through economies of scale (Chapter 19)",
   "A **larger market share**, giving more influence over suppliers, distributors and prices, and attracting customers to the 'big name'",
   "**Spreading risk** by entering new products and markets"
 ]},
 {t:"h", x:"Two routes to growth"},
 {t:"table", head:["", "Internal (organic) growth", "External growth (integration)"], rows:[
   ["What it is", "Expanding the existing business — new outlets, new products, more capacity", "Merging with or taking over another business"],
   ["Funded by", "Usually retained profits from the existing business", "Cash, shares, or borrowing — usually large sums"],
   ["Speed", "Slow", "Fast, sometimes overnight"],
   ["Control", "Easier to manage; culture is preserved", "Harder — two management styles and cultures must be combined"],
   ["Example", "A restaurant owner opens a second restaurant in another town", "Nestlé buying Hsu Fu Chi, the Chinese sweet maker"]
 ]},
 {t:"h", x:"The three types of integration"},
 {t:"table", head:["Type", "Definition", "Example", "Main benefits"], rows:[
   ["**Horizontal**", "Same industry, **same stage** of production", "One car manufacturer buys another car manufacturer", "Fewer competitors; economies of scale; bigger market share"],
   ["**Vertical — forward**", "Same industry, **later stage** (closer to the consumer)", "A car manufacturer buys a chain of car showrooms", "Guaranteed outlet; absorbs the retailer's profit margin; can block rivals' models from those showrooms; direct information on customer preferences"],
   ["**Vertical — backward**", "Same industry, **earlier stage** (closer to raw materials)", "A car manufacturer buys a supplier of body panels", "Guaranteed supply of components; absorbs the supplier's profit margin; can deny supply to rivals; control over input costs and quality"],
   ["**Conglomerate**", "A **completely different** industry (diversification)", "A house builder merges with a clothing manufacturer", "Spreads risk across unrelated markets; ideas and expertise transfer between divisions"]
 ]},
 {t:"tip", x:"The direction of vertical integration is decided by asking: **which way is the consumer?** Towards the consumer = forward. Towards the raw material = backward. Students lose easy marks by guessing. A fruit juice business buying a fruit farm is **backward**; a car maker buying garages is **forward**."},
 {t:"h", x:"Problems caused by growth — and how to overcome them"},
 {t:"table", head:["Problem", "How it might be overcome"], rows:[
   ["The larger business is **difficult to control** (diseconomies of scale)", "Operate in smaller units — decentralisation, giving divisions their own authority"],
   ["**Communication worsens** — messages pass through more levels and get distorted", "Operate in smaller units; use modern IT and telecommunications, though these bring problems of their own (information overload)"],
   ["Expansion **costs so much** the business runs short of cash (overtrading)", "Expand more slowly, funding growth from profits; ensure enough long-term finance is in place first"],
   ["**Integrating another business** is harder than expected — different management styles and cultures", "Communicate clearly with both workforces so they understand the reasons for change; introduce new management style gradually"]
 ]},
 {t:"key", x:"Growth is not automatically good. In an evaluation question, the strongest structure is: 'Growth would bring [specific benefit]. **However**, [specific problem for this business]. On balance...'. Businesses that grow too fast fail through cash shortage even while profitable."}
]},
{
h2: "Why some businesses stay small",
c: [
 {t:"ol", x:[
   "**The type of industry.** Hairdressing, car repair, plumbing, window cleaning and catering all depend on a close, personal service. Growing too large destroys the very thing customers buy. These industries also have low barriers to entry, so new competitors constantly appear and keep existing firms small.",
   "**The size of the market.** If total customers are few — a village shop, a maker of very luxurious cars, a specialist fashion label — the business cannot grow beyond the market that exists.",
   "**The owners' objectives.** Many owners prefer to keep control, know all their staff and customers personally, and avoid the stress of running a large organisation. Not every entrepreneur wants to be Richard Branson."
 ]},
 {t:"eg", x:"In the UK, 99.3% of the 5.5 million private sector businesses are small (under 250 employees), and they provide 60% of all private sector employment. Small is normal, not exceptional."}
]},
{
h2: "Causes of business failure",
c: [
 {t:"table", head:["Cause", "How it kills the business"], rows:[
   ["**Lack of management skills**", "Inexperience leads to bad decisions — locating in a high-cost, low-demand area, mispricing, over-ordering. Family firms fail when the founder's children inherit control without the ability, and refuse to hire professional managers."],
   ["**Changes in the business environment**", "New technology, a powerful new competitor, or a recession. Kodak was destroyed by digital photography; SAAB by expensive models that no longer met changing customer needs."],
   ["**Liquidity problems / poor financial management**", "The single most common killer. A shortage of cash means workers, suppliers, landlords and government cannot be paid — even in a profitable business. Failure to forecast cash flow is the usual root cause."],
   ["**Over-expansion**", "Growing too fast ties up cash in stock and fixed assets, and stretches management beyond its ability to control the business."]
 ]},
 {t:"key", x:"**New businesses fail more often** because they combine every risk at once: little finance, no reputation, no established customers, an owner without experience, and forecasts based on guesswork rather than trading history. In some countries over 50% close within five years."},
 {t:"trap", x:"Profit and cash are not the same. A business can be profitable on paper and still fail because customers have not yet paid and the wages are due on Friday. This point earns marks in Chapters 3, 22, 23 and 26 — learn it once, use it everywhere."}
]}
],
mcq: [
 {q:"A car manufacturer takes over a business that supplies its steel. This is:", o:["Horizontal integration","Forward vertical integration","Backward vertical integration","Conglomerate integration"], a:2, why:"The steel supplier is at an earlier stage of production, closer to the raw material — backward."},
 {q:"A bicycle retailer buys a bicycle shop in another town. This is:", o:["Horizontal integration","Backward vertical integration","Conglomerate integration","Internal growth"], a:0, why:"Same industry, same stage of production (both are retailers)."},
 {q:"The main advantage of conglomerate integration is:", o:["Fewer competitors in the industry","Guaranteed supply of components","Risk is spread across different industries","A guaranteed outlet for products"], a:2, why:"Diversification means a fall in one market can be offset by another. The other three describe horizontal or vertical integration."},
 {q:"Company A employs 20,000 workers with $50m capital; Company B employs 5,000 with $150m capital. This suggests:", o:["A is more profitable","B is labour-intensive","A is labour-intensive and B is capital-intensive","B is a smaller business"], a:2, why:"Many workers with little capital = labour-intensive; few workers with heavy capital = capital-intensive."},
 {q:"Which is a limitation of using 'number of employees' to measure business size?", o:["It is hard to count employees","Automated firms have high output but few workers","Employees change jobs frequently","It cannot be compared between firms"], a:1, why:"Capital-intensive businesses look artificially small on this measure."},
 {q:"The most common cause of failure among new small businesses is:", o:["Too much competition","Liquidity problems and poor cash flow management","Government regulation","Too many employees"], a:1, why:"Running out of cash is the classic killer — often while still profitable on paper."},
 {q:"A business expands by opening branches funded from its own retained profits. This is:", o:["A takeover","A merger","Internal growth","Backward integration"], a:2, why:"Expanding existing operations from within is internal (organic) growth."},
 {q:"Why might a hairdressing business stay small?", o:["Hairdressing is illegal to franchise","Customers demand a close personal service that is lost at scale","Hairdressers cannot borrow money","There is no demand for haircuts"], a:1, why:"Personal-service industries lose their appeal when scaled up, and low barriers to entry keep bringing in new small rivals."},
 {q:"A business plan is MOST useful to an entrepreneur because it:", o:["Guarantees the business will succeed","Forces the owner to think ahead and is required by lenders","Removes the need for market research","Reduces the tax the business pays"], a:1, why:"It compels forward planning and is normally a precondition of a bank loan — but it guarantees nothing."}
],
exam: [
 {cmd:"Define", m:2,
  q:"Define 'takeover'.",
  ctx:"",
  plan:["One business buys another.","Add: the acquired business becomes part of the buyer / the owners are bought out."],
  model:["A takeover is when one business buys out the owners of another business (1), so that the second business becomes part of the predator business that has acquired it (1)."],
  marker:"1 mark for 'one business buys another'; 1 for the ownership change or for distinguishing it from a merger (which is by agreement)."},

 {cmd:"Outline", m:4,
  q:"Outline two reasons why external groups would be interested in measuring the size of a business such as TelCom.",
  ctx:"TelCom owns a phone network. It employs 4,000 workers and had sales last year of $300 million.",
  plan:["Group 1: banks — size relative to the loan.","Group 2: investors or competitors.","Name the group, then say what the size tells them."],
  model:[
   "A bank would want to measure TelCom's size (1) because a loan of a given amount is a much smaller risk to a business with $300 million of annual sales than to a small firm, so the size determines whether the bank lends and at what interest rate (1).",
   "Competitors would want to compare size (1) because knowing that TelCom employs 4,000 workers and sells $300 million tells them how much market power TelCom has and whether they can realistically compete on price (1)."],
  marker:"4 marks: 2 groups identified (1 each), 2 developments (1 each). Using TelCom's actual figures secures the application."},

 {cmd:"Explain", m:6,
  q:"Explain two possible reasons why senior managers at TelCom want to expand the business.",
  ctx:"TelCom provides phone network services but does not manufacture phones or own retail stores. It is considering taking over either a phone manufacturer or a chain of phone shops.",
  plan:["Reason 1: economies of scale / lower average costs → competitive price → market share.","Reason 2: managerial motives — status, salary, security — and/or market share giving power over suppliers.","Apply to TelCom specifically."],
  model:[
   "Expansion would give TelCom lower average costs through economies of scale. A larger network business can spread the fixed cost of its head office and its network infrastructure over many more customers, and it can negotiate bulk discounts from equipment suppliers. Lower unit costs would let TelCom either cut prices to win subscribers from rivals or keep prices the same and earn a higher profit margin on each one.",
   "Senior managers also have personal reasons. Salaries and status are usually higher for managers who control bigger businesses, and a larger TelCom is more secure — a big network operator is harder for a rival to take over, which protects the managers' own jobs. This is an important point because it means expansion may be pursued even when it is not in the shareholders' best interests, a conflict of stakeholder objectives."],
  marker:"6 marks. The second point is a strong one because it introduces the divorce between ownership and control (Chapter 4) and stakeholder conflict (Chapter 5) — linking chapters is a top-band habit."},

 {cmd:"Recommend", m:12,
  q:"How should TelCom expand — by taking over a phone manufacturer, or a chain of shops selling mobile phones? Justify your recommendation.",
  ctx:"TelCom employs 4,000 workers with sales of $300m. The largest phone manufacturer, PhonTec, has 450 workers and sales of $1,200m.",
  plan:["Option A (manufacturer = backward vertical): guaranteed supply, absorb supplier margin, control quality/cost, deny rivals. Against: PhonTec sales are 4x TelCom's — can it afford this? Different industry expertise; capital-intensive manufacturing is unfamiliar.","Option B (shops = forward vertical): guaranteed outlet, direct customer contact and data, absorb retail margin, block rivals' handsets from those shops. Against: retail is low-margin; many shops to manage; customers may want choice of network.","Judgement: decide, with the size figures as the decisive evidence."],
  model:[
   "**Taking over PhonTec (backward vertical integration).** This would guarantee TelCom a supply of handsets and let it absorb the manufacturer's profit margin, so a phone bundled with a contract would cost TelCom less. It could also stop PhonTec supplying rival networks, weakening competitors. However, PhonTec's sales of $1,200 million are four times TelCom's $300 million. Taking over a business four times your size is extremely expensive and would require enormous borrowing, and manufacturing is a capital-intensive business in which TelCom's managers, who run a service network, have no experience.",
   "**Taking over a chain of phone shops (forward vertical integration).** This would guarantee TelCom an outlet for its contracts, absorb the retailer's margin, and give it direct contact with customers — valuable market research about what subscribers actually want. It could also prevent rival networks being sold in those shops. Against this, retailing is a low-margin business with high rents, and TelCom would be managing hundreds of small sites and their staff, which is a very different skill from running a network. Some customers also prefer shops that offer a choice of networks, so sales could fall.",
   "**Recommendation.** TelCom should take over the chain of shops. The decisive evidence is the size comparison: PhonTec has sales four times TelCom's, so that takeover is probably unaffordable and, if attempted through heavy borrowing, would leave TelCom highly geared and vulnerable to any rise in interest rates. The retail chain is a far smaller acquisition, is closer to TelCom's existing skill of selling services to consumers, and delivers the customer information that TelCom, as a network operator, most needs. The manufacturer option was rejected on cost and on lack of manufacturing expertise, not because backward integration is a bad idea in principle — if TelCom were the larger business, it would be the stronger long-term move."],
  marker:"12 marks. Both options must be argued with advantages AND disadvantages applied to TelCom (up to 8), plus a judgement that decides, uses evidence from the case (the $300m vs $1,200m comparison is the key figure), and explains why the other option was rejected (up to 4)."}
]
},

/* ==================== CHAPTER 4 ==================== */
{
n: "4", s: 1,
title: "Types of business organisation",
sub: "Sole traders, partnerships, private and public limited companies, franchises, joint ventures, public corporations",
obj: [
  "Explain the main features of each form of business organisation",
  "Explain the advantages and disadvantages of each",
  "Explain the difference between unincorporated businesses and limited companies",
  "Explain the concepts of risk, ownership and limited liability",
  "Recommend which form is appropriate in given circumstances"
],
defs: [
  ["Sole trader", "A business owned and operated by just one person, who is the sole proprietor."],
  ["Partnership", "A form of business in which two or more people agree to jointly own and run a business."],
  ["Partnership agreement (deed of partnership)", "The written legal agreement between business partners setting out capital contributed, profit shares, duties and arrangements for retirement or new partners."],
  ["Unlimited liability", "When the owners of a business can be held personally responsible for the debts of the business. Their liability is not limited to the amount they invested."],
  ["Limited liability", "When the liability of shareholders in a company is limited to only the amount they invested in shares."],
  ["Unincorporated business", "A business that does not have a separate legal identity from its owners. Sole traders and partnerships are unincorporated."],
  ["Incorporated business", "A business that has a separate legal identity from its owners — a limited company."],
  ["Shareholders", "The owners of a limited company, who have bought shares representing part-ownership of it."],
  ["Private limited company", "A business owned by shareholders, whose shares cannot be sold to the general public and cannot be transferred without the agreement of the other shareholders."],
  ["Public limited company", "A business owned by shareholders whose shares can be bought and sold freely by the general public, usually on a stock exchange."],
  ["Franchise", "A business based on the use of the brand name, promotional logos and trading methods of an existing successful business. The franchisee buys a licence to operate it from the franchisor."],
  ["Joint venture", "When two or more businesses start a new project together, sharing the capital, the risks and the profits."],
  ["Public corporation", "A business wholly owned by the state or central government, run by a board of directors appointed by government ministers."],
  ["Annual General Meeting (AGM)", "A legal requirement for all companies. Shareholders may attend and vote on who they want on the board of directors for the coming year."],
  ["Dividends", "Payments to shareholders out of a company's profits after tax — the return for investing in the company."]
],
blocks: [
{
h2: "The private sector: six forms",
c: [
 {t:"table", head:["Form", "Owners", "Liability", "Legal identity", "Can sell shares to public?"], rows:[
   ["Sole trader", "1", "**Unlimited**", "Unincorporated", "No"],
   ["Partnership", "2–20 (usually)", "**Unlimited**", "Unincorporated", "No"],
   ["Limited Liability Partnership (LLP)", "2+", "Limited", "Separate legal unit", "No"],
   ["Private limited company (Ltd)", "Shareholders (restricted)", "**Limited**", "Incorporated", "No"],
   ["Public limited company (plc)", "Shareholders (unrestricted)", "**Limited**", "Incorporated", "**Yes**"],
   ["Franchise", "The franchisee (any legal form)", "Depends on legal form", "Depends", "n/a"],
   ["Joint venture", "Two or more businesses", "Depends on structure", "Depends", "n/a"]
 ]},
 {t:"key", x:"Two distinctions run through this whole chapter and are worth memorising: **limited vs unlimited liability** (can creditors take your house?) and **incorporated vs unincorporated** (is the business a separate legal person that survives your death?)."}
]},
{
h2: "Sole traders",
c: [
 {t:"p", x:"The most common form of business organisation, largely because there are so few legal requirements to set one up: register with the tax office, comply with any rules on the business name, and obtain any industry licence needed (alcohol, taxi, food hygiene)."},
 {t:"pc",
  adv:[
   "**Few legal formalities** to set up — you can trade almost immediately",
   "**Complete control** — you are your own boss, with no one to consult before deciding",
   "**Freedom** to choose hours, holidays, prices and who to employ",
   "**Close personal contact** with customers, so you can respond quickly to their needs",
   "**You keep all the profit** after tax, which is a powerful incentive to work hard",
   "**Complete secrecy** — no accounts have to be published to anyone but the tax office"
  ],
  dis:[
   "**Unlimited liability** — if the business cannot pay its debts, creditors can force you to sell your own house and possessions",
   "**Limited sources of finance** — only your savings, retained profits and small bank loans; no other owners can inject capital",
   "The business is therefore likely to **stay small** and cannot benefit from economies of scale",
   "**No one to discuss decisions with** and no cover if you are ill or want a holiday",
   "**No continuity** — the business legally ceases to exist on the owner's death and cannot simply be passed on",
   "Limited ability to offer training or career progression to employees"
  ]},
 {t:"trap", x:"A sole trader **can employ other people**. 'Sole' refers to a single *owner*, not a single worker. Students lose marks writing 'a sole trader works alone'."},
 {t:"h", x:"When a sole trader is the right choice"},
 {t:"ul", x:[
   "Setting up a **brand-new** business with little capital needed",
   "Businesses dealing **directly with the public** where personal contact matters — hairdressing, retail, plumbing, taxi driving",
   "Where the owner values **independence and control** above growth"
 ]}
]},
{
h2: "Partnerships",
c: [
 {t:"p", x:"Two or more people (usually up to 20) agree to own and run a business together, contributing capital and sharing profits. It can be created by verbal agreement, but a written [[partnership agreement]] is strongly advised."},
 {t:"h", x:"What the partnership agreement should cover"},
 {t:"ul", x:[
   "The **capital invested** by each partner",
   "The **tasks** each partner will undertake",
   "How **profits (and losses) will be shared**",
   "How long the partnership will last",
   "Arrangements for **absence, retirement and admitting new partners**"
 ]},
 {t:"pc",
  adv:[
   "**More capital** can be invested, allowing the business to expand",
   "**Responsibilities are shared** — partners can specialise (one on accounts, one on marketing)",
   "**Absence and holidays** are manageable because another partner is available",
   "**Losses are shared**, not carried by one person",
   "All partners are motivated because they share the profits"
  ],
  dis:[
   "**Unlimited liability** — creditors can still force partners to sell personal property",
   "**No separate legal identity** — the partnership ends on the death of a partner",
   "**Disagreements** are possible and consulting all partners takes time",
   "**One inefficient or dishonest partner** can lose money for everyone",
   "Growth is limited by the capital that at most 20 people can raise"
  ]},
 {t:"h", x:"When a partnership suits"},
 {t:"ul", x:[
   "People who want to go into business together but **avoid legal complications**",
   "Professions where the professional body only permits partnerships, not companies (in some countries, medicine and law)",
   "Partners who **know each other well**, often family, and want a simple way to involve several people"
 ]},
 {t:"tip", x:"In evaluation questions about adding a partner, the strongest 'against' point is usually **loss of control combined with unlimited liability** — you now share the decisions but you are still personally liable for a debt your partner ran up. Amin's rich but bossy uncle is the classic case."}
]},
{
h2: "Private limited companies (Ltd)",
c: [
 {t:"p", x:"A company is an **incorporated** business — a separate legal unit from its owners. This means it continues to exist if an owner dies, it can make contracts in its own name, and its accounts are kept separately from the owners' personal finances."},
 {t:"pc",
  adv:[
   "**Limited liability** — shareholders can lose only what they invested, never their homes. This encourages people to invest",
   "Shares can be sold to a larger number of people (friends, family, employees), raising **far more capital** than one or two owners could",
   "The company has a **separate legal identity** and continuity — it survives the death of a shareholder",
   "The original owners **keep control** as long as they do not sell too many shares",
   "Greater status than a sole trader when dealing with suppliers and banks"
  ],
  dis:[
   "**Legal formalities**: the Articles of Association and Memorandum of Association must be filed with the Registrar of Companies before a Certificate of Incorporation is issued",
   "**Shares cannot be transferred** without the agreement of the other shareholders, which puts some investors off",
   "**Accounts must be filed** and can be inspected by the public — less secrecy than a sole trader",
   "**Shares cannot be offered to the general public**, so really large sums cannot be raised"
  ]},
 {t:"h", x:"The two founding documents"},
 {t:"table", head:["Document", "Contains"], rows:[
   ["**Articles of Association**", "The internal rules: rights and duties of directors, how directors are elected, how official meetings are held, the procedure for issuing shares"],
   ["**Memorandum of Association**", "The external facts: the company's official name, the address of the registered office, the objectives of the company, and the number of shares each director will buy"]
 ]},
 {t:"trap", x:"Naming conventions vary by country and confuse students. In the UK, 'Ltd' = private, 'plc' = public. In South Africa and some others, '(Pty) Ltd' = private and plain 'Limited' = public. Read the question — it will make clear which type is meant."}
]},
{
h2: "Public limited companies (plc)",
c: [
 {t:"p", x:"Suitable for very large businesses. Shares can be advertised and sold to the general public, usually through a stock exchange."},
 {t:"pc",
  adv:[
   "**Very large capital sums** can be raised — there is no limit on the number of shareholders",
   "**Limited liability** still protects every shareholder",
   "**No restriction** on buying, selling or transferring shares, which makes shares attractive because investors can get their money back",
   "**High status** — suppliers are more willing to give credit and banks more willing to lend",
   "Incorporated, so there is continuity and a separate legal identity"
  ],
  dis:[
   "The legal formalities of formation are **complicated, expensive and slow**",
   "**Many more regulations and controls** to protect shareholders, including publishing full accounts that anyone — including competitors — can read",
   "Selling shares is **expensive**: merchant bank commission plus printing thousands of prospectuses",
   "**Risk of losing control** — the original owners can be outvoted, or the company taken over"
  ]},
 {t:"h", x:"The divorce between ownership and control"},
 {t:"p", x:"In a sole trader, partnership or most private limited companies, the owners are the managers. In a plc with thousands of shareholders, that is impossible."},
 {t:"formula", lbl:"How a plc is actually run", x:"SHAREHOLDERS own &rarr; vote at the AGM for the BOARD OF DIRECTORS &rarr; who appoint MANAGERS &rarr; who take the day-to-day decisions (control)"},
 {t:"key", x:"**The shareholders own, but the directors and managers control.** This is the *divorce between ownership and control*, and it matters because directors may run the business to meet **their own** objectives — growth to justify higher salaries, or cutting dividends to fund expansion — rather than the shareholders'."},
 {t:"eg", x:"Mike and Gita owned 50% each of their private limited company. After going public they owned 20% of the total shares between them, became very rich — and were then voted off the board when profits fell. They had lost control of a business that had once been entirely theirs."},
 {t:"tip", x:"'Should this company go public?' is a classic 12-marker. The trade-off is always **capital versus control**. Structure it: the company gains access to millions in new capital (name what it would be spent on from the case) but risks losing control, faces publication of accounts that competitors can read, and pays heavy issue costs. Then decide based on **how badly the business needs the money**."}
]},
{
h2: "Franchising",
c: [
 {t:"p", x:"The **franchisor** owns the brand and the trading method. The **franchisee** buys a licence to use it. McDonald's, The Body Shop, Subway and Dunkin' Donuts all grow this way."},
 {t:"table", head:["", "To the franchisor", "To the franchisee"], rows:[
   ["**Advantages**", "Receives a licence fee and often a percentage of turnover; expansion is far faster because the franchisee finances each new outlet; the franchisee manages the outlet; all supplies must be bought from the franchisor", "Much lower risk of failure because the product is already well known; the franchisor pays for national advertising; supplies come from a central source; fewer decisions to make; training is provided; banks lend more readily because the risk is lower"],
   ["**Disadvantages**", "Loss of some control over how outlets are run; a badly run franchise damages the whole brand's reputation; profits are shared with franchisees", "**Less independence** than an ordinary business; cannot make decisions to suit the local area, such as adding products outside the range; a licence fee and often a share of annual turnover must be paid to the franchisor"]
 ]},
 {t:"tip", x:"For 'should X buy a franchise or set up alone?', the deciding factors are usually the entrepreneur's **experience** and their **attitude to independence**. Someone with no business experience gains most from a franchise. Someone who left a job because they hated taking orders (like Jameel in the classic case) will find the franchisor's rules intolerable — and that is your judgement."}
]},
{
h2: "Joint ventures",
c: [
 {t:"pc",
  adv:[
   "**Costs are shared** — vital for very expensive projects such as developing a new aircraft",
   "**Local knowledge** when one partner is already based in the target country",
   "**Risks are shared** between the partners",
   "Faster market entry than building operations from scratch"
  ],
  dis:[
   "If the project succeeds, **profits must be shared** with the partner",
   "**Disagreements** over important decisions are likely",
   "The partners may have **different cultures and ways of running a business**",
   "Knowledge and technology may be transferred to a business that later becomes a competitor"
  ]},
 {t:"eg", x:"Walmart entered India through a joint venture with Bharti Enterprises, creating BestPrice Modern Wholesale. Walmart is the world's largest retailer, but it had little knowledge of Indian consumers, suppliers or regulations. Bharti supplied exactly that."}
]},
{
h2: "The public sector",
c: [
 {t:"p", x:"[[Public corporations]] are wholly owned by the state, usually after **nationalisation**. Government ministers appoint a board of directors to run them and set the objectives they must pursue."},
 {t:"pc",
  labels:["Advantages of public corporations", "Disadvantages of public corporations"],
  adv:[
   "Some industries are so important — water, electricity — that state ownership is considered essential",
   "**Natural monopolies** are controlled so consumers cannot be exploited by a private monopolist",
   "A failing but important business can be **nationalised to save jobs** rather than allowed to collapse",
   "Important but **unprofitable public services** — minority-interest broadcasting, rural transport — can still be provided"
  ],
  dis:[
   "**No private shareholders** demanding profit and efficiency, so the profit motive is weak",
   "**Government subsidies** breed inefficiency — managers know losses will be covered — and are unfair to private competitors",
   "Often **no close competition**, so little incentive to improve choice, efficiency or customer service",
   "Governments may use them for **political reasons**, such as creating jobs before an election"
  ]},
 {t:"p", x:"Local government authorities also run trading activities. Some are free at the point of use and paid for from local taxes (street lighting, schools); others charge and are expected at least to break even (swimming pools, theatres, markets), with a subsidy if they do not."}
]}
],
mcq: [
 {q:"Which of these has unlimited liability?", o:["A private limited company","A public limited company","A sole trader","A limited liability partnership"], a:2, why:"Sole traders and ordinary partnerships are unincorporated and carry unlimited liability."},
 {q:"'Incorporated' means the business:", o:["Has more than one owner","Has a separate legal identity from its owners","Is owned by the government","Sells shares on a stock exchange"], a:1, why:"Incorporation creates a separate legal person, which is why companies survive the death of an owner."},
 {q:"A public limited company is:", o:["Owned by the government","In the public sector","In the private sector, owned by shareholders","Always larger than a public corporation"], a:2, why:"The classic trap. 'Public' here means shares are sold to the public — the company is privately owned."},
 {q:"The Memorandum of Association contains:", o:["The rules for electing directors","The company name, registered address and objectives","The annual accounts","The partnership profit-sharing ratio"], a:1, why:"The Memorandum carries external facts; the Articles carry internal rules."},
 {q:"The 'divorce between ownership and control' means:", o:["Directors own no shares by law","Shareholders own the company but managers make the decisions","Owners must sell their shares","The company has split into two"], a:1, why:"In a large plc thousands of shareholders cannot run the business, so appointed directors and managers control it."},
 {q:"A drawback for a franchisee is that they:", o:["Must fund national advertising themselves","Cannot easily add products suited to their local area","Face a very high risk of business failure","Cannot obtain training"], a:1, why:"Product range, prices and store layout are set by the franchisor — that loss of independence is the core drawback."},
 {q:"Two businesses share the capital, risk and profit of developing a new aircraft. This is:", o:["A merger","A joint venture","A franchise","Horizontal integration"], a:1, why:"A joint venture is a shared new project; the businesses remain separate."},
 {q:"A private limited company CANNOT:", o:["Have limited liability","Employ workers","Advertise its shares for sale to the general public","Keep accounts"], a:2, why:"Only a plc may offer shares to the public. This is the key restriction on a private limited company's ability to raise capital."},
 {q:"An advantage to Mike of converting his partnership into a private limited company is:", o:["Fewer accounts need to be filed","He gains limited liability, protecting his personal possessions","He no longer pays tax","He can sell shares on the stock exchange"], a:1, why:"Limited liability is the central benefit of incorporation; filing requirements actually increase."}
],
exam: [
 {cmd:"Define", m:2,
  q:"Define 'sole trader'.",
  ctx:"",
  plan:["One owner.","Add the liability or control feature."],
  model:["A sole trader is a business that is owned and controlled by just one person (1), who takes all the decisions, keeps all the profit and has unlimited liability for the business's debts (1)."],
  marker:"1 for single ownership; 1 for control, profit or unlimited liability. 'Someone who works alone' is wrong — a sole trader can employ staff."},

 {cmd:"Outline", m:4,
  q:"Outline two benefits to Jameel of operating his new food shop as a sole trader.",
  ctx:"Jameel lost his job when a fruit and vegetable shop closed. He never liked taking the manager's orders. He has $5,000 in savings and suppliers have offered him one month's credit.",
  plan:["Benefit 1: complete control — connect to 'never liked taking orders'.","Benefit 2: few legal formalities / keeps all profit / quick to start — connect to $5,000 and needing to trade soon."],
  model:[
   "As a sole trader Jameel would have complete control over the business (1). This suits him particularly well because he disliked taking orders from the manager at his previous shop; he could now choose his own opening hours, prices and suppliers without consulting anyone (1).",
   "There are very few legal formalities to set up as a sole trader (1), so Jameel could start trading almost immediately with his $5,000, which matters because he is currently unemployed and has no income while he waits (1)."],
  marker:"4 marks. Note how both developments use a fact from the case — the dislike of orders, the $5,000, the unemployment. That is the difference between 2 and 4."},

 {cmd:"Explain", m:6,
  q:"Explain two drawbacks to Aurelie and Nadine of the partnership form of legal structure.",
  ctx:"Aurelie and Nadine set up the A and N Partnership ten years ago making handmade shoes. It employs 20 people and demand is rising rapidly. They need to invest much more capital but want to avoid a lot of risk as they both have families dependent on the income.",
  plan:["Drawback 1: unlimited liability — directly contradicts 'want to avoid risk' and 'families dependent'.","Drawback 2: limited capital — contradicts 'need to invest much more capital' and 'demand rising rapidly'.","Both drawbacks are handed to you by the case; use its exact words."],
  model:[
   "A partnership has unlimited liability, which means Aurelie and Nadine are personally responsible for the business's debts. If they borrow heavily to expand and demand then falls, creditors could force them to sell their own homes and possessions. This is a serious drawback for them specifically, because the case says both have families dependent on the income from the business and they want to avoid a lot of risk — unlimited liability gives them the opposite.",
   "A partnership can also raise only limited capital, since the money must come from the partners' own savings, retained profits and bank loans. The business already employs 20 people and demand for its handmade shoes is rising rapidly, so it needs substantial investment in workshop space and materials. Two partners are unlikely to be able to raise that on their own, and their main competitor ShoeWorks plc can afford extensive advertising that they cannot match — so the shortage of capital risks losing them market share."],
  marker:"6 marks. Both points are 'in the case' — the examiner has deliberately planted 'avoid risk / families dependent' (liability) and 'need much more capital / demand rising' (finance). Spotting planted evidence is a learnable skill."},

 {cmd:"Recommend", m:12,
  q:"If the A and N Partnership continues, recommend whether a private limited company is a suitable form of legal structure for this business. Justify your answer by considering the advantages and disadvantages.",
  ctx:"See above. Their main competitor is ShoeWorks plc, which has a much larger market share and can afford extensive advertising.",
  plan:["Advantages of Ltd for THIS business: limited liability solves the risk problem; more capital from selling shares to friends/family solves the finance problem; separate legal identity and continuity; more credibility with suppliers.","Disadvantages: legal formalities and cost; accounts published so ShoeWorks can read them; shares not transferable without agreement; still cannot raise the very large sums a plc can; some loss of control if many shares sold.","Also consider the alternative: staying a partnership, or going straight to plc.","Judgement: recommend Ltd, but note the ceiling."],
  model:[
   "**The case for a private limited company.** The two problems the case gives us are risk and capital, and incorporation addresses both. Limited liability would mean Aurelie and Nadine could lose only the money they have put into the company, not their family homes — which directly answers their stated wish to avoid risk while their families depend on the income. Second, they could sell shares to friends, relatives and possibly their employees, raising far more than two people's savings and bank borrowing could provide. That capital is exactly what a business with rapidly rising demand needs in order to buy materials and workshop capacity before the demand goes elsewhere. Incorporation also gives the business a separate legal identity, so it survives if one of them dies, and greater status with suppliers who may then offer better credit terms.",
   "**The case against.** There are real costs. The Articles and Memorandum of Association must be prepared and filed with the Registrar of Companies, which takes time and legal fees the business must pay before it earns anything. More seriously, a limited company must file its accounts, and anyone can inspect them — including ShoeWorks plc, which would be able to see A and N's sales, margins and financial weaknesses. Shares in a private limited company also cannot be transferred without the other shareholders' agreement, which puts some investors off, and the company still cannot advertise shares to the general public, so there is a ceiling on how much can be raised.",
   "**Recommendation.** A private limited company is the right structure for A and N now. The decisive point is that the two things the partners say they want — much more capital and much less personal risk — are precisely what incorporation delivers, and neither is available to them as a partnership. The loss of secrecy to ShoeWorks is a genuine cost, but ShoeWorks is already far larger and already outspends them on advertising, so the competitive damage from published accounts is marginal compared with the damage of being unable to fund growth while demand is rising. They should not go straight to plc: the formation cost is far higher, and with only 20 employees they would risk losing control of a business they have built over ten years. The limited company is the structure that fits the size they are now — and they can always convert later if growth demands it."],
  marker:"12 marks. The top band needs: advantages applied (4), disadvantages applied (4), and a judgement that decides, weighs, and rejects the alternatives with reasons (4). Explicitly ruling out 'go straight to plc' is a mark-earning move because it shows you considered more than the two options handed to you."}
]
},

/* ==================== CHAPTER 5 ==================== */
{
n: "5", s: 1,
title: "Business objectives and stakeholder objectives",
sub: "Why objectives matter, types of objective, social enterprises, stakeholders and conflict",
obj: [
  "Explain the need for and importance of business objectives",
  "Describe different business objectives, including those of social enterprises",
  "Identify the main internal and external stakeholder groups and their objectives",
  "Explain how stakeholder objectives may conflict, with examples",
  "Explain the differences between the objectives of private and public sector enterprises"
],
defs: [
  ["Objective", "An aim or target that a business works towards."],
  ["Market share", "The percentage of total market sales held by one brand or business."],
  ["Social enterprise", "A private sector business that has social and environmental objectives alongside financial ones, reinvesting profit into its social purpose."],
  ["Stakeholder", "Any person or group with a direct interest in the performance and activities of a business."],
  ["Profit", "The surplus remaining after total costs have been subtracted from revenue."]
],
blocks: [
{
h2: "Why businesses need objectives",
c: [
 {t:"ul", x:[
   "They give workers and managers a **clear target**, which helps to motivate people",
   "Decisions become focused: *will this help us achieve our objective?*",
   "Clear, measurable objectives **unite the whole business** behind the same goal",
   "Managers can **compare performance against the objective** to judge whether the business has succeeded"
 ]},
 {t:"trap", x:"Setting an objective does not guarantee success. In a 'do you think setting objectives will make the business successful?' question, the balancing point is: objectives give direction, but success also depends on competition, the economy, finance and the quality of management. Say that, then decide."}
]},
{
h2: "The main business objectives",
c: [
 {t:"table", head:["Objective", "When it dominates", "What it means in practice"], rows:[
   ["**Survival**", "New businesses; recessions; when a powerful new competitor arrives", "Managers may cut prices to keep customers even though profit per item falls. Cash matters more than profit."],
   ["**Profit**", "Most established private sector firms", "Needed to reward owners for the capital invested and the risk taken, and to finance further investment. Without any profit at all, owners will close the business."],
   ["**Growth**", "Established, confident firms in expanding markets", "Measured by sales or output. Makes jobs more secure, raises manager salaries and status, spreads risk into new products/markets, and delivers economies of scale."],
   ["**Market share**", "Competitive consumer markets", "Gives good publicity ('the most popular'), more influence over suppliers, and more power to set prices."],
   ["**Returns to shareholders**", "Public limited companies", "Achieved by raising dividends and by raising the share price. Discourages shareholders from selling and helps directors keep their jobs."],
   ["**Service to the community**", "Social enterprises; some public sector bodies", "Social, environmental and financial objectives together."]
 ]},
 {t:"formula", lbl:"Market share", x:"Market share (%) = (Company sales &divide; Total market sales) &times; 100"},
 {t:"worked", title:"Market share calculation", steps:[
   "Total market sales in one year = **$100 million**",
   "Company A's sales = **$20 million**",
   "Market share = ($20m &divide; $100m) &times; 100 = **20%**",
   "If total market sales grow to $150m and Company A's sales grow to $25m, its sales have risen but its share has *fallen* to 16.7%. Rising sales does not mean rising market share — examiners test this."
 ]},
 {t:"key", x:"**Will a business always try to maximise profit?** Not necessarily. Raising prices to boost profit can drive customers away and attract new competitors into the market, reducing long-run profit. Many owners aim for a *satisfactory* level of profit that avoids excessive working hours and high tax."},
 {t:"h", x:"Why objectives change"},
 {t:"ol", x:[
   "A business that has **survived** its first three years now aims for higher profit",
   "A business that has **achieved market share** now aims for higher returns to shareholders",
   "A profitable business hit by **recession** reverts to the short-term objective of survival"
 ]}
]},
{
h2: "Social enterprises",
c: [
 {t:"p", x:"[[Social enterprises]] are in the **private sector** — owned by private individuals, not the state — but profit is not their only goal. They typically set three objectives at once, often called the triple bottom line:"},
 {t:"table", head:["Objective", "Meaning"], rows:[
   ["**Social**", "Providing jobs and support for disadvantaged groups such as the homeless, disabled people or poor rural communities"],
   ["**Environmental**", "Protecting the environment"],
   ["**Financial**", "Making a profit — but to reinvest in expanding the social work rather than to distribute to owners"]
 ]},
 {t:"eg", x:"**RangSutra** in India helps poor village communities develop craft and clothing skills and markets their products at a fair price. Its producers are also its owners, and profits go back into improving life in those communities."},
 {t:"trap", x:"A social enterprise is **not** a public sector organisation and **not** a charity in the exam's sense. It trades, it must at least break even, and it is privately owned. Confusing it with the public sector is a common error."}
]},
{
h2: "Stakeholders and their objectives",
c: [
 {t:"table", head:["Stakeholder", "Internal / External", "What they want from the business"], rows:[
   ["**Owners / shareholders**", "Internal", "Profit, dividends, a rising share price, a return on the risk taken"],
   ["**Managers / directors**", "Internal", "High salaries, status, job security, growth of the business (which justifies higher pay)"],
   ["**Workers**", "Internal", "Good wages, job security, safe conditions, training, promotion, job satisfaction"],
   ["**Customers**", "External", "Good quality, reasonable prices, reliable supply, choice, good customer service, safe products"],
   ["**Suppliers**", "External", "Regular orders, prompt payment, a long-term relationship, fair prices"],
   ["**Banks / lenders**", "External", "That the business remains liquid and profitable so interest and loans are repaid"],
   ["**Government**", "External", "Tax revenue, employment, compliance with the law, contribution to economic growth"],
   ["**The local community**", "External", "Jobs, but also low pollution, low noise, low traffic, and protection of the local environment"]
 ]},
 {t:"h", x:"Conflicts between stakeholders — the exam's favourite"},
 {t:"p", x:"Almost every 6- and 12-mark stakeholder question is really a question about **conflict**. Learn a handful of standard conflicts and you can generate an answer for any case."},
 {t:"table", head:["Decision", "Winners", "Losers", "The conflict"], rows:[
   ["**Introduce new machinery**", "Owners (lower costs, higher profit); customers (lower prices)", "Workers (redundancy)", "Efficiency versus employment"],
   ["**Use a cheaper production method**", "Owners (higher profit)", "Local community (more pollution); customers (lower quality)", "Profit versus environment and quality"],
   ["**Expand the factory**", "Owners (long-run profit); workers (more jobs)", "Local community (noise, traffic, dirt); owners short-term (lower profit while paying for it)", "Long run versus short run; business versus community"],
   ["**Cut prices to win market share**", "Customers", "Owners (lower margin); possibly workers (cost cutting)", "Volume versus margin"],
   ["**Pay higher wages**", "Workers", "Owners (lower profit); customers (higher prices)", "Cost versus motivation"],
   ["**Retain profit to fund expansion**", "Managers (growth); the business long term", "Shareholders (lower dividends now)", "Reinvestment versus return"]
 ]},
 {t:"tip", x:"To turn a conflict into full marks, name **both** stakeholders, say what each gains or loses, and then add the consequence. 'New machines raise Oilco's profit for its owners, but the refinery workers whose jobs are replaced lose their income, and the local town — where the refinery is the main employer — will see spending in local shops fall.' That last clause is the analysis mark."},
 {t:"key", x:"Managers must **compromise**. They cannot satisfy every stakeholder, and ignoring one group has consequences — angry workers strike, angry communities campaign, angry customers leave. Managers must also change objectives over time: growth during an economic expansion, survival by cost-cutting during a recession."}
]},
{
h2: "Private sector versus public sector objectives",
c: [
 {t:"table", head:["", "Private sector", "Public sector"], rows:[
   ["Primary objective", "Profit, growth, market share, returns to shareholders", "Providing a service to the population; social objectives"],
   ["Financial target", "Maximise or achieve satisfactory profit", "Often to break even, or to keep within a budget; losses may be covered by subsidy"],
   ["Who benefits", "Owners and shareholders", "Users of the service and taxpayers"],
   ["Measure of success", "Profit, ROCE, market share, share price", "Quality and reach of the service, cost control, meeting government targets"],
   ["Response to a loss-making activity", "Close it", "May continue it if it is socially necessary (rural bus route, minority broadcasting)"]
 ]},
 {t:"p", x:"That said, the line blurs. Governments increasingly set profit or break-even targets for state-owned businesses, and private businesses increasingly adopt social and environmental objectives — partly from genuine conviction, partly because consumers reward it."}
]}
],
mcq: [
 {q:"A business's sales rise from $20m to $25m while the total market grows from $100m to $150m. Its market share has:", o:["Risen from 20% to 25%","Fallen from 20% to 16.7%","Stayed at 20%","Risen to 16.7%"], a:1, why:"Share = 25/150 = 16.7%, down from 20/100 = 20%. Sales rose but share fell because the market grew faster."},
 {q:"Which is most likely to be the main objective of a newly formed business in a recession?", o:["Maximising market share","Survival","Maximising dividends","International expansion"], a:1, why:"New businesses and recessions both push objectives towards survival, often by cutting prices even at lower margins."},
 {q:"Social enterprises are:", o:["Owned by the government","Charities that do not trade","Private sector businesses with social, environmental and financial objectives","Public corporations"], a:2, why:"They trade in the private sector but pursue a triple bottom line and reinvest profit into their social purpose."},
 {q:"Which stakeholder is INTERNAL?", o:["A supplier","The local community","A manager","The government"], a:2, why:"Internal stakeholders work for or own the business — owners, managers and workers."},
 {q:"A decision to replace workers with machines primarily creates a conflict between:", o:["Customers and suppliers","Owners and workers","Government and banks","Suppliers and the community"], a:1, why:"Owners gain lower costs and higher profit; workers lose their jobs. This is the textbook conflict."},
 {q:"Directors decide to cut dividends to fund a new factory. This conflicts with the objectives of:", o:["Managers","Shareholders","Suppliers","The government"], a:1, why:"Shareholders want returns now; managers want growth. It is a classic ownership-versus-control conflict."},
 {q:"Which is NOT usually a public sector objective?", o:["Providing a service to the whole population","Maximising returns to shareholders","Keeping within a government budget","Protecting employment in an important industry"], a:1, why:"Public corporations have no private shareholders, so shareholder returns cannot be an objective."},
 {q:"A reason a business might NOT try to maximise profit is:", o:["Profit is illegal above a certain level","High prices may drive customers away and attract new competitors","Profit cannot be measured","Shareholders dislike profit"], a:1, why:"Short-run profit maximisation can damage long-run profit by losing customers and inviting entry."}
],
exam: [
 {cmd:"Define", m:2,
  q:"Define 'stakeholder'.",
  ctx:"",
  plan:["Person or group with an interest in the business.","Add an example or the internal/external distinction."],
  model:["A stakeholder is any person or group that has a direct interest in the performance and activities of a business (1), such as its owners, workers, customers, suppliers or the local community (1)."],
  marker:"1 mark for 'person/group with an interest in the business'; 1 for an example or for the internal/external distinction. 'Someone who owns shares' is a shareholder, not a stakeholder — that scores 0 or 1."},

 {cmd:"Outline", m:4,
  q:"Outline two possible reasons why Big Pit Mining has profit as an objective.",
  ctx:"Big Pit Mining (BPM) owns coal and gold mines in several countries and employs thousands of workers, many on low pay in dangerous conditions.",
  plan:["Reason 1: reward owners/shareholders for capital and risk.","Reason 2: finance future investment — mining is capital-intensive and mines become exhausted, so new ones must be found and developed."],
  model:[
   "Profit is needed to reward the shareholders who have invested capital in BPM and taken a risk (1). Mining is a risky business — a seam may prove worthless — so investors will only put money into BPM if the returns are high enough to justify that risk, otherwise they will sell their shares and invest elsewhere (1).",
   "Profit also finances future investment (1). Mines are eventually exhausted, so BPM must constantly find and develop new sites, and the equipment for coal and gold mining is extremely expensive; retained profit is the cheapest way to pay for that without borrowing (1)."],
  marker:"4 marks. Applying to mining specifically — risk of a worthless seam, exhaustion of mines, expensive equipment — is what turns generic reasons into 4-mark answers."},

 {cmd:"Explain", m:6,
  q:"Explain how a decision to open a new BPM mine might affect two stakeholder groups.",
  ctx:"BPM's waste is often dumped in local rivers. Most of its workers are on low pay in dangerous conditions.",
  plan:["Group 1: local community — jobs (positive) but river pollution and health damage (negative).","Group 2: workers OR shareholders. Workers: employment but dangerous conditions and low pay. Shareholders: higher profits but reputational and legal risk.","For each: name the group, state the effect, follow it to a consequence."],
  model:[
   "**The local community** would be affected in two opposite ways. A new mine would create jobs in an area that may have few other employers, and the wages spent locally would support shops and services in the town. However, the case says BPM's waste is often dumped in local rivers. If the same happens at the new mine, the community's water supply could be contaminated, damaging health and harming farming and fishing that other local people depend on. The community may therefore gain income but lose the resources it needs to live.",
   "**Workers** would gain employment, which for people with few alternatives is significant. But the case makes clear that BPM's workers are on low pay and work in very dangerous conditions. Opening another mine on the same terms means more people exposed to the risk of injury or death underground, and low wages mean their standard of living rises only slightly. Over time, poor conditions are likely to cause high labour turnover and, if the workforce organises into a trade union, industrial action that disrupts BPM's output."],
  marker:"6 marks: 3 for each stakeholder group, requiring the group named, the effect stated and applied to BPM's specific situation (river dumping, low pay, dangerous conditions), and a consequence drawn out. Showing both a positive and a negative effect for one group is a strong analytical move."},

 {cmd:"Justify", m:6,
  q:"BPM's Managing Director said: 'Shareholders are our most important stakeholder group.' Do you agree? Justify your answer.",
  ctx:"",
  plan:["Agree: shareholders own the business, provide the capital, bear the risk, can remove the directors at the AGM; without them there is no business.","Disagree: without workers nothing is mined; without customers there is no revenue; a community or government that turns against BPM over pollution can close a mine entirely; damaged reputation reduces long-run shareholder value anyway.","Judgement: decide — the strongest line is that shareholders are most *powerful* but that serving only them destroys long-run shareholder value."],
  model:[
   "There is a case for the Managing Director. Shareholders own BPM and supplied the capital that bought the mines and the equipment. They carry the risk of losing their investment if a seam is worthless, and they alone can vote the directors off the board at the AGM, so in terms of formal power no other group comes close.",
   "However, treating shareholders as the only group that matters is short-sighted. Nothing is mined without workers, and workers who are underpaid and put in dangerous conditions will leave, strike, or be killed in accidents that stop production. Dumping waste in local rivers may be cheap now, but governments increasingly fine and prosecute for this, and a mine can be closed by a licence being withdrawn — which would cost shareholders far more than the pollution controls would have.",
   "I do not fully agree. Shareholders are the most *powerful* stakeholder because they can remove the board, but they are not best served by being treated as the only one. The decisive point is that BPM's mistreatment of workers and the local environment creates exactly the risks — strikes, accidents, fines, licence withdrawal — that destroy shareholder value in the long run. A Managing Director who genuinely wanted to maximise returns to shareholders would improve safety and waste disposal, not ignore them. The statement would only be right if BPM operated for a single year and then closed."],
  marker:"6 marks. The high-level move here is refusing the false choice: agreeing that shareholders are most powerful, then showing that serving them properly requires serving the others too. That is genuine evaluation rather than list-and-hedge."}
]
}

]);
