const socket = io(); // Connect to the signaling server
const chat = document.getElementById('chat');
const messageInput = document.getElementById('messageInput');

// Configuration for WebRTC
const configuration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const peerConnection = new RTCPeerConnection(configuration);
let dataChannel;

// Generate a unique room ID or use a default room
const roomId = new URLSearchParams(window.location.search).get('room') || 'default-room';
socket.emit('join', roomId); // Join the room

// Create a data channel
function createDataChannel() {
    dataChannel = peerConnection.createDataChannel('chat');

    dataChannel.onopen = () => {
        console.log('Data channel is open!');
    };

    dataChannel.onmessage = (event) => {
        appendMessage(`Peer: ${event.data}`);
    };

    dataChannel.onclose = () => {
        console.log('Data channel is closed.');
    };

    dataChannel.onerror = (error) => {
        console.error('Data channel error:', error);
    };
}

// Handle incoming data channel
peerConnection.ondatachannel = (event) => {
    const channel = event.channel;

    channel.onopen = () => {
        console.log('Data channel is open!');
    };

    channel.onmessage = (event) => {
        appendMessage(`Peer: ${event.data}`);
    };

    channel.onclose = () => {
        console.log('Data channel is closed.');
    };

    channel.onerror = (error) => {
        console.error('Data channel error:', error);
    };
};

// Handle signaling data from the server
socket.on('signal', (data) => {
    console.log('Signal received:', data);

    if (data.type === 'offer') {
        handleOffer(data.offer);
    } else if (data.type === 'answer') {
        handleAnswer(data.answer);
    } else if (data.type === 'candidate') {
        handleCandidate(data.candidate);
    }
});

// Handle incoming offer
async function handleOffer(offer) {
    console.log('Received offer:', offer);

    if (peerConnection.signalingState !== 'stable') {
        console.error('Cannot set remote offer: Connection not in stable state');
        return;
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('signal', { roomId, signalData: { type: 'answer', answer } });
}

// Handle incoming answer
async function handleAnswer(answer) {
    console.log('Received answer:', answer);

    if (peerConnection.signalingState !== 'have-local-offer') {
        console.error('Cannot set remote answer: Connection not in "have-local-offer" state');
        return;
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

// Handle incoming ICE candidate
async function handleCandidate(candidate) {
    console.log('Received ICE candidate:', candidate);
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

// Start the call
async function startCall() {
    createDataChannel();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('signal', { roomId, signalData: { type: 'offer', offer } });
}

// Automatically start the call when the page loads
startCall();

// Listen for ICE candidates and send them to the server
peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
        socket.emit('signal', { roomId, signalData: { type: 'candidate', candidate: event.candidate } });
    }
};

// Send a message when Enter is pressed
messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        const message = messageInput.value;
        if (message) {
            if (dataChannel && dataChannel.readyState === 'open') {
                dataChannel.send(message);
                appendMessage(`You: ${message}`);
                messageInput.value = '';
            } else {
                console.error('Data channel is not open.');
            }
        }
    }
});

// Append a message to the chat window
function appendMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    chat.appendChild(messageElement);
    chat.scrollTop = chat.scrollHeight;
}

// Debugging connection states
peerConnection.onsignalingstatechange = () => {
    console.log(`Signaling state: ${peerConnection.signalingState}`);
};

peerConnection.oniceconnectionstatechange = () => {
    console.log(`ICE connection state: ${peerConnection.iceConnectionState}`);
};
