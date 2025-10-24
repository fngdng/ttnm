const db = require('../models');
const Transaction = db.Transaction;
const Budget = db.Budget;
const User = db.User;
const { Op, Sequelize } = require('sequelize');
const exceljs = require('exceljs');

exports.getSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query; // (e.g., 2025-10-01 to 2025-10-31)
    const whereCondition = { userId: req.userId };
    
    if (!startDate || !endDate) {
       return res.status(400).send({ message: "Vui lòng cung cấp startDate và endDate." });
    }
    
    whereCondition.date = { [Op.between]: [startDate, endDate] };

    
    const user = await User.findByPk(req.userId);
    const monthlyLimit = user ? user.monthlyLimit : 0;

    
    const totalIncome = await Transaction.sum('amount', {
      where: { ...whereCondition, type: 'income' }
    });
    const totalExpense = await Transaction.sum('amount', {
      where: { ...whereCondition, type: 'expense' }
    });
    
    
    const startOfCurrentMonth = new Date(startDate);
    const startOfLastMonth = new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth() - 1, 1);
    const endOfLastMonth = new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth(), 0);

    const lastMonthExpense = await Transaction.sum('amount', {
      where: {
        userId: req.userId,
        type: 'expense',
        date: {
          [Op.between]: [
            startOfLastMonth.toISOString().split('T')[0],
            endOfLastMonth.toISOString().split('T')[0]
          ]
        }
      }
    });

    
    res.status(200).send({
      totalIncome: totalIncome || 0,
      totalExpense: totalExpense || 0,
      netBalance: (totalIncome || 0) - (totalExpense || 0),
      monthlyLimit: parseFloat(monthlyLimit || 0), // (Thông báo vượt mức)
      lastMonthExpense: lastMonthExpense || 0 // (Thông báo so với tháng trước)
    });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.getReportByCategory = async (req, res) => {
   try {
    const { type = 'expense', startDate, endDate } = req.query;
    const whereCondition = { userId: req.userId, type: type };

    if (startDate && endDate) {
      whereCondition.date = { [Op.between]: [startDate, endDate] };
    }
    
    const report = await Transaction.findAll({
      attributes: ['categoryId', [Sequelize.fn('SUM', Sequelize.col('amount')), 'totalAmount']],
      where: whereCondition,
      group: ['categoryId'],
      include: [{ model: db.Category, attributes: ['name', 'icon'] }]
    });

    res.status(200).send(report);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.getBudgetProgress = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const whereCondition = { userId: req.userId };

    if (startDate && endDate) {
      whereCondition.date = { [Op.between]: [startDate, endDate] };
    } else {
      const startOfMonth = new Date(); startOfMonth.setDate(1);
      const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);
      whereCondition.date = { [Op.between]: [
        startOfMonth.toISOString().split('T')[0], 
        endOfMonth.toISOString().split('T')[0]
      ]};
    }

  const expenses = await Transaction.findAll({
      attributes: ['categoryId', [Sequelize.fn('SUM', Sequelize.col('amount')), 'totalSpent']],
      where: { userId: req.userId, type: 'expense', date: whereCondition.date },
      group: ['categoryId'],
      include: [{ model: db.Category, attributes: ['name', 'icon'] }],
      raw: true, nest: true
    });

  const budgets = await Budget.findAll({
      where: {
        userId: req.userId,
        startDate: { [Op.gte]: whereCondition.date[Op.between][0] },
        endDate: { [Op.lte]: whereCondition.date[Op.between][1] }
      },
      include: [db.Category],
      raw: true, nest: true
    });

    
    const progressMap = new Map();
    budgets.forEach(budget => {
      progressMap.set(budget.categoryId, {
        categoryId: budget.categoryId,
        categoryName: budget.Category.name,
        icon: budget.Category.icon,
        budgetAmount: parseFloat(budget.amount),
        totalSpent: 0,
      });
    });

    expenses.forEach(expense => {
      const categoryId = expense.categoryId;
      const spent = parseFloat(expense.totalSpent);
      if (progressMap.has(categoryId)) {
        progressMap.get(categoryId).totalSpent = spent;
      } else {
        progressMap.set(categoryId, {
          categoryId: categoryId,
          categoryName: expense.Category.name,
          icon: expense.Category.icon,
          budgetAmount: 0,
          totalSpent: spent,
        });
      }
    });

    const finalReport = Array.from(progressMap.values());
    const reportWithCalculations = finalReport.map(item => {
      const remaining = item.budgetAmount - item.totalSpent;
      const progress = (item.budgetAmount > 0) ? (item.totalSpent / item.budgetAmount) : null;
      return { ...item, remaining, progress };
    });

    res.status(200).send(reportWithCalculations);

  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};
exports.exportExcel = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const whereCondition = { userId: req.userId };

    if (startDate && endDate) {
      whereCondition.date = { [Op.between]: [startDate, endDate] };
    } else {
      return res.status(400).send({ message: "Vui lòng cung cấp startDate và endDate." });
    }

    const transactions = await Transaction.findAll({
      where: whereCondition,
      include: [{ model: db.Category, attributes: ['name'] }],
      order: [['date', 'ASC']],
      raw: true, // Lấy data thô
      nest: true // Gộp object Category
    });

  const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet('ChiTieu');
    
    worksheet.columns = [
      { header: 'Ngày', key: 'date', width: 15 },
      { header: 'Mô tả', key: 'description', width: 30 },
      { header: 'Danh mục', key: 'category', width: 20 },
      { header: 'Loại', key: 'type', width: 10 },
      { header: 'Số tiền', key: 'amount', width: 15, style: { numFmt: '#,##0' } }
    ];

  transactions.forEach(tx => {
      worksheet.addRow({
        date: tx.date,
        description: tx.description,
        category: tx.Category ? tx.Category.name : 'Không có',
        type: tx.type === 'expense' ? 'Chi tiêu' : 'Thu nhập',
        amount: parseFloat(tx.amount)
      });
    });

    
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ChiTieu_${startDate}_den_${endDate}.xlsx"`
    );

  await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};