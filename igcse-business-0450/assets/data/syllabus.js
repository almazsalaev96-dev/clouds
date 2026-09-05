/* Syllabus map — Cambridge IGCSE (0450/0986) & O Level (7115) Business Studies */
window.SYLLABUS = {
  code: "0450 / 0986 / 7115",
  name: "Business Studies",
  papers: [
    { n: 1, name: "Short Answer & Data Response", time: "1h 30m", marks: 80, weight: "50%",
      format: "Four data-response questions, each on a different business. Each splits into parts (a)-(e) worth 2, 2, 4, 6 and 6 marks." },
    { n: 2, name: "Case Study", time: "1h 30m", marks: 80, weight: "50%",
      format: "Four structured questions, each in two parts — (a) 8 marks and (b) 12 marks — all based on one case study insert." }
  ],
  aos: [
    { k: "AO1", name: "Knowledge & understanding", w: "30%",
      d: "Recall business terms, concepts and theories. Earned by definitions and identifications." },
    { k: "AO2", name: "Application", w: "20%",
      d: "Use the case material. Name the business, its product, its people, its numbers. Un-applied answers are capped." },
    { k: "AO3", name: "Analysis", w: "30%",
      d: "Build chains of reasoning — cause to effect to consequence for this business. This is where 6-mark and 12-mark answers are won." },
    { k: "AO4", name: "Evaluation", w: "20%",
      d: "Weigh both sides, then decide. A supported judgement that also says why the other option was rejected." }
  ],
  sections: [
    { n: 1, key: "s1", title: "Understanding business activity",
      blurb: "Needs, wants, scarcity and opportunity cost; the three sectors; enterprise and growth; legal structures; objectives and stakeholders.",
      chapters: ["1","2","3","4","5"] },
    { n: 2, key: "s2", title: "People in business",
      blurb: "Motivation theory and pay systems; organisation structure and leadership; recruitment and training; employment law; communication.",
      chapters: ["6","7","8","9"] },
    { n: 3, key: "s3", title: "Marketing",
      blurb: "Customer needs and segmentation; market research; the full marketing mix — product, price, place, promotion — plus technology and strategy.",
      chapters: ["10","11","12","13","14","15","16","17"] },
    { n: 4, key: "s4", title: "Operations management",
      blurb: "Production methods and productivity; lean production; costs and economies of scale; break-even; quality; location.",
      chapters: ["18","19","20","21"] },
    { n: 5, key: "s5", title: "Financial information and decisions",
      blurb: "Sources of finance; cash flow and working capital; income statements; statements of financial position; ratio analysis.",
      chapters: ["22","23","24","25","26"] },
    { n: 6, key: "s6", title: "External influences on business activity",
      blurb: "The business cycle and government economic policy; environmental and ethical issues; globalisation, multinationals and exchange rates.",
      chapters: ["27","28","29"] }
  ]
};
