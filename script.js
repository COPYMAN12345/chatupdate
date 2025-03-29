// ================== P2P Chat and Video Call Application ==================
// DOM Elements
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

// Application State
let peer;
let conn = null;
let localStream = null;
let currentCall = null;
let username;
let isMuted = false;
let isVideoPaused = false;
let lastConnectedPeerId = '';
let checkConnectionInterval;
let lastPeerStatus = false;
let notificationPermissionGranted = false;
let lastNotificationTime = 0;
let watchPositionId = null;

// Constants
const RECONNECT_INTERVAL = 5000;
const NOTIFICATION_COOLDOWN = 5000;
const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const LOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0
};
const MIN_LOCATION_ACCURACY = 30; // meters
const MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY'; // Replace with your actual API key

// ================== Storage Functions ==================
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

// ================== Notification System ==================
const initNotifications = () => {
    if (!("Notification" in window)) {
        console.log("Browser doesn't support notifications");
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

    const notification = new Notification(title, {...defaultOptions, ...options});
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

// ================== Connection Management ==================
const checkPeerAvailability = (peerId) => {
    if (checkConnectionInterval) clearInterval(checkConnectionInterval);

    const checkConnection = () => {
        if (!peer || peer.disconnected) return;

        const tempConn = peer.connect(peerId, { serialization: 'none' });
        
        tempConn.on('open', () => {
            if (!lastPeerStatus) {
                showPopupNotification(
                    `${peerId} is online`, 
                    'Your friend is now available',
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
        if (!document.hidden) checkConnection();
    });
};

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
        if (!conn || !conn.open) {
            conn = connection;
            
            connection.on('open', () => {
                if (lastConnectedPeerId !== connection.peer) {
                    lastConnectedPeerId = connection.peer;
                    saveConnectionState(connection.peer, true);
                    connection.send({ username: 'System', message: 'Connected to ' + username });
                    appendMessage('Connected to ' + connection.peer, 'system');
                    checkPeerAvailability(connection.peer);
                }
            });
            
            connection.on('data', handleIncomingData);
            
            connection.on('close', () => {
                appendMessage('Disconnected from ' + connection.peer, 'system');
                saveConnectionState(connection.peer, false);
            });
        } else {
            connection.close();
        }
    });

    peer.on('call', handleIncomingCall);
};

// ================== Media Functions ==================
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

// ================== Message Handling ==================
const appendMessage = (message, type) => {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', type);

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

    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
};

const handleIncomingData = (data) => {
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
};

const handleIncomingCall = (call) => {
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
};

// ================== Location Sharing Functions ==================
const shareLocation = () => {
    if (!navigator.geolocation) {
        appendMessage('Geolocation is not supported by your browser', 'system');
        return;
    }
    
    appendMessage('Getting high-accuracy location...', 'system');
    
    // First try high accuracy
    navigator.geolocation.getCurrentPosition(
        (position) => {
            handlePositionSuccess(position);
        },
        (highAccuracyError) => {
            // If high accuracy fails, try with lower accuracy
            appendMessage('High accuracy failed, trying standard accuracy...', 'system');
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    handlePositionSuccess(position);
                },
                (standardError) => {
                    handlePositionError(standardError);
                },
                { maximumAge: 30000, timeout: 15000 }
            );
        },
        LOCATION_OPTIONS
    );
};

const handlePositionSuccess = (position) => {
    const accuracy = position.coords.accuracy;
    const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: accuracy,
        timestamp: new Date(position.timestamp).toLocaleTimeString()
    };
    
    let accuracyMessage = getAccuracyMessage(accuracy);
    
    if (conn && conn.open) {
        conn.send({
            type: 'location',
            location: location,
            username: username,
            accuracy: accuracyMessage
        });
        appendMessage(`You shared your location${accuracyMessage}`, 'local');
        displaySharedLocation(location, 'local', accuracyMessage);
        
        if (accuracy > MIN_LOCATION_ACCURACY) {
            appendMessage('Tip: For better accuracy, try moving to an open area', 'system');
        }
    } else {
        appendMessage('Not connected to any peer', 'system');
    }
};

const getAccuracyMessage = (accuracy) => {
    if (accuracy <= 30) return ' (High accuracy)';
    if (accuracy <= 100) return ' (Medium accuracy)';
    return ' (Low accuracy)';
};

const handlePositionError = (error) => {
    let errorMessage = 'Location error: ';
    switch(error.code) {
        case error.PERMISSION_DENIED:
            errorMessage += "Permission denied. Please enable location services.";
            break;
        case error.POSITION_UNAVAILABLE:
            errorMessage += "Location information unavailable.";
            break;
        case error.TIMEOUT:
            errorMessage += "Request timed out. Try again in an open area.";
            break;
        default:
            errorMessage += "Couldn't get your location.";
            break;
    }
    appendMessage(errorMessage, 'system');
};

