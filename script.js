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
// Group Call State
let groupId = null;
let groupMembers = {};
let isGroupLeader = false;
let isCoLeader = false;
let groupCall = null;

// Constants
const RECONNECT_INTERVAL = 5000;
const NOTIFICATION_COOLDOWN = 5000;
const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

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
        // Only accept new connection if we don't have one or the current is closed
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

// ================== Sharing Functions ==================
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

const shareLocation = () => {
    if (!navigator.geolocation) {
        appendMessage('Geolocation not supported', 'system');
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
            appendMessage('Location error: ' + error.message, 'system');
        }
    );
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

const displaySharedLocation = (location, type) => {
    const locElement = document.createElement('div');
    locElement.className = `shared-location ${type}`;
    
    const link = document.createElement('a');
    link.href = `https://www.google.com/maps?q=${location.lat},${location.lng}`;
    link.target = '_blank';
    link.textContent = `View Location (Accuracy: ${Math.round(location.accuracy)}m)`;
    link.className = 'location-link';
    
    locElement.appendChild(link);
    sharedContentContainer.appendChild(locElement);
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
    
    // Don't reconnect if already connected to same peer
    if (conn && conn.open && conn.peer === peerId) {
        return appendMessage('Already connected to ' + peerId, 'system');
    }
    
    // Close existing connection if it exists
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
// ================== Group Call Functions ==================
const createGroup = () => {
    if (peer.disconnected) return appendMessage("Peer not connected", "system");
    
    groupId = `group-${Math.random().toString(36).substr(2, 9)}`;
    isGroupLeader = true;
    groupMembers[peer.id] = { stream: null, isLeader: true };
    
    appendMessage(`Group created! ID: ${groupId}`, "system");
    document.getElementById("groupIdInput").value = groupId;
    updateGroupUI();
};

const joinGroup = () => {
    const joinId = document.getElementById("groupIdInput").value.trim();
    if (!joinId) return appendMessage("Enter a Group ID", "system");
    
    if (Object.keys(groupMembers).length >= 20) {
        return appendMessage("Group is full (max 20)", "system");
    }
    
    groupId = joinId;
    groupMembers[peer.id] = { stream: null, isLeader: false };
    
    // Notify group leader
    if (conn && conn.open) {
        conn.send({ type: "groupJoin", groupId, peerId: peer.id });
    }
    
    appendMessage(`Joined group: ${groupId}`, "system");
    updateGroupUI();
};

const handleGroupCall = () => {
    if (!isGroupLeader && !isCoLeader) {
        return appendMessage("Only leaders can start group calls", "system");
    }
    
    if (localStream) {
        Object.keys(groupMembers).forEach(memberId => {
            if (memberId !== peer.id) {
                const call = peer.call(memberId, localStream);
                call.on("stream", (remoteStream) => {
                    if (!groupCall) groupCall = {};
                    groupCall[memberId] = remoteStream;
                    updateRemoteVideos();
                });
            }
        });
    }
};

const updateRemoteVideos = () => {
    const videoContainer = document.getElementById("videoContainer");
    videoContainer.innerHTML = `
        <video id="localVideo" autoplay muted></video>
        ${Object.entries(groupCall).map(([id, stream]) => `
            <video id="remote-${id}" autoplay></video>
        `).join("")}
    `;
    
    Object.entries(groupCall).forEach(([id, stream]) => {
        document.getElementById(`remote-${id}`).srcObject = stream;
    });
};

const updateGroupUI = () => {
    const membersList = document.getElementById("groupMembersList");
    membersList.innerHTML = Object.entries(groupMembers)
        .map(([id, data]) => `
            <div>${id} ${data.isLeader ? "(Leader)" : ""} ${id === peer.id ? "(You)" : ""}</div>
        `).join("");
};

// Start the application
initApp();
// Group Call Event Listeners
document.getElementById("createGroupButton").addEventListener("click", createGroup);
document.getElementById("joinGroupButton").addEventListener("click", joinGroup);
document.getElementById("leaveGroupButton").addEventListener("click", () => {
    groupId = null;
    groupMembers = {};
    appendMessage("Left group", "system");
});

document.getElementById("inviteCoLeaderButton").addEventListener("click", () => {
    if (!isGroupLeader) return appendMessage("Only leader can assign co-leader", "system");
    // Logic to promote a member (omitted for brevity)
});