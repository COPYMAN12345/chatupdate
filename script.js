// ================== P2P Chat and Video Call Functions ==================

// Get DOM elements
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
const clearDataButton = document.getElementById('clearDataButton');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const peerIdDisplay = document.getElementById('peerIdDisplay');
const fileShareButton = document.getElementById('fileShareButton');
const photoShareButton = document.getElementById('photoShareButton');
const locationShareButton = document.getElementById('locationShareButton');
const fileInput = document.getElementById('fileInput');
const photoInput = document.getElementById('photoInput');
const sharedContentContainer = document.getElementById('sharedContentContainer');
const reconnectButton = document.getElementById('reconnectButton');

let peer;
let conn;
let localStream = null;
let currentCall;
let username;
let isMuted = false;
let isVideoPaused = false;
let lastConnectedPeerId = ''; // Track last connected peer

// Local Storage Functions
const saveUserData = (peerId, name) => {
    localStorage.setItem('p2pChat_peerId', peerId);
    localStorage.setItem('p2pChat_username', name);
};

const loadUserData = () => {
    return {
        peerId: localStorage.getItem('p2pChat_peerId'),
        username: localStorage.getItem('p2pChat_username')
    };
};

const clearUserData = () => {
    localStorage.removeItem('p2pChat_peerId');
    localStorage.removeItem('p2pChat_username');
};

// Initialize PeerJS
const initializePeer = (customId) => {
    peer = new Peer(customId);

    peer.on('open', (id) => {
        console.log('PeerJS connection opened. My peer ID is:', id);
        peerIdDisplay.textContent = 'Your Peer ID: ' + id;
        appendMessage('Your peer ID is: ' + id, 'system');
    });

    peer.on('error', (error) => {
        console.error('PeerJS error:', error);
        appendMessage('Error: ' + error.message, 'system');
    });

    peer.on('connection', (connection) => {
        conn = connection;
        conn.on('open', () => {
            lastConnectedPeerId = conn.peer; // Store connected peer
            conn.send({ username: 'System', message: 'Connected to ' + username });
            appendMessage('Connected to ' + conn.peer, 'system');
        });
        conn.on('data', (data) => {
            if (data.type === 'file') {
                appendMessage(`${data.username} shared a file: ${data.filename}`, 'remote');
                displaySharedFile(data.filename, data.data, 'remote');
            } else if (data.type === 'image') {
                appendMessage(`${data.username} shared a photo`, 'remote');
                displaySharedImage(data.data, 'remote');
            } else if (data.type === 'location') {
                appendMessage(`${data.username} shared their location`, 'remote');
                displaySharedLocation(data.location, 'remote');
            } else {
                appendMessage(data.username + ': ' + data.message, data.username === 'System' ? 'system' : 'remote');
            }
        });
    });

    peer.on('call', (call) => {
        if (localStream) {
            call.answer(localStream);
            call.on('stream', (remoteStream) => {
                remoteVideo.srcObject = remoteStream;
            });
            currentCall = call;
            appendMessage('Incoming video call from ' + call.peer, 'system');
        } else {
            call.close();
            appendMessage('Missed video call from ' + call.peer + ' (no media permissions)', 'system');
        }
    });
};

// Media Permissions
const requestMediaPermissions = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = stream;
        localStream = stream;
        return true;
    } catch (error) {
        console.error('Media access denied:', error);
        appendMessage('Camera/microphone access denied', 'system');
        return false;
    }
};

// Message Functions
const appendMessage = (message, type) => {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');

    const colonIndex = message.indexOf(':');
    if (colonIndex > -1) {
        const usernamePart = message.substring(0, colonIndex + 1);
        const messagePart = message.substring(colonIndex + 1);

        const usernameSpan = document.createElement('span');
        usernameSpan.textContent = usernamePart;
        usernameSpan.classList.add('username');

        const messageSpan = document.createElement('span');
        messageSpan.textContent = messagePart;

        messageElement.appendChild(usernameSpan);
        messageElement.appendChild(messageSpan);
    } else {
        messageElement.textContent = message;
    }

    messageElement.classList.add(type);
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
};

// Initialize Application
const initApp = () => {
    const savedData = loadUserData();
    
    if (savedData.peerId && savedData.username) {
        username = savedData.username;
        initializePeer(savedData.peerId);
        appendMessage('Welcome back, ' + username + '!', 'system');
    } else {
        const newPeerId = prompt('Enter your peer ID (share this with others):');
        if (newPeerId) {
            const newUsername = prompt('Enter your name:');
            if (newUsername) {
                username = newUsername;
                saveUserData(newPeerId, newUsername);
                initializePeer(newPeerId);
                appendMessage('Welcome, ' + username + '!', 'system');
            } else {
                alert('Username is required. Please refresh the page.');
            }
        } else {
            alert('Peer ID is required. Please refresh the page.');
        }
    }
};

// Event Listeners
sendButton.addEventListener('click', () => {
    const message = messageInput.value;
    if (!message) return;
    if (conn && conn.open) {
        conn.send({ username: username, message: message });
        appendMessage(username + ': ' + message, 'local');
        messageInput.value = '';
    } else {
        appendMessage('Not connected to any peer', 'system');
    }
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendButton.click();
    }
});

connectButton.addEventListener('click', () => {
    const peerId = peerIdInput.value;
    if (!peerId) return appendMessage('Please enter a Peer ID', 'system');
    
    lastConnectedPeerId = peerId; // Store the peer ID
    conn = peer.connect(peerId);
    conn.on('open', () => {
        conn.send({ username: 'System', message: 'Connected to ' + username });
        appendMessage('Connected to ' + peerId, 'system');
    });
});

