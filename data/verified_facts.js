// Verified Facts Database — simulates a knowledge base of checked facts
const VERIFIED_FACTS = [
  {
    id: "fact_001",
    claim: "India's GDP growth rate in 2023 was 7.2%",
    verdict: "TRUE",
    source: "IMF World Economic Outlook 2023",
    category: "Economy",
    confidence: 0.97,
    tags: ["india", "gdp", "economy", "growth"]
  },
  {
    id: "fact_002",
    claim: "COVID-19 vaccines cause infertility",
    verdict: "FALSE",
    source: "WHO, CDC, ICMR Joint Statement 2022",
    category: "Health",
    confidence: 0.99,
    tags: ["covid", "vaccine", "health", "infertility", "टीका", "वैक्सीन"]
  },
  {
    id: "fact_003",
    claim: "Drinking cow urine cures cancer",
    verdict: "FALSE",
    source: "AIIMS Research Report 2021",
    category: "Health",
    confidence: 0.98,
    tags: ["cancer", "cow urine", "गौमूत्र", "health", "cure", "treatment"]
  },
  {
    id: "fact_004",
    claim: "5G towers spread coronavirus",
    verdict: "FALSE",
    source: "TRAI, WHO Expert Panel 2020",
    category: "Technology",
    confidence: 0.99,
    tags: ["5g", "covid", "coronavirus", "technology", "towers"]
  },
  {
    id: "fact_005",
    claim: "India launched Chandrayaan-3 successfully to Moon's south pole",
    verdict: "TRUE",
    source: "ISRO Official Press Release, August 2023",
    category: "Science",
    confidence: 0.99,
    tags: ["chandrayaan", "isro", "moon", "space", "चंद्रयान"]
  },
  {
    id: "fact_006",
    claim: "Election voting machines (EVMs) are easily hackable",
    verdict: "DISPUTED",
    source: "Election Commission of India Technical Review 2023",
    category: "Politics",
    confidence: 0.72,
    tags: ["evm", "election", "voting", "hack", "india"]
  },
  {
    id: "fact_007",
    claim: "India has the world's highest youth unemployment rate",
    verdict: "FALSE",
    source: "ILO Global Employment Trends 2023",
    category: "Economy",
    confidence: 0.88,
    tags: ["unemployment", "youth", "india", "jobs", "economy"]
  },
  {
    id: "fact_008",
    claim: "WhatsApp reads your private messages",
    verdict: "DISPUTED",
    source: "WhatsApp Privacy Policy Review, MEITY Report 2021",
    category: "Technology",
    confidence: 0.65,
    tags: ["whatsapp", "privacy", "messages", "read", "surveillance"]
  },
  {
    id: "fact_009",
    claim: "Eating onions prevents dengue fever",
    verdict: "FALSE",
    source: "Ministry of Health India Advisory 2022",
    category: "Health",
    confidence: 0.96,
    tags: ["onion", "dengue", "fever", "prevention", "pyaaz", "health"]
  },
  {
    id: "fact_010",
    claim: "India became world's most populous country surpassing China in 2023",
    verdict: "TRUE",
    source: "UN Population Division Report, April 2023",
    category: "Demographics",
    confidence: 0.98,
    tags: ["india", "china", "population", "census", "largest"]
  },
  {
    id: "fact_011",
    claim: "PM Modi ji ne sabhi kisanon ko 10 lakh rupaye diye",
    verdict: "FALSE",
    source: "PIB Fact Check, Ministry of Agriculture 2023",
    category: "Politics",
    confidence: 0.97,
    tags: ["modi", "kisan", "किसान", "farmer", "money", "10 lakh", "government scheme"]
  },
  {
    id: "fact_012",
    claim: "Vitamin C megadoses cure viral infections",
    verdict: "FALSE",
    source: "Lancet Meta-Analysis 2022, WHO Guidance",
    category: "Health",
    confidence: 0.91,
    tags: ["vitamin c", "cure", "viral", "infection", "megadose", "health"]
  },
  {
    id: "fact_013",
    claim: "Petrol prices in India are lowest in Asia",
    verdict: "FALSE",
    source: "GlobalPetrolPrices.com Database 2023",
    category: "Economy",
    confidence: 0.94,
    tags: ["petrol", "fuel", "price", "india", "asia", "cheap"]
  },
  {
    id: "fact_014",
    claim: "New Education Policy 2020 bans English medium schools",
    verdict: "FALSE",
    source: "NEP 2020 Full Text, Ministry of Education",
    category: "Education",
    confidence: 0.96,
    tags: ["nep", "education policy", "english", "ban", "school", "medium"]
  },
  {
    id: "fact_015",
    claim: "India's Unified Payment Interface processes over 10 billion transactions monthly",
    verdict: "TRUE",
    source: "NPCI Monthly Data Report, Oct 2023",
    category: "Technology",
    confidence: 0.97,
    tags: ["upi", "payments", "npci", "transactions", "digital india"]
  }
];

