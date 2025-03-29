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
let lastConnectedPeerId = '';
let checkConnectionInterval;
let lastPeerStatus = false;
let notificationPermissionGranted = false;
let lastNotificationTime = 0;

// Constants
const RECONNECT_INTERVAL = 5000; // 5 seconds
const NOTIFICATION_COOLDOWN = 5000; // 5 seconds between notifications
const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3';

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

const saveConnectionState = (peerId, isConnecting) => {
    localStorage.setItem('p2pChat_lastPeerId', peerId);
    localStorage.setItem('p2pChat_isConnecting', isConnecting.toString());
};

const loadConnectionState = () => {
    return {
        peerId: localStorage.getItem('p2pChat_lastPeerId'),
        isConnecting: localStorage.getItem('p2pChat_isConnecting') === 'true'
    };
};

const clearConnectionState = () => {
    localStorage.removeItem('p2pChat_lastPeerId');
    localStorage.removeItem('p2pChat_isConnecting');
};

// Notification System
const initNotifications = () => {
    if (!("Notification" in window)) {
        console.log("This browser does not support notifications");
        return;
    }

    Notification.requestPermission().then(permission => {
        notificationPermissionGranted = permission === "granted";
        if (notificationPermissionGranted) {
            console.log("Notification permission granted");
        }
    });
};

const showPopupNotification = (title, message, options = {}) => {
    if (!notificationPermissionGranted || document.hasFocus()) return;
    
    const now = Date.now();
    if (now - lastNotificationTime < NOTIFICATION_COOLDOWN) return;
    lastNotificationTime = now;

    const defaultOptions = {
        body: message,
        icon: 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
        vibrate: [200, 100, 200],
        tag: 'p2p-notification',
        renotify: true,
        silent: false
    };

    const finalOptions = { ...defaultOptions, ...options };

    const notification = new Notification(title, finalOptions);

    notification.onclick = () => {
        window.focus();
        notification.close();
    };

    playNotificationSound();
};

const playNotificationSound = () => {
    const audio = new Audio(NOTIFICATION_SOUND_URL);
    audio.play().catch(e => console.log("Audio playback failed:", e));
};

// Peer Availability Check
const checkPeerAvailability = (peerId) => {
    if (checkConnectionInterval) {
        clearInterval(checkConnectionInterval);
    }

    const checkConnection = () => {
        if (!peer || peer.disconnected) return;

        const tempConn = peer.connect(peerId, { serialization: 'none' });
        
        tempConn.on('open', () => {
            if (!lastPeerStatus) {
                showPopupNotification(
                    `${peerId} is online`, 
                    'Your friend is now available for chat',
                    { icon: 'https://cdn-icons-png.flaticon.com/512/733/733585.png' }
                );
                appendMessage(`${peerId} is now online!`, 'system');
                
                if (!conn || !conn.open) {
                    setTimeout(() => {
                        peerIdInput.value = peerId;
                        connectButton.click();
                    }, 1000);
                }
            }
            lastPeerStatus = true;
            tempConn.close();
        });

        tempConn.on('error', () => {
            lastPeerStatus = false;
        });
    };

    checkConnection();
    checkConnectionInterval = setInterval(checkConnection, RECONNECT_INTERVAL);
    
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            checkConnection();
        }
    });
};

// Initialize PeerJS
const initializePeer = (customId) => {
    peer = new Peer(customId);

    peer.on('open', (id) => {
        console.log('PeerJS connection opened. My peer ID is:', id);
        peerIdDisplay.textContent = 'Your Peer ID: ' + id;
        appendMessage('Your peer ID is: ' + id, 'system');
        
        const connectionState = loadConnectionState();
        if (connectionState.isConnecting && connectionState.peerId) {
            setTimeout(() => {
                peerIdInput.value = connectionState.peerId;
                connectButton.click();
                appendMessage(`Attempting to reconnect to ${connectionState.peerId}...`, 'system');
            }, 1000);
        }
    });

    peer.on('error', (error) => {
        console.error('PeerJS error:', error);
        appendMessage('Error: ' + error.message, 'system');
    });

    peer.on('connection', (connection) => {
        conn = connection;
        conn.on('open', () => {
            lastConnectedPeerId = conn.peer;
            saveConnectionState(conn.peer, true);
            conn.send({ username: 'System', message: 'Connected to ' + username });
            appendMessage('Connected to ' + conn.peer, 'system');
            checkPeerAvailability(conn.peer);
        });
        
        conn.on('data', (data) => {
            if (data.type === 'file') {
                appendMessage(`${data.username} shared a file: ${data.filename}`, 'remote');
                displaySharedFile(data.filename, data.data, 'remote');
                if (document.hidden) {
                    showPopupNotification(
                        `New file from ${data.username}`,
                        `${data.filename}`,
                        { icon: 'https://cdn-icons-png.flaticon.com/512/2965/2965300.png' }
                    );
                }
            } else if (data.type === 'image') {
                appendMessage(`${data.username} shared a photo`, 'remote');
                displaySharedImage(data.data, 'remote');
                if (document.hidden) {
                    showPopupNotification(
                        `New photo from ${data.username}`,
                        'Tap to view',
                        { icon: 'https://cdn-icons-png.flaticon.com/512/2965/2965300.png' }
                    );
                }
            } else if (data.type === 'location') {
                appendMessage(`${data.username} shared their location`, 'remote');
                displaySharedLocation(data.location, 'remote');
            } else {
                appendMessage(data.username + ': ' + data.message, data.username === 'System' ? 'system' : 'remote');
                if (document.hidden && data.username !== 'System') {
                    showPopupNotification(
                        `New message from ${data.username}`,
                        data.message.length > 30 ? data.message.substring(0, 30) + '...' : data.message,
                        { icon: 'https://cdn-icons-png.flaticon.com/512/733/733585.png' }
                    );
                }
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
            showPopupNotification(
                'Incoming video call',
                `From ${call.peer}`,
                { icon: 'https://cdn-icons-png.flaticon.com/512/733/733585.png' }
            );
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

// Initialize Application
const initApp = () => {
    initNotifications();
    
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
    
    lastConnectedPeerId = peerId;
    saveConnectionState(peerId, true);
    
    conn = peer.connect(peerId);
    conn.on('open', () => {
        conn.send({ username: 'System', message: 'Connected to ' + username });
        appendMessage('Connected to ' + peerId, 'system');
        checkPeerAvailability(peerId);
    });
    
    conn.on('close', () => {
        saveConnectionState(peerId, true);
    });
});

disconnectButton.addEventListener('click', () => {
    if (conn) {
        conn.close();
        appendMessage('Disconnected', 'system');
        conn = null;
        clearConnectionState();
        if (checkConnectionInterval) {
            clearInterval(checkConnectionInterval);
        }
    }
});

reconnectButton.addEventListener('click', () => {
    if (!lastConnectedPeerId) {
        appendMessage('No previous connection found', 'system');
        return;
    }

    if (!peer || peer.disconnected) {
        appendMessage('Cannot reconnect - peer not initialized', 'system');
        return;
    }

    if (conn) {
        conn.close();
        conn = null;
        appendMessage('Disconnected from current peer', 'system');
    }

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
    clearConnectionState();
    appendMessage('Saved data cleared. Refresh to enter new details.', 'system');
});

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