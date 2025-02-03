// First add this debug version of main.js
const socket = io({
    reconnection: true,
    reconnectionAttempts: 5,
    timeout: 10000,
    transports: ['websocket', 'polling']
});

// Debug element for visible logging
const debugLog = document.createElement('div');
debugLog.style.position = 'fixed';
debugLog.style.top = '10px';
debugLog.style.right = '10px';
debugLog.style.background = 'rgba(0,0,0,0.8)';
debugLog.style.color = 'white';
debugLog.style.padding = '10px';
debugLog.style.borderRadius = '5px';
debugLog.style.maxHeight = '200px';
debugLog.style.overflow = 'auto';
document.body.appendChild(debugLog);

function log(message) {
    console.log(message);
    const logEntry = document.createElement('div');
    logEntry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    debugLog.appendChild(logEntry);
    while (debugLog.children.length > 10) {
        debugLog.removeChild(debugLog.firstChild);
    }
}

// Test socket connection
socket.on('connect', () => {
    log('Socket connected! ID: ' + socket.id);
});

socket.on('connect_error', (error) => {
    log('Socket connection error: ' + error);
});

socket.on('disconnect', (reason) => {
    log('Socket disconnected: ' + reason);
});

const chat = document.getElementById('chat');
const messageInput = document.getElementById('messageInput');

// Log when elements are found/not found
if (chat) {
    log('Chat element found');
} else {
    log('Chat element NOT found');
}

if (messageInput) {
    log('MessageInput element found');
} else {
    log('MessageInput element NOT found');
}

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

let peerConnection;
try {
    peerConnection = new RTCPeerConnection(configuration);
    log('RTCPeerConnection created successfully');
} catch (error) {
    log('Error creating RTCPeerConnection: ' + error);
}

let dataChannel = null;
const roomId = new URLSearchParams(window.location.search).get('room') || 'default-room';
log('Room ID: ' + roomId);

// Join room
socket.emit('join', roomId);
log('Joining room: ' + roomId);

socket.on('role', (role) => {
    log('Received role: ' + role);
    if (role === 'initiator') {
        createDataChannel();
        startCall();
    }
});

function createDataChannel() {
    try {
        dataChannel = peerConnection.createDataChannel('chat');
        log('Data channel created');
        setupDataChannelHandlers(dataChannel);
    } catch (error) {
        log('Error creating data channel: ' + error);
    }
}

function setupDataChannelHandlers(channel) {
    channel.onopen = () => {
        log('Data channel opened');
        messageInput.disabled = false;
        messageInput.placeholder = 'Type a message...';
    };

    channel.onclose = () => {
        log('Data channel closed');
        messageInput.disabled = true;
        messageInput.placeholder = 'Connection closed...';
    };

    channel.onmessage = (event) => {
        log('Message received: ' + event.data);
        appendMessage(`Peer: ${event.data}`);
    };
}

peerConnection.ondatachannel = (event) => {
    log('Received data channel');
    dataChannel = event.channel;
    setupDataChannelHandlers(dataChannel);
};

socket.on('signal', async (data) => {
    log('Signal received: ' + data.type);
    try {
        if (data.type === 'offer') {
            await handleOffer(data.offer);
        } else if (data.type === 'answer') {
            await handleAnswer(data.answer);
        } else if (data.type === 'candidate') {
            await handleCandidate(data.candidate);
        }
    } catch (error) {
        log('Error handling signal: ' + error);
    }
});

async function handleOffer(offer) {
    log('Handling offer');
    try {
        await peerConnection.setRemoteDescription(offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { roomId, signalData: { type: 'answer', answer } });
    } catch (error) {
        log('Error handling offer: ' + error);
    }
}

async function handleAnswer(answer) {
    log('Handling answer');
    try {
        await peerConnection.setRemoteDescription(answer);
    } catch (error) {
        log('Error handling answer: ' + error);
    }
}

async function handleCandidate(candidate) {
    log('Handling ICE candidate');
    try {
        await peerConnection.addIceCandidate(candidate);
    } catch (error) {
        log('Error handling candidate: ' + error);
    }
}

async function startCall() {
    log('Starting call');
    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('signal', { roomId, signalData: { type: 'offer', offer } });
    } catch (error) {
        log('Error starting call: ' + error);
    }
}

peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
        log('Sending ICE candidate');
        socket.emit('signal', { roomId, signalData: { type: 'candidate', candidate: event.candidate } });
    }
};

peerConnection.oniceconnectionstatechange = () => {
    log('ICE connection state: ' + peerConnection.iceConnectionState);
};

messageInput.disabled = true;
messageInput.placeholder = 'Connecting...';

messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        const message = messageInput.value.trim();
        if (message && dataChannel?.readyState === 'open') {
            dataChannel.send(message);
            appendMessage(`You: ${message}`);
            messageInput.value = '';
            log('Message sent: ' + message);
        } else {
            log('Cannot send message. Channel state: ' + dataChannel?.readyState);
        }
    }
});

function appendMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    chat.appendChild(messageElement);
    chat.scrollTop = chat.scrollHeight;
}