// Simulated posts feed — mix of Hindi, English, mixed-language
const SAMPLE_POSTS = [
  {
    id: "post_001",
    text: "Breaking news! PM Modi ne aaj sabhi unemployed yuvaon ko Rs 5000 per month dene ka announcement kiya. Share karo jaldi!",
    source: "WhatsApp",
    language: "Hindi+English",
    timestamp: new Date(Date.now() - 120000),
    risk: "high"
  },
  {
    id: "post_002",
    text: "ISRO successfully launched Chandrayaan-3 and it landed near the Moon's south pole, making India the first country to achieve this feat.",
    source: "Twitter",
    language: "English",
    timestamp: new Date(Date.now() - 240000),
    risk: "low"
  },
  {
    id: "post_003",
    text: "COVID vaccine ke side effects mein infertility aati hai, doctor ne bola. Ye government ka plan hai population control karne ka!",
    source: "WhatsApp",
    language: "Hindi",
    timestamp: new Date(Date.now() - 60000),
    risk: "high"
  },
  {
    id: "post_004",
    text: "5G towers se corona fail hota hai, scientifically proven. Apne area mein 5G tower mat lagane do!",
    source: "YouTube",
    language: "Hindi",
    timestamp: new Date(Date.now() - 300000),
    risk: "high"
  },
  {
    id: "post_005",
    text: "India overtook China as the world's most populous country in 2023 according to UN data.",
    source: "Twitter",
    language: "English",
    timestamp: new Date(Date.now() - 180000),
    risk: "low"
  },
  {
    id: "post_006",
    text: "Pyaaz khane se dengue thik hota hai, ye ancient remedy hai. Ghar mein pyaaz rakho!",
    source: "WhatsApp",
    language: "Hindi",
    timestamp: new Date(Date.now() - 90000),
    risk: "high"
  },
  {
    id: "post_007",
    text: "EVM machines hack ho sakti hain, ek hacker ne demo diya YouTube pe. Share karo elections se pehle!",
    source: "YouTube",
    language: "Hindi+English",
    timestamp: new Date(Date.now() - 360000),
    risk: "medium"
  },
  {
    id: "post_008",
    text: "India's UPI processed over 10 billion transactions in October 2023, a new record.",
    source: "Twitter",
    language: "English",
    timestamp: new Date(Date.now() - 420000),
    risk: "low"
  },
  {
    id: "post_009",
    text: "Gaay ka mutra pine se cancer thik ho jata hai, multiple patients ki testimony hai WhatsApp pe!",
    source: "WhatsApp",
    language: "Hindi",
    timestamp: new Date(Date.now() - 150000),
    risk: "high"
  },
  {
    id: "post_010",
    text: "New Education Policy 2020 bans all English medium schools from 2024. Hindi must be compulsory!",
    source: "Twitter",
    language: "English",
    timestamp: new Date(Date.now() - 480000),
    risk: "high"
  }
];

// Conversational fluff patterns to strip during optimization
const FLUFF_PATTERNS = [
  /please share|share karo|forward karo|viral karo/gi,
  /breaking news|breaking!/gi,
  /must read|zaroor padho/gi,
  /jaldi|urgent|asap/gi,
  /friends|doston|bhai log|bhai-log/gi,
  /aap sab ko batana chahta hun|i want to tell everyone/gi,
  /believe me|trust me|sach maan lo/gi,
  /\b(plz|pls|please)\b/gi,
  /!!+|😱|🚨|⚠️|🔴|🆘/g,
  /according to my uncle|mere bhai ne bola|dost ne bataya/gi,
  /copy paste karo|copy karo|send karo sabko/gi
];
