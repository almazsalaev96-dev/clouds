/* SECTION 4 — Operations management (chapters 18-21) */
window.CH = (window.CH || []).concat([

/* ==================== CHAPTER 18 ==================== */
{
n: "18", s: 4,
title: "Production of goods and services",
sub: "Productivity, inventories, lean production, job/batch/flow, technology",
obj: [
  "Explain the meaning of production and the difference between production and productivity",
  "Explain the benefits of increasing efficiency and how to increase it",
  "Explain why businesses hold inventories",
  "Explain lean production and how it is achieved, including JIT and Kaizen",
  "Explain the features, benefits and limitations of job, batch and flow production",
  "Recommend and justify an appropriate production method",
  "Explain how technology is changing production methods"
],
defs: [
  ["Production", "The provision of a product or a service to satisfy consumer wants and needs, adding value to the inputs used."],
  ["Productivity", "Output measured against the inputs used to create it."],
  ["Labour productivity", "Output over a given period of time divided by the number of employees."],
  ["Capital-intensive production", "Production that uses a high proportion of machinery relative to labour."],
  ["Labour-intensive production", "Production that uses a high proportion of labour relative to machinery."],
  ["Inventories (stock)", "Raw materials, components, partly finished goods and finished products held by a business."],
  ["Buffer inventory level", "The inventory held to deal with uncertainty in customer demand and in deliveries of supplies."],
  ["Lean production", "Techniques used by businesses to cut down on waste and therefore increase efficiency."],
  ["Kaizen", "A Japanese term meaning continuous improvement through the elimination of waste, driven by the ideas of the workers themselves."],
  ["Just-in-time (JIT)", "A production method that reduces or virtually eliminates the need to hold inventories of raw materials or unsold finished products."],
  ["Cell production", "Where the production line is divided into separate, self-contained units, each making an identifiable part of the finished product."],
  ["Job production", "Where a single product is made at a time, to the customer's specification."],
  ["Batch production", "Where a quantity of one product is made, then a quantity of another item is produced."],
  ["Flow production", "Where large quantities of a product are produced in a continuous process. Also called mass production."],
  ["Automation", "Where the equipment used in production is controlled by a computer to carry out mechanical processes."]
],
blocks: [
{
h2: "Production, inputs and outputs",
c: [
 {t:"formula", lbl:"The transformation", x:"INPUTS (land, labour, capital, enterprise) &rarr; PRODUCTION PROCESS &rarr; OUTPUTS (goods and services)"},
 {t:"p", x:"Production adds value to the raw materials and bought-in components. The same inputs can be combined in very different proportions:"},
 {t:"table", head:["", "Labour-intensive", "Capital-intensive"], rows:[
   ["Uses", "Many workers, few machines", "Many machines, few workers"],
   ["Typical of", "Developing countries where wages are low; craft and personal-service businesses", "Developed countries where labour costs are high; mass manufacturing"],
   ["Advantages", "Low capital cost to set up; flexible; suits customised work", "Very low cost per unit at high volume; consistent quality; machines work 24 hours"],
   ["Disadvantages", "High wage bill as volumes rise; quality varies between workers", "Very high set-up cost; inflexible; a breakdown halts everything"]
 ]},
 {t:"eg", x:"A restaurant combines all four factors: ingredients bought for $10 are cooked and served by waiters in pleasant surroundings, and the customer pays $50. Value added = $40. The same logic applies in manufacturing."}
]},
{
h2: "Productivity — and how to raise it",
c: [
 {t:"formula", lbl:"Productivity", x:"Productivity = Output &divide; Quantity of input"},
 {t:"formula", lbl:"Labour productivity", x:"Labour productivity = Output over a period &divide; Number of employees"},
 {t:"trap", x:"**Production is not productivity.** Production is the total output. Productivity is output *per unit of input*. A business can raise production by hiring more workers while its productivity **falls**. This is one of the most reliably examined distinctions in Section 4."},
 {t:"worked", title:"Production up, productivity down", steps:[
   "**2016:** output 10,000 cakes, 30 workers &rarr; productivity = 10,000 &divide; 30 = **333 cakes per worker**",
   "**2017:** output 20,000 cakes, 60 workers &rarr; productivity = 20,000 &divide; 60 = **333 cakes per worker** — production doubled, productivity unchanged",
   "**2018:** output 25,000 cakes, 50 workers &rarr; productivity = 25,000 &divide; 50 = **500 cakes per worker** — production rose 25% but productivity rose 50%",
   "Conclusion: the owner should not be pleased simply because output rose. Between 2016 and 2017 he hired 30 more workers to double output and gained **no efficiency at all** — the wage bill doubled with the output, so cost per cake was unchanged."
 ]},
 {t:"h", x:"Six ways to increase productivity"},
 {t:"ul", x:[
   "**Improve quality control and inventory control** to reduce waste",
   "**Replace employees with machines** — automation",
   "**Improve training** so employees work more efficiently",
   "**Motivate employees more effectively** (Chapter 6)",
   "**Introduce new technology**",
   "**Reorganise the workplace** — Kaizen, cell production"
 ]},
 {t:"h", x:"Benefits of higher productivity"},
 {t:"ul", x:[
   "**Fewer inputs** are needed for the same output",
   "**Lower average cost per unit**, so the business can cut prices or raise its margin",
   "Fewer workers may be needed, lowering the wage bill — though this creates a stakeholder conflict",
   "**Higher wages** can be paid without raising unit costs, which itself increases motivation"
 ]}
]},
{
h2: "Inventories",
c: [
 {t:"p", x:"Inventories can be raw materials, components, partly finished goods, finished products or even spare parts for machinery. Holding them lets a business maintain production and satisfy customer demand quickly."},
 {t:"table", head:["Term", "Meaning"], rows:[
   ["**Maximum inventory level**", "The most the business is prepared to hold"],
   ["**Reorder level**", "The level at which a new order is placed — must be high enough to last through the lead time"],
   ["**Lead time**", "The time between placing an order and the goods being delivered"],
   ["**Buffer / minimum inventory level**", "The safety cushion held to cover unexpectedly high demand or a late delivery"]
 ]},
 {t:"pc",
  labels:["Costs of holding too MUCH inventory","Costs of holding too LITTLE inventory"],
  adv:[
   "Cash is tied up in goods that are not earning anything — an **opportunity cost**",
   "**Storage costs** — warehouse space, heating, security, insurance",
   "Goods may **deteriorate, spoil or go out of fashion** before they are sold",
   "Risk of theft and damage"
  ],
  dis:[
   "**Production stops** if materials run out",
   "**Customers are disappointed** and may go to a competitor permanently",
   "**Bulk discounts** are lost by ordering small quantities",
   "More frequent ordering means higher **administration and delivery costs**"
  ]}
]},
{
h2: "Lean production",
c: [
 {t:"p", x:"[[Lean production]] means cutting out any activity that does not add value for the customer. It applies to services as much as manufacturing."},
 {t:"h", x:"The seven types of waste"},
 {t:"table", head:["Waste", "What it looks like"], rows:[
   ["**Overproduction**", "Making goods before customers have ordered them — high storage costs and possible damage or obsolescence"],
   ["**Waiting**", "Goods sitting still, not moving or being processed"],
   ["**Transportation**", "Moving goods around unnecessarily; adds no value and risks damage"],
   ["**Unnecessary inventory**", "Takes up space, gets in the way of production and ties up cash"],
   ["**Motion**", "Unnecessary bending, stretching or walking by workers, or unnecessary machine movement — wastes time and creates a health and safety risk"],
   ["**Over-processing**", "Using complex machinery for simple tasks, or performing steps that a better product design would have made unnecessary"],
   ["**Defects**", "Faults require rework and inspection time"]
 ]},
 {t:"h", x:"Benefits of lean production"},
 {t:"ul", x:[
   "Less storage of raw materials and components, so **lower storage costs**",
   "**Quicker production** of goods and services",
   "No need to repair defects or repeat a service for a dissatisfied customer",
   "**Better use of equipment** and floor space",
   "**Less cash tied up in inventories**, improving working capital",
   "**Improved health and safety**, so less time lost to injury",
   "Lower costs allow lower prices, greater competitiveness and potentially higher profit"
 ]},
 {t:"h", x:"The three lean methods"},
 {t:"table", head:["Method", "How it works", "Advantages", "Risks"], rows:[
   ["**Kaizen**", "Continuous improvement driven by the **workers themselves**, meeting in small groups to identify problems and solutions. The factory floor is reorganised, machines repositioned tightly into cells, and colour-coded lines map the flow of materials", "Increased productivity; **less space needed**; work-in-progress reduced; jobs can be combined, freeing workers for other tasks; workers are motivated because their ideas are used — a Herzberg motivator", "Requires a culture of trust and management willingness to act on workers' ideas; improvements are incremental, not transformational"],
   ["**Just-in-time (JIT)**", "Materials arrive **just in time** to be used; parts are made just in time for the next stage; the finished product is made just in time for delivery. Inventories are run down to almost nothing", "Massive reduction in **inventory holding and warehouse costs**; the finished product sells quickly so cash returns to the business faster, helping cash flow; less risk of stock becoming obsolete", "Requires **extremely reliable suppliers** and an efficient ordering system. A single late delivery or a transport strike stops production entirely — there is no buffer"],
   ["**Cell production**", "The production line is divided into self-contained units, each making an identifiable part of the finished product, instead of one long flow line", "Improves morale — workers feel valued and identify with an output they can see; less disruption and fewer strikes; workers become multi-skilled", "Can be less efficient than a pure flow line for very high volumes; requires more training"]
 ]},
 {t:"eg", x:"JIT is not only for manufacturers. Hotels and fast-food restaurants reduce waste and lower costs by ordering food and supplies only as needed — provided they arrive *just in time* to serve the customer."}
]},
{
h2: "The three production methods",
c: [
 {t:"table", head:["", "Job production", "Batch production", "Flow production"], rows:[
   ["**What it is**", "A single product made at a time, to the customer's specification", "A quantity of one product is made, then a quantity of another", "Large quantities produced in a continuous process"],
   ["**Examples**", "Made-to-measure suits, ships, bridges, a bespoke computer program, a wedding cake", "A bakery making a batch of bread then a batch of rolls; several houses to the same design; a run of one size of jeans", "Cars, cameras, televisions, packaged foods and drinks"],
   ["**Advantages**", "Meets the customer's exact requirements; varied work so **higher motivation**; flexible; high quality allows a **higher price**", "**Flexible** — production can switch between products; still gives workers some variety; allows **product variety and consumer choice**; a machine breakdown does not necessarily stop everything", "**High output** of a standardised product; **low cost per unit** so low prices; capital-intensive methods reduce labour costs; workers can be relatively unskilled so training is cheap; **economies of scale** in purchasing; automated lines can run 24 hours; no need to move goods between parts of the factory"],
   ["**Disadvantages**", "**Skilled labour is expensive**; labour-intensive so high costs; production takes a long time; errors are expensive to correct; materials may have to be specially purchased", "Semi-finished products must be moved between stages, which is costly; **machines must be reset between batches**, so output is lost during changeover; warehouse space needed for materials, components and finished batches", "**Very boring for workers**, so little job satisfaction and poor motivation; **huge storage requirements** for materials and finished goods unless JIT is used; **very high capital cost** to set up the line; if one machine breaks down **the whole line stops**"]
 ]},
 {t:"h", x:"Choosing the method"},
 {t:"table", head:["Factor", "Points towards"], rows:[
   ["**Nature of the product** — unique/personalised or standardised?", "Unique &rarr; job. Standardised and mass-producible &rarr; flow"],
   ["**Size of the market** — local niche, or international?", "Small/niche &rarr; job or batch. International mass market &rarr; flow"],
   ["**Nature of demand** — steady and large, or occasional?", "Large and steady &rarr; flow. Less frequent &rarr; job or batch"],
   ["**Size of the business and access to capital**", "Small business without capital &rarr; job or batch. Only large businesses can afford automated flow lines"]
 ]},
 {t:"tip", x:"Cases very often describe a business **growing through the three methods in sequence** — Tara cooked individual dishes to order (job), then made large quantities of one dish at a time in a rented unit (batch), then bought automated machinery producing one dish continuously (flow). If a case shows growth, the expected answer is that the method should change with the scale. Say which method, at what point, and why."}
]},
{
h2: "Technology in production",
c: [
 {t:"table", head:["Technology", "What it is"], rows:[
   ["**Automation**", "Equipment controlled by a computer carries out mechanical processes, such as paint-spraying on a car line. Few people are needed"],
   ["**Mechanisation**", "Production done by machines but **operated by people**, such as a printing press"],
   ["**Robots**", "Programmed machines, particularly valuable for unpleasant, dangerous and difficult jobs. Fast, very accurate, can work 24 hours"],
   ["**CAD** (computer-aided design)", "Software that draws designs quickly and allows them to be rotated and viewed from all sides. Used for new products and restyling existing ones"],
   ["**CAM** (computer-aided manufacture)", "Computers monitor the production process and control machines or robots on the factory floor"],
   ["**CIM** (computer-integrated manufacturing)", "Total integration of CAD and CAM — the design computers are linked directly to the manufacturing computers"],
   ["**EPOS** (electronic point of sale)", "Barcodes scanned at the checkout display and record the price, automatically update inventory records and can trigger a reorder"],
   ["**EFTPOS** (electronic funds transfer at point of sale)", "The till is connected to banks over a network; the customer's card is read and the money debited directly after a PIN or signature"],
   ["**Contactless payment**", "Cards, key fobs, watches and phones transmit payment details when touched against a terminal — fast, easy and secure for small transactions"]
 ]},
 {t:"pc",
  labels:["Advantages of new technology","Disadvantages of new technology"],
  adv:[
   "**Higher productivity** and lower average costs",
   "**Greater job satisfaction** as routine and boring jobs are done by machines",
   "More **skilled workers** needed to operate and maintain it, and training can motivate existing staff",
   "**Better quality** through more accurate production",
   "**Quicker communication** and less paperwork",
   "Managers get far more **information**, so decisions are better and faster",
   "Completely **new products** become possible"
  ],
  dis:[
   "**Unemployment** may rise as machines replace people in factories and offices",
   "**Expensive to buy** — large quantities must be sold to cover the investment, which increases risk",
   "Employees may be **unhappy** with the changes to their working practices and resist them",
   "Technology **becomes outdated quickly** and must be replaced to stay competitive"
  ]},
 {t:"eg", x:"The US National Bureau of Economic Research has estimated that roughly **three workers are displaced for every new industrial robot** installed. Technology raises productivity and destroys jobs at the same time — that tension is the heart of most evaluation questions on this topic."}
]}
],
mcq: [
 {q:"Output rises from 10,000 to 20,000 units while employees rise from 30 to 60. Productivity has:", o:["Doubled","Halved","Stayed the same","Risen by 25%"], a:2, why:"333 units per worker in both years. Production doubled but efficiency did not change at all."},
 {q:"Just-in-time production mainly reduces:", o:["Wage costs","Inventory holding and storage costs","Advertising costs","Interest payments"], a:1, why:"JIT virtually eliminates stock, cutting warehousing costs and freeing up working capital."},
 {q:"The greatest risk of JIT is that:", o:["Too much stock builds up","A single late delivery stops production entirely","Quality falls","Workers become bored"], a:1, why:"With no buffer inventory there is nothing to fall back on if a supplier fails."},
 {q:"Kaizen means:", o:["Just-in-time delivery","Continuous improvement driven by workers' own ideas","Buying new machinery","Producing in batches"], a:1, why:"Kaizen is continuous improvement through eliminating waste, using the knowledge of the people doing the job."},
 {q:"A made-to-measure wedding dress is produced using:", o:["Job production","Batch production","Flow production","Cell production"], a:0, why:"One unique item made to the customer's specification."},
 {q:"A disadvantage of flow production is that:", o:["Unit costs are high","Work is repetitive so motivation is poor","It cannot produce large volumes","Skilled labour is always required"], a:1, why:"Boredom and low job satisfaction are the classic human cost of mass production."},
 {q:"An advantage of batch production over flow production is that:", o:["Unit costs are lower","It is more flexible and allows product variety","It requires less warehouse space","Machines never need resetting"], a:1, why:"Batch allows switching between products; its main cost is the lost output during changeover."},
 {q:"CAD stands for:", o:["Computer-aided delivery","Computer-aided design","Continuous automated distribution","Cost and depreciation"], a:1, why:"CAD is design software; CAM is manufacture; CIM integrates the two."},
 {q:"'Overproduction' is classed as waste in lean production because:", o:["The goods can never be sold","It creates storage costs and risks damage or obsolescence","It uses too few workers","It reduces quality inspection"], a:1, why:"Making goods before they are ordered ties up cash and space and risks the goods deteriorating."}
],
exam: [
 {cmd:"Define", m:2,
  q:"Define 'productivity'.",
  ctx:"",
  plan:["Output measured against inputs.","Distinguish it from total production."],
  model:["Productivity is output measured against the inputs used to create it (1) — for example output per worker — so it measures efficiency rather than the total amount produced (1)."],
  marker:"1 mark for 'output relative to inputs'; 1 for the efficiency point or for distinguishing it from total production. Defining it as 'how much a business makes' scores 0."},

 {cmd:"Outline", m:4,
  q:"Outline two ways, other than lean production, that Carlos could increase productivity in his bakery.",
  ctx:"Carlos owns BettaBakers Limited, producing bread and cakes for local shops using batch production.",
  plan:["Way 1: training — faster, fewer errors.","Way 2: improved motivation OR new equipment (a faster oven / automated mixer).","Each with a development linked to a bakery."],
  model:[
   "Carlos could train his workers more thoroughly (1). Bakery work involves mixing, proving and baking to precise timings, and a well-trained worker wastes fewer batches through incorrect timing, so more saleable loaves are produced from the same hours worked (1).",
   "He could invest in new equipment such as an automated dough mixer (1), which would mix a batch far faster and more consistently than by hand, so the same number of employees could produce more bread each morning and Carlos could supply more local shops (1)."],
  marker:"4 marks: 2 methods (1 each) with developments (1 each). Note the question says 'other than lean production' — an answer about JIT or Kaizen scores 0 however good it is. Read the exclusion."},

 {cmd:"Explain", m:6,
  q:"Explain two advantages to Carlos of using batch production.",
  ctx:"BettaBakers produces bread loaves and a variety of cakes sold in local shops.",
  plan:["Advantage 1: flexibility — can switch between bread and different cakes to meet varied local demand.","Advantage 2: allows product variety, so BettaBakers can offer local shops a range without the capital cost of a flow line.","Analyse to sales and cost consequences."],
  model:[
   "Batch production is flexible, which suits Carlos precisely because he makes both bread and a variety of cakes. He can produce a batch of loaves in the morning, clean down, and then produce a batch of a particular cake, adjusting the quantities according to what the local shops have ordered that week. A flow line producing one continuous product could not do this, and Carlos would either have to abandon most of his range or invest in several separate lines.",
   "It also lets him offer variety without enormous capital investment. Local shops want a choice of products to sell, and being able to supply several kinds of cake makes BettaBakers a more attractive supplier than a bakery producing only one item. Because the same ovens and mixers are used for every batch, Carlos gets that variety from equipment he has already bought — the only cost is the time lost cleaning and resetting between batches, which for a small bakery is far cheaper than a dedicated production line for each product."],
  marker:"6 marks: 3 per advantage. Both explicitly compare batch against the alternative (flow), which is a strong way of demonstrating why the chosen method is right rather than merely describing it."},

 {cmd:"Justify", m:6,
  q:"Do you think Mr Patel should introduce new technology into his furniture factory? Justify your answer.",
  ctx:"Mr Patel's business manufactures wooden furniture using traditional labour-intensive job production. Workers measure, cut and shape wood for each piece, made to the exact requirements of each customer. He is worried about efficiency and wants to improve productivity.",
  plan:["For: higher productivity, lower unit cost, more accurate cutting, CAD lets customers see designs before ordering, less physical strain and fewer accidents.","Against: high capital cost for a small business; job production means every piece is different, so automation gives less benefit than in mass production; customers pay for handmade craftsmanship — machine-made may undermine the selling point; workers may resist; skills may be lost.","Judgement: selective technology (CAD, machine tools) yes; full automation no."],
  model:[
   "There is a real case for it. New technology such as computer-controlled cutting machines would cut timber faster and far more accurately than by hand, reducing wasted wood and raising output per worker — exactly the productivity problem Mr Patel is worried about. CAD software would also let him produce designs quickly and show customers a rotated three-dimensional view before committing to a piece, which could win orders.",
   "But there are serious objections. The equipment is expensive, and Mr Patel runs a business making furniture to individual customer requirements — every item is different, so an automated line has far less to offer than it would in mass production, and the machinery might stand idle much of the time. More fundamentally, his customers are buying **handmade** furniture made to their exact specification. If the product becomes visibly machine-produced, the very thing that justifies its price is weakened, and he could find himself competing with mass-market furniture manufacturers whose unit costs he can never match.",
   "Mr Patel should introduce technology, but **selectively**. He should invest in CAD for design and in accurate powered cutting and shaping tools, while keeping the assembly and finishing work in his craftsmen's hands. The decisive reason is the nature of his product: job production for individual customers means his competitive advantage is craftsmanship, not cost, so technology should be used where it removes waste and physical drudgery without removing the handmade quality customers are paying for. Full automation was rejected because it would make him a small, under-capitalised competitor in a mass market rather than a strong one in a specialist niche."],
  marker:"6 marks. The evaluation is lifted by distinguishing **which** technologies to adopt and by identifying that the business competes on craftsmanship rather than cost — a strategic insight rather than a cost calculation."}
]
},

/* ==================== CHAPTER 19 ==================== */
{
n: "19", s: 4,
title: "Costs, scale of production and break-even analysis",
sub: "Fixed and variable costs, economies and diseconomies of scale, break-even charts and calculations",
obj: [
  "Classify costs as fixed, variable, average and total",
  "Use cost data to make simple cost-based decisions",
  "Explain economies and diseconomies of scale with examples",
  "Construct, complete and interpret a break-even chart",
  "Calculate break-even output and the margin of safety",
  "Use break-even analysis in decision making and explain its limitations"
],
defs: [
  ["Fixed costs", "Costs which do not vary in the short run with the number of items sold or produced. Also called overhead costs."],
  ["Variable costs", "Costs which vary directly with the number of items sold or produced."],
  ["Total costs", "Fixed costs and variable costs added together."],
  ["Average cost per unit", "The total cost of production divided by total output. Also called unit cost."],
  ["Revenue", "The income during a period of time from the sale of goods or services. Revenue = quantity sold x price."],
  ["Economies of scale", "The factors that lead to a reduction in average costs as a business increases in size."],
  ["Diseconomies of scale", "The factors that lead to an increase in average costs as a business grows beyond a certain size."],
  ["Break-even level of output", "The quantity that must be produced and sold for total revenue to equal total costs."],
  ["Break-even point", "The level of sales at which total costs equal total revenue — neither profit nor loss is made."],
  ["Contribution", "The selling price of a product less its variable cost per unit."],
  ["Margin of safety", "The amount by which current sales exceed the break-even level of output."]
],
blocks: [
{
h2: "Business costs",
c: [
 {t:"table", head:["", "Fixed costs (overheads)", "Variable costs"], rows:[
   ["Definition", "Do not change with output in the short run", "Change directly with output"],
   ["Paid when output is zero?", "**Yes** — still payable", "No — zero output means zero variable cost"],
   ["Examples", "Rent, management salaries, insurance, business rates, loan interest, advertising campaign, depreciation", "Raw materials, components, piece-rate wages, packaging, power used in production, sales commission"]
 ]},
 {t:"trap", x:"Fixed costs are fixed **with respect to output**, not with respect to time. A business that builds a second factory will see its fixed costs rise. The correct phrase is: 'fixed costs do not vary with output, given the existing scale of premises and equipment.'"},
 {t:"formula", lbl:"The three cost formulas you must know", x:"Total cost = Fixed costs + Total variable costs<br><br>Average cost per unit = Total cost &divide; Total output<br><br>Total cost = Average cost per unit &times; Output"},
 {t:"worked", title:"Calculating total and average cost", steps:[
   "A car manufacturer makes Model X: variable material costs $5m, variable labour costs $10m, allocated fixed costs $9m, annual output 4,000 vehicles",
   "**Total variable cost** = $5m + $10m = **$15m**",
   "**Total cost** = $15m + $9m = **$24m**",
   "**Average cost per unit** = $24,000,000 &divide; 4,000 = **$6,000 per vehicle**",
   "This is the figure the business must beat with its selling price if it is to make a profit on Model X."
 ]},
 {t:"h", x:"Using cost data for decisions"},
 {t:"table", head:["Decision", "How costs are used", "The complication"], rows:[
   ["**Setting prices**", "Average cost of a pizza is $3; the business wants $1 profit per pizza, so it charges $4", "You must know the average cost or you may price below it and lose money on every sale"],
   ["**Stop production or continue?**", "Total annual cost $25,000 but revenue only $23,000 — a $2,000 loss, so consider stopping", "**The fixed costs may still have to be paid** even if you stop, e.g. rent on a factory you cannot sell. And a newly launched product may not yet have reached its potential sales"],
   ["**Choosing a location**", "Location A has annual costs of $34,000; Location B has $50,000, so A looks better", "Cost is not everything — a cheap site in a bad area may generate far lower revenue (see Chapter 21)"]
 ]}
]},
{
h2: "Economies and diseconomies of scale",
c: [
 {t:"key", x:"Economies of scale reduce **average (unit) cost**, not total cost. A large firm has higher total costs than a small one — but lower cost *per unit*. Getting this wrong is one of the most common errors in Section 4."},
 {t:"table", head:["Economy of scale", "How it works"], rows:[
   ["**Purchasing**", "Buying components and materials in bulk earns discounts, so the cost per item bought is lower than a small firm pays"],
   ["**Marketing**", "The business can afford its own delivery vehicles rather than paying hauliers; larger vehicles cut transport cost per unit; advertising rates do not rise in proportion to the size of the advert; ten product lines do not need twice as many salespeople as five"],
   ["**Financial**", "Banks see lending to large organisations as less risky, so charge a **lower rate of interest**"],
   ["**Managerial**", "Large firms can afford **specialists** — a marketing director, a qualified accountant — which raises efficiency. A small firm cannot"],
   ["**Technical**", "Larger ships and vehicles cut transport cost per unit; **flow production** and the division of labour become viable; expensive specialised machinery can be kept fully occupied. A machine that welds 100 times a minute has a high average cost if a small firm uses it for an hour a day"]
 ]},
 {t:"eg", x:"The cost of transporting each barrel of oil in a large tanker holding 800,000 barrels is roughly **one third** of the cost using a 100,000-barrel tanker. That single technical economy is a major reason the oil industry is dominated by a few very large firms."},
 {t:"table", head:["Diseconomy of scale", "How it works"], rows:[
   ["**Poor communication**", "The larger the organisation, the harder it is to send and receive accurate messages. Slow or inaccurate communication causes mistakes that raise costs"],
   ["**Lack of commitment from employees**", "A worker in a business employing thousands may never see a senior manager, feels unimportant and unvalued, and works less efficiently. Small firms can build close relationships that large ones cannot"],
   ["**Weak coordination**", "Decisions take longer to reach every part of the business; different divisions may pull in different directions; top managers become so busy directing that they lose contact with customers and products"]
 ]},
 {t:"p", x:"Many very large businesses now deliberately break themselves into smaller, self-managing units precisely to avoid these diseconomies — a form of decentralisation."}
]},
{
h2: "Break-even analysis",
c: [
 {t:"key", x:"The [[break-even level of output]] is the minimum a business must sell to cover all its costs. At break-even it makes **neither profit nor loss**. The faster a new business reaches it, the more likely it is to survive."},
 {t:"formula", lbl:"The two formulas", x:"Contribution per unit = Selling price &minus; Variable cost per unit<br><br>Break-even output = Fixed costs &divide; Contribution per unit"},
 {t:"worked", title:"Worked example — the sports shoe business", steps:[
   "Fixed costs = **$5,000 per year**. Variable cost per pair = **$3**. Selling price = **$8**. Maximum capacity = 2,000 pairs.",
   "**Contribution per unit** = $8 &minus; $3 = **$5**",
   "**Break-even output** = $5,000 &divide; $5 = **1,000 pairs per year**",
   "**Profit at maximum output** = (2,000 &times; $5) &minus; $5,000 = $10,000 &minus; $5,000 = **$5,000**",
   "**Margin of safety at full capacity** = 2,000 &minus; 1,000 = **1,000 pairs**"
 ]},
 {t:"worked", title:"What happens if the price rises to $9?", steps:[
   "New contribution = $9 &minus; $3 = **$6**",
   "New break-even = $5,000 &divide; $6 = **834 pairs** (round *up* — you cannot break even on a fraction of a shoe)",
   "New maximum profit = (2,000 &times; $6) &minus; $5,000 = **$7,000**",
   "So raising the price **lowers** break-even and **raises** maximum profit — but only if all 2,000 pairs still sell. If demand is price elastic, the higher price may mean fewer than 2,000 are sold, and the business could be worse off. **Always state that caveat** — it is the evaluation mark."
 ]},
 {t:"h", x:"Drawing a break-even chart"},
 {t:"ol", x:[
   "**y-axis** = money (costs and revenue). **x-axis** = units produced and sold",
   "**Fixed costs**: a horizontal line at the fixed cost level — it does not change with output",
   "**Total costs**: starts on the y-axis at the fixed cost level and slopes upwards; the slope is the variable cost per unit",
   "**Sales revenue**: starts at the **origin** (zero output = zero revenue) and slopes upwards; the slope is the selling price",
   "**Break-even point**: where the total cost line and the revenue line cross",
   "**Loss** is the gap between the lines to the *left* of that point; **profit** is the gap to the *right*",
   "**Margin of safety**: the horizontal distance from break-even output to current or maximum output"
 ]},
 {t:"pc",
  labels:["Uses of break-even analysis","Limitations of break-even analysis"],
  adv:[
   "Shows the **minimum output** needed to avoid a loss — vital for a new business and for a bank assessing a loan",
   "The expected **profit or loss at any output** can be read straight off the chart",
   "The **impact of a decision** can be tested by redrawing — what if we raise the price? use cheaper materials? rent a bigger factory?",
   "Shows the **margin of safety**, so managers know how far sales could fall before a loss is made"
  ],
  dis:[
   "It **assumes everything produced is sold** — the chart cannot show unsold stock building up",
   "**Fixed costs only stay constant within the existing scale.** Doubling output usually needs a bigger factory, which shifts the whole fixed cost line up",
   "It assumes **straight lines**: in reality overtime raises variable cost per unit at high output, and bulk discounts to customers reduce revenue per unit, so both lines bend",
   "It concentrates on break-even alone, while managers must also consider quality, waste, motivation and marketing"
  ]},
 {t:"tip", x:"Three break-even exam habits that protect marks: **(1)** always **round break-even output up** to the next whole unit; **(2)** always give the answer with **units and a time period** ('8,334 units per year'); **(3)** when asked how a business could reduce its break-even level, there are exactly three routes — **raise the price**, **cut the variable cost per unit**, or **cut the fixed costs** — and each carries a risk you should name (lost sales, lower quality, less capacity or less advertising)."}
]}
],
mcq: [
 {q:"Which is a fixed cost for a bakery?", o:["Flour used in bread","Rent of the shop","Packaging","Piece-rate wages"], a:1, why:"Rent must be paid whether the bakery produces anything or not; the other three vary with output."},
 {q:"Selling price $12, variable cost $7, fixed costs $40,000. Break-even output is:", o:["3,333 units","8,000 units","5,714 units","40,000 units"], a:1, why:"Contribution = $12 − $7 = $5. Break-even = $40,000 ÷ $5 = 8,000 units."},
 {q:"Contribution per unit is:", o:["Selling price minus total cost","Selling price minus variable cost per unit","Total revenue minus fixed costs","Fixed costs divided by output"], a:1, why:"Contribution is what each unit contributes towards covering fixed costs, and then towards profit."},
 {q:"Economies of scale cause a fall in:", o:["Total costs","Average cost per unit","Fixed costs","Selling price"], a:1, why:"Larger firms have higher total costs but lower cost per unit — this distinction is heavily examined."},
 {q:"A bank charging a large company a lower interest rate than a small one is an example of:", o:["Purchasing economies","Financial economies","Technical economies","Managerial economies"], a:1, why:"Lending to large organisations is seen as less risky, so the rate is lower."},
 {q:"Which is a diseconomy of scale?", o:["Bulk-buying discounts","Poor communication in a very large organisation","Employing specialist managers","Using larger delivery vehicles"], a:1, why:"The other three are economies. Communication problems raise average costs as a business grows too large."},
 {q:"Margin of safety is:", o:["Fixed costs divided by contribution","The amount by which current sales exceed break-even output","Total revenue minus total cost","The profit at maximum output"], a:1, why:"It measures how far sales could fall before a loss is made."},
 {q:"A limitation of break-even charts is that they assume:", o:["Fixed costs change with output","Everything produced is sold","Variable costs are zero","There is only one product"], a:1, why:"The chart cannot show unsold stock building up — the revenue line assumes all output is sold."},
 {q:"Which action would REDUCE a business's break-even level of output?", o:["Increasing fixed costs","Reducing the selling price","Reducing the variable cost per unit","Increasing the variable cost per unit"], a:2, why:"Lower variable cost raises contribution per unit, so fewer units are needed to cover fixed costs."}
],
exam: [
 {cmd:"Define", m:2,
  q:"Define 'fixed costs'.",
  ctx:"",
  plan:["Costs that do not change with output.","Add: still paid at zero output, or an example."],
  model:["Fixed costs are costs that do not vary with the level of output in the short run (1) — for example the rent of a factory, which must still be paid even if the business produces nothing at all (1)."],
  marker:"1 mark for 'do not vary with output'; 1 for an example or for the point that they are payable at zero output. 'Costs that never change' is imprecise and may score only 1."},

 {cmd:"Calculate", m:4,
  q:"A business has fixed costs of $50,000 per year. Each unit sells for $8 and has a variable cost of $2. (a) Calculate the contribution per unit. (b) Calculate the break-even level of output. (c) If the business currently sells 12,000 units, calculate the margin of safety. (d) Calculate its annual profit.",
  ctx:"",
  plan:["Show formula, substitution, answer with units for each part.","Round break-even UP."],
  model:[
   "**(a)** Contribution = Selling price &minus; Variable cost = $8 &minus; $2 = **$6 per unit**",
   "**(b)** Break-even output = Fixed costs &divide; Contribution = $50,000 &divide; $6 = 8,333.3, rounded up to **8,334 units per year**",
   "**(c)** Margin of safety = Current sales &minus; Break-even output = 12,000 &minus; 8,334 = **3,666 units**",
   "**(d)** Profit = (Units sold &times; Contribution) &minus; Fixed costs = (12,000 &times; $6) &minus; $50,000 = $72,000 &minus; $50,000 = **$22,000 per year**"],
  marker:"4 marks, 1 per part. Method marks survive arithmetic errors, so always show the formula and the substitution. Note the rounding up in (b) and the units on every answer."},

 {cmd:"Explain", m:6,
  q:"Explain two economies of scale the business might benefit from as it grows larger.",
  ctx:"Premium Suits is a private limited company making men's suits using batch production. It employs 100 production workers and is expanding rapidly.",
  plan:["Economy 1: purchasing — bulk buying of cloth.","Economy 2: technical or managerial — specialist cutting machinery kept fully occupied, or affording a specialist marketing manager.","Analyse each to the effect on average cost and therefore price/profit."],
  model:[
   "**Purchasing economies.** As Premium Suits grows it will buy cloth, thread and linings in much larger quantities, and suppliers offer bulk discounts on large orders. If the cost of cloth per suit falls even slightly, that saving is multiplied across every suit produced, so the average cost per suit falls. This matters because the case tells us Sally faces heavy competition in the medium-priced suit market — a lower unit cost lets her either cut prices to compete or keep prices the same and widen her margin.",
   "**Technical economies.** A larger business can justify buying specialist equipment such as automated cutting machinery. A small workshop cannot: the machine would stand idle most of the day, so its cost spread over few suits would be high. With 100 production workers and rising output, Premium Suits can keep such a machine fully occupied, so the cost of the machine per suit produced becomes small while cutting becomes faster and more accurate — reducing both labour cost per suit and wasted cloth."],
  marker:"6 marks: 3 per economy. Both explain the mechanism (why the cost falls) and the consequence (competitiveness or margin). Naming the economy correctly is only the first mark of three."},

 {cmd:"Recommend", m:12,
  q:"A business is deciding whether to raise its selling price from $8 to $10, or to reduce its variable cost per unit from $2 to $1 by using a cheaper supplier. Fixed costs are $50,000 and the business currently sells 12,000 units. Recommend which it should do. Justify your answer with calculations.",
  ctx:"The business sells a branded product with a reputation for good quality. Several competitors sell similar products at $8 to $9.",
  plan:["Calculate both options: break-even and profit.","Option A: price $10 → contribution $8 → BE 6,250 → profit at 12,000 = $46,000.","Option B: VC $1 → contribution $7 → BE 7,143 → profit at 12,000 = $34,000.","BUT: option A assumes 12,000 still sell at $10 when competitors charge $8-9 — demand is likely price elastic. Option B risks quality damage to a brand known for quality.","Judgement: weigh the numbers against the risks."],
  model:[
   "**Option A — raise the price to $10.** Contribution becomes $10 &minus; $2 = $8 per unit. Break-even output falls to $50,000 &divide; $8 = **6,250 units**, and profit at 12,000 units would be (12,000 &times; $8) &minus; $50,000 = **$46,000**. On the arithmetic alone this is much the better option: break-even falls by over 2,000 units and profit more than doubles from the current $22,000.",
   "**Option B — cut variable cost to $1.** Contribution becomes $8 &minus; $1 = $7. Break-even output falls to $50,000 &divide; $7 = **7,143 units**, and profit at 12,000 units would be (12,000 &times; $7) &minus; $50,000 = **$34,000**. This is also an improvement on the current $22,000, but less than Option A delivers.",
   "**The risks the calculations hide.** Option A's figures assume the business still sells 12,000 units at $10. Competitors charge $8 to $9 for similar products, so demand is likely to be price elastic — customers can switch easily. If sales fell to, say, 8,000 units, profit would be (8,000 &times; $8) &minus; $50,000 = only $14,000, which is worse than doing nothing. Option B's risk is different: the product has a reputation for good quality, and a cheaper supplier may deliver inferior materials. That would not show up in this year's break-even chart but could damage the brand permanently and cost far more than $12,000 of extra profit.",
   "**Recommendation.** The business should raise the price, but by **less than the full $2** — to around $9, matching the top of the competitor range. At $9, contribution is $7, break-even is 7,143 units and profit at 12,000 units is $34,000, the same as Option B but without touching material quality. The decisive point is elasticity: with rivals at $8 to $9, a jump to $10 puts the product above every competitor and risks losing the volume on which the whole calculation depends, whereas $9 keeps it within the competitive range. The cheaper-supplier option was rejected because the case identifies quality as the basis of the brand, and the calculations show it delivers no more profit than a modest price rise while carrying a permanent risk to the reputation."],
  marker:"12 marks. Calculations are necessary but not sufficient: full marks require recognising that break-even analysis **assumes all output is sold** and that the price rise may destroy that assumption. Proposing a third, intermediate option supported by its own calculation is the strongest possible move."}
]
},

/* ==================== CHAPTER 20 ==================== */
{
n: "20", s: 4,
title: "Achieving quality production",
sub: "What quality means, quality control, quality assurance, TQM",
obj: [
  "Explain what quality means and why it is important for all businesses",
  "Explain the concept of quality control and how businesses implement it",
  "Explain the concept of quality assurance and how it can be implemented",
  "Explain Total Quality Management"
],
defs: [
  ["Quality", "Producing a good or a service which meets customer expectations."],
  ["Quality control", "Checking for quality at the end of the production process, using inspectors to find faults."],
  ["Quality assurance", "Checking for quality standards throughout the production process, by the employees themselves."],
  ["Total Quality Management (TQM)", "The continuous improvement of products and processes by focusing on quality at each and every stage of production, aiming for zero defects."],
  ["Quality circles", "Groups of workers who meet regularly to discuss quality problems and suggest solutions."]
],
blocks: [
{
h2: "What quality means",
c: [
 {t:"key", x:"Quality does **not** mean excellent or expensive. It means **meeting customer expectations**. Nobody expects a $3 toy car to perform like a $300 one — but they do expect it to work, to be safe, and to last a reasonable time. Quality is 'fitness for purpose' at the price charged."},
 {t:"p", x:"Expectations rise with price. A customer at McDonald's expects speed, consistency and cleanliness; a customer at a luxury hotel restaurant expects individual attention and outstanding food. Both can be high quality — against different expectations."},
 {t:"pc",
  labels:["What good quality does for a business","What poor quality costs a business"],
  adv:[
   "Establishes a **brand image**",
   "Builds **brand loyalty** and repeat purchase",
   "Maintains a good **reputation**",
   "**Increases sales** and attracts new customers",
   "Supports a **higher price** and therefore higher added value",
   "Reduces the cost of scrapping, reworking and returns"
  ],
  dis:[
   "**Customers switch** to other brands",
   "Cost of **replacing faulty products** or repeating a poor service",
   "**Word of mouth** — dissatisfied customers tell other people, and online reviews reach thousands",
   "Damaged reputation leads to **lower sales and profits**",
   "In many countries the law requires refund or replacement (see Chapter 17), so poor quality is a legal cost too"
  ]}
]},
{
h2: "Quality control",
c: [
 {t:"p", x:"The traditional approach: **inspectors check the finished product** at the end of the line, taking samples at intervals. In a service business the equivalent is a 'mystery customer' testing the service."},
 {t:"pc",
  labels:["Advantages of quality control","Drawbacks of quality control"],
  adv:[
   "Tries to eliminate faults **before the customer receives** the product or service",
   "**Less training is required** for ordinary workers, because inspectors do the checking",
   "Straightforward to implement and to manage"
  ],
  dis:[
   "**Expensive** — inspectors must be employed and paid",
   "It identifies faulty products but **does not find out why** the fault occurred, so the problem recurs",
   "**High cost of failure**: a whole batch may have to be scrapped or reworked after all the value has been added to it",
   "Workers take no responsibility for quality — it is 'the inspector's job'"
  ]},
 {t:"trap", x:"The central weakness of quality control is that it finds faults **after** the money has been spent making them. That is why lean production (Chapter 18) classes defects as one of the seven wastes, and why quality assurance largely replaced it."}
]},
{
h2: "Quality assurance and TQM",
c: [
 {t:"p", x:"[[Quality assurance]] sets standards that apply at **every stage** of production, checked by the employees doing the work rather than by inspectors at the end. It covers design, components and materials, delivery schedules, after-sales service and checking procedures."},
 {t:"pc",
  labels:["Advantages of quality assurance","Drawbacks"],
  adv:[
   "Faults are eliminated **at each stage**, before value is added to a defective item",
   "**Fewer customer complaints**",
   "**Reduced costs** because products do not have to be scrapped, reworked or a service repeated",
   "Workers take responsibility for their own work, which is motivating"
  ],
  dis:[
   "**Expensive to train** every employee to check their own work",
   "**Relies on employee commitment** — if workers do not buy into the standards, the system fails"
  ]},
 {t:"h", x:"Total Quality Management"},
 {t:"key", x:"[[TQM]] takes quality assurance further: quality becomes the responsibility of **every employee at every stage**, with the aim of **zero defects — right first time**. Crucially, TQM treats the next person or department in the process as your 'customer', so quality is maintained internally, not just at the point of sale."},
 {t:"table", head:["", "Quality control", "Quality assurance", "TQM"], rows:[
   ["**When checked**", "At the end, after production", "Throughout production", "At every stage, continuously"],
   ["**Who checks**", "Inspectors", "The employees doing the work", "Everyone, including suppliers"],
   ["**Aim**", "Detect faulty products before dispatch", "Prevent faults from happening", "Zero defects — right first time"],
   ["**Waste**", "Considerable — faults found after value is added", "Reduced", "Eliminated as far as possible"],
   ["**Culture**", "Quality is the inspector's job", "Quality is the worker's job", "Quality is everyone's job and part of the business's ethos"]
 ]},
 {t:"pc",
  labels:["Advantages of TQM","Drawbacks of TQM"],
  adv:[
   "Quality is built into every part of production and becomes central to the culture",
   "Eliminates faults **before the customer receives** anything — a 'right first time' approach",
   "**No customer complaints**, so brand image improves and sales rise",
   "**Reduced costs** — nothing is scrapped, reworked or repeated",
   "Waste is removed and efficiency rises (it links directly to Kaizen and lean production)"
  ],
  dis:[
   "**Expensive to train all employees**",
   "Relies on **every employee** accepting responsibility — one department that does not buy in undermines the whole system",
   "Takes a long time to embed; it is a culture change, not a procedure"
  ]},
 {t:"eg", x:"**Rolls-Royce** builds aircraft engines using quality assurance with TQM principles — every employee is responsible for quality — **plus** additional specially trained inspectors at various stages. When a defect could cause an aircraft to crash, the cost of double-checking is trivial next to the cost of failure. The right system depends on the consequences of getting it wrong."},
 {t:"h", x:"Quality marks"},
 {t:"p", x:"A business can apply for an external quality mark such as **ISO 9001** (quality management systems) or ISO 14001 (environmental management). It must follow specified rules and be inspected to keep it. Some customers — particularly other businesses — buy only from suppliers holding these certifications, so a quality mark can be a condition of entering a market rather than merely a marketing benefit."},
 {t:"tip", x:"For 'which quality system should this business use?', decide on **the consequences of a defect**. Where a fault is cheap and easily replaced (a low-priced flip-flop), quality control by sampling may be enough. Where a fault could injure someone or destroy a reputation (aircraft engines, food, medicine, a luxury brand), quality assurance or TQM is worth its extra cost. Naming that criterion is what turns a description into a judgement."}
]}
],
mcq: [
 {q:"Quality means:", o:["Producing the most expensive product possible","Producing a good or service that meets customer expectations","Employing the most inspectors","Using the cheapest materials"], a:1, why:"Quality is fitness for purpose against customer expectations at the price charged — not luxury."},
 {q:"Quality control involves checking:", o:["At every stage by the workers themselves","At the end of production by inspectors","Only the raw materials","Only after customers complain"], a:1, why:"Control is end-of-line inspection; assurance is checking throughout by the workers."},
 {q:"A drawback of quality control is that:", o:["It requires all workers to be trained","It finds faults but not their causes, so problems recur","It is cheaper than quality assurance","Customers never receive faulty goods"], a:1, why:"Detecting a fault does not explain why it happened, so the same fault reappears in the next batch."},
 {q:"TQM aims for:", o:["An acceptable level of defects","Zero defects — right first time","Fewer inspectors","Lower wages"], a:1, why:"'Right first time' with zero defects is the defining aim of Total Quality Management."},
 {q:"In TQM, the 'customer' includes:", o:["Only the final buyer","Only wholesalers","The next person or department in the production process","Only the shareholders"], a:2, why:"Treating the next stage as your customer is what makes quality everyone's responsibility internally."},
 {q:"A benefit of quality assurance over quality control is that:", o:["It costs nothing","Faults are prevented before value is added, reducing scrap costs","It requires no employee commitment","Inspectors are still needed"], a:1, why:"Catching a fault early means you have not wasted further materials and labour on a defective item."},
 {q:"ISO 9001 certification is most valuable to a business because:", o:["It guarantees higher profits","It signals to customers, especially other businesses, that quality is managed to a recognised standard","It removes the need for quality checks","It reduces wage costs"], a:1, why:"Many business customers will only buy from certified suppliers, so it can be a condition of market entry."}
],
exam: [
 {cmd:"Define", m:2,
  q:"Define 'quality control'.",
  ctx:"",
  plan:["Checking at the end of production.","Add: by inspectors, to find faults."],
  model:["Quality control is the checking of products for quality at the end of the production process (1), usually carried out by inspectors who take samples in order to find any faults before the goods reach the customer (1)."],
  marker:"1 mark for 'checking at the end of production'; 1 for the inspectors or the purpose of detecting faults."},

 {cmd:"Outline", m:4,
  q:"Outline two benefits of using quality control to DR.",
  ctx:"DR manufactures low-priced flip-flop shoes sold through supermarkets across the country.",
  plan:["Benefit 1: faulty flip-flops are found before they reach supermarkets — protects the retail relationship.","Benefit 2: less training needed than quality assurance, which suits a low-priced, low-margin product."],
  model:[
   "Faulty flip-flops would be found before they are dispatched to the supermarkets (1). Supermarkets are powerful customers who may drop a supplier whose products generate customer returns, so catching defects protects DR's shelf space in the chains that account for all its sales (1).",
   "Quality control requires less training for ordinary production workers than quality assurance does, because the checking is done by a small number of inspectors (1). For a low-priced product like flip-flops, where the margin on each pair is small, keeping training costs down helps DR remain price-competitive (1)."],
  marker:"4 marks. The second benefit is the stronger one because it connects the choice of quality system to the **low price** of the product — a link most candidates miss."},

 {cmd:"Explain", m:6,
  q:"Explain two possible disadvantages of using quality control to DR.",
  ctx:"DR manufactures low-priced flip-flops sold through supermarkets.",
  plan:["Disadvantage 1: expensive — inspectors' wages on a low-margin product.","Disadvantage 2: identifies faults but not causes, so the same defect recurs; and a whole batch may be scrapped after all value has been added.","Analyse to cost and repetition."],
  model:[
   "Employing inspectors is a direct cost that adds nothing to the product. Flip-flops are a low-priced item, so the margin on each pair is small and the wages of a team of inspectors must be recovered across a very large number of pairs. If DR is competing with other low-cost manufacturers, that cost could make the difference between winning and losing a supermarket contract.",
   "More seriously, quality control finds defective flip-flops but does not explain **why** they are defective. If a moulding machine is out of alignment, sampling at the end of the line will keep catching faulty pairs day after day while the cause continues, so DR pays twice — once to make the defective shoes using materials and machine time, and again to scrap them. A system that checked during production would identify the machine problem when the first faulty pair appeared, rather than after a whole batch had been completed."],
  marker:"6 marks: 3 per disadvantage. The second answer's point that the business 'pays twice' is precise analysis of the cost mechanism, which is what earns the third mark on each point."},

 {cmd:"Justify", m:6,
  q:"Do you think the owners of LK should charge higher prices in their cafés if quality assurance is introduced? Justify your answer.",
  ctx:"LK is a private limited company owning three city-centre cafés. Customers expect quality service and value for money. There has been an increasing number of complaints about waiting times and food quality. Nearby cafés have a brand image of high-quality service and charge high prices.",
  plan:["For higher prices: quality assurance costs money to train staff; better service justifies a higher price; competitors already charge high prices for high quality, so there is room; higher price signals quality.","Against: customers currently expect 'value for money' — raising prices changes the positioning; complaints suggest LK has not yet earned a quality reputation; raising prices before quality improves would accelerate customer loss; city-centre customers can walk to a competitor.","Judgement: improve quality first, then raise prices — sequence matters."],
  model:[
   "There is an argument for raising prices. Introducing quality assurance means training every member of staff to check standards at each stage, which is a genuine cost that must be recovered somehow. The case also tells us nearby cafés charge high prices for high-quality service, which shows city-centre customers in this area are willing to pay more when the quality justifies it — so there is headroom in the market.",
   "But the timing is wrong. The case says LK's customers currently expect **value for money**, and that complaints about waiting times and food quality are increasing. Raising prices for customers who are already dissatisfied would confirm their decision to leave, and in a city centre a competitor café is a two-minute walk away. Quality assurance also takes time to work — the standards must be trained in and embedded before customers actually experience any improvement.",
   "LK should introduce quality assurance **first and hold prices**, then raise them only once complaints have fallen and the improvement is visible to customers. The decisive reason is the sequence: price is a promise about quality, and LK cannot credibly make that promise while customers are complaining about the quality they already receive. Raising prices immediately would also abandon the value-for-money position without yet having earned the premium position the nearby cafés occupy — leaving LK stuck between the two, which is the worst place to be. Once service is reliably good, a modest price rise towards the level of those competitors would be justified and could be presented to customers as part of an improved offer."],
  marker:"6 marks. The top-band feature is recognising that the answer is not yes or no but **when** — and explaining why the sequence matters. Identifying the danger of being 'stuck between two positions' is a sophisticated marketing point drawn from Chapter 17."}
]
},

/* ==================== CHAPTER 21 ==================== */
{
n: "21", s: 4,
title: "Location decisions",
sub: "Locating manufacturing, service and retail businesses; locating in another country; legal controls",
obj: [
  "Explain the factors relevant to the location decision of manufacturing and service businesses",
  "Explain the factors a business considers when deciding which country to locate in",
  "Explain the role of legal controls on location decisions",
  "Recommend and justify an appropriate location in given circumstances"
],
defs: [
  ["Relocation", "Moving a business's operations from one site to another."],
  ["Bulk-increasing (weight-gaining) product", "A product that becomes heavier or more expensive to transport during production, so the business tends to locate near the market."],
  ["Bulk-decreasing (weight-losing) product", "A product whose raw materials are heavier than the finished product, so the business tends to locate near the raw material."],
  ["Enterprise zone", "An area where the government offers low-cost premises, grants or tax reductions to attract businesses."],
  ["Multinational (transnational) business", "A business with factories, production or service operations in more than one country."]
],
blocks: [
{
h2: "Locating a manufacturing business",
c: [
 {t:"table", head:["Factor", "Why it matters"], rows:[
   ["**Production method**", "Job production is small-scale, so proximity to component suppliers matters less. Large-scale flow production uses vast quantities of components, so supplier location matters much more — unless JIT makes it critical"],
   ["**Market**", "Important for **bulk-increasing** products, which become heavier and more expensive to transport during production (bottled drinks — the bottles and ingredients are lighter than the filled bottles). Also vital for **perishable** products such as bread and milk. Improved transport has reduced this factor's importance"],
   ["**Raw materials**", "Important for **bulk-decreasing** products where much waste is produced. Ore-processing plants locate at the mine because it is cheaper than transporting the ore. Also vital where materials must be processed while fresh — frozen vegetables, tinned fruit"],
   ["**External economies of scale**", "Being near other firms that support you — equipment installers and maintenance companies who can respond quickly to a breakdown, and universities whose research departments help develop new products"],
   ["**Availability of labour**", "Skilled labour is easier and cheaper to recruit where such workers already live. Unskilled labour is easier to find in areas of high unemployment. **Wage rates vary by area**"],
   ["**Government influence**", "Grants and subsidies to locate in areas of high unemployment; conversely, regulations may **prohibit** locating in a national park or near housing, especially where waste is harmful"],
   ["**Transport and communications**", "Access to roads, rail, ports and airports. Exporters need port access; a nearby motorway cuts delivery time and cost"],
   ["**Power and water supply**", "A reliable supply matters more than availability in most countries now. Businesses using large volumes of water for cooling — such as power stations — must locate near a river or the sea"],
   ["**Climate**", "Rarely decisive, but Silicon Valley's very dry climate assists silicon chip production"]
 ]}
]},
{
h2: "Locating a service business",
c: [
 {t:"table", head:["Factor", "Why it matters"], rows:[
   ["**Customers**", "Decisive where **direct personal contact** is needed and a quick response is expected — plumbers, electricians, hairdressers, restaurants, cafés, post offices. Not important where the service is delivered by phone or internet"],
   ["**Technology**", "Website designers, call centres and online services can locate anywhere, including in remote areas or abroad, taking advantage of cheaper rent"],
   ["**Availability of labour**", "A service needing many employees must be near a town or city. Highly specialised staff are more likely to move to the business than the reverse"],
   ["**Climate**", "Decisive for tourism-related services — hotels need good weather and a beach"],
   ["**Near other businesses**", "Firms servicing equipment used by large companies must be close enough to respond quickly. Banks locate in busy areas — though mobile banking is reducing this"],
   ["**Rent and taxes**", "Services that do not need a main-street site — doctors, dentists, lawyers, accountants — locate on the outskirts where rents and business taxes are lower"],
   ["**Personal preference of the owner**", "Sole traders very often locate near where they live"]
 ]}
]},
{
h2: "Locating a retail business",
c: [
 {t:"table", head:["Factor", "Why it matters"], rows:[
   ["**Shoppers**", "Both the **number** and the **type**. A retailer of expensive goods needs an area visited by high-income shoppers; a gift shop needs tourists"],
   ["**Nearby shops**", "Locating near a post office or popular fast-food outlet means many potential customers pass the door. **Competitors nearby can be a positive** — several clothes shops together draw shoppers to the area because of the choice; a lone clothes shop may attract nobody"],
   ["**Customer parking**", "Convenient parking encourages visits; the lack of it drives shoppers elsewhere"],
   ["**Availability of suitable vacant premises**", "The ideal site is worthless if nothing is available to rent or buy"],
   ["**Rent and taxes**", "The more central and popular the area, the higher the rent — because demand for sites there is higher"],
   ["**Access for delivery vehicles**", "Difficult access raises restocking costs"],
   ["**Security**", "High rates of theft and vandalism deter businesses, and insurers may refuse cover. A patrolled shopping centre may be worth the higher rent"],
   ["**Legislation**", "Laws may restrict trading or marketing of particular goods in particular areas"]
 ]},
 {t:"tip", x:"The **most counter-intuitive point in this chapter** — and therefore the most valuable — is that being near competitors can be an *advantage* for a retailer. Shoppers travel to areas offering choice. A clothes shop alone on a side street may see fewer customers than one of ten clothes shops in a mall. When a case has a manager saying 'we should not locate near our competitors', that is your evaluation opportunity."}
]},
{
h2: "Locating in another country",
c: [
 {t:"table", head:["Factor", "Why a business relocates or expands abroad"], rows:[
   ["**New markets overseas**", "When export sales rise steadily it becomes cheaper to produce near the market than to ship from home. JCB built factories in Brazil and China while keeping its UK plant. Service businesses such as Starbucks and Hilton must be where their customers are"],
   ["**Cheaper or new sources of materials**", "If a raw material source is exhausted, the business must move. It may also be cheaper to process materials at source than to transport them"],
   ["**Wage costs**", "Labour-intensive businesses relocate to countries with much lower wages — Western clothing manufacturers moving to Vietnam and Bangladesh"],
   ["**Availability of specific skills**", "India's large number of IT graduates has attracted businesses needing those skills"],
   ["**Rents and taxes**", "Lower business rents and lower taxes on profits or personal incomes"],
   ["**Government grants and incentives**", "Governments offer grants, lower taxes and other incentives to attract foreign investment, jobs, skills and technology"],
   ["**Avoiding trade barriers**", "Producing inside a market avoids its tariffs and quotas — the reason Japanese car companies built plants in Europe"]
 ]},
 {t:"eg", x:"**Chesapeake Bay Candle**, a US company manufacturing in China, opened a new US factory after Chinese wage costs rose up to 40% and shipping costs rose 6%. Its founder added a second reason: 'to be successful in the American market the business needs to be able to produce and ship the products the next day to meet quickly changing fashions.' **Speed to market can outweigh wage costs** — a point most candidates miss."}
]},
{
h2: "Legal controls on location",
c: [
 {t:"p", x:"Governments intervene in location decisions for two reasons: to **attract** businesses to areas of high unemployment, and to **prevent** them locating in overcrowded areas or places of natural beauty."},
 {t:"table", head:["Instrument", "How it works"], rows:[
   ["**Planning regulations**", "Legally restrict what business activity may take place where. A factory in a residential area may be refused planning permission; in some protected areas nothing but farming is permitted"],
   ["**Grants and subsidies**", "Non-repayable grants or low-rent premises to encourage businesses into **development areas** with very high unemployment"],
   ["**Enterprise zones**", "Designated areas offering low-cost premises and tax reductions to start-ups and relocating firms"]
 ]},
 {t:"trap", x:"Government grants are attractive but should never decide a location on their own. A grant is one-off or short-term; a bad location is permanent. If the site has no skilled labour, poor transport links and is far from the market, the grant will run out long before those problems do. Saying this is a strong evaluation move in any location question involving incentives."},
 {t:"tip", x:"Location questions are almost always 12-mark 'recommend' questions with two sites and a table of data. Method: **(1)** identify the two or three factors that matter most **for this type of business** (a bakery: perishability and local market; an exporter: port access; a call centre: labour and rent); **(2)** compare the sites on those factors only, ignoring the rest; **(3)** decide, and say what would change your mind. Do not work through all twelve factors — you will run out of time and dilute the answer."}
]}
],
mcq: [
 {q:"A business processing sugar beet into sugar produces a lot of waste. It should locate near:", o:["The market","The raw material source","A university","An airport"], a:1, why:"Bulk-decreasing production — it is cheaper to move the light finished product than the heavy raw material plus waste."},
 {q:"A bottled drinks manufacturer would most likely locate near:", o:["The raw material source","The market","A national park","A coal mine"], a:1, why:"Bottling is bulk-increasing — filled bottles are heavier and costlier to transport than the empty bottles and ingredients."},
 {q:"For which business is being close to customers MOST important?", o:["A website design company","A local plumbing service","An oil refinery","A textiles exporter"], a:1, why:"Personal services requiring a quick on-site response must be local; the others can locate anywhere."},
 {q:"A retailer of expensive jewellery should locate:", o:["In an area of high unemployment","Where high-income shoppers visit","Next to a discount warehouse","On an industrial estate"], a:1, why:"The type of shopper matters as much as the number — location must match the target market."},
 {q:"Being located near competing shops can be an ADVANTAGE because:", o:["Competitors will share their profits","Shoppers travel to areas offering choice","Rents are always lower","Delivery access improves"], a:1, why:"Clustering draws customers who want to compare — this is why shopping malls and 'shoe streets' exist."},
 {q:"A government offers grants to businesses locating in an area of high unemployment. This is intended to:", o:["Reduce competition","Create jobs in that area","Increase business rents","Lower the minimum wage"], a:1, why:"Regional policy uses grants to attract employers into depressed areas."},
 {q:"A Japanese car manufacturer building a factory in Europe is mainly avoiding:", o:["Higher wages","Import tariffs and quotas","Poor climate","Language problems"], a:1, why:"Producing inside the market means the output is not an import, so tariffs and quotas do not apply."},
 {q:"A limitation of choosing a location because of a government grant is that:", o:["Grants must always be repaid","The grant is temporary but the location's disadvantages are permanent","Grants are illegal","Grants reduce the number of customers"], a:1, why:"Incentives should support a decision that already makes commercial sense, not substitute for one."}
],
exam: [
 {cmd:"Define", m:2,
  q:"Define 'relocation of the factory'.",
  ctx:"",
  plan:["Moving operations from one site to another.","Add why or the implication."],
  model:["Relocation is when a business moves its operations from its existing site to a different one (1), which may be elsewhere in the same country or in another country, usually to reduce costs or be nearer to its market or materials (1)."],
  marker:"1 mark for 'moving from one site to another'; 1 for a reason or for the domestic/international distinction."},

 {cmd:"Outline", m:4,
  q:"Outline two factors which influenced ABC Limited's original location decision.",
  ctx:"ABC Limited produces fruit juice drinks. The fruit is grown on nearby farms. Producing the drinks creates a lot of waste from unused parts of the fruit. There is a big market for fruit drinks both at home and overseas.",
  plan:["Factor 1: proximity to the raw material — fruit is perishable and bulk-decreasing (a lot of waste).","Factor 2: waste disposal — needs a site where waste can be handled, away from housing."],
  model:[
   "Being close to the fruit farms (1). Fruit is perishable and must be processed quickly to make a good-quality drink, and because a lot of the fruit becomes waste it is cheaper to transport the finished juice than to carry whole fruit a long distance and then throw much of it away (1).",
   "The need to dispose of large amounts of waste (1) means ABC required a site where waste could be handled without creating a nuisance, which usually means locating away from residential areas and where planning permission for such processing is granted (1)."],
  marker:"4 marks. The first factor identifies **both** perishability and bulk-decreasing production, which is exactly what the case has planted with 'nearby farms' and 'a lot of waste'."},

 {cmd:"Explain", m:6,
  q:"Explain two reasons why ABC might want to buy land next to its existing factory to expand rather than relocate to another country.",
  ctx:"Land near the farm is available at a low price. ABC's fruit is grown locally; imported fruit is cheaper but lower quality.",
  plan:["Reason 1: keeps proximity to the local fruit supply, which the case says is higher quality than imports — quality is the basis of the product.","Reason 2: cost and disruption of relocating vs cheap adjacent land; keeps existing trained workforce.","Analyse each to cost or quality consequence."],
  model:[
   "Staying next to the existing site keeps ABC close to its local fruit supply. The case tells us imported fruit is cheaper but of lower quality, and the quality of the fruit determines the quality of the juice. If ABC relocated abroad it would have to buy locally in that country or import, and either could damage the taste and reputation of its drinks — losing it customers who buy the product precisely because it is good. Adjacent land also means no additional transport cost between the farms and the factory.",
   "Relocating abroad is expensive and disruptive, while the land next door is cheap. ABC would have to build a new factory, transport or replace its equipment, and recruit and train an entirely new workforce, losing employees who already know its processes. Expanding on adjacent land avoids all of that: the existing factory keeps operating during construction, the same trained workers can staff the extension, and the low land price means the expansion costs far less than a relocation would."],
  marker:"6 marks: 3 per reason. The first is the stronger because it links location directly to **product quality**, which the case has deliberately planted with the sentence about imported fruit."},

 {cmd:"Recommend", m:12,
  q:"MT Furniture wants to expand and must choose between Site A, on the outskirts of its home city, and Site B, overseas in its main export market. Recommend which site MT should choose. Justify your answer.",
  ctx:"Site A: large local market, good road links, port several miles away, raw materials and components close by, high wage rates, skilled workers available nearby, low unemployment, high rents and land taxes, no grants. Site B: large and growing export market, good roads, ports very close, raw materials NOT close (some must be imported), very low wages, very few skilled workers, high unemployment, low rents and taxes, government grants available for new companies.",
  plan:["Site A: existing skilled workforce retained, materials close, but high wages/rents and the market is at home while sales are increasingly export.","Site B: cheap labour, cheap land, grants, next to the growing market and the ports — but no skilled workers and materials must be imported.","Judgement: the decisive tension is SKILLED LABOUR (furniture making needs it) vs COST + MARKET ACCESS. Decide with a condition."],
  model:[
   "**Site A — outskirts of the home city.** Its greatest strength is people and materials. Skilled furniture makers are available nearby and MT's existing workforce could continue, so quality and productivity would be maintained from day one. Raw materials and components are close, keeping input transport costs low, and road links are good. Against this, wage rates are high, rents and land taxes are high, no grants are available, and — critically — the case says MT's sales growth is coming from **exports**, while Site A is several miles from the port and thousands of miles from those customers.",
   "**Site B — in the main export market.** The cost advantages are substantial: very low wages, low rents and taxes, and government grants towards the capital investment. It sits inside the growing export market, so MT would avoid long-distance shipping costs to its fastest-growing customers, and the ports are very close for onward exports elsewhere. High local unemployment means workers are readily available. But there are two serious weaknesses: very few **skilled** workers, and raw materials that are not close and would partly have to be imported.",
   "**Weighing them.** The decisive question is what MT's furniture business actually depends on. Furniture manufacturing needs skilled workers, and Site B does not have them — MT would have to train an entire workforce from nothing, during which quality and output would both suffer, and quality is what its customers buy. The material problem compounds this: importing raw materials into Site B would erode much of the wage saving. Conversely, Site A's high wages and rents are real but predictable costs, and MT is already managing them successfully.",
   "**Recommendation.** MT should choose **Site A** and continue exporting, at least for this expansion. The decisive factor is the availability of skilled labour: a furniture business that cannot make furniture to its existing standard has no advantage worth having, and neither low wages nor a government grant compensates for that. Site B was rejected primarily on skills and materials, not on principle — and if MT's export sales continue to grow, Site B should be revisited later, once the business is large enough to fund a proper training programme and to negotiate reliable local material supply. At that point the wage, rent, grant and market-proximity advantages would become compelling. The decision therefore turns on **timing**: Site B is the right location eventually, but not yet."],
  marker:"12 marks. The top band requires both sites argued with advantages and disadvantages applied to a furniture manufacturer (8), plus a judgement that decides, names the decisive criterion, and explains the rejection (4). The 'right site but wrong time' conclusion is a sophisticated resolution that examiners reward highly."}
]
}

]);
