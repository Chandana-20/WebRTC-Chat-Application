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
    console.log('Role assigned:', role);
    
    if (isInitiator) {
        console.log('Creating data channel as initiator');
        createDataChannel();
        startCall();
    }
});

function createDataChannel() {
    try {
        dataChannel = peerConnection.createDataChannel('chat', {
            ordered: true
        });
        console.log('Data channel created:', dataChannel.label);
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
        console.log('Message received:', event.data);
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

// Handle incoming data channel for non-initiator
peerConnection.ondatachannel = (event) => {
    console.log('Received data channel:', event.channel.label);
    dataChannel = event.channel;
    setupDataChannelHandlers(dataChannel);
};

socket.on('signal', async (data) => {
    try {
        console.log('Signal received:', data.type);
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
        console.log('Handling offer');
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
        console.log('Handling answer');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
        console.error('Error handling answer:', error);
    }
}

async function handleCandidate(candidate) {
    try {
        if (candidate) {
            console.log('Adding ICE candidate');
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    } catch (error) {
        console.error('Error handling ICE candidate:', error);
    }
}

async function startCall() {
    try {
        console.log('Starting call');
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('signal', { roomId, signalData: { type: 'offer', offer } });
    } catch (error) {
        console.error('Error starting call:', error);
    }
}

peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
        console.log('Sending ICE candidate');
        socket.emit('signal', { roomId, signalData: { type: 'candidate', candidate: event.candidate } });
    }
};

// Initialize message input as disabled
messageInput.disabled = true;

// Handle message sending
messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        const message = messageInput.value.trim();
        if (message && dataChannel) {
            console.log('Data channel state:', dataChannel.readyState);
            if (dataChannel.readyState === 'open') {
                dataChannel.send(message);
                appendMessage(`You: ${message}`);
                messageInput.value = '';
            } else {
                appendMessage('System: Connection not ready. Please wait...');
                console.log('Data channel not open. State:', dataChannel.readyState);
            }
        }
    }
});

// Add click event listener for mobile devices
messageInput.addEventListener('click', () => {
    if (messageInput.disabled) {
        appendMessage('System: Still establishing connection...');
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
    const state = peerConnection.connectionState;
    console.log(`Connection state changed to: ${state}`);
    appendMessage(`System: Connection state - ${state}`);
};

peerConnection.oniceconnectionstatechange = () => {
    const state = peerConnection.iceConnectionState;
    console.log(`ICE connection state changed to: ${state}`);
};