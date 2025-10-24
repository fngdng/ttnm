const app = require('./app');
const db = require('./models');
const http = require('http');
const { Server } = require('socket.io');

require('dotenv').config();

const PORT = process.env.PORT || 8080;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

io.on('connection', (socket) => {
  console.log(`Một client đã kết nối: ${socket.id}`);
  socket.on('join_room', (userId) => {
    socket.join(userId);
    console.log(`Socket ${socket.id} đã tham gia phòng của user ${userId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client đã ngắt kết nối: ${socket.id}`);
  });
});

db.sequelize.sync({ force: false }).then(() => {
  console.log('Database synced successfully.');
}).catch((err) => {
  console.error('Failed to sync db: ' + err.message);
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});