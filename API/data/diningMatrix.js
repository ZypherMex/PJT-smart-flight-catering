// First/Business wine+course tiers and Economy veg/non-veg dishes, by haul
// length (and, for Economy, time of day). Moved here from the original
// single-file prototype so the frontend no longer hardcodes it.

const DINING = {
  firstClass: {
    shortHaul: {
      haulExample: 'e.g. Dubai–Kuwait, under ~3 hours',
      courseCount: 3,
      courses: [
        'Amuse-bouche: Smoked salmon rillette with brioche toast',
        'Main: Pan-seared chicken supreme with lemon-thyme jus and saffron rice',
        'Dessert: Pistachio and rose panna cotta',
      ],
      wineCount: 4,
      wineList: [
        'Moët & Chandon Brut Impérial Champagne',
        'Cloudy Bay Sauvignon Blanc (white)',
        'Château Lynch-Bages, Pauillac (red)',
        "Taylor's 10-Year-Old Tawny Port (dessert)",
      ],
    },
    mediumHaul: {
      haulExample: 'e.g. Dubai–London, 4-7 hours',
      courseCount: 4,
      courses: [
        'Starter: Hiramasa kingfish ceviche with yuzu dressing',
        'Soup: Lobster bisque with a dash of cognac',
        'Main: Grilled Wagyu beef tenderloin with black truffle jus and potato gratin',
        'Dessert: Valrhona dark chocolate fondant with vanilla bean ice cream',
      ],
      wineCount: 6,
      wineList: [
        'Dom Pérignon Vintage Champagne',
        "Chablis Grand Cru 'Les Clos' (white)",
        'Chassagne-Montrachet Grand Cru (white)',
        'Château Margaux, Bordeaux (red)',
        'Penfolds Grange Shiraz (red)',
        "Graham's 20-Year-Old Tawny Port (dessert)",
      ],
    },
    longHaul: {
      haulExample: 'e.g. Dubai–Los Angeles, 14+ hours',
      courseCount: 6,
      courses: [
        'Amuse-bouche: Beluga caviar service with blini and crème fraîche',
        'Starter: Hiramasa kingfish ceviche with yuzu dressing',
        'Soup: Lobster bisque with cognac',
        'Main: Beef Wellington with black truffle jus and fondant potato',
        'Cheese course: Trolley service of Comté, Roquefort, Brie, and Époisses',
        'Dessert: Dark chocolate and gold-leaf fondant with Madagascar vanilla ice cream, served with Arabic coffee and dates',
      ],
      wineCount: 10,
      wineList: [
        'Dom Pérignon P2 Champagne',
        'Krug Grande Cuvée Champagne',
        "Chablis Grand Cru 'Les Clos' (white)",
        'Chassagne-Montrachet Grand Cru (white)',
        'Cloudy Bay Sauvignon Blanc (white)',
        'Château Margaux, Bordeaux (red)',
        'Château Lynch-Bages, Pauillac (red)',
        'Penfolds Grange Shiraz (red)',
        "Graham's 20-Year-Old Tawny Port (dessert)",
        "Château d'Yquem, Sauternes (dessert)",
      ],
    },
    note: 'First Class always carries the widest wine list of the three cabins at every haul length. Pick exactly one wine for this seat.',
  },
  businessClass: {
    shortHaul: {
      haulExample: 'e.g. Dubai–Kuwait, under ~3 hours',
      courseCount: 2,
      courses: [
        'Main: Grilled chicken breast with herb jus and rice pilaf',
        'Dessert: Lemon tart',
      ],
      wineCount: 2,
      wineList: [
        'Veuve Clicquot Yellow Label Champagne',
        'Wolf Blass Grey Label Cabernet Sauvignon (red)',
      ],
    },
    mediumHaul: {
      haulExample: 'e.g. Dubai–London, 4-7 hours',
      courseCount: 3,
      courses: [
        'Starter: Mezze platter (hummus, baba ganoush, olives)',
        'Main: Grilled salmon fillet with lemon butter sauce and couscous',
        'Dessert: Chocolate mousse',
      ],
      wineCount: 4,
      wineList: [
        'Veuve Clicquot Yellow Label Champagne',
        'Oyster Bay Sauvignon Blanc (white)',
        'Wolf Blass Grey Label Cabernet Sauvignon (red)',
        "Graham's 10-Year-Old Tawny Port (dessert)",
      ],
    },
    longHaul: {
      haulExample: 'e.g. Dubai–Los Angeles, 14+ hours',
      courseCount: 4,
      courses: [
        'Starter: Mezze platter (hummus, baba ganoush, olives)',
        'Soup: Chicken and vegetable broth',
        'Main: Braised beef short ribs with red wine jus and mashed potato',
        'Dessert: Tiramisu',
      ],
      wineCount: 6,
      wineList: [
        'Veuve Clicquot Yellow Label Champagne',
        'Chablis (white)',
        'Oyster Bay Sauvignon Blanc (white)',
        'Wolf Blass Grey Label Cabernet Sauvignon (red)',
        "Jacob's Creek Shiraz (red)",
        "Graham's 10-Year-Old Tawny Port (dessert)",
      ],
    },
    note: 'Business Class offers wine at every haul length but with fewer courses and a visibly shorter wine list than First Class at the same haul length. Pick exactly one wine for this seat.',
  },
  economy: {
    shortHaul: {
      haulExample: 'e.g. Dubai–Kuwait, under ~3 hours',
      breakfast: { veg: 'Vegetable and cheese omelette with hash browns and sautéed mushrooms', nonVeg: 'Chicken sausage and scrambled eggs with hash browns' },
      lunchDinner: { veg: 'Vegetable biryani with raita and papadum', nonVeg: 'Chicken biryani with raita and papadum' },
      eveningSnack: { snackOnly: true, item: 'Cheese and cucumber sandwich with a granola bar and fruit cup (single light snack, no veg/non-veg split on short haul)' },
    },
    mediumHaul: {
      haulExample: 'e.g. Dubai–London, 4-7 hours',
      breakfast: { veg: 'Spinach and mushroom frittata with roasted tomato and herbed potatoes', nonVeg: 'Turkey bacon, scrambled eggs and grilled tomato with herbed potatoes' },
      lunchDinner: { veg: 'Paneer tikka masala with basmati rice and naan', nonVeg: 'Butter chicken with basmati rice and naan' },
      eveningSnack: { veg: 'Vegetable samosas with mint chutney', nonVeg: 'Chicken shawarma wrap with garlic sauce' },
    },
    longHaul: {
      haulExample: 'e.g. Dubai–Los Angeles, 14+ hours',
      breakfast: { veg: 'Mushroom and spinach frittata with grilled tomato, served with a croissant', nonVeg: 'Omelette with chicken sausage and hash browns, served with a croissant' },
      lunchDinner: { veg: 'Vegetable korma with saffron rice and yellow dal', nonVeg: 'Slow-braised lamb curry with saffron rice and yellow dal' },
      eveningSnack: { veg: 'Falafel wrap with hummus and tabbouleh', nonVeg: 'Grilled chicken wrap with garlic sauce and tabbouleh' },
    },
    note: 'Economy never offers wine; it is strictly a binary Veg/Non-Veg choice. Dish depends on both haul length and time-of-day window. On Short Haul only, the Evening/Snack window collapses to a single light snack item rather than a veg/non-veg pair.',
  },
};

const PREFERENCE_GROUPS = {
  allergies: ['Peanuts', 'Eggs', 'Milk / dairy', 'Sesame', 'Soy'],
  intolerances: ['Lactose / Gluten intolerance'],
  medicalConditions: ['Diabetes', 'High blood pressure', 'High cholesterol', 'Heart disease', 'Kidney disease'],
  other: ['Vegetarian / vegan', 'Halal'],
};

module.exports = { DINING, PREFERENCE_GROUPS };
