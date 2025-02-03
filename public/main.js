document.addEventListener('DOMContentLoaded', () => {
    const socket = io(); // Connect to the signaling server

    const chat = document.getElementById('chat');
    const messageInput = document.getElementById('messageInput');

    let peerConnection;
    let dataChannel;

    // Configuration for WebRTC (STUN server)
    const configuration = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };

    // Automatically join the "default-room"
    console.log('Joining the default room');

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

    // Handle role assignment (initiator or receiver)
    socket.on('role', (role) => {
        console.log(`Received role: ${role}`);
        if (role === 'initiator') {
            createPeerConnection();
            createDataChannel();
            startCall();
        } else if (role === 'receiver') {
            createPeerConnection();
        }
    });

    // Create a new RTCPeerConnection
    function createPeerConnection() {
        peerConnection = new RTCPeerConnection(configuration);

        // Handle incoming ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate');
                socket.emit('signal', { type: 'candidate', candidate: event.candidate });
            }
        };

        // Handle incoming data channel (for receiver)
        peerConnection.ondatachannel = (event) => {
            console.log('Data channel received');
            dataChannel = event.channel;
            setupDataChannel();
        };
    }

    // Create a data channel (for initiator)
    function createDataChannel() {
        console.log('Creating data channel');
        dataChannel = peerConnection.createDataChannel('chat');
        setupDataChannel();
    }

    // Set up data channel event handlers
    function setupDataChannel() {
        dataChannel.onmessage = (event) => {
            console.log('Message received:', event.data);
            appendMessage(`Peer: ${event.data}`);
        };

        dataChannel.onopen = () => {
            console.log('Data channel is open!');
        };

        dataChannel.onclose = () => {
            console.log('Data channel closed');
        };
    }

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
        console.log('Starting call');
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('signal', { type: 'offer', offer: offer });
    }

    // Send a message when Enter is pressed
    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            const message = messageInput.value;
            if (message && dataChannel && dataChannel.readyState === 'open') {
                dataChannel.send(message); // Send message via WebRTC data channel
                appendMessage(`You: ${message}`);
                messageInput.value = ''; // Clear the input field
            } else {
                console.error('Data channel is not open');
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
});
