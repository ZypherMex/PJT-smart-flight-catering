// Initial health-condition rules. Seeded once into the DB; after that the
// database (managed from the admin area) is the source of truth.
//
// Condition ids deliberately equal the old seat_preferences column names so the
// one-time migration can copy existing selections across by id.

const RESTRICTION_TAGS = [
  { tag: 'peanut', label: 'Peanuts', kind: 'ingredient' },
  { tag: 'tree_nut', label: 'Tree nuts', kind: 'ingredient' },
  { tag: 'egg', label: 'Eggs', kind: 'ingredient' },
  { tag: 'dairy', label: 'Dairy', kind: 'ingredient' },
  { tag: 'gluten', label: 'Gluten', kind: 'ingredient' },
  { tag: 'soy', label: 'Soy', kind: 'ingredient' },
  { tag: 'sesame', label: 'Sesame', kind: 'ingredient' },
  { tag: 'meat', label: 'Meat', kind: 'ingredient' },
  { tag: 'fish', label: 'Fish', kind: 'ingredient' },
  { tag: 'pork', label: 'Pork', kind: 'ingredient' },
  { tag: 'alcohol', label: 'Alcohol', kind: 'ingredient' },
  { tag: 'high_sugar', label: 'Sugar', kind: 'nutrition' },
  { tag: 'high_sodium', label: 'Sodium', kind: 'nutrition' },
  { tag: 'high_fat', label: 'Fat', kind: 'nutrition' },
];

const BUILTIN_CONDITIONS = [
  { id: 'peanut_allergy', label: 'Peanuts', group: 'allergies', forbids: ['peanut', 'tree_nut'] },
  { id: 'egg_allergy', label: 'Eggs', group: 'allergies', forbids: ['egg'] },
  { id: 'milk_allergy', label: 'Milk / dairy', group: 'allergies', forbids: ['dairy'] },
  { id: 'sesame_allergy', label: 'Sesame', group: 'allergies', forbids: ['sesame'] },
  { id: 'soy_allergy', label: 'Soy', group: 'allergies', forbids: ['soy'] },
  { id: 'lactose_gluten_intolerance', label: 'Lactose / Gluten intolerance', group: 'intolerances', forbids: ['dairy', 'gluten'] },
  { id: 'diabetes', label: 'Diabetes', group: 'medicalConditions', forbids: ['high_sugar'] },
  { id: 'high_blood_pressure', label: 'High blood pressure', group: 'medicalConditions', forbids: ['high_sodium'] },
  { id: 'high_cholesterol', label: 'High cholesterol', group: 'medicalConditions', forbids: ['high_fat'] },
  { id: 'heart_disease', label: 'Heart disease', group: 'medicalConditions', forbids: ['high_fat', 'high_sodium'] },
  { id: 'kidney_disease', label: 'Kidney disease', group: 'medicalConditions', forbids: ['high_sodium'] },
  { id: 'vegetarian_vegan', label: 'Vegetarian / vegan', group: 'other', forbids: ['meat', 'fish'] },
  { id: 'halal', label: 'Halal', group: 'other', forbids: ['pork', 'alcohol'] },
];

// Keyword rules matched against "name + description". These are *inferred*
// defaults, deliberately conservative (when a dish plausibly contains an
// allergen, it is tagged) and flagged "needs review" until staff confirm them.
const TAG_RULES = {
  peanut: /peanut/,
  tree_nut: /almond|pistachio|hazelnut|macadamia|walnut|cashew|pecan|frangipane/,
  egg: /\begg|omelette|frittata|bayd|anglaise|frangipane|waffle|cr[eê]pe|mousse/,
  dairy: /cheese|mozzarella|parmesan|cream|yoghurt|yogurt|milk|butter|beurre|ashta|mousse|waffle|cr[eê]pe|omelette|anglaise|chocolate|ganache|kunafe|frangipane/,
  gluten: /bread|\bpav\b|toast|sandwich|\brye\b|waffle|cr[eê]pe|noodle|\bpie\b|\btart\b|maamoul|frangipane|pizza|pastry|biscuit|blini|melba|cracker|barley|fatayer|spring roll|kunafe|crumble/,
  soy: /\bsoy|tofu|bean curd/,
  sesame: /sesame|tahini|houmous|hummus|baba ghanou|zaatar|za'atar/,
  meat: /chicken|beef|lamb|turkey|sausage|chipolata|bresaola|wagyu|kebab|rasher|\bham\b|bacon|\bmeat\b/,
  fish: /salmon|trout|caviar|\bfish\b|tuna|prawn|shrimp/,
  pork: /\bpork\b|bacon|\bham\b|pancetta/,
  alcohol: /champagne|\bwine\b|\bport\b/,
  high_sugar: /compote|jell(y|ies)|caramel|syrup|maamoul|waffle|mousse|ganache|chocolate/,
  high_sodium: /bresaola|caviar|sausage|chipolata|rasher|cheese|pizza|\bpie\b|soy chilli|antipasti|zaatar/,
  high_fat: /cheese|cream|butter|beurre|\bpie\b|ganache|pizza|frangipane|waffle/,
};

const ICON_TAGS = {
  champagne: ['alcohol'],
  wine: ['alcohol'],
  dessert: ['high_sugar'],
  tart: ['high_sugar'],
  chocolate: ['high_sugar'],
};

function inferItemTags({ name, description, icon }) {
  // Wine/champagne descriptions are tasting notes ("hint of toast"), not
  // ingredients, so ingredient keyword rules must not run on them.
  if (icon === 'champagne' || icon === 'wine') return ['alcohol'];

  const text = `${name} ${description || ''}`.toLowerCase();
  const tags = new Set(ICON_TAGS[icon] || []);
  for (const [tag, pattern] of Object.entries(TAG_RULES)) {
    if (pattern.test(text)) tags.add(tag);
  }
  return [...tags];
}

module.exports = { RESTRICTION_TAGS, BUILTIN_CONDITIONS, inferItemTags };
