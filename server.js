const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files (HTML, JS, CSS)
app.use(express.static('public'));

// Socket.io connection handler
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Automatically join a common room (e.g., "default-room")
    const room = 'default-room';
    socket.join(room);
    console.log(`User ${socket.id} joined room: ${room}`);

    // Assign roles based on the number of users in the room
    const roomUsers = io.sockets.adapter.rooms.get(room) || new Set();
    if (roomUsers.size === 1) {
        socket.emit('role', 'initiator'); // First user becomes the initiator
    } else if (roomUsers.size === 2) {
        socket.emit('role', 'receiver'); // Second user becomes the receiver
    }

    // Relay signaling data within the room
    socket.on('signal', (data) => {
        socket.to(room).emit('signal', data);
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Signaling server running on http://localhost:${PORT}`);
});
