document.addEventListener('DOMContentLoaded', () => {
    const socket = io(); // Connect to signaling server
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
            console.log("Initiator: Creating data channel and starting call...");
            createDataChannel();
            startCall();
        } else if (role === 'receiver') {
            console.log("Receiver: Waiting for connection...");
        }
    });

    function createPeerConnection() {
        peerConnection = new RTCPeerConnection(configuration);

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("Sending ICE Candidate:");
                console.log(`  → Candidate: ${event.candidate.candidate}`);
                console.log(`  → sdpMLineIndex: ${event.candidate.sdpMLineIndex}`);
                console.log(`  → sdpMid: ${event.candidate.sdpMid}`);

                socket.emit('signal', { type: 'candidate', candidate: event.candidate });
            } else {
                console.log("ICE Candidate gathering complete.");
            }
        };

        peerConnection.ondatachannel = (event) => {
            console.log("Data channel received");
            dataChannel = event.channel;
            setupDataChannel();
        };

        peerConnection.oniceconnectionstatechange = () => {
            console.log(`ICE connection state: ${peerConnection.iceConnectionState}`);
        };
    }

    function createDataChannel() {
        console.log("Creating data channel");
        dataChannel = peerConnection.createDataChannel("chat");
        console.log("Initial Data Channel State:", dataChannel.readyState);
        setupDataChannel();
    }

    function setupDataChannel() {
        if (!dataChannel) {
            console.error("Data channel is undefined, waiting for connection...");
            return;
        }

        console.log("Setting up data channel events...");

        dataChannel.onopen = () => {
            console.log("Data channel is now OPEN");
            messageInput.disabled = false;
        };

        dataChannel.onmessage = (event) => {
            console.log("Message received:", event.data);
            appendMessage(`Peer: ${event.data}`);
        };

        dataChannel.onclose = () => {
            console.warn("Data channel closed");
            messageInput.disabled = true;
        };

        dataChannel.onerror = (error) => {
            console.error("Data channel error:", error);
        };
    }

    async function startCall() {
        console.log("Starting call");
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('signal', { type: 'offer', offer });
    }

    async function handleOffer(offer) {
        console.log("Received Offer", offer);
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            console.log("Offer set as remote description");

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            console.log("Sending Answer", answer);
            socket.emit('signal', { type: 'answer', answer });

        } catch (error) {
            console.error("Error handling offer:", error);
        }
    }

    async function handleAnswer(answer) {
        console.log("Received Answer", answer);
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log("Answer set as remote description");
        } catch (error) {
            console.error("Error handling answer:", error);
        }
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

    socket.on("signal", (data) => {
        console.log("Received signal:", data);
        if (data.type === "offer") {
            handleOffer(data.offer);
        } else if (data.type === "answer") {
            handleAnswer(data.answer);
        } else if (data.type === "candidate") {
            handleCandidate(data.candidate);
        }
    });

    messageInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            if (!dataChannel || dataChannel.readyState !== "open") {
                console.warn("Data channel is still connecting. Please wait...");
                return;
            }

            const message = messageInput.value.trim();
            if (message !== "") {
                dataChannel.send(message);
                appendMessage(`You: ${message}`);
                messageInput.value = "";
            }
        }
    });

    function appendMessage(message) {
        const messageElement = document.createElement("div");
        messageElement.textContent = message;
        chat.appendChild(messageElement);
        chat.scrollTop = chat.scrollHeight;
    }
});
