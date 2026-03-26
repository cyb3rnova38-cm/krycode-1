import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// UI Elements
const views = {
    home: document.getElementById('view-home'),
    pricing: document.getElementById('view-pricing'),
    blog: document.getElementById('view-blog'),
    about: document.getElementById('view-about'),
    careers: document.getElementById('view-careers'),
    contact: document.getElementById('view-contact'),
    press: document.getElementById('view-press'),
    login: document.getElementById('view-login'),
    signup: document.getElementById('view-signup'),
    promos: document.getElementById('view-promos'),
    privacy: document.getElementById('view-privacy'),
    terms: document.getElementById('view-terms')
};

const mobileMenu = document.getElementById('mobileMenu');
const mobileMenuIcon = document.getElementById('mobileMenuIcon');
const notificationPanel = document.getElementById('notificationPanel');
const userDropdown = document.getElementById('userDropdown');
const navAuthBtn = document.getElementById('nav-auth-btn');
const chatWidget = document.getElementById('chatWidget');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatToggle = document.getElementById('chatToggle');

let chatListener = null;

// Navigation
window.switchPage = function(pageId) {
    Object.keys(views).forEach(id => {
        if (views[id]) {
            if (id === pageId) {
                views[id].classList.remove('hidden');
                gsap.fromTo(views[id], { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 });
            } else {
                views[id].classList.add('hidden');
            }
        }
    });
    window.scrollTo(0, 0);
    if (pageId === 'home') loadPortfolio();
    if (pageId === 'blog') loadBlogs();
    if (pageId === 'promos') loadPromos();
};

window.toggleMobileMenu = function() {
    mobileMenu.classList.toggle('hidden');
    mobileMenuIcon.classList.toggle('fa-bars');
    mobileMenuIcon.classList.toggle('fa-times');
};

window.toggleNotifications = function() {
    notificationPanel.classList.toggle('hidden');
    if (!notificationPanel.classList.contains('hidden')) loadNotifications();
};

async function loadNotifications() {
    const list = document.getElementById('notificationList');
    if (!list) return;

    const snapshot = await db.collection('notifications').orderBy('timestamp', 'desc').limit(10).get();
    if (snapshot.empty) {
        list.innerHTML = `
            <div class="flex flex-col items-center justify-center py-8 text-slate-400">
                <i class="fa-solid fa-bell-slash text-2xl opacity-20 mb-2"></i>
                <p class="text-[10px] font-bold uppercase">No new alerts</p>
            </div>
        `;
        return;
    }

    list.innerHTML = snapshot.docs.map(doc => {
        const n = doc.data();
        return `
            <div class="flex gap-3 p-2 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group">
                <div class="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <i class="fa-solid ${n.icon || 'fa-bell'} text-xs"></i>
                </div>
                <div>
                    <p class="text-xs font-bold">${n.title}</p>
                    <p class="text-[10px] text-slate-500 line-clamp-2">${n.description}</p>
                </div>
            </div>
        `;
    }).join('');
}

window.handleChatClick = function() {
    const user = auth.currentUser;
    if (user) {
        chatWidget.classList.toggle('hidden');
        if (!chatWidget.classList.contains('hidden')) {
            chatToggle.style.opacity = '0';
            chatToggle.style.pointerEvents = 'none';
            loadChatMessages();
        } else {
            chatToggle.style.opacity = '1';
            chatToggle.style.pointerEvents = 'auto';
            if (chatListener) {
                chatListener(); // Unsubscribe when closed
                chatListener = null;
            }
        }
    } else {
        switchPage('login');
    }
};

function loadChatMessages() {
    const user = auth.currentUser;
    if (!user) return;

    if (chatListener) chatListener(); // Clear existing

    chatListener = db.collection('chats').doc(user.uid).collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                const m = change.doc.data();
                const id = change.doc.id;
                
                if (change.type === 'added' || change.type === 'modified') {
                    // Check if we have a local echo for this message
                    const localEcho = chatMessages.querySelector(`[data-client-id="${m.clientMsgId}"]`);
                    if (localEcho) {
                        localEcho.dataset.id = id;
                        localEcho.classList.remove('opacity-50');
                        localEcho.removeAttribute('data-client-id');
                    } else if (!chatMessages.querySelector(`[data-id="${id}"]`)) {
                        const isMe = m.sender === 'user';
                        const div = document.createElement('div');
                        div.dataset.id = id;
                        div.className = `chat-bubble ${isMe ? 'me' : 'them'}`;
                        div.innerHTML = `<p>${m.text}</p>`;
                        chatMessages.appendChild(div);
                    }
                }
            });
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
}

