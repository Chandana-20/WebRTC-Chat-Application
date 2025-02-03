const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Keep track of rooms and their peers
const rooms = new Map();

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (roomId) => {
        socket.join(roomId);
        
        // Initialize room if it doesn't exist
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
        }
        
        const room = rooms.get(roomId);
        room.add(socket.id);

        // Assign roles based on join order
        const role = room.size === 1 ? 'initiator' : 'receiver';
        socket.emit('role', role);
        
        console.log(`User ${socket.id} joined room ${roomId} as ${role} (${room.size} peers)`);
    });

    socket.on('signal', (data) => {
        const { roomId, signalData } = data;
        console.log(`Relaying ${signalData.type} from ${socket.id} in room ${roomId}`);
        socket.to(roomId).emit('signal', signalData);
    });

    socket.on('disconnect', () => {
        // Clean up rooms
        for (const [roomId, peers] of rooms.entries()) {
            if (peers.has(socket.id)) {
                peers.delete(socket.id);
                if (peers.size === 0) {
                    rooms.delete(roomId);
                }
                // Notify remaining peers about disconnection
                io.to(roomId).emit('peerDisconnected', socket.id);
            }
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Signaling server running on port ${PORT}`);
});