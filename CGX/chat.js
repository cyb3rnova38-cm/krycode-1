import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const chatArea = document.getElementById('chatArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const emptyState = document.getElementById('emptyState');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');

let currentUser = null;

// Auth Check
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        userName.textContent = user.displayName || 'Support Guest';
        userEmail.textContent = user.email;
        loadMessages();
    } else {
        window.location.href = 'index.html'; // Updated to .html since index.htm was deleted
    }
});

function loadMessages() {
    if (!currentUser) return;

    // Listen to messages for this specific user session
    db.collection('messages')
        .where('sessionId', '==', currentUser.uid)
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            if (snapshot.empty) {
                emptyState.classList.remove('hidden');
                return;
            }
            emptyState.classList.add('hidden');
            
            chatArea.innerHTML = '';
            snapshot.forEach(doc => {
                const msg = doc.data();
                const isMe = msg.sender === 'user';
                const div = document.createElement('div');
                div.className = `message-bubble ${isMe ? 'message-me' : 'message-them'} flex flex-col`;
                div.innerHTML = `
                    <p>${msg.text}</p>
                    <span class="text-[10px] opacity-60 mt-1 self-end">${new Date(msg.timestamp?.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                `;
                chatArea.appendChild(div);
            });
            chatArea.scrollTop = chatArea.scrollHeight;
        });
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentUser) return;

    const data = {
        text: text,
        sender: 'user',
        sessionId: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    messageInput.value = '';
    db.collection('messages').add(data).catch(err => {
        console.error("Error sending message:", err);
    });
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendMessage();
});
