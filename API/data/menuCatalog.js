// Real Emirates in-flight menu content, transcribed from official menu PDFs
// (First/Business/Economy class x Short/Medium/Long haul). Where a source PDF
// only covered drinks or a single section for a given combination, that
// combination intentionally has fewer sections here rather than inventing
// dishes that weren't in the source material.
//
// `icon` is a placeholder visual key rendered as a gradient + glyph card until
// real dish photography is added (see `image_url` on menu_items — left NULL
// here; populate it later to swap the placeholder for a real photo with no
// markup changes needed).

// Dish name -> uploaded photo, served from WEB/images/menu/. Add an entry here
// whenever a new photo is dropped in; item() looks it up automatically so the
// menu sections below don't need to be touched by hand.
const DISH_PHOTOS = {
  'Apple Caramel Mousse': '/images/menu/apple-caramel-mousse.png',
  'Arabic Dips': '/images/menu/arabic-dips.png',
  'Batata wa Bayd Mfarakeh': '/images/menu/batata-wa-bayd-mfarakeh.png',
  'Bzar Chicken': '/images/menu/bzar-chicken.png',
  'Cheese Board': '/images/menu/cheese-board.png',
  'Chicken Kebab': '/images/menu/chicken-kebab.png',
  'Chocolate Mango Tart': '/images/menu/chocolate-mango-tart.png',
  'Cream of Mushroom Soup': '/images/menu/cream-of-mushroom-soup.png',
  'Grilled Chicken': '/images/menu/grilled-chicken.png',
  'Kale and Spinach Frittata': '/images/menu/kale-and-spinach-frittata.png',
  'Kofta Sweet and Sour': '/images/menu/kofta-sweet-and-sour.png',
  'Mozzarella and Sundried Tomato Sandwich': '/images/menu/mozzarella-and-sundried-tomato-sandwich.png',
  'Pan-fried Beef Tenderloin': '/images/menu/pan-fried-beef-tenderloin.png',
  'Pan-seared Salmon Trout': '/images/menu/pan-seared-salmon-trout.png',
  Pav: '/images/menu/pav.png',
  'Scrambled Eggs with Turkey Rashers': '/images/menu/scrambled-eggs-with-turkey-rashers.png',
  'Scrambled Eggs': '/images/menu/scrambled-eggs.png',
  'Spiced Bean Curd and Peppers': '/images/menu/spiced-bean-curd-and-peppers.png',
  'Stir-fried Vegetable Noodles': '/images/menu/stir-fried-vegetable-noodles.png',
  'Tofu Poke Bowl': '/images/menu/tofu-poke-bowl.png',
  'Vegetable Paella': '/images/menu/vegetable-paella.png',
  Waffles: '/images/menu/waffles.png',
};

function item(name, description, icon, dietaryTag) {
  return { name, description, icon, dietaryTag: dietaryTag || null, imageUrl: DISH_PHOTOS[name] || null };
}