const displaySharedLocation = (location, type, accuracyMessage = '') => {
    const locElement = document.createElement('div');
    locElement.className = `shared-location ${type}`;
    
    const link = document.createElement('a');
    link.href = `https://www.google.com/maps?q=${location.lat},${location.lng}`;
    link.target = '_blank';
    link.textContent = `View Location (${Math.round(location.accuracy)}m accuracy${accuracyMessage})`;
    link.className = 'location-link';
    
    const mapImg = document.createElement('img');
    mapImg.src = `https://maps.googleapis.com/maps/api/staticmap?center=${location.lat},${location.lng}&zoom=15&size=300x200&markers=color:red%7C${location.lat},${location.lng}&key=${MAPS_API_KEY}`;
    mapImg.alt = 'Location map';
    mapImg.className = 'location-map';
    
    const timeStamp = document.createElement('div');
    timeStamp.className = 'location-timestamp';
    timeStamp.textContent = `Shared at ${location.timestamp}`;
    
    locElement.appendChild(link);
    locElement.appendChild(document.createElement('br'));
    locElement.appendChild(mapImg);
    locElement.appendChild(timeStamp);
    
    if (location.accuracy > MIN_LOCATION_ACCURACY) {
        const warning = document.createElement('div');
        warning.className = 'accuracy-warning';
        warning.textContent = 'Note: Location accuracy may be improved by moving outdoors';
        locElement.appendChild(warning);
    }
    
    sharedContentContainer.appendChild(locElement);
};

// ================== File Sharing Functions ==================
const handleFileShare = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > MAX_FILE_SIZE) {
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
};

const handlePhotoShare = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > MAX_IMAGE_SIZE) {
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
};

const displaySharedFile = (filename, data, type) => {
    const fileElement = document.createElement('div');
    fileElement.className = `shared-file ${type}`;
    
    const link = document.createElement('a');
    link.href = data;
    link.download = filename;
    link.textContent = `Download ${filename}`;
    link.className = 'download-link';
    
    fileElement.appendChild(link);
    sharedContentContainer.appendChild(fileElement);
};

const displaySharedImage = (data, type) => {
    const imgElement = document.createElement('div');
    imgElement.className = `shared-image ${type}`;
    
    const img = document.createElement('img');
    img.src = data;
    img.alt = 'Shared photo';
    img.className = 'shared-photo';
    
    imgElement.appendChild(img);
    sharedContentContainer.appendChild(imgElement);
};

// ================== Event Listeners ==================
sendButton.addEventListener('click', () => {
    const message = messageInput.value.trim();
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
    if (e.key === 'Enter') sendButton.click();
});

connectButton.addEventListener('click', () => {
    const peerId = peerIdInput.value.trim();
    if (!peerId) return appendMessage('Please enter a Peer ID', 'system');
    
    if (conn && conn.open && conn.peer === peerId) {
        return appendMessage('Already connected to ' + peerId, 'system');
    }
    
    if (conn) conn.close();
    
    lastConnectedPeerId = peerId;
    saveConnectionState(peerId, true);
    
    conn = peer.connect(peerId, {
        reliable: true,
        serialization: 'json'
    });
    
    conn.on('open', () => {
        if (!conn.userNotified) {
            conn.send({ username: 'System', message: 'Connected to ' + username });
            appendMessage('Connected to ' + peerId, 'system');
            checkPeerAvailability(peerId);
            conn.userNotified = true;
        }
    });
    
    conn.on('data', handleIncomingData);
    
    conn.on('close', () => {
        appendMessage('Disconnected from ' + peerId, 'system');
        saveConnectionState(peerId, false);
    });
    
    conn.on('error', (err) => {
        console.error('Connection error:', err);
        appendMessage('Connection error: ' + err.message, 'system');
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
    sharedContentContainer.innerHTML = '';
});

clearDataButton.addEventListener('click', () => {
    clearUserData();
    clearConnectionState();
    appendMessage('All data cleared. Please refresh the page.', 'system');
});

fileShareButton.addEventListener('click', () => fileInput.click());
photoShareButton.addEventListener('click', () => photoInput.click());
fileInput.addEventListener('change', handleFileShare);
photoInput.addEventListener('change', handlePhotoShare);
locationShareButton.addEventListener('click', shareLocation);

// ================== Application Initialization ==================
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

// Start the application
initApp();