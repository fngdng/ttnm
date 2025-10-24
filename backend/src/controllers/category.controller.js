const db = require('../models');
const Category = db.Category;

exports.create = async (req, res) => {
  try {
    const { name, type, icon } = req.body;
    if (!name || !type) {
      return res.status(400).send({ message: 'Name and type are required.' });
    }
    const category = await Category.create({ name, type, icon: icon || null, userId: req.userId });
    res.status(201).send(category);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.findAll = async (req, res) => {
  try {
    const { type } = req.query;
    const whereCondition = { userId: req.userId };
    if (type) whereCondition.type = type;

    const categories = await Category.findAll({
      where: whereCondition,
      order: [['name', 'ASC']]
    });
    res.status(200).send(categories);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const id = req.params.id;
    const [num] = await Category.update(req.body, { where: { id: id, userId: req.userId } });
    if (num == 1) res.send({ message: 'Category was updated successfully.' });
    else res.status(404).send({ message: `Cannot update Category with id=${id}.` });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const id = req.params.id;
    const num = await Category.destroy({ where: { id: id, userId: req.userId } });
    if (num == 1) res.send({ message: 'Category was deleted successfully!' });
    else res.status(404).send({ message: `Cannot delete Category with id=${id}.` });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};