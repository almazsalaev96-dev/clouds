/* SECTION 6 — External influences on business activity (chapters 27-29) */
window.CH = (window.CH || []).concat([

/* ==================== CHAPTER 27 ==================== */
{
n: "27", s: 6,
title: "Economic issues",
sub: "The business cycle, government economic objectives, fiscal and monetary policy, supply side policies",
obj: [
  "Explain the main stages of the business cycle",
  "Explain the impact on business of changes in employment, inflation and GDP",
  "Identify government economic objectives",
  "Explain the impact of changes in taxes, government spending and interest rates",
  "Explain how businesses might respond to these changes"
],
defs: [
  ["Gross Domestic Product (GDP)", "The total value of output of goods and services in a country in one year."],
  ["Recession", "A period of falling GDP, usually with rising unemployment."],
  ["Inflation", "The increase in the average price level of goods and services over time."],
  ["Unemployment", "When people who are willing and able to work cannot find a job."],
  ["Economic growth", "When a country's GDP increases — more goods and services are produced than in the previous year."],
  ["Real income", "The value of income measured by what it can buy. Real income falls when prices rise faster than money income."],
  ["Balance of payments", "The record of the difference between a country's exports and imports."],
  ["Exports", "Goods and services sold from one country to other countries."],
  ["Imports", "Goods and services bought in by one country from other countries."],
  ["Fiscal policy", "Any change by the government in tax rates or public sector spending."],
  ["Direct taxes", "Taxes paid directly from incomes, such as income tax or profits tax."],
  ["Indirect taxes", "Taxes added to the prices of goods, paid by taxpayers as they purchase, such as VAT."],
  ["Disposable income", "The level of income a taxpayer has left after paying income tax."],
  ["Monetary policy", "A change in interest rates by the government or central bank."],
  ["Import tariff", "A tax placed on imported goods when they arrive in the country."],
  ["Import quota", "A physical limit on the quantity of a product that can be imported."],
  ["Supply side policies", "Policies that aim to make an economy more efficient and its industries more competitive."]
],
blocks: [
{
h2: "The business cycle",
c: [
 {t:"table", head:["Stage", "What happens", "Effect on most businesses"], rows:[
   ["**Growth**", "GDP is rising, unemployment falling, living standards improving", "Sales and profits rise; businesses invest and recruit"],
   ["**Boom**", "Too much spending. Prices rise quickly, skilled workers become scarce", "Business costs rise — wages and materials. Uncertainty grows. This is often what causes the next downturn"],
   ["**Recession**", "GDP actually falls, usually caused by too little spending", "Falling demand and profits; workers lose jobs; weak businesses close"],
   ["**Slump**", "A deep, prolonged recession. Very high unemployment; prices may fall", "Many businesses fail to survive"]
 ]},
 {t:"key", x:"Governments try to avoid recession **and** boom. A boom with rapid inflation and rising costs typically creates the conditions for the recession that follows."},
 {t:"h", x:"How the key indicators affect business"},
 {t:"table", head:["Indicator", "Effect on business"], rows:[
   ["**Rising unemployment**", "Easier and cheaper to recruit — more applicants per vacancy. But customers' incomes fall, so sales drop. **Businesses selling cheaper products may actually gain** as consumers trade down"],
   ["**Rising inflation**", "Business costs rise; prices must go up, which may cut sales. Consumers spending more on essentials have less left for non-essentials. **The effect depends on the type of product** — necessities are affected far less than luxuries"],
   ["**Rising GDP**", "Generally more sales as employment and incomes rise. But recruitment becomes harder and wage costs rise as unemployment falls"]
 ]},
 {t:"trap", x:"Never write 'a recession is bad for all businesses'. Discount retailers, repair services, second-hand goods dealers and budget food brands often **grow** in a recession as consumers trade down. Naming that exception is a reliable evaluation mark."}
]},
{
h2: "Government economic objectives",
c: [
 {t:"table", head:["Objective", "Why it matters", "Problems if not achieved"], rows:[
   ["**Low inflation**", "Encourages businesses to invest and expand; keeps exports price-competitive", "Wages buy less, so **real incomes fall** and workers demand rises; the country's goods become expensive relative to foreign ones, so jobs are lost to imports; businesses will not invest amid uncertainty"],
   ["**Low unemployment**", "Raises total output and living standards", "Unemployed people produce nothing, so output is below potential; the government pays unemployment benefit, which cannot then be spent on schools and hospitals"],
   ["**Economic growth**", "Rising GDP raises living standards", "Falling GDP means fewer workers needed, so unemployment rises; the population can afford less; businesses do not expand"],
   ["**Balance of payments**", "Long-run balance between exports and imports", "A deficit means the country may **run out of foreign currency** and have to borrow from abroad; the exchange rate falls (depreciation), so the currency buys less"]
 ]},
 {t:"worked", title:"Real income — the calculation examiners like", steps:[
   "Joe earned **$20,000** in 2017 and received a **10% pay rise** in 2018, so he now earns **$22,000**",
   "But inflation in 2018 was **15%**",
   "Money income rose 10%; prices rose 15%",
   "**Real income fell by approximately 5%** — Joe can buy less than before despite earning more",
   "The lesson for business: in high inflation, workers will demand large pay rises simply to stand still, which raises costs and can trigger further inflation."
 ]}
]},
{
h2: "Fiscal policy: taxes and government spending",
c: [
 {t:"table", head:["Tax", "What it is", "Effect on business if RAISED"], rows:[
   ["**Income tax**", "A direct tax on people's incomes, usually progressive (higher earners pay a higher rate)", "**Disposable income falls**, so consumers spend less. Sales fall, output is cut and workers may lose jobs. **Businesses selling luxuries are hit hardest**; those selling essentials much less"],
   ["**Corporation / profits tax**", "A direct tax on company profits", "**Profit after tax falls**, so less finance is available for reinvestment and expansion; new projects may be cancelled. Fewer people start businesses; share prices may fall"],
   ["**Indirect taxes (VAT)**", "Added to the price of goods; usually avoided on essentials such as basic food", "**Prices in the shops rise**, so consumers may buy less. Workers' real incomes fall, so pressure for wage rises increases business costs. Again, essentials are affected far less"],
   ["**Import tariffs**", "A tax on imported goods", "**Domestic firms competing with imports gain**, as imports become dearer. But firms **importing materials or components face higher costs**. Other countries may **retaliate**, damaging exporters"]
 ]},
 {t:"worked", title:"Working out disposable income", steps:[
   "Tax rates: **20%** on the first $5,000 of income; **30%** on income above $5,000",
   "John earns **$10,000**",
   "Tax on first $5,000 = 20% &times; $5,000 = **$1,000**",
   "Tax on next $5,000 = 30% &times; $5,000 = **$1,500**",
   "Total tax = **$2,500**. **Disposable income = $10,000 &minus; $2,500 = $7,500**",
   "This $7,500 is what John can actually spend or save — and it is what businesses are competing for."
 ]},
 {t:"h", x:"Government spending"},
 {t:"p", x:"Governments spend tax revenue on education, health, defence, law and order, and transport. **Raising** spending creates demand, jobs and growth — and directly benefits businesses supplying schools, hospitals, defence equipment, roads and railways. **Cutting** spending has the reverse effect and can be devastating for businesses dependent on public sector contracts."},
 {t:"tip", x:"For any tax or interest-rate question, the single most valuable move is to **classify the product**. Ask: is this a necessity or a luxury? Is demand price elastic or inelastic (Chapter 13)? A rise in income tax devastates a business selling foreign holidays and barely touches one selling salt. Naming the product type before analysing the effect is what turns a generic answer into an applied one."}
]},
{
h2: "Monetary policy: interest rates",
c: [
 {t:"p", x:"An interest rate is the cost of borrowing money, normally set by the government or central bank."},
 {t:"table", head:["Effect of HIGHER interest rates", "Consequence"], rows:[
   ["**Existing variable-rate loans cost more**", "Interest payments rise, so profits fall — less to distribute to owners and less retained for expansion"],
   ["**New borrowing becomes more expensive**", "Investment decisions are delayed or cancelled; fewer factories and offices are built; entrepreneurs cannot afford the capital to start up"],
   ["**Consumers with mortgages have less to spend**", "Demand falls across almost all goods and services"],
   ["**Consumers are unwilling to borrow for expensive items**", "Businesses selling **cars, houses and other credit-financed goods are hit hardest** — they may cut output and make workers redundant"],
   ["**Foreign investors deposit money in the country to earn the higher rate**", "Demand for the currency rises, so the **exchange rate appreciates** — imports look cheaper and exports become more expensive"]
 ]},
 {t:"trap", x:"Interest rate changes affect businesses **very unevenly**. A highly geared business with large variable-rate loans, or one selling expensive goods usually bought on credit, is severely affected. A debt-free business selling low-cost everyday items barely notices. Always identify which type the case describes."}
]},
{
h2: "Supply side policies",
c: [
 {t:"ul", x:[
   "**Privatisation** — using the profit motive to improve efficiency (Chapter 2)",
   "**Improving training and education** — raising the skills of the workforce, especially in industries short of qualified staff such as computing",
   "**Increasing competition** — reducing government controls on industry, or acting against monopolies to encourage new businesses"
 ]},
 {t:"p", x:"These are called supply side policies because they aim to improve the efficient **supply** of goods and services, allowing businesses to expand, produce more and employ more people."}
]},
{
h2: "How businesses respond",
c: [
 {t:"table", head:["Policy change", "Possible business response", "Problem with that response"], rows:[
   ["**Income tax raised** (less consumer spending)", "Lower prices to sustain demand; introduce cheaper versions of products", "Less profit per item sold; a cheaper version may damage the brand image"],
   ["**Import tariffs raised**", "Focus on the domestic market, where local goods are now relatively cheaper; switch from imported to locally produced materials", "Exporting may still be more profitable; local materials may be lower quality"],
   ["**Interest rates raised**", "Reduce investment; develop cheaper products consumers can still afford; sell assets to repay loans", "Competitors that keep investing gain market share; the assets sold may be needed later"],
   ["**Government spending raised**", "Shift marketing towards winning public sector contracts — schools, hospitals, roads", "Every competitor will do the same, so competition for those contracts is intense"]
 ]},
 {t:"key", x:"The overall impact of any response depends on **how large the policy change is** and **what competitors do**. A price cut only wins market share if rivals do not match it — that conditional is the heart of a strong evaluation answer."}
]}
],
mcq: [
 {q:"A recession is defined as a period of:", o:["Rising prices","Falling GDP","Rising exports","Falling interest rates"], a:1, why:"Recession means total output actually falls, usually with rising unemployment."},
 {q:"Joe's wage rises 10% while inflation is 15%. His real income has:", o:["Risen 10%","Risen 5%","Fallen about 5%","Stayed the same"], a:2, why:"Prices rose faster than money income, so what his wage will buy has fallen by roughly 5%."},
 {q:"An increase in income tax would MOST damage a business selling:", o:["Basic bread","Salt","Foreign holidays","Tap water"], a:2, why:"Disposable income falls, so luxuries are cut first. Necessities are far less affected."},
 {q:"Higher interest rates would MOST damage a business selling:", o:["Newspapers","Cars bought on credit","Chewing gum","Bus tickets"], a:1, why:"Expensive goods financed by borrowing suffer most when the cost of borrowing rises."},
 {q:"An import tariff is:", o:["A physical limit on imports","A tax on imported goods","A subsidy to exporters","A ban on foreign products"], a:1, why:"A tariff is a tax; a quota is the physical limit."},
 {q:"A business that imports its raw materials would be harmed by:", o:["Lower interest rates","Higher import tariffs","Lower corporation tax","Higher government spending on roads"], a:1, why:"Tariffs raise the cost of its inputs, increasing its costs of production."},
 {q:"Which is a supply side policy?", o:["Raising income tax","Improving training and education","Increasing interest rates","Increasing unemployment benefit"], a:1, why:"Supply side policies raise the efficiency and competitiveness of the economy — training, privatisation, more competition."},
 {q:"A balance of payments deficit means:", o:["Exports exceed imports","Imports exceed exports","The government spends more than it taxes","Inflation is above target"], a:1, why:"More money flowing out for imports than coming in from exports; the third option describes a budget deficit."},
 {q:"During a recession, which business is MOST likely to see sales rise?", o:["A luxury car dealer","A discount food retailer","A high-end jeweller","A first-class airline"], a:1, why:"Consumers trade down in a recession, so budget and discount businesses can grow while luxury sellers suffer."}
],
exam: [
 {cmd:"Define", m:2,
  q:"Define 'inflation'.",
  ctx:"",
  plan:["Rise in the average price level.","Add: over time / and its effect on real income."],
  model:["Inflation is an increase in the average price level of goods and services in an economy over a period of time (1). It means that a given amount of money buys less than before, so consumers' real incomes fall unless wages rise by at least as much (1)."],
  marker:"1 mark for 'rise in average prices'; 1 for 'over time' or the real income consequence. 'Prices going up' alone is too vague for both marks."},

 {cmd:"Outline", m:4,
  q:"Outline two types of taxes that a government can use to raise revenue.",
  ctx:"",
  plan:["Tax 1: a direct tax — income tax or corporation tax.","Tax 2: an indirect tax — VAT or import tariffs.","Name it, say what it is charged on."],
  model:[
   "**Income tax** is a direct tax charged on people's incomes (1), usually at a higher percentage rate for higher earners, and paid directly to the government out of wages and salaries (1).",
   "**Value Added Tax** is an indirect tax added to the price of goods and services (1), so it is collected by businesses as consumers buy products and then passed to the government (1)."],
  marker:"4 marks: 2 taxes named (1 each) with an explanation of what each is charged on (1 each). Using the direct/indirect classification adds precision."},

 {cmd:"Explain", m:6,
  q:"Explain two ways in which an increase in interest rates could affect businesses in Country A.",
  ctx:"The economy of Country A is growing rapidly. Unemployment is falling and most consumers' incomes are rising. Inflation increased to 8% last year and business owners fear the government will raise interest rates.",
  plan:["Effect 1: cost of existing and new borrowing rises → investment cancelled, profits fall.","Effect 2: consumer demand falls, especially for goods bought on credit → sales fall.","Apply to a rapidly growing economy where businesses are likely to be borrowing to expand."],
  model:[
   "Higher interest rates would raise the cost of borrowing. In Country A the economy is growing rapidly, so many businesses will have taken out loans to fund expansion — new premises, machinery and stock. If those loans are at variable rates, the interest payments rise immediately, cutting profits and leaving less retained profit to fund further growth. Businesses planning new investment would be likely to delay or cancel it, which slows the expansion that is currently driving the economy.",
   "Consumer demand would also fall. Consumers with mortgages and other loans would have less income left to spend once their repayments rose, and those thinking of buying expensive items on credit — cars, furniture, houses — would postpone the purchase. Businesses selling those goods would be hit hardest and might have to cut output and make workers redundant, which would begin to reverse the falling unemployment described in the case. Businesses selling low-cost everyday essentials would be much less affected, because those purchases are not financed by borrowing."],
  marker:"6 marks: 3 per effect. The second answer's final sentence — distinguishing which businesses are hit hardest — is the analytical refinement that separates 5 marks from 6."},

 {cmd:"Justify", m:6,
  q:"Do you think that increased government spending on more roads and airports is a good idea? Justify your answer.",
  ctx:"The government in Country B is planning to increase taxes and use the revenue to build more roads and airports to reduce unemployment and increase economic growth. Inflation was very high last year but has started to fall.",
  plan:["For: creates jobs directly and in supplier businesses; better infrastructure cuts transport costs for all firms long term; raises GDP.","Against: funded by higher taxes, which reduce consumer spending and business profits — the gain may be offset; inflation risk if the economy is already near capacity; opportunity cost — the money could go to schools or hospitals; construction jobs are temporary.","Judgement: decide, using the inflation fact."],
  model:[
   "There is a strong case for it. Building roads and airports creates jobs directly in construction and indirectly in the businesses that supply materials and equipment, which addresses the unemployment the government is targeting. The completed infrastructure also has lasting value: better roads reduce transport costs and delivery times for every business in the country, and airports support tourism and exports, so the benefit continues long after the construction workers have moved on.",
   "However, the spending is funded by **higher taxes**, and that partly cancels the benefit. Higher income tax reduces consumers' disposable income, so they spend less and businesses selling to them lose sales; higher profits tax leaves companies with less to reinvest. There is also an inflation risk: the case says inflation was very high last year, and pumping government spending into an economy can push prices up again, particularly by bidding up construction wages and material costs. And there is an opportunity cost — the same money could have gone to schools or hospitals.",
   "On balance it is a good idea, but the government should proceed **gradually**. The decisive factor is that inflation, though high last year, is now falling: that means there is probably some spare capacity in the economy, so extra spending is more likely to create real output and jobs than simply to raise prices. Infrastructure is also one of the few forms of government spending that improves the economy's long-term productive capacity rather than just its short-term demand, which is exactly what a country recovering from high inflation needs. The risk is one of scale rather than principle — if the programme were too large and too fast it would reignite the inflation that is only just coming under control."],
  marker:"6 marks. The top-band move is using the specific case fact — inflation high but now falling — as the decisive evidence, and framing the judgement as a question of scale and timing rather than a flat yes or no."}
]
},

/* ==================== CHAPTER 28 ==================== */
{
n: "28", s: 6,
title: "Environmental and ethical issues",
sub: "Externalities, sustainable development, pressure groups, legal controls, business ethics",
obj: [
  "Explain how business activity can impact on the environment",
  "Explain the concept of externalities — external costs and benefits of business decisions",
  "Explain sustainable development and how business can contribute to it",
  "Explain how and why business might respond to environmental pressures and opportunities",
  "Explain the role of legal controls over business activity affecting the environment",
  "Explain ethical issues a business might face and the conflict between profits and ethics"
],
defs: [
  ["Social responsibility", "When a business decision benefits stakeholders other than shareholders, for example protecting the environment by reducing pollution."],
  ["Environment", "Our natural world, including pure air, clean water and undeveloped countryside."],
  ["Global warming", "A gradual increase in the overall temperature of the Earth's atmosphere, generally thought to be caused by increased levels of carbon dioxide and other pollutants."],
  ["Private costs", "The costs of an activity paid for by the business or the consumer of the product."],
  ["Private benefits", "The gains from an activity to the business or the consumer of the product."],
  ["External costs", "Costs of business activity paid for by the rest of society rather than by the business."],
  ["External benefits", "Gains to the rest of society, other than the business, resulting from business activity."],
  ["Social cost", "External costs plus private costs."],
  ["Social benefit", "External benefits plus private benefits."],
  ["Cost-benefit analysis", "Giving a value to all the private and external costs and benefits of a decision in order to judge whether it should proceed."],
  ["Sustainable development", "Development which does not put at risk the living standards of future generations."],
  ["Pressure group", "A group of people who act together to try to force businesses or governments to adopt certain policies."],
  ["Consumer boycott", "When consumers decide not to buy products from businesses that do not act in a socially responsible way."],
  ["Ethical decision", "A decision taken because of a moral code rather than purely for profit."]
],
blocks: [
{
h2: "Business activity and the environment",
c: [
 {t:"ul", x:[
   "Aircraft jet engine emissions damage the atmosphere",
   "Pollution from factory chimneys reduces air quality",
   "Waste disposal pollutes rivers and seas",
   "Transporting goods by ship and truck burns fossil fuels, creating carbon emissions linked to **global warming** and climate change",
   "Extraction of non-renewable resources — rainforest timber, minerals, oil — leaves less for future generations"
 ]},
 {t:"h", x:"The central argument"},
 {t:"table", head:["Businesses should focus on producing profitably", "Businesses have a social responsibility"], rows:[
   ["Protecting the environment is **expensive** — reducing waste, recycling and cutting emissions all cost money and reduce profits", "Global warming and pollution affect everyone, and businesses have a **moral duty** to reduce their contribution"],
   ["Firms may have to **raise prices** to pay for it", "Using non-renewable resources leaves **less for future generations** and raises prices in the long run"],
   ["That makes them **uncompetitive** against businesses in countries with weaker rules", "Most scientists believe business activity can damage the environment **permanently**"],
   ["Consumers buy less if prices rise", "Consumers are increasingly **choosing environmentally responsible businesses**, so it is a marketing advantage"],
   ["If pollution is a problem, **governments should pay** to clean it up", "**Pressure groups** can damage a polluting business's reputation and sales"],
   ["Some owners argue there is not enough proof of permanent damage", "Legal penalties and licence withdrawal are real financial risks"]
 ]}
]},
{
h2: "Externalities",
c: [
 {t:"p", x:"When a business decides where to locate a factory it counts only its **private costs and benefits**. Society bears others."},
 {t:"worked", title:"A chemical factory next to a housing estate", steps:[
   "**Private costs** to the business: cost of land, construction, labour, running the plant, transport of materials and products",
   "**Private benefits** to the business: the money made from selling the chemicals",
   "**External costs** to society: waste products cause pollution; smoke and fumes may damage residents' health; parkland is lost to local people; noise disturbs the neighbourhood",
   "**External benefits** to society: jobs are created in a high-unemployment area; other businesses move in to supply the plant; the company pays taxes that fund public services",
   "**Social cost = private costs + external costs.** **Social benefit = private benefits + external benefits.**",
   "In a **cost-benefit analysis** a government values all four and compares them. If social benefit exceeds social cost, permission is likely; if not, it is refused. The difficulty is valuing things like the loss of a park for children to play in."
 ]},
 {t:"tip", x:"'Explain two external costs and two external benefits' is a standard 8-marker. The trick is to keep them **external** — a cost to *society*, not to the business. Higher wage costs are a private cost. Contaminated drinking water is an external cost. Getting this wrong loses half the marks, so check every point by asking: *who pays for this — the business, or someone else?*"}
]},
{
h2: "Sustainable development",
c: [
 {t:"key", x:"[[Sustainable development]] means achieving economic growth **without damaging the environment and society for future generations**. World energy demand and carbon emissions are both rising with population and industrialisation, and many economists argue the current rate cannot continue."},
 {t:"table", head:["What business can do", "How it works"], rows:[
   ["**Use renewable energy**", "Fit solar panels or buy energy generated from wind, tidal or hydroelectric sources"],
   ["**Recycle waste**", "Re-use water and materials that would otherwise be disposed of, reducing total resource use"],
   ["**Use fewer resources**", "Lean production (Chapter 18) manages production so that the minimum quantity of resources is consumed"],
   ["**Develop environmentally friendly products and processes**", "Replacing cans and bottles with biodegradable packaging; low-carbon production methods"]
 ]},
 {t:"eg", x:"**Tunweni Drinks in Namibia** adopted the Zero Emissions Research Initiative. Grain fibres left over from production are recycled to cultivate mushrooms; waste is fed into a biodigester that produces methane used as energy in the plant; waste water fills a pond used to farm fish. Its Chief Executive: 'This makes our business much more sustainable and gives us a **competitive edge**.' Sustainability and profit are not always opposed."}
]},
{
h2: "How businesses are made to respond",
c: [
 {t:"table", head:["Pressure", "How it works", "When it succeeds", "When it fails"], rows:[
   ["**Consumers**", "Bad publicity about dumping waste or destroying a natural site causes people to stop buying", "An increasing proportion of consumers care about the environment, and lost sales force change fast", "Where consumers care only about price, or where the business sells to other businesses rather than the public"],
   ["**Pressure groups**", "Greenpeace, Earth First! and others organise blockades, publicity campaigns and **consumer boycotts**", "The group has popular support and media coverage; a boycott genuinely cuts sales; the group is well organised and financed", "The activity is unpopular but **not illegal**; changing methods costs more than the lost sales; the business sells to other businesses so public pressure is weak"],
   ["**Government legal controls**", "Making activities illegal — locating in national parks, dumping waste in rivers, making non-recyclable products. **Pollution permits** licence a level of pollution; exceeding it means buying more permits from cleaner firms or paying large fines. Additional taxes on polluting goods", "Enforcement is effective and penalties are large enough to exceed the cost of compliance", "It is hard to prove which business dumped the waste; some governments keep rules weak to attract businesses and create jobs"]
 ]},
 {t:"key", x:"**Pollution permits** are worth understanding properly: a business that pollutes less than its permit allows can **sell** the surplus to a dirtier firm. That gives every business a financial incentive to reduce pollution — clean firms earn money, dirty firms pay. It uses the market rather than fighting it."},
 {t:"trap", x:"For 'should the government have strict environmental laws?', the balanced answer notes the genuine trade-off: strict controls add to costs and can drive businesses to countries with weaker rules, costing jobs. But weak controls damage the health and resources of the population, and consumers in export markets increasingly refuse to buy from polluting producers. Present both, then decide."}
]},
{
h2: "Ethical issues",
c: [
 {t:"p", x:"An [[ethical decision]] is one taken because of a moral code rather than purely for profit. Common ethical questions in business include:"},
 {t:"ul", x:[
   "Taking or offering **bribes** to government officials or employees of other businesses",
   "Employing **child workers**, even where it is not illegal locally",
   "Buying supplies that caused **environmental damage**, such as rainforest timber",
   "**Fixing prices** with competitors",
   "Paying directors very large bonuses while **making workers redundant**",
   "**Dynamic pricing** that charges higher prices to customers whose buying history suggests they can pay more"
 ]},
 {t:"table", head:["The two extreme positions", ""], rows:[
   ["'As long as a business does not break the law, any decision is acceptable — businesses exist to make profit.'", "'Even if an activity is legal, it can be unethical and therefore wrong, whatever profit it produces.'"]
 ]},
 {t:"h", x:"The business case for ethical decisions"},
 {t:"table", head:["Potential benefits of behaving ethically", "Potential costs"], rows:[
   ["Consumers may **switch to you** and away from competitors who do not", "**Higher costs** — adult workers cost more than children; good working conditions cost money"],
   ["**Good publicity** acts as free promotion; unethical rivals suffer bad publicity", "**Prices may have to be higher** than less scrupulous competitors'"],
   ["**Long-term profits** may increase even if short-term profits fall", "If consumers care only about price, **sales could fall**"],
   ["Easier to **recruit good employees** and raise capital from investors who want an ethical association", "**Short-term profits** may fall"],
   ["**Less risk of legal action**, fines and licence withdrawal", "In some cases, families lose income if child employment ends — the ethical answer is not always obvious"]
 ]},
 {t:"eg", x:"**The pay gap.** In 2017 some of India's largest listed companies paid top executives up to **1,200 times** the average employee's pay, while average pay stagnated. In South Africa the director-to-worker ratio moved from roughly 50:1 thirty years ago to around 500:1. Companies paying these sums often negotiate simultaneously with unions for lower worker pay rises. Defenders argue that top talent must be paid to attract it; critics argue it damages morale, loyalty and consumer trust. There is no single right answer — which is exactly why it makes a good evaluation question."},
 {t:"tip", x:"Ethics questions have no 'correct' answer, and examiners know that. What earns marks is the **structure**: state the ethical objection, state the commercial case, identify **which stakeholders gain and lose**, then decide with a reason grounded in this business's specific position. The most sophisticated move is to show that ethics and long-run profit often point the same way — a business that mistreats workers and pollutes rivers is creating the strikes, fines and licence withdrawals that destroy shareholder value later."}
]}
],
mcq: [
 {q:"An external cost of building a new factory would be:", o:["The cost of the land","Wages paid to construction workers","Air pollution affecting local residents","Interest on the loan"], a:2, why:"External costs fall on society, not the business. The other three are private costs paid by the firm."},
 {q:"Social cost is:", o:["External costs only","Private costs plus external costs","Private costs minus external benefits","The cost to the government"], a:1, why:"Social cost adds together everything the decision costs the business and everything it costs society."},
 {q:"Sustainable development means:", o:["Growing as fast as possible","Development that does not put at risk the living standards of future generations","Never building new factories","Only using recycled materials"], a:1, why:"The definition centres on not compromising the ability of future generations to meet their needs."},
 {q:"A pressure group is MOST likely to change a business's behaviour when:", o:["The business sells only to other businesses","A consumer boycott significantly reduces sales","Changing methods costs more than the lost sales","The activity is legal and unnoticed"], a:1, why:"Lost revenue is the pressure businesses respond to; the other three describe when campaigns fail."},
 {q:"Pollution permits work by:", o:["Banning all pollution","Allowing clean businesses to sell surplus permits to polluting ones","Taxing consumers","Giving grants to polluters"], a:1, why:"A tradeable permit gives clean firms an income and dirty firms a cost — a market incentive to reduce pollution."},
 {q:"Which is an ethical rather than a legal issue in most countries?", o:["Dumping toxic waste in a river","Paying below the legal minimum wage","Paying directors 1,000 times the average worker's wage","Selling products that are not fit for purpose"], a:2, why:"Extreme pay ratios are legal almost everywhere but widely questioned on moral grounds; the other three are illegal."},
 {q:"A potential benefit to a business of acting ethically is:", o:["Lower production costs","Good publicity that attracts customers from less ethical rivals","Higher short-term profits guaranteed","No need for quality control"], a:1, why:"Reputation is the main commercial return on ethical behaviour, though costs usually rise in the short run."},
 {q:"A business argues it should not have to reduce pollution because competitors abroad do not. This is an argument about:", o:["Sustainable development","Competitiveness and cost","External benefits","Consumer boycotts"], a:1, why:"The claim is that environmental compliance raises costs relative to less regulated rivals."}
],
exam: [
 {cmd:"Define", m:2,
  q:"Define 'sustainable development'.",
  ctx:"",
  plan:["Development that does not damage prospects for future generations.","Add the growth/environment balance."],
  model:["Sustainable development is economic development that does not put at risk the living standards of future generations (1), achieving growth without permanently damaging the environment or using up non-renewable resources that later generations will need (1)."],
  marker:"1 mark for the future generations idea; 1 for the growth-without-damage element or a valid example."},

 {cmd:"Outline", m:4,
  q:"Outline two ways in which Jean-Luc's furniture business impacts on the environment.",
  ctx:"Jean-Luc's factory buys wood from the cheapest sources, which he believes come from rainforests being cut down. Furniture is transported by truck and ship. Waste wood is burnt because it is cheaper than processing it. Air quality in his country is very poor.",
  plan:["Impact 1: deforestation from rainforest timber — a non-renewable resource in practice.","Impact 2: burning waste wood adds to the already poor air quality; transport emissions.","Use the case facts."],
  model:[
   "Buying timber from rainforest sources contributes to deforestation (1). Rainforests take decades or centuries to regrow and absorb carbon dioxide, so cutting them down both destroys habitats and worsens global warming — and it uses a resource that will not be available to future generations (1).",
   "Burning waste wood releases smoke and carbon dioxide directly into the atmosphere (1), and the case states that air quality in Jean-Luc's country is already very poor, so his factory is adding to a pollution problem that damages the health of people living nearby (1)."],
  marker:"4 marks. Both impacts are lifted straight from the case — the examiner has planted 'rainforests', 'burnt' and 'air quality is very poor'. Always harvest the planted evidence first."},

 {cmd:"Explain", m:6,
  q:"Explain two possible benefits to Jean-Luc's business of becoming more environmentally friendly.",
  ctx:"Jean-Luc promotes his business as supporting sustainable development because wood is better for the environment than plastic or metal. His furniture is sold in many countries.",
  plan:["Benefit 1: marketing advantage — his furniture is sold internationally, and consumers in many export markets actively choose sustainable products; also removes the risk of being exposed as making a false claim.","Benefit 2: cost savings from processing waste rather than burning it; avoids future fines and tightening regulation.","Analyse each to sales or cost."],
  model:[
   "The strongest benefit is a marketing one, and it is urgent for Jean-Luc specifically. He already promotes his business as supporting sustainable development, but he buys rainforest timber and burns his waste — so the claim is false. His furniture is sold in many countries, and consumers in export markets increasingly check these claims and boycott businesses that make them dishonestly. Genuinely sourcing certified sustainable timber would turn a marketing risk into a marketing asset, letting him charge a premium to environmentally conscious customers rather than facing exposure and lost contracts.",
   "There are also direct financial benefits. Waste wood that is currently burnt could be processed into chipboard, sold as fuel or reused in production, turning a disposal cost into either a saving or a small revenue. Beyond that, environmental regulation is tightening in most countries, and a business that burns waste in a country with very poor air quality is an obvious future target for fines or restrictions. Changing now, at his own pace, is far cheaper than being forced to change suddenly by a new law or a prosecution."],
  marker:"6 marks: 3 per benefit. The first answer is exceptionally strong because it identifies the **contradiction in the case** — he claims sustainability but does the opposite — and turns it into business analysis."},

 {cmd:"Justify", m:6,
  q:"Marie, the Chief Executive of MST, said: 'Profits must be increased as a priority; ethical decisions can come later.' Do you agree? Justify your answer.",
  ctx:"MST is a large steel maker. Sales and profits have fallen. One director paid a bribe to a government official to win a contract. MST has opened a huge works in a low-income country where pollution controls are weak, wages are low and some children are employed in non-dangerous jobs.",
  plan:["Agree: MST's profits are falling and shareholders demand returns; low costs abroad are legal there; a loss-making business helps nobody and would cost jobs.","Disagree: bribery is illegal in most jurisdictions and carries huge fines and possible imprisonment; weak pollution controls invite licence withdrawal and international boycotts; child labour destroys reputation with customers and investors; these risks destroy the very profits Marie is protecting.","Judgement: reject the sequencing — 'later' is the flaw."],
  model:[
   "There is a case for Marie's position. MST's sales and profits are falling, and a business that does not return to profit cannot pay its workers or its shareholders at all — so restoring profitability is genuinely urgent. Low wages in the new works are legal in that country, and the children employed are said to be in non-dangerous jobs, in an economy where family incomes may depend on that work.",
   "But her sequencing is the problem. **Bribery is not a matter of ethics that can wait — it is a crime**, in most countries including the one where MST is headquartered, and companies are prosecuted for bribes paid by their directors abroad. The penalties are enormous fines, exclusion from future government contracts and possible imprisonment. Weak pollution controls carry a similar risk: a licence can be withdrawn, closing a huge works overnight. And a steel maker discovered to be employing children faces boycotts from the manufacturers who buy its steel, many of whom have their own ethical sourcing rules.",
   "I do not agree with Marie, and the reason is not moral disapproval — it is that her strategy will not achieve the profits she is prioritising. Every one of the three practices creates a risk of a sudden, very large cost: a fine, a closed plant, a lost customer. Those costs would dwarf the savings, and they arrive without warning. The decisive point is the word 'later': ethical failures are not deferred obligations that can be tidied up once profits recover — they are liabilities accumulating now, and the longer they run the larger the eventual cost. A Chief Executive genuinely focused on profit would stop the bribery immediately, meet proper pollution standards, and replace the child workers — because those are the actions that protect the profit stream she is trying to rebuild."],
  marker:"6 marks. The highest-scoring approach here is not to argue from morality alone but to show that the **commercial case and the ethical case coincide** — that Marie's own objective is best served by acting ethically. Distinguishing bribery (illegal) from low wages (legal but questionable) also demonstrates precision."}
]
},

/* ==================== CHAPTER 29 ==================== */
{
n: "29", s: 6,
title: "Business and the international economy",
sub: "Globalisation, tariffs and quotas, multinationals, exchange rates",
obj: [
  "Explain the concept of globalisation and the reasons for it",
  "Explain the opportunities and threats of globalisation for business",
  "Explain why governments might introduce import tariffs and quotas",
  "Explain why a business might become a multinational and the impact on its stakeholders",
  "Explain the benefits and drawbacks of multinationals to the countries they operate in",
  "Explain how exchange rate changes affect businesses as importers and exporters"
],
defs: [
  ["Globalisation", "The increase in worldwide trade and the movement of people and capital between countries."],
  ["Free trade agreement", "An agreement between countries to trade with no barriers such as tariffs and quotas."],
  ["Protectionism", "When a government protects domestic businesses from foreign competition using tariffs and quotas."],
  ["Import tariff", "A tax placed on imported goods when they arrive in the country."],
  ["Import quota", "A restriction on the quantity of a product that can be imported."],
  ["Multinational business", "A business with factories, production or service operations in more than one country. Also called a transnational business."],
  ["Repatriation of profits", "When a multinational sends the profits earned in a host country back to its home country."],
  ["Exchange rate", "The price of one currency in terms of another currency."],
  ["Currency appreciation", "When the value of a currency rises so that it buys more of another currency."],
  ["Currency depreciation", "When the value of a currency falls so that it buys less of another currency."]
],
blocks: [
{
h2: "Globalisation",
c: [
 {t:"h", x:"Why it has accelerated"},
 {t:"ul", x:[
   "**Free trade agreements and economic unions** have reduced protection, so consumers can buy from other countries with few or no import controls",
   "**Improved and cheaper transport and communications** make it easier to move products globally; containerisation has cut shipping costs dramatically",
   "**The internet and e-commerce** allow price comparison and ordering from anywhere in the world",
   "**Emerging market countries** such as China and those in Southeast Asia have industrialised so rapidly that they now export in huge quantities at very competitive prices"
 ]},
 {t:"table", head:["Opportunities of globalisation", "Threats of globalisation"], rows:[
   ["**Sell exports to new countries**, opening up fast-growing markets. *But* selling abroad is expensive and foreign consumers may not want the product", "**Increasing imports from foreign competitors** who may be cheaper or better, cutting local firms' sales. *But* the competition may force local firms to become more efficient"],
   ["**Open operations in other countries** where production is cheaper. *But* quality may suffer, there may be ethical concerns, and setting up abroad is expensive and difficult", "**Multinationals setting up locally**, with economies of scale and the ability to pay for the best employees. *But* local firms may become their suppliers and grow"],
   ["**Import products to sell domestically** — profitable now that trade is free. *But* who provides maintenance, spare parts and support?", "**Employees may leave** for international competitors who pay more. *But* this pushes local businesses to improve motivation and pay"],
   ["**Import cheaper materials and components** while still producing at home. *But* distant suppliers may be less reliable and transport costs may offset the saving", "Lower-skilled workers in developed countries have seen **real wages fall by more than 20%** since the 1970s and suffer more spells of unemployment"]
 ]},
 {t:"key", x:"Globalisation has brought more choice and lower prices for consumers and has forced businesses to become efficient. But it also destroys jobs — often in the richest countries, where production workers cannot compete with lower-cost foreign producers, and governments can no longer protect them."}
]},
{
h2: "Tariffs and quotas",
c: [
 {t:"table", head:["Instrument", "How it works", "Effect"], rows:[
   ["**Import tariff**", "A tax on imported goods when they arrive", "Raises the price of imports, making domestic goods relatively cheaper, so local sales rise. Also raises revenue for the government"],
   ["**Import quota**", "A physical limit on the quantity that may be imported", "Reduces the supply of imports, which usually raises their price and increases sales of domestic goods"]
 ]},
 {t:"p", x:"Both are forms of **protectionism**. The purpose is to protect domestic industries and the jobs in them from foreign competition that might otherwise close them down."},
 {t:"trap", x:"Many economists argue protectionism is a mistake, and knowing the counter-argument earns evaluation marks. Free trade lets consumers buy as cheaply as possible, raising living standards, and lets each country specialise in what it produces best. Protection also invites **retaliation** — if Country A taxes Country B's goods, B taxes A's, and A's exporters suffer. Protected industries have less incentive to become efficient."}
]},
{
h2: "Multinational businesses",
c: [
 {t:"trap", x:"A multinational is **not** simply a business that sells in many countries. To be multinational it must **produce goods or services in more than one country**. Exporting alone does not make a business multinational — this is a frequently examined distinction."},
 {t:"h", x:"Why a business becomes multinational"},
 {t:"ul", x:[
   "**Produce in countries with low costs**, especially low wages",
   "**Extract raw materials** the company needs — crude oil, minerals",
   "**Produce nearer the market** to cut transport costs, especially for bulky products such as bricks and tiles",
   "**Avoid trade barriers** — producing inside a market means the output is not an import, so tariffs and quotas do not apply",
   "**Increase market share and spread risk** — if sales fall in one country they may rise in another",
   "**Stay competitive** with rivals who are expanding abroad",
   "**Obtain government grants** offered to attract foreign investment"
 ]},
 {t:"h", x:"Impact on the multinational's own stakeholders"},
 {t:"table", head:["Stakeholder", "Impact"], rows:[
   ["**Shareholders**", "Likely to receive higher dividends from higher profits"],
   ["**Employees**", "More promotion opportunities as the business grows; the chance to work abroad — but jobs may move away from the home country"],
   ["**Suppliers**", "Sales may rise or fall depending on where the business chooses to locate and source"],
   ["**Government**", "May gain tax revenue if profits are repatriated — or lose it if the business relocates its head office abroad"]
 ]},
 {t:"table", head:["Benefits to the HOST country", "Drawbacks to the HOST country"], rows:[
   ["**Jobs are created**, reducing unemployment", "The jobs created are often **unskilled assembly work**; skilled jobs in research and design usually stay in the home country"],
   ["**Investment** in buildings and machinery raises output; new technology and methods enter the country", "**Local businesses may be forced out** — multinationals are often more efficient with lower costs"],
   ["**Exports rise** and imports may fall as goods are made locally", "**Profits are repatriated** to the home country rather than kept in the host economy"],
   ["**Taxes** are paid, increasing government funds", "Multinationals use up **scarce, non-renewable resources** in the host country"],
   ["**Consumer choice and competition** increase", "Their size gives them **influence over the government** — they may demand grants under threat of leaving with large job losses"]
 ]},
 {t:"eg", x:"**Starbucks in Argentina** opens around 12 new cafés a year. Supporters point to cheerful American-style customer service, fast and consistently prepared coffee, and improvements in cleanliness, service and pricing at competing local cafés. Critics point out that Buenos Aires has a deeply rooted traditional café culture that Starbucks may threaten, that its branches are practically identical worldwide, and that all major investment decisions are taken outside Argentina."}
]},
{
h2: "Exchange rates",
c: [
 {t:"p", x:"An [[exchange rate]] is the price of one currency in terms of another. Most currencies float, so the rate is set by the demand for and supply of each currency."},
 {t:"formula", lbl:"The two rules — memorise these", x:"**APPRECIATION** (currency worth more): EXPORTS become more expensive abroad; IMPORTS become cheaper<br><br>**DEPRECIATION** (currency worth less): EXPORTS become cheaper abroad; IMPORTS become more expensive"},
 {t:"worked", title:"An exporter faces an appreciation", steps:[
   "Lion Trading sells washing machines at **$300**. It exports to France, where the price must be in euros. Exchange rate: **$1 = &euro;1.6**",
   "Price in France = 300 &times; 1.6 = **&euro;480**",
   "The dollar now **appreciates** to **$1 = &euro;2.0**",
   "**Option 1:** keep the French price at &euro;480. But &euro;480 &divide; 2.0 = only **$240** per machine — the business earns $60 less on every unit",
   "**Option 2:** raise the French price to &euro;600 to keep earning $300. But the machine is now 25% dearer in France, so **sales will probably fall**",
   "**Conclusion:** an appreciation is bad news for exporters. They must choose between lower revenue per unit and lower sales volume."
 ]},
 {t:"worked", title:"An importer faces a depreciation", steps:[
   "Nadir Imports (UK) buys bananas at **$250 per tonne**. Exchange rate: **&pound;1 = $2.5**",
   "Cost per tonne = 250 &divide; 2.5 = **&pound;100**",
   "The pound **depreciates** to **&pound;1 = $2.0**",
   "New cost per tonne = 250 &divide; 2.0 = **&pound;125** — a 25% increase in costs",
   "**Conclusion:** a depreciation raises an importer's costs. Nadir must either absorb it (lower profit) or raise prices to supermarkets (possibly losing the contract)."
 ]},
 {t:"table", head:["", "Exporter", "Importer"], rows:[
   ["**Currency appreciates**", "**Bad** — exports dearer abroad, so lower sales or lower revenue per unit", "**Good** — imported materials and goods become cheaper, lowering costs"],
   ["**Currency depreciates**", "**Good** — exports cheaper abroad, so sales can rise", "**Bad** — imported materials and goods cost more, raising costs"]
 ]},
 {t:"eg", x:"After the 2016 vote to leave the EU, the pound depreciated by nearly 20%. Jaguar Land Rover, which earns about 80% of its £24 billion revenue from exports, went on to record its highest-ever sales — its cars had become significantly cheaper for buyers in China and North America."},
 {t:"tip", x:"Exchange rate questions are answered wrong more often than any other topic in Section 6, because candidates guess the direction. Do it mechanically every time: **(1)** Is this business an **importer or an exporter** — or both? **(2)** Has the currency **appreciated or depreciated**? **(3)** Apply the rule. A business that exports finished goods but imports its materials is affected **both ways**, and saying so is a strong analytical point: a depreciation makes its exports more competitive but raises its input costs, so the net effect depends on how much of its value is added at home."}
]}
],
mcq: [
 {q:"A multinational business is one that:", o:["Sells its products in many countries","Produces goods or services in more than one country","Has foreign shareholders","Imports its raw materials"], a:1, why:"Production in more than one country is the defining feature — exporting alone is not enough."},
 {q:"If a country's currency appreciates, its exports become:", o:["Cheaper abroad","More expensive abroad","Unchanged in price","Free of tariffs"], a:1, why:"A stronger currency means foreign buyers need more of their own money to buy the same goods."},
 {q:"A UK importer buys goods for $250 when £1 = $2.5. If the pound depreciates to £1 = $2.0, the cost becomes:", o:["£100","£125","£80","£500"], a:1, why:"250 ÷ 2.0 = £125, up from 250 ÷ 2.5 = £100 — a 25% increase in cost."},
 {q:"A depreciation of the currency is GOOD news for:", o:["Importers of raw materials","Exporters of finished goods","Consumers buying foreign holidays","Businesses repaying foreign loans"], a:1, why:"Exports become cheaper in foreign markets, so sales can rise. The other three all become more expensive."},
 {q:"An import quota is:", o:["A tax on imports","A physical limit on the quantity imported","A subsidy for exporters","A ban on all foreign trade"], a:1, why:"A quota limits quantity; a tariff taxes value."},
 {q:"A drawback to a HOST country of multinational investment is that:", o:["Jobs are created","Taxes are paid to the government","Profits are repatriated to the home country","Consumer choice increases"], a:2, why:"Profits leaving the country mean the host economy retains less of the value created. The others are benefits."},
 {q:"Japanese car makers built factories in Europe mainly to:", o:["Reduce wage costs","Avoid European import tariffs and quotas","Find skilled engineers","Escape Japanese taxes"], a:1, why:"Producing inside the market means the cars are not imports, so trade barriers do not apply."},
 {q:"A business that exports finished goods but imports its raw materials will find that a currency depreciation:", o:["Only benefits it","Only harms it","Makes exports more competitive but raises input costs","Has no effect at all"], a:2, why:"It is affected in both directions; the net outcome depends on how much value is added domestically."},
 {q:"Which is a reason globalisation has accelerated?", o:["Higher import tariffs worldwide","Cheaper transport and the growth of e-commerce","Falling world population","Reduced use of the internet"], a:1, why:"Cheaper transport, freer trade and the internet are the main drivers."}
],
exam: [
 {cmd:"Define", m:2,
  q:"Define 'globalisation'.",
  ctx:"",
  plan:["Increase in worldwide trade and movement of people/capital.","Add a driver or a consequence."],
  model:["Globalisation is the increase in worldwide trade and in the movement of people and capital between countries (1), so that businesses increasingly buy, sell and produce internationally rather than only in their home country (1)."],
  marker:"1 mark for 'increase in international trade/movement between countries'; 1 for the consequence for business or a named driver."},

 {cmd:"Outline", m:4,
  q:"Outline two possible threats from globalisation to PaintCo.",
  ctx:"PaintCo manufactures specialist paints for aircraft. It has four factories in low-cost countries, imports raw materials and exports to aircraft manufacturers in the USA, Brazil and China.",
  plan:["Threat 1: foreign competitors entering its market — specialist paint makers from other countries can now reach the same aircraft manufacturers.","Threat 2: exchange rate volatility, or employees being recruited by international rivals.","Apply to a specialist exporter."],
  model:[
   "Foreign competitors can now reach PaintCo's customers as easily as PaintCo can (1). Aircraft manufacturers in the USA, Brazil and China can source specialist paint from suppliers anywhere in the world and compare prices instantly, so PaintCo faces competition it would not have faced when markets were more protected (1).",
   "PaintCo both imports raw materials and exports finished paint (1), so it is exposed to exchange rate movements in two directions at once — a currency movement that makes its exports more competitive simultaneously raises the cost of the materials it brings in, making its profits difficult to predict (1)."],
  marker:"4 marks. The second threat is the stronger because it recognises PaintCo is **both** an importer and an exporter — a case detail most candidates read past."},

 {cmd:"Explain", m:6,
  q:"Explain two effects on Beema of a depreciation of Country B's currency.",
  ctx:"Beema makes shoes in Country B. It imports some of the leather and the machines it uses, and exports 30% of its output.",
  plan:["Effect 1: exports (30% of output) become cheaper abroad → sales and market share can rise.","Effect 2: imported leather and machines cost more → costs rise on the other 70% too.","Weigh: only 30% is exported, so the cost effect may dominate."],
  model:[
   "A depreciation makes Beema's shoes cheaper for foreign buyers. Because the currency of Country B now buys less, a foreign customer needs fewer of their own units of currency to buy the same pair of shoes, so Beema's exports become more price-competitive against local producers in those markets. Beema exports 30% of its output, so it could increase sales volume abroad or keep prices unchanged and earn more per pair — either way that part of the business benefits.",
   "At the same time the leather and machinery Beema imports become more expensive. It now takes more of Country B's currency to buy the same dollar-priced leather, so the cost of every pair of shoes rises — including the 70% sold at home, which gain no benefit from the depreciation at all. This is the more significant effect for Beema, because the higher input cost applies to its entire output while the export advantage applies to less than a third of it. Unless Beema can find domestic leather suppliers, a depreciation may leave it worse off overall despite the apparent boost to exports."],
  marker:"6 marks: 3 per effect. The decisive analytical move is weighing the 30% export benefit against the 100% cost increase — using the case's own percentage to reach a conclusion the question did not hand you."},

 {cmd:"Justify", m:6,
  q:"Do you think the government of Country C should encourage businesses such as Beema to start operations in its country? Justify your answer.",
  ctx:"Country C already has several shoe manufacturers. It has just agreed to remove trade barriers such as import tariffs. Many of its industries are inefficient.",
  plan:["For: jobs, investment, technology transfer, tax revenue, competition forces inefficient local firms to improve, exports rise.","Against: existing local shoe makers may be forced out; jobs created may be low-skilled; profits repatriated to Country B; multinationals gain influence over government.","Judgement: use the 'many industries are inefficient' fact — that is the decisive evidence."],
  model:[
   "There is a strong case for encouraging it. Beema would create jobs and bring investment in buildings and machinery, and its production methods and technology would enter Country C, raising skills that local firms could later use. It would pay taxes, and if it exported from Country C the country's export earnings would rise.",
   "But there are real risks. Country C already has several shoe manufacturers, and a larger, more efficient foreign entrant could take their customers and force them to close, so jobs would be destroyed as well as created. The jobs Beema brings may be mainly low-skilled assembly work, with design and management staying in Country B, and Beema would repatriate its profits rather than leaving them in Country C's economy.",
   "The government should encourage it. The decisive evidence is the case's statement that **many of Country C's industries are inefficient**, combined with the fact that it has just removed import tariffs. Those two facts together mean the existing shoe manufacturers are about to face foreign competition regardless — inefficient firms protected by tariffs that no longer exist will not survive on their own. Given that, it is far better for Country C that the competition arrives as a factory employing local workers and paying local taxes than as imported shoes made and taxed elsewhere. The risk to existing producers is genuine, but the government's answer should be to help them raise efficiency rather than to keep a more efficient employer out."],
  marker:"6 marks. The top-band feature is combining two separate case facts — inefficient industries and newly removed tariffs — to show that the 'protect local firms' argument has already been overtaken by events. That is genuine evaluation rather than balanced listing."}
]
}

]);
