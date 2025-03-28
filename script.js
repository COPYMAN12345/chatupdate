// ================== P2P Chat and Video Call Functions ==================

// Get DOM elements for P2P chat and video call
const chatBox = document.getElementById('chatBox');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const peerIdInput = document.getElementById('peerIdInput');
const connectButton = document.getElementById('connectButton');
const disconnectButton = document.getElementById('disconnectButton');
const callButton = document.getElementById('callButton');
const endCallButton = document.getElementById('endCallButton');
const muteButton = document.getElementById('muteButton');
const pauseVideoButton = document.getElementById('pauseVideoButton');
const clearChatButton = document.getElementById('clearChatButton');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const peerIdDisplay = document.getElementById('peerIdDisplay');

let peer;
let conn;
let localStream = null; // Initialize localStream as null
let currentCall;
let username; // Variable to store the username
let isMuted = false; // Track mute state
let isVideoPaused = false; // Track video pause state

// Function to initialize PeerJS with a custom ID
const initializePeer = (customId) => {
    peer = new Peer(customId);

    // Debugging: Log PeerJS initialization
    console.log('Initializing PeerJS with custom ID:', customId);

    peer.on('open', (id) => {
        console.log('PeerJS connection opened. My peer ID is:', id);
        peerIdDisplay.textContent = 'Your Peer ID: ' + id; // Display Peer ID on the page
    });

    peer.on('error', (error) => {
        console.error('PeerJS error:', error);
        alert('An error occurred with PeerJS. Please check the console for details.');
    });

    peer.on('connection', (connection) => {
        conn = connection;
        conn.on('open', () => {
            // Send a confirmation message to the other peer
            conn.send({ username: 'System', message: 'Connected to ' + username });
            appendMessage('Connected to ' + conn.peer, 'system');
        });
        conn.on('data', (data) => {
            // Display the received message with the sender's username
            appendMessage(data.username + ': ' + data.message, data.username === 'System' ? 'system' : 'remote');
        });
    });

    peer.on('call', (call) => {
        if (localStream) {
            // Answer the call and send local stream if available
            call.answer(localStream);
            call.on('stream', (remoteStream) => {
                remoteVideo.srcObject = remoteStream;
            });
            currentCall = call;
        } else {
            // If localStream is not available, reject the call
            call.close();
            alert('Cannot accept video call: Camera and microphone access denied.');
        }
    });
};

// Function to request camera and microphone access
const requestMediaPermissions = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = stream;
        localStream = stream;
        console.log('Camera and microphone access granted.');
        return true; // Permissions granted
    } catch (error) {
        console.warn('Camera and microphone access denied:', error);
        alert('Camera and microphone access denied. You cannot start a video call.');
        return false; // Permissions denied
    }
};

// Prompt the user for a custom Peer ID and username
const customId = prompt('ENTER PEER ID [share it for]');
if (customId) {
    username = prompt('ENTER YOUR NAME');
    if (username) {
        initializePeer(customId); // Initialize PeerJS with the custom ID
    } else {
        alert('Username is required. Please refresh the page and try again.');
    }
} else {
    alert('Peer ID is required. Please refresh the page and try again.');
}

// Connect to another peer
connectButton.addEventListener('click', () => {
    const peerId = peerIdInput.value;
    if (!peerId) return alert('Please enter a Peer ID');
    conn = peer.connect(peerId);
    conn.on('open', () => {
        // Send a confirmation message to the other peer
        conn.send({ username: 'System', message: 'Connected to ' + username });
        appendMessage('Connected to ' + peerId, 'system');
    });
    conn.on('data', (data) => {
        // Display the received message with the sender's username
        appendMessage(data.username + ': ' + data.message, data.username === 'System' ? 'system' : 'remote');
    });
});

// Send a message
sendButton.addEventListener('click', () => {
    const message = messageInput.value;
    if (!message) return;
    if (conn && conn.open) {
        // Send the message along with the username
        conn.send({ username: username, message: message });
        appendMessage(username + ': ' + message, 'local');
        messageInput.value = '';
    } else {
        alert('Not connected to any peer.');
    }
});

// Disconnect from the current peer
disconnectButton.addEventListener('click', () => {
    if (conn) {
        conn.close();
        appendMessage('Disconnected', 'system');
        conn = null;
    }
});

// Start a video call
callButton.addEventListener('click', async () => {
    if (!conn) return alert('Not connected to any peer.');

    // Request camera and microphone permissions
    const permissionsGranted = await requestMediaPermissions();
    if (!permissionsGranted) return; // Stop if permissions are denied

    const peerId = conn.peer;
    const call = peer.call(peerId, localStream);
    call.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
    });
    currentCall = call;
});

// End the video call
endCallButton.addEventListener('click', () => {
    if (currentCall) {
        currentCall.close();
        remoteVideo.srcObject = null;
    }
});

// Mute/Unmute audio
muteButton.addEventListener('click', () => {
    if (localStream) {
        isMuted = !isMuted;
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !isMuted;
        });
        muteButton.textContent = isMuted ? 'Unmute' : 'Mute';
    }
});

// Pause/Resume video
pauseVideoButton.addEventListener('click', () => {
    if (localStream) {
        isVideoPaused = !isVideoPaused;
        localStream.getVideoTracks().forEach(track => {
            track.enabled = !isVideoPaused;
        });
        pauseVideoButton.textContent = isVideoPaused ? 'Resume Video' : 'Pause Video';
    }
});

// Clear chat
clearChatButton.addEventListener('click', () => {
    chatBox.innerHTML = '';
});

// Append a message to the chat box
const appendMessage = (message, type) => {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');

    // Split the message into username and content
    const colonIndex = message.indexOf(':');
    const usernamePart = message.substring(0, colonIndex + 1); // Include the colon
    const messagePart = message.substring(colonIndex + 1); // Exclude the colon

    // Create a span for the username (bold and uppercase)
    const usernameSpan = document.createElement('span');
    usernameSpan.textContent = usernamePart;
    usernameSpan.classList.add('username');

    // Create a span for the message content
    const messageSpan = document.createElement('span');
    messageSpan.textContent = messagePart;

    // Append the username and message to the message element
    messageElement.appendChild(usernameSpan);
    messageElement.appendChild(messageSpan);

    // Set the class based on the message type
    if (type === 'local') {
        messageElement.classList.add('local'); // Align to the right
    } else if (type === 'remote') {
        messageElement.classList.add('remote'); // Align to the left
    } else if (type === 'system') {
        messageElement.classList.add('system'); // Center align
    }

    // Append the message element to the chat box
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to the latest message
};