disconnectButton.addEventListener('click', () => {
    if (conn) {
        conn.close();
        appendMessage('Disconnected', 'system');
        conn = null;
    }
});

// New Reconnect Functionality
reconnectButton.addEventListener('click', () => {
    if (!lastConnectedPeerId) {
        appendMessage('No previous connection found', 'system');
        return;
    }

    if (!peer || peer.disconnected) {
        appendMessage('Cannot reconnect - peer not initialized', 'system');
        return;
    }

    // Disconnect if currently connected
    if (conn) {
        conn.close();
        conn = null;
        appendMessage('Disconnected from current peer', 'system');
    }

    // Reconnect after short delay
    setTimeout(() => {
        peerIdInput.value = lastConnectedPeerId;
        connectButton.click();
        appendMessage(`Reconnecting to ${lastConnectedPeerId}...`, 'system');
    }, 300);
});

callButton.addEventListener('click', async () => {
    if (!conn) return appendMessage('Not connected to any peer', 'system');

    const permissionsGranted = await requestMediaPermissions();
    if (!permissionsGranted) return;

    const call = peer.call(conn.peer, localStream);
    call.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
    });
    currentCall = call;
    appendMessage('Calling ' + conn.peer, 'system');
});

endCallButton.addEventListener('click', () => {
    if (currentCall) {
        currentCall.close();
        remoteVideo.srcObject = null;
        appendMessage('Call ended', 'system');
        currentCall = null;
    }
});

muteButton.addEventListener('click', () => {
    if (localStream) {
        isMuted = !isMuted;
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !isMuted;
        });
        muteButton.textContent = isMuted ? 'Unmute' : 'Mute';
        appendMessage(isMuted ? 'Microphone muted' : 'Microphone unmuted', 'system');
    }
});

pauseVideoButton.addEventListener('click', () => {
    if (localStream) {
        isVideoPaused = !isVideoPaused;
        localStream.getVideoTracks().forEach(track => {
            track.enabled = !isVideoPaused;
        });
        pauseVideoButton.textContent = isVideoPaused ? 'Resume Video' : 'Pause Video';
        appendMessage(isVideoPaused ? 'Video paused' : 'Video resumed', 'system');
    }
});

clearChatButton.addEventListener('click', () => {
    chatBox.innerHTML = '';
});

clearDataButton.addEventListener('click', () => {
    clearUserData();
    appendMessage('Saved data cleared. Refresh to enter new details.', 'system');
});

// File Sharing Functions
function handleFileShare(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
        appendMessage('File is too large (max 10MB)', 'system');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        if (conn && conn.open) {
            conn.send({
                type: 'file',
                filename: file.name,
                data: e.target.result,
                username: username
            });
            appendMessage(`You shared a file: ${file.name}`, 'local');
            displaySharedFile(file.name, e.target.result, 'local');
        } else {
            appendMessage('Not connected to any peer', 'system');
        }
    };
    reader.readAsDataURL(file);
}

function handlePhotoShare(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
        appendMessage('Image is too large (max 5MB)', 'system');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        if (conn && conn.open) {
            conn.send({
                type: 'image',
                filename: file.name,
                data: e.target.result,
                username: username
            });
            appendMessage(`You shared a photo: ${file.name}`, 'local');
            displaySharedImage(e.target.result, 'local');
        } else {
            appendMessage('Not connected to any peer', 'system');
        }
    };
    reader.readAsDataURL(file);
}

function shareLocation() {
    if (!navigator.geolocation) {
        appendMessage('Geolocation is not supported by your browser', 'system');
        return;
    }
    
    appendMessage('Requesting location...', 'system');
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
            
            if (conn && conn.open) {
                conn.send({
                    type: 'location',
                    location: location,
                    username: username
                });
                appendMessage('You shared your location', 'local');
                displaySharedLocation(location, 'local');
            } else {
                appendMessage('Not connected to any peer', 'system');
            }
        },
        (error) => {
            appendMessage('Unable to retrieve your location: ' + error.message, 'system');
        }
    );
}

function displaySharedFile(filename, data, type) {
    const fileElement = document.createElement('div');
    fileElement.className = `shared-file ${type}`;
    
    const link = document.createElement('a');
    link.href = data;
    link.download = filename;
    link.textContent = `Download ${filename}`;
    link.className = 'download-link';
    
    fileElement.appendChild(link);
    sharedContentContainer.appendChild(fileElement);
}

function displaySharedImage(data, type) {
    const imgElement = document.createElement('div');
    imgElement.className = `shared-image ${type}`;
    
    const img = document.createElement('img');
    img.src = data;
    img.alt = 'Shared photo';
    img.className = 'shared-photo';
    
    imgElement.appendChild(img);
    sharedContentContainer.appendChild(imgElement);
}

function displaySharedLocation(location, type) {
    const locElement = document.createElement('div');
    locElement.className = `shared-location ${type}`;
    
    const link = document.createElement('a');
    link.href = `https://www.google.com/maps?q=${location.lat},${location.lng}`;
    link.target = '_blank';
    link.textContent = `View Location (Accuracy: ${Math.round(location.accuracy)} meters)`;
    link.className = 'location-link';
    
    locElement.appendChild(link);
    sharedContentContainer.appendChild(locElement);
}

// Initialize file sharing event listeners
fileShareButton.addEventListener('click', () => {
    fileInput.click();
});

photoShareButton.addEventListener('click', () => {
    photoInput.click();
});

fileInput.addEventListener('change', handleFileShare);
photoInput.addEventListener('change', handlePhotoShare);
locationShareButton.addEventListener('click', shareLocation);

// Start the application
initApp();