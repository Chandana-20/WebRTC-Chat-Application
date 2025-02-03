const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));  // Serve static files from 'public' folder

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    const room = 'default-room';
    socket.join(room);
    console.log(`User ${socket.id} joined room: ${room}`);

    const roomUsers = io.sockets.adapter.rooms.get(room) || new Set();
    if (roomUsers.size === 1) {
        socket.emit('role', 'initiator');
    } else if (roomUsers.size === 2) {
        socket.emit('role', 'receiver');
    }

    // Debugging: Log when signals are relayed
    socket.on('signal', (data) => {
        console.log(`Relaying signal from ${socket.id}:`, data);
        socket.to(room).emit('signal', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Signaling server running on http://localhost:${PORT}`);
});
