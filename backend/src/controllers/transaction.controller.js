const db = require('../models');
const Transaction = db.Transaction;
const { Op } = require('sequelize');

exports.create = async (req, res) => {
  try {
    const { description, amount, date, type, categoryId } = req.body;
    if (!amount || !date || !type) {
      return res.status(400).send({ message: 'Amount, date, and type are required.' });
    }

    const transaction = await Transaction.create({
      description,
      amount: parseFloat(amount),
      date,
      type,
      categoryId: categoryId || null,
      userId: req.userId
    });
    
    
    req.io.emit('transaction_updated', {
      message: 'Một giao dịch mới đã được thêm!',
      userId: req.userId // Gửi kèm userId để client tự lọc
    });

    res.status(201).send(transaction);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.findAll = async (req, res) => {
  try {
    const { type, categoryId, startDate, endDate } = req.query;
    const whereCondition = { userId: req.userId };

    if (type) whereCondition.type = type;
    if (categoryId) whereCondition.categoryId = categoryId;
    if (startDate && endDate) {
      whereCondition.date = { [Op.between]: [startDate, endDate] };
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const { count, rows } = await Transaction.findAndCountAll({
      where: whereCondition,
      include: [db.Category],
      order: [['date', 'DESC']],
      limit,
      offset
    });

    res.status(200).send({
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      transactions: rows
    });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    const id = req.params.id;
    const transaction = await Transaction.findOne({
      where: { id: id, userId: req.userId },
      include: [db.Category]
    });
    if (!transaction) return res.status(404).send({ message: 'Transaction not found.' });
    res.status(200).send(transaction);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const id = req.params.id;
    const [num] = await Transaction.update(req.body, {
      where: { id: id, userId: req.userId }
    });

    if (num == 1) {
      req.io.emit('transaction_updated', { message: `Giao dịch ${id} đã cập nhật!`, userId: req.userId });
      res.send({ message: 'Transaction was updated successfully.' });
    } else {
      res.status(404).send({ message: `Cannot update Transaction with id=${id}.` });
    }
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const id = req.params.id;
    const num = await Transaction.destroy({
      where: { id: id, userId: req.userId }
    });

    if (num == 1) {
      req.io.emit('transaction_updated', { message: `Giao dịch ${id} đã bị xóa!`, userId: req.userId });
      res.send({ message: 'Transaction was deleted successfully!' });
    } else {
      res.status(404).send({ message: `Cannot delete Transaction with id=${id}.` });
    }
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};