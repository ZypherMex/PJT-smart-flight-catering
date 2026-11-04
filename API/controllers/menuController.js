const { getMenu } = require('../models/menuModel');

const VALID_CLASS_TYPES = ['First', 'Business', 'Economy'];
const VALID_HAUL_LENGTHS = ['shortHaul', 'mediumHaul', 'longHaul'];

function getMenuHandler(req, res) {
  const { classType, haulLength } = req.params;

  if (!VALID_CLASS_TYPES.includes(classType)) {
    return res.status(400).json({ error: `Unknown classType: ${classType}` });
  }
  if (!VALID_HAUL_LENGTHS.includes(haulLength)) {
    return res.status(400).json({ error: `Unknown haulLength: ${haulLength}` });
  }

  res.json({ classType, haulLength, sections: getMenu(classType, haulLength) });
}

module.exports = { getMenuHandler, VALID_CLASS_TYPES, VALID_HAUL_LENGTHS };
