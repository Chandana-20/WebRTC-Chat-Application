const socket = io(); // Connect to the signaling server

const chat = document.getElementById('chat');
const messageInput = document.getElementById('messageInput');

// Configuration for WebRTC (STUN server)
const configuration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Create a new RTCPeerConnection
const peerConnection = new RTCPeerConnection(configuration);
let dataChannel;

// Create a data channel for sending messages
function createDataChannel() {
    dataChannel = peerConnection.createDataChannel('chat');

    dataChannel.onopen = () => {
        console.log('Data channel is open and ready for use!');
    };

    dataChannel.onclose = () => {
        console.log('Data channel is closed.');
    };

    dataChannel.onmessage = (event) => {
        appendMessage(`Peer: ${event.data}`);
    };
}

// Handle incoming data channel messages
peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;

    dataChannel.onopen = () => {
        console.log('Data channel is open and ready for use!');
    };

    dataChannel.onmessage = (event) => {
        appendMessage(`Peer: ${event.data}`);
    };
};

// Handle signaling data from the server
socket.on('signal', (data) => {
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
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('signal', { type: 'answer', answer: answer });
}

// Handle incoming answer
async function handleAnswer(answer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

// Handle incoming ICE candidate
async function handleCandidate(candidate) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

// Start the call by creating an offer
async function startCall() {
    createDataChannel(); // Ensure the data channel is created before the offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('signal', { type: 'offer', offer: offer });
}

// Automatically start the call when the page loads
startCall();

// Listen for ICE candidates and send them to the other peer
peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
        socket.emit('signal', { type: 'candidate', candidate: event.candidate });
    }
};

// Send a message when Enter is pressed
messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        const message = messageInput.value;
        if (message) {
            if (dataChannel && dataChannel.readyState === 'open') {
                dataChannel.send(message); // Send message via WebRTC data channel
                appendMessage(`You: ${message}`);
                messageInput.value = ''; // Clear the input field
            } else {
                console.error('Data channel is not open. Cannot send message.');
            }
        }
    }
});

// Append a message to the chat window
function appendMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    chat.appendChild(messageElement);
    chat.scrollTop = chat.scrollHeight; // Auto-scroll to the bottom
}
