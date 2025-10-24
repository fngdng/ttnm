const db = require('../models');
const Budget = db.Budget;
const { Op } = require('sequelize');

exports.setBudget = async (req, res) => {
  try {
    const { amount, startDate, endDate, categoryId } = req.body;
    if (!amount || !startDate || !endDate || !categoryId) {
      return res.status(400).send({ message: 'All fields are required.' });
    }

    const [budget, created] = await Budget.findOrCreate({
      where: { userId: req.userId, categoryId: categoryId, startDate: startDate, endDate: endDate },
      defaults: { amount: parseFloat(amount) }
    });

    if (!created) {
      budget.amount = parseFloat(amount);
      await budget.save();
      return res.status(200).send(budget);
    }
    res.status(201).send(budget);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.findAll = async (req, res) => {
  try {
    const { month, year } = req.query;
    const whereCondition = { userId: req.userId };

    if (month && year) {
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).toISOString().split('T')[0];
      whereCondition.startDate = { [Op.gte]: firstDay };
      whereCondition.endDate = { [Op.lte]: lastDay };
    }

    const budgets = await Budget.findAll({
      where: whereCondition,
      include: [db.Category],
      order: [['endDate', 'DESC']]
    });
    res.status(200).send(budgets);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const id = req.params.id;
    const num = await Budget.destroy({ where: { id: id, userId: req.userId } });
    if (num == 1) res.send({ message: 'Budget was deleted successfully!' });
    else res.status(404).send({ message: `Cannot delete Budget with id=${id}.` });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};