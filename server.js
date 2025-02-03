const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

// Serve static files
app.use(express.static('public'));

// Track rooms and peers
const rooms = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (roomId) => {
        console.log(`Socket ${socket.id} joining room ${roomId}`);
        
        // Leave any existing rooms
        socket.rooms.forEach(room => {
            if (room !== socket.id) {
                socket.leave(room);
            }
        });
        
        socket.join(roomId);
        
        // Initialize room if it doesn't exist
        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                initiator: null,
                peers: new Set()
            });
        }
        
        const room = rooms.get(roomId);
        
        // Assign roles
        let role = 'receiver';
        if (!room.initiator) {
            role = 'initiator';
            room.initiator = socket.id;
        }
        
        room.peers.add(socket.id);
        
        console.log(`Assigning role ${role} to socket ${socket.id} in room ${roomId}`);
        socket.emit('role', role);
        
        // Log room state
        console.log(`Room ${roomId} state:`, {
            initiator: room.initiator,
            peerCount: room.peers.size
        });
    });

    socket.on('signal', (data) => {
        console.log(`Signal ${data.signalData.type} from ${socket.id} in room ${data.roomId}`);
        socket.to(data.roomId).emit('signal', data.signalData);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Clean up rooms
        for (const [roomId, room] of rooms.entries()) {
            if (room.peers.has(socket.id)) {
                room.peers.delete(socket.id);
                
                // If initiator disconnected, assign new initiator
                if (room.initiator === socket.id && room.peers.size > 0) {
                    room.initiator = Array.from(room.peers)[0];
                    io.to(room.initiator).emit('role', 'initiator');
                }
                
                // Remove empty rooms
                if (room.peers.size === 0) {
                    rooms.delete(roomId);
                }
                
                // Notify remaining peers
                io.to(roomId).emit('peerCount', room.peers.size);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Error handling
server.on('error', (error) => {
    console.error('Server error:', error);
});

io.on('connect_error', (error) => {
    console.error('Socket.IO error:', error);
});