const MENU_CATALOG = {
  First: {
    shortHaul: [
      {
        section: 'Dinner',
        items: [
          item('Arabic Dips', 'Houmous and baba ghanouj', 'dip'),
          item('Chicken Kebab', 'Served with saffron sauce, zereshk rice and tomatoes', 'chicken'),
          item('Kofta Sweet and Sour', 'Fried tapioca-soy dumplings in a tangy sauce, served with steamed rice, pak choi and lotus root', 'dumpling', 'vegetarian'),
          item('Maamoul with Chocolate', 'Date and chocolate cookie layered with ashta and kunafe fark, garnished with pistachios, served with crème anglaise', 'dessert'),
          item('Fine Luxury Chocolates', 'An assortment of fine luxury chocolates', 'chocolate'),
        ],
      },
      {
        section: 'Champagne & Wine',
        items: [
          item('Dom Pérignon 2008', 'Complex bouquet of apricot, citrus and aniseed; dry, pure and focused with a hint of toast on the finish', 'champagne'),
          item('Opalie de Château Coutet Blanc 2013', 'Bordeaux, France — pure aromas of mandarin and fresh pear; dry, crisp, medium-bodied', 'wine'),
          item('Château Lynch Bages 2005', 'Pauillac, France — intense nose of blackcurrant, cedar and graphite; medium-bodied with a long mineral-toned finish', 'wine'),
        ],
      },
    ],
    mediumHaul: [
      {
        section: 'Breakfast',
        items: [
          item('Scrambled Eggs', 'Served with chicken sausages, baked beans and crushed potatoes with chives', 'egg'),
          item('Batata wa Bayd Mfarakeh', 'Scrambled eggs with potatoes, served with lamb sausages and tomato', 'egg'),
          item('Kale and Spinach Frittata', 'Served with roasted potato wedges, spinach and portobello mushroom', 'egg'),
          item('Spiced Bean Curd and Peppers', 'Served with hash browns, sautéed spinach and plum tomato', 'tofu', 'vegetarian'),
        ],
      },
      {
        section: 'Champagne & Wine',
        items: [
          item('Dom Pérignon 2008', 'Complex bouquet of apricot, citrus and aniseed; dry, pure and focused with a hint of toast on the finish', 'champagne'),
          item('Opalie de Château Coutet Blanc 2013', 'Bordeaux, France — pure aromas of mandarin and fresh pear; dry, crisp, medium-bodied', 'wine'),
          item('Savaterre Chardonnay 2016', 'Victoria, Australia — intense hazelnut and nectarine aromas, creamy lemon and green apple palate', 'wine'),
          item('Château Lynch Bages 2005', 'Pauillac, France — intense nose of blackcurrant, cedar and graphite; medium-bodied with a long mineral-toned finish', 'wine'),
          item('Domaine Serene Evenstad Reserve Pinot Noir 2014', 'Oregon, USA — mulberries, blackberries and cedar; medium-bodied with silky tannins', 'wine'),
        ],
      },
    ],
    longHaul: [
      {
        section: 'Breakfast',
        items: [
          item('Scrambled Eggs', 'With chicken chipolatas, baked beans and crushed potatoes with chives', 'egg'),
          item('Kale and Spinach Frittata', 'Served with roasted potato wedges, spinach and portobello mushroom', 'egg'),
          item('Waffles', 'Served with berry compote', 'waffle'),
          item('Spiced Bean Curd and Peppers', 'Served with hash browns, sautéed spinach and plum tomato', 'tofu', 'vegetarian'),
        ],
      },
      {
        section: 'Appetisers',
        items: [
          item('Caviar', 'Presented with finely chopped chives, grated egg, sour cream and lemon, served with melba toast and blinis', 'caviar'),
          item('Cream of Mushroom Soup', 'Topped with chives', 'soup'),
          item('Arabic Dips', 'Houmous and baba ghanouj', 'dip'),
          item('Antipasti', 'Wagyu bresaola and roasted chicken with herbs, served with parmesan and marinated vegetables', 'antipasti'),
          item('Salad', 'Seasonal leaves served with dressing', 'salad'),
        ],
      },
      {
        section: 'Main Course',
        items: [
          item('Pan-fried Beef Tenderloin', 'Served with jus lié, steamed snow peas, carrots and new potatoes with herbs', 'beef'),
          item('Bzar Chicken', 'Chicken in a traditional Arabic spice marinade, served on aromatic rice with fried onions and pistachios', 'chicken'),
          item('Kofta Sweet and Sour', 'Fried tapioca-soy dumplings in a tangy sauce, served with steamed rice, pak choi and lotus root', 'dumpling', 'vegetarian'),
          item('Pan-seared Salmon Trout', 'Served with mashed sweet potatoes, sautéed kai-lan and beurre blanc with roasted macadamia nuts', 'fish'),
        ],
      },
      {
        section: 'Dessert',
        items: [
          item('Orange Frangipane Tart', 'Served with citrus compote', 'tart'),
          item('Chocolate Mango Tart', 'Layered chocolate and mango mousse topped with dark chocolate ganache, served with mango jellies', 'tart'),
          item('Seasonal Fruit', 'An assortment of fresh cut fruit', 'fruit'),
          item('Cheese Board', 'A carefully chosen assortment of fine boutique cheeses, served with crackers and accompaniments', 'cheese'),
          item('Fine Luxury Chocolates', 'An assortment of fine luxury chocolates', 'chocolate'),
        ],
      },
      {
        section: 'Light Bites',
        items: [
          item('Tofu Poke Bowl', 'Sriracha tofu with barley salad, sautéed oyster mushrooms, carrots, cherry tomatoes, avocado, sesame seeds and soy chilli dressing', 'tofu', 'vegetarian'),
          item('Stir-fried Vegetable Noodles', 'A light stir-fry of fresh vegetables and noodles', 'noodles', 'vegetarian'),
          item('Lamb and Rosemary Pie', 'A warming savoury pie with lamb and fresh rosemary', 'pie'),
        ],
      },
      {
        section: 'Champagne & Wine',
        items: [
          item('Dom Pérignon P2', 'An exceptional, extra-aged expression of Dom Pérignon', 'champagne'),
          item('Grosset Polish Hill Riesling 2017', 'Clare Valley, Australia — tight, focused lemon and lime over crushed rock notes', 'wine'),
          item('Howard Park Allingham Chardonnay 2017', 'Margaret River, Australia — ripe peach, baked apple and hazelnut', 'wine'),
          item('Château Smith Haut Lafitte Rouge 2006', 'Pessac-Léognan, France — intense blackcurrant and blackberry nose, firm fine tannins', 'wine'),
          item('Mount Mary Quintet 2013', 'Yarra Valley, Australia — violets, blackcurrant and spice with fine-grained tannins', 'wine'),
        ],
      },
    ],
  },

  Business: {
    shortHaul: [
      {
        section: 'Champagne & Wine',
        items: [
          item('Moët & Chandon Grand Vintage 2013', 'Launched exclusively with Emirates — aromas of nectarine, lemon peel and nougat; dry with a hint of grapefruit', 'champagne'),
          item('Château de Chamirey Mercurey Blanc 2017', 'Burgundy, France — barrel-fermented, honeyed lemon butter and toast aromas', 'wine'),
          item('La Grange Neuve de Figeac 2011', 'Saint-Émilion, France — blackcurrant, tobacco and toast, medium-bodied with firm tannins', 'wine'),
        ],
      },
    ],
    mediumHaul: [
      {
        section: 'Breakfast',
        items: [
          item('Batata wa Bayd Mfarakeh', 'Scrambled eggs with potatoes, served with lamb sausages and plum tomato', 'egg'),
          item('Kale and Spinach Frittata', 'Served with roasted potato wedges, spinach and portobello mushroom', 'egg'),
          item('Spiced Bean Curd and Peppers', 'Served with hash browns, sautéed spinach and plum tomato', 'tofu', 'vegetarian'),
        ],
      },
      {
        section: 'Champagne & Wine',
        items: [
          item('Moët & Chandon Grand Vintage 2013', 'Launched exclusively with Emirates — aromas of nectarine, lemon peel and nougat; dry with a hint of grapefruit', 'champagne'),
          item('Château de Chamirey Mercurey Blanc 2017', 'Burgundy, France — barrel-fermented, honeyed lemon butter and toast aromas', 'wine'),
          item('La Grange Neuve de Figeac 2011', 'Saint-Émilion, France — blackcurrant, tobacco and toast, medium-bodied with firm tannins', 'wine'),
        ],
      },
    ],
    longHaul: [
      {
        section: 'Breakfast',
        items: [
          item('Scrambled Eggs', 'Served with chicken chipolatas, baked beans and crushed potatoes with chives', 'egg'),
          item('Kale and Spinach Frittata', 'Served with roasted potato wedges, spinach and portobello mushroom', 'egg'),
          item('Spiced Bean Curd and Peppers', 'Served with hash browns, sautéed spinach and plum tomato', 'tofu', 'vegetarian'),
        ],
      },
      {
        section: 'Light Bites',
        items: [
          item('Tofu Poke Bowl', 'Sriracha tofu with barley salad, sautéed oyster mushrooms, carrots, cherry tomatoes, avocado, sesame seeds and soy chilli dressing', 'tofu', 'vegetarian'),
          item('Stir-fried Vegetable Noodles', 'A light stir-fry of fresh vegetables and noodles', 'noodles', 'vegetarian'),
          item('Lamb and Rosemary Pie', 'A warming savoury pie with lamb and fresh rosemary', 'pie'),
        ],
      },
      {
        section: 'Lunch',
        items: [
          item('Arabic Dips', 'Houmous and baba ghanouj', 'dip'),
          item('Antipasti', 'Wagyu bresaola and roasted chicken with herbs, served with parmesan and marinated vegetables', 'antipasti'),
          item('Pan-fried Beef Tenderloin', 'Served with jus lié, steamed snow peas, carrots and new potatoes with herbs', 'beef'),
          item('Bzar Chicken', 'Chicken in a traditional Arabic spice marinade, served on aromatic rice with fried onions and pistachios', 'chicken'),
          item('Kofta Sweet and Sour', 'Fried tapioca-soy dumplings in a tangy sauce, served with steamed rice, pak choi and lotus root', 'dumpling', 'vegetarian'),
          item('Chocolate Mango Tart', 'Layered chocolate and mango mousse topped with dark chocolate ganache, served with mango jellies', 'tart'),
          item('Seasonal Fruit', 'An assortment of fresh cut fruit', 'fruit'),
          item('Cheese Board', 'A carefully chosen assortment of fine boutique cheeses, served with crackers and accompaniments', 'cheese'),
        ],
      },
      {
        section: 'Champagne & Wine',
        items: [
          item('Moët & Chandon Grand Vintage 2013', 'Launched exclusively with Emirates — aromas of nectarine, lemon peel and nougat; dry with a hint of grapefruit', 'champagne'),
          item('Down to Earth Sauvignon Blanc 2017', 'Wrattonbully, Australia — intense lime, spice and stone fruit aromas, dry and textured', 'wine'),
          item('Château Trimoulet 2012', 'Saint-Émilion, France — ripe black cherry with black raspberry and cedar notes', 'wine'),
        ],
      },
    ],
  },

  Economy: {
    shortHaul: [
      {
        section: 'Light Bites',
        items: [
          item('Mozzarella and Sundried Tomato Sandwich', 'Served on rye and turmeric bread', 'sandwich'),
        ],
      },
    ],
    mediumHaul: [
      {
        section: 'Breakfast',
        items: [
          item('Fresh Seasonal Fruit', 'An assortment of fresh seasonal fruit', 'fruit'),
          item('Fruit Yoghurt', 'Creamy yoghurt with fruit', 'yoghurt'),
          item('Scrambled Eggs with Turkey Rashers', 'Served with fried potatoes and tomato zaatar fatayer', 'egg'),
          item('Vegetable Crêpes', 'Served with sautéed mushrooms with tomato concassé, hash brown and vegan spinach spring roll', 'crepe', 'vegetarian'),
          item('Pav', 'Soft bread roll, served with a selection of juices, tea and coffee', 'bread'),
        ],
      },
    ],
    longHaul: [
      {
        section: 'Breakfast',
        items: [
          item('Fresh Seasonal Fruit', 'An assortment of fresh seasonal fruit', 'fruit'),
          item('Fruit Yoghurt', 'Creamy yoghurt with fruit', 'yoghurt'),
          item('Cheese Omelette', 'Served with grilled chicken sausage, potato hash and sautéed mushrooms with tomato concassé', 'egg'),
          item('Vegetable Crêpes', 'Served with sautéed mushrooms with tomato concassé, hash browns and vegan spinach spring roll', 'crepe', 'vegetarian'),
          item('Pav', 'Soft bread roll, served with a selection of juices, tea and coffee', 'bread'),
        ],
      },
      {
        section: 'Light Bites',
        items: [
          item('Emirates Pizza', 'Vegetarian pizza topped with tomatoes, melted cheese and oregano', 'pizza', 'vegetarian'),
        ],
      },
      {
        section: 'Lunch',
        items: [
          item('Barley Salad', 'Dressed with vinaigrette', 'salad'),
          item('Grilled Chicken', 'Served with bean and corn salsa, sweet potato mash and broccoli', 'chicken'),
          item('Vegetable Paella', 'Topped with peppers and served with braised lentils', 'rice', 'vegetarian'),
          item('Apple Caramel Mousse', 'With vanilla cream and biscuit crumble', 'dessert'),
        ],
      },
    ],
  },
};

module.exports = { MENU_CATALOG };
