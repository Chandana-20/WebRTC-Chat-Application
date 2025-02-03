const socket = io();
const chat = document.getElementById('chat');
const messageInput = document.getElementById('messageInput');

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

const peerConnection = new RTCPeerConnection(configuration);
let dataChannel = null;
let isInitiator = false;

// Generate a unique room ID or use a default room
const roomId = new URLSearchParams(window.location.search).get('room') || 'default-room';

// Join room and handle role assignment
socket.emit('join', roomId);
socket.on('role', (role) => {
    isInitiator = role === 'initiator';
    if (isInitiator) {
        createDataChannel();
        startCall();
    }
});

function createDataChannel() {
    try {
        dataChannel = peerConnection.createDataChannel('chat', {
            ordered: true,
            maxRetransmits: 3
        });
        setupDataChannelHandlers(dataChannel);
    } catch (error) {
        console.error('Error creating data channel:', error);
        appendMessage('System: Error creating data channel');
    }
}

function setupDataChannelHandlers(channel) {
    channel.onopen = () => {
        console.log('Data channel is open!');
        messageInput.disabled = false;
        appendMessage('System: Connected to peer');
    };

    channel.onmessage = (event) => {
        appendMessage(`Peer: ${event.data}`);
    };

    channel.onclose = () => {
        console.log('Data channel is closed');
        messageInput.disabled = true;
        appendMessage('System: Connection closed');
    };

    channel.onerror = (error) => {
        console.error('Data channel error:', error);
        appendMessage('System: Connection error occurred');
    };
}

peerConnection.ondatachannel = (event) => {
    console.log('Received data channel');
    dataChannel = event.channel;
    setupDataChannelHandlers(dataChannel);
};

socket.on('signal', async (data) => {
    try {
        if (data.type === 'offer') {
            await handleOffer(data.offer);
        } else if (data.type === 'answer') {
            await handleAnswer(data.answer);
        } else if (data.type === 'candidate') {
            await handleCandidate(data.candidate);
        }
    } catch (error) {
        console.error('Error handling signal:', error);
    }
});

async function handleOffer(offer) {
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { roomId, signalData: { type: 'answer', answer } });
    } catch (error) {
        console.error('Error handling offer:', error);
    }
}

async function handleAnswer(answer) {
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
        console.error('Error handling answer:', error);
    }
}

async function handleCandidate(candidate) {
    try {
        if (candidate) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    } catch (error) {
        console.error('Error handling ICE candidate:', error);
    }
}

async function startCall() {
    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('signal', { roomId, signalData: { type: 'offer', offer } });
    } catch (error) {
        console.error('Error starting call:', error);
    }
}

peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
        socket.emit('signal', { roomId, signalData: { type: 'candidate', candidate: event.candidate } });
    }
};

// Disable input initially
messageInput.disabled = true;

messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        const message = messageInput.value.trim();
        if (message && dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(message);
            appendMessage(`You: ${message}`);
            messageInput.value = '';
        } else if (!dataChannel || dataChannel.readyState !== 'open') {
            appendMessage('System: Connection not established yet. Please wait...');
        }
    }
});

function appendMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    chat.appendChild(messageElement);
    chat.scrollTop = chat.scrollHeight;
}

// Connection state logging
peerConnection.onconnectionstatechange = () => {
    console.log(`Connection state: ${peerConnection.connectionState}`);
    appendMessage(`System: Connection state - ${peerConnection.connectionState}`);
};

peerConnection.oniceconnectionstatechange = () => {
    console.log(`ICE connection state: ${peerConnection.iceConnectionState}`);
};