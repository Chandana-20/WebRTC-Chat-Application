document.addEventListener('DOMContentLoaded', () => {
    const socket = io();  // Connect to signaling server
    const chat = document.getElementById('chat');
    const messageInput = document.getElementById('messageInput');

    let peerConnection;
    let dataChannel;

    const configuration = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };

    console.log('Joining the default room');

    socket.on('role', (role) => {
        console.log(`Received role: ${role}`);
        createPeerConnection();

        if (role === 'initiator') {
            createDataChannel();
            startCall();
        }
    });

    function createPeerConnection() {
        peerConnection = new RTCPeerConnection(configuration);

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate', event.candidate);
                socket.emit('signal', { type: 'candidate', candidate: event.candidate });
            }
        };

        peerConnection.ondatachannel = (event) => {
            console.log('Data channel received');
            dataChannel = event.channel;
            setupDataChannel();
        };

        peerConnection.oniceconnectionstatechange = () => {
            console.log(`ICE connection state: ${peerConnection.iceConnectionState}`);
        };
    }

    function createDataChannel() {
        console.log('Creating data channel');
        dataChannel = peerConnection.createDataChannel('chat');
        console.log('Initial Data Channel State:', dataChannel.readyState);
        setupDataChannel();
    }

    function setupDataChannel() {
        dataChannel.onmessage = (event) => {
            console.log('Message received:', event.data);
            appendMessage(`Peer: ${event.data}`);
        };

        dataChannel.onopen = () => {
            console.log('Data channel is open!');
            messageInput.disabled = false;
        };

        dataChannel.onclose = () => {
            console.log('Data channel closed');
            messageInput.disabled = true;
        };

        dataChannel.onerror = (error) => {
            console.error('Data channel error:', error);
        };
    }

    async function startCall() {
        console.log('Starting call');
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('signal', { type: 'offer', offer });
    }

    async function handleOffer(offer) {
        console.log("Received Offer", offer);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { type: 'answer', answer });
    }

    async function handleAnswer(answer) {
        console.log("Received Answer", answer);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }

    async function handleCandidate(candidate) {
        console.log("Received ICE Candidate:", candidate);
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log("ICE Candidate added successfully");
        } catch (error) {
            console.error("Error adding ICE Candidate:", error);
        }
    }

    socket.on('signal', (data) => {
        console.log('Received signal:', data);
        if (data.type === 'offer') {
            handleOffer(data.offer);
        } else if (data.type === 'answer') {
            handleAnswer(data.answer);
        } else if (data.type === 'candidate') {
            handleCandidate(data.candidate);
        }
    });

    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            const message = messageInput.value;
            if (message && dataChannel && dataChannel.readyState === 'open') {
                dataChannel.send(message);
                appendMessage(`You: ${message}`);
                messageInput.value = '';
            } else {
                console.error('Data channel is not open. Current state:', dataChannel?.readyState);
            }
        }
    });

    function appendMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.textContent = message;
        chat.appendChild(messageElement);
        chat.scrollTop = chat.scrollHeight;
    }
});