function sendChatMessage() {
    const text = chatInput.value.trim();
    const user = auth.currentUser;
    if (!text || !user) return;

    const clientMsgId = 'msg-' + Date.now();
    
    // Local Echo: Show the message immediately
    const div = document.createElement('div');
    div.dataset.clientId = clientMsgId;
    div.className = `chat-bubble me opacity-50`; // Dimmed to indicate sending
    div.innerHTML = `<p>${text}</p>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const timestamp = firebase.firestore.FieldValue.serverTimestamp();
    const data = {
        text: text,
        sender: 'user',
        clientMsgId: clientMsgId,
        timestamp: timestamp
    };

    chatInput.value = '';
    
    const batch = db.batch();
    const chatRef = db.collection('chats').doc(user.uid);
    const msgRef = chatRef.collection('messages').doc();

    batch.set(chatRef, {
        lastMessage: text,
        lastTimestamp: timestamp,
        userName: user.displayName || user.email.split('@')[0],
        userId: user.uid
    }, { merge: true });

    batch.set(msgRef, data);

    batch.commit().catch(err => {
        console.error("Error sending message:", err);
        div.classList.add('bg-red-500');
        div.innerHTML = `<p>${text} (Failed to send)</p>`;
    });
}

chatSendBtn?.addEventListener('click', sendChatMessage);
chatInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendChatMessage();
});

window.logout = function() {
    auth.signOut().then(() => {
        location.reload();
    });
};

// Auth Observer
auth.onAuthStateChanged(user => {
    if (user) {
        const initial = (user.displayName || user.email).charAt(0).toUpperCase();
        navAuthBtn.innerHTML = `<span class="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-full font-bold">${initial}</span>`;
        navAuthBtn.classList.remove('px-5', 'py-2.5', 'bg-black');
        navAuthBtn.classList.add('p-0', 'bg-transparent');
        navAuthBtn.onclick = () => userDropdown.classList.toggle('hidden');
        document.getElementById('mobile-auth-btn').textContent = 'Account';
        document.getElementById('promoGate').classList.add('hidden');
    } else {
        navAuthBtn.innerHTML = 'Get Started';
        navAuthBtn.classList.remove('p-0', 'bg-transparent');
        navAuthBtn.classList.add('px-5', 'py-2.5', 'bg-black');
        navAuthBtn.onclick = () => switchPage('login');
        document.getElementById('mobile-auth-btn').textContent = 'Get Started';
        document.getElementById('promoGate').classList.remove('hidden');
        
        // Clear and hide chat if logged out
        chatWidget?.classList.add('hidden');
        if (chatMessages) chatMessages.innerHTML = '';
        if (chatListener) {
            chatListener();
            chatListener = null;
        }
    }
});

// Forms
document.getElementById('loginForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    const errorMsg = document.getElementById('loginErrorMessage');
    const submitBtn = document.getElementById('loginSubmitBtn');
    const originalText = submitBtn.innerHTML;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Processing...</span>';

    auth.signInWithEmailAndPassword(email, pass)
        .then(cred => {
            // Ensure user document exists (in case it wasn't created during signup)
            const userRef = db.collection('users').doc(cred.user.uid);
            return userRef.get().then(doc => {
                if (!doc.exists) {
                    return userRef.set({
                        name: cred.user.displayName || email.split('@')[0],
                        email: email,
                        role: 'user',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            });
        })
        .then(() => switchPage('home'))
        .catch(err => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            errorMsg.textContent = err.message;
            errorMsg.classList.remove('hidden');
        });
});

document.getElementById('signupForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const pass = document.getElementById('signupPassword').value;
    const errorMsg = document.getElementById('signupErrorMessage');
    const submitBtn = document.getElementById('signupSubmitBtn');
    const originalText = submitBtn.innerHTML;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Processing...</span>';

    auth.createUserWithEmailAndPassword(email, pass)
        .then(cred => {
            // Create user document
            return db.collection('users').doc(cred.user.uid).set({
                name: name,
                email: email,
                role: 'user', // Default role
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => cred.user.updateProfile({ displayName: name }));
        })
        .then(() => switchPage('home'))
        .catch(err => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            errorMsg.textContent = err.message;
            errorMsg.classList.remove('hidden');
        });
});

// Form Validation Helpers
function validateEmail(email) {
    return String(email)
        .toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );
}

function setInputStatus(input, isValid) {
    if (isValid) {
        input.classList.remove('border-red-500', 'ring-red-500');
        input.classList.add('border-green-500', 'ring-green-500');
    } else {
        input.classList.remove('border-green-500', 'ring-green-500');
        input.classList.add('border-red-500', 'ring-red-500');
    }
}

// Real-time Contact Form Validation
const contactEmailInput = document.getElementById('contactEmail');
contactEmailInput?.addEventListener('input', (e) => {
    setInputStatus(e.target, validateEmail(e.target.value));
});

const contactNameInput = document.getElementById('contactName');
contactNameInput?.addEventListener('input', (e) => {
    setInputStatus(e.target, e.target.value.length >= 2);
});

document.getElementById('contactForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const submitBtn = document.getElementById('contactSubmitBtn');
    const successMsg = document.getElementById('contactSuccess');
    
    const email = document.getElementById('contactEmail').value;
    const name = document.getElementById('contactName').value;

    if (!validateEmail(email) || name.length < 2) {
        alert("Please provide a valid name and email address.");
        return;
    }

    const data = {
        name: name,
        email: email,
        subject: document.getElementById('contactSubject').value,
        message: document.getElementById('contactMessage').value,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    submitBtn.disabled = true;
    const originalContent = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>Sending...</span>';

    db.collection('inquiries').add(data).then(() => {
        successMsg.classList.remove('hidden');
        e.target.reset();
        // Reset validation styles
        [contactEmailInput, contactNameInput].forEach(input => {
            input.classList.remove('border-green-500', 'ring-green-500', 'border-red-500', 'ring-red-500');
        });
        setTimeout(() => successMsg.classList.add('hidden'), 5000);
    }).catch(err => {
        console.error("Error sending inquiry:", err);
        alert("Failed to send message. Please try again or use live chat.");
    }).finally(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalContent;
    });
});

document.getElementById('newsletterForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const email = e.target.querySelector('input').value;
    const submitBtn = document.getElementById('newsletterSubmitBtn');
    const successMsg = document.getElementById('newsletterSuccess');

    submitBtn.disabled = true;
    db.collection('newsletter').add({
        email: email,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        successMsg.classList.remove('hidden');
        e.target.reset();
        setTimeout(() => successMsg.classList.add('hidden'), 5000);
    }).finally(() => {
        submitBtn.disabled = false;
    });
});

// Data Loading
async function loadPortfolio() {
    const grid = document.getElementById('portfolioGrid');
    if (!grid) return;
    
    const snapshot = await db.collection('portfolios').orderBy('timestamp', 'desc').limit(6).get();
    grid.innerHTML = snapshot.docs.map(doc => {
        const p = doc.data();
        return `
            <div class="group glass rounded-[40px] overflow-hidden border-white/5 hover:border-indigo-500/30 transition-all hover:bg-white/10 cursor-pointer" onclick="window.open('${p.url}', '_blank')">
                <div class="aspect-video overflow-hidden">
                    <img src="${p.image || 'https://via.placeholder.com/800x450'}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">
                </div>
                <div class="p-8">
                    <h3 class="text-xl font-bold mb-2">${p.title}</h3>
                    <p class="text-slate-600 text-sm line-clamp-2">${p.description}</p>
                </div>
            </div>
        `;
    }).join('');
}

async function loadBlogs() {
    const grid = document.getElementById('blogGrid');
    if (!grid) return;
    
    const snapshot = await db.collection('blogs').orderBy('timestamp', 'desc').limit(9).get();
    grid.innerHTML = snapshot.docs.map(doc => {
        const b = doc.data();
        return `
            <article class="group cursor-pointer">
                <div class="aspect-[16/10] rounded-[32px] overflow-hidden mb-6">
                    <img src="${b.image || 'https://via.placeholder.com/800x500'}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                </div>
                <div class="space-y-3">
                    <div class="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-indigo-600">
                        <span>${b.category || 'Engineering'}</span>
                        <span class="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span class="text-slate-400">${b.date || 'Recently'}</span>
                    </div>
                    <h3 class="text-2xl font-bold group-hover:text-indigo-600 transition-colors">${b.title}</h3>
                    <p class="text-slate-500 text-sm line-clamp-2">${b.blurb}</p>
                </div>
            </article>
        `;
    }).join('');
}

async function loadPromos() {
    const grid = document.getElementById('promoGrid');
    if (!grid) return;
    
    const snapshot = await db.collection('promos').orderBy('timestamp', 'desc').get();
    grid.innerHTML = snapshot.docs.map(doc => {
        const p = doc.data();
        return `
            <div class="glass p-8 rounded-[40px] border-white hover:scale-[1.02] transition-transform">
                <div class="mb-6">
                    <span class="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest">${p.tag || 'Special'}</span>
                </div>
                <h3 class="text-2xl font-bold mb-2">${p.title}</h3>
                <p class="text-slate-500 text-sm mb-6">${p.blurb}</p>
                <div class="flex items-end gap-1 mb-8">
                    <span class="text-4xl font-black">$${p.price}</span>
                    <span class="text-slate-400 text-sm pb-1">/one-time</span>
                </div>
                <button class="w-full py-4 rounded-2xl bg-black text-white font-bold hover:bg-indigo-600 transition-colors">Claim Offer</button>
            </div>
        `;
    }).join('');
}

// Estimator
document.getElementById('estimatorGo')?.addEventListener('click', () => {
    const input = document.getElementById('estimatorInput').value;
    const result = document.getElementById('estimateResult');
    const summary = document.getElementById('estimateSummary');
    const breakdown = document.getElementById('estimateBreakdown');
    
    if (!input || input.length < 5) {
        summary.textContent = "Please provide more detail for an accurate analysis.";
        breakdown.textContent = "Describe your project goal (e.g., 'Web app for e-commerce').";
        result.classList.remove('hidden');
        return;
    }

    result.classList.remove('hidden');
    summary.innerHTML = `<div class="flex items-center gap-2"><i class="fa-solid fa-spinner animate-spin text-indigo-600"></i> <span>Analyzing architecture requirements...</span></div>`;
    breakdown.textContent = "";
    
    // Check if user is logged in
    const user = auth.currentUser;
    
    setTimeout(() => {
        let min = 2500;
        let max = 5000;
        let timeline = "4 weeks";
        
        const lowerInput = input.toLowerCase();
        if (lowerInput.includes('e-commerce') || lowerInput.includes('shop') || lowerInput.includes('store')) {
            min = 8000; max = 15000; timeline = "8-12 weeks";
        } else if (lowerInput.includes('dashboard') || lowerInput.includes('complex') || lowerInput.includes('saas')) {
            min = 12000; max = 25000; timeline = "12-16 weeks";
        } else if (lowerInput.includes('simple') || lowerInput.includes('landing') || lowerInput.includes('portfolio')) {
            min = 1500; max = 3000; timeline = "2 weeks";
        } else if (lowerInput.includes('management') || lowerInput.includes('infrastructure') || lowerInput.includes('cloud')) {
            min = 5000; max = 12000; timeline = "6-8 weeks";
        }

        summary.innerHTML = `<span class="text-indigo-600">Estimated Investment: $${min.toLocaleString()} - $${max.toLocaleString()}</span>`;
        breakdown.innerHTML = `
            <p class="mb-2"><strong>Timeline:</strong> ${timeline}</p>
            <p>Our analysis suggests a <strong>${timeline.split(' ')[0]} phase</strong> focusing on high-performance architecture, custom UI/UX, and secure data handling. This includes full deployment and 30 days of post-launch support.</p>
        `;

        // Lead capture or chat trigger
        if (!user) {
            breakdown.innerHTML += `
                <div class="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                    <p class="text-xs text-indigo-700 font-bold mb-2 uppercase tracking-widest">Next Step</p>
                    <p class="text-sm text-slate-600 mb-3">Sign in to save this estimate and chat with an engineer about your project.</p>
                    <button onclick="switchPage('login')" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors">Sign In to Continue</button>
                </div>
            `;
        }

        // Store the estimate in Firestore if user is logged in
        if (user) {
            db.collection('estimates').add({
                userId: user.uid,
                userName: user.displayName || user.email,
                input: input,
                minEstimate: min,
                maxEstimate: max,
                timeline: timeline,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(err => console.error("Error saving estimate:", err));
        }

        gsap.from(result, { opacity: 0, y: 10, duration: 0.3 });
    }, 1500);
});

document.getElementById('estimateChat')?.addEventListener('click', () => {
    handleChatClick();
    const input = document.getElementById('estimatorInput').value;
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.value = `Hi! I just ran an estimate for: "${input}". I'd like to discuss the details.`;
        chatInput.focus();
    }
});

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    loadPortfolio();
    
    // Initial animations
    gsap.from(".glow-text", { opacity: 0, y: 30, duration: 1, stagger: 0.2, ease: "expo.out" });
});

// Global Click-to-Close listener
document.addEventListener('click', (e) => {
    // 1. Notification Panel
    if (notificationPanel && !notificationPanel.classList.contains('hidden')) {
        const toggle = document.getElementById('notificationToggle');
        if (toggle && !notificationPanel.contains(e.target) && !toggle.contains(e.target)) {
            notificationPanel.classList.add('hidden');
        }
    }

    // 2. User Dropdown
    if (userDropdown && !userDropdown.classList.contains('hidden')) {
        if (navAuthBtn && !userDropdown.contains(e.target) && !navAuthBtn.contains(e.target)) {
            userDropdown.classList.add('hidden');
        }
    }

    // 3. Chat Widget
    if (chatWidget && !chatWidget.classList.contains('hidden')) {
        // If the click is NOT inside the chat widget AND NOT on a chat trigger button
        if (!chatWidget.contains(e.target) && !e.target.closest('.chat-trigger')) {
            window.handleChatClick();
        }
    }
});