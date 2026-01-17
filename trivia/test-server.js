// Simple test server to verify Socket.io works
const { createServer } = require('http');
const { Server } = require('socket.io');

const httpServer = createServer();
const io = new Server(httpServer, {
  path: '/api/socket',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);
  
  socket.on('lobby:create', (nickname) => {
    console.log('📝 Received lobby:create:', nickname);
    socket.emit('lobby:joined', { id: '123', hostId: '456', playerCount: 1, maxPlayers: 8, status: 'waiting' }, []);
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

httpServer.listen(3003, () => {
  console.log('🚀 Test server listening on http://localhost:3003');
  console.log('📡 Socket.io path: /api/socket');
});
