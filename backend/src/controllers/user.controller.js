const db = require('../models');
const User = db.User;

exports.setSpendingLimit = async (req, res) => {
  try {
    const { limit } = req.body;
    const userId = req.userId; // Lấy từ authJwt middleware

    if (limit === null || isNaN(parseFloat(limit)) || limit < 0) {
      return res.status(400).send({ message: 'Hạn mức không hợp lệ.' });
    }

    const [num] = await User.update(
      { monthlyLimit: parseFloat(limit) },
      { where: { id: userId } }
    );

    if (num == 1) {
      res.status(200).send({
        message: 'Cập nhật hạn mức thành công.',
        newLimit: parseFloat(limit)
      });
    } else {
      res.status(404).send({ message: 'Không tìm thấy người dùng.' });
    }
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};