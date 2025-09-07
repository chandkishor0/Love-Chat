// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyCoj43k4CKACbm2zW-sFYwDcaDSbrXDgK0",
  authDomain: "love-chat-9ebf1.firebaseapp.com",
  databaseURL: "https://love-chat-9ebf1-default-rtdb.firebaseio.com",
  projectId: "love-chat-9ebf1",
  storageBucket: "love-chat-9ebf1.firebasestorage.app",
  messagingSenderId: "401778706290",
  appId: "1:401778706290:web:5ea399dfe242582a24ffeb",
  measurementId: "G-CL9HTNQ2M8"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// --- Variables ---
const sanitizeEmail = email => email.replace(/\./g, ',');
let currentUser = null, partnerUser = null, chatId = null, currentTheme = 'theme-pink';
let mySecretCode = null;

// --- Signup / Login ---
function signup() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  if (!email || !password) return alert("Enter email & password");

  auth.createUserWithEmailAndPassword(email, password)
    .then(() => {
      currentUser = email;
      const userRef = db.ref('users/' + sanitizeEmail(currentUser));

      userRef.once('value').then(snapshot => {
        if (snapshot.exists() && snapshot.val().secretCode) {
          mySecretCode = snapshot.val().secretCode; // use existing
        } else {
          mySecretCode = Math.floor(100000 + Math.random() * 900000).toString(); // generate new
          userRef.update({ secretCode: mySecretCode });
        }
        document.getElementById("mySecretCode").innerText = mySecretCode;
        showPartnerBox();
      });
    })
    .catch(err => document.getElementById("authMsg").innerText = err.message);
}

function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  if (!email || !password) return alert("Enter email & password");

  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      currentUser = email;
      const userRef = db.ref('users/' + sanitizeEmail(currentUser));

      userRef.once('value').then(snapshot => {
        if (snapshot.exists() && snapshot.val().secretCode) {
          mySecretCode = snapshot.val().secretCode; // use existing
        } else {
          mySecretCode = Math.floor(100000 + Math.random() * 900000).toString(); // generate new
          userRef.update({ secretCode: mySecretCode });
        }
        document.getElementById("mySecretCode").innerText = mySecretCode;
        showPartnerBox();
      });
    })
    .catch(err => document.getElementById("authMsg").innerText = err.message);
}

// --- Show Partner Entry Box ---
function showPartnerBox() {
  document.getElementById("authBox").style.display = "none";
  document.getElementById("partnerBox").style.display = "block";
}

// --- Partner Setup ---
function setPartner() {
  partnerUser = document.getElementById("partnerEmail").value.trim();
  const partnerCode = document.getElementById("partnerSecretCode").value.trim();
  if (!partnerUser || !partnerCode) return alert("Enter partner email & secret code");

  chatId = [sanitizeEmail(currentUser), sanitizeEmail(partnerUser)].sort().join("_");
  const chatRef = db.ref('chats/' + chatId);

  db.ref('users/' + sanitizeEmail(partnerUser) + '/secretCode').once('value')
    .then(snapshot => {
      const partnerSecret = snapshot.exists() ? snapshot.val() : partnerCode;

      chatRef.once('value').then(snap => {
        if (snap.exists()) {
          const storedCodes = snap.val().partnerCodes || {};
          if (storedCodes[sanitizeEmail(partnerUser)] !== partnerSecret) {
            return alert("Partner secret code incorrect!");
          }
        } else {
          const codesObj = {};
          codesObj[sanitizeEmail(currentUser)] = mySecretCode;
          codesObj[sanitizeEmail(partnerUser)] = partnerSecret;
          chatRef.set({ partnerCodes: codesObj });
        }
        startChatUI();
      });
    });
}

// --- Start Chat UI ---
function startChatUI() {
  document.getElementById("partnerBox").style.display = "none";
  document.getElementById("chatBoxContainer").style.display = "block";
  document.getElementById("partnerName").innerText = partnerUser;
  document.getElementById("codeDisplay").innerText = "Chat secured with secret codes";
  loadMessages();
  listenTyping();
}

// --- Send Message ---
function sendMessage() {
  const msg = document.getElementById("messageInput").value.trim();
  if (!msg) return;
  const key = db.ref('messages/' + chatId).push().key;

  db.ref('messages/' + chatId + '/messages/' + key).set({
    from: sanitizeEmail(currentUser),
    type: "text",
    content: msg,
    timestamp: Date.now(),
    delivered: false,
    read: false
  }).then(() => {
    document.getElementById("messageInput").value = "";
    createHeart();
  });
}

// --- Load Messages ---
function loadMessages() {
  const chatBox = document.getElementById("chatBox");
  db.ref('messages/' + chatId + '/messages').on('value', snap => {
    chatBox.innerHTML = "";
    const data = snap.val();
    if (!data) return;

    Object.keys(data).forEach(id => {
      const msg = data[id];
      const userClass = msg.from === sanitizeEmail(currentUser) ? "you" : "partner";

      if (msg.from !== sanitizeEmail(currentUser)) {
        if (!msg.delivered) db.ref('messages/' + chatId + '/messages/' + id + '/delivered').set(true);
        if (!msg.read) db.ref('messages/' + chatId + '/messages/' + id + '/read').set(true);
      }

      let contentHtml = msg.content;
      if (msg.from === sanitizeEmail(currentUser)) {
        contentHtml += `<span onclick="deleteMessage('${id}')" style="margin-left:5px; cursor:pointer;">🗑️</span>`;
      }

      let tickHtml = msg.from === sanitizeEmail(currentUser) ? (msg.read ? "✓✓" : msg.delivered ? "✓✓" : "✓") : "";
      contentHtml += `<span style="float:right;margin-left:5px;">${tickHtml}</span>`;

      chatBox.innerHTML += `<div class="msg ${userClass}" id="msg-${id}">${contentHtml}</div>`;
    });

    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

// --- Delete Message ---
function deleteMessage(msgId) {
  if (confirm("Delete this message?")) {
    db.ref('messages/' + chatId + '/messages/' + msgId).remove();
  }
}

// --- Typing Indicator ---
function listenTyping() {
  document.getElementById("messageInput").addEventListener("input", () => {
    db.ref('typing/' + chatId + '/' + sanitizeEmail(currentUser)).set({ typing: document.getElementById("messageInput").value.length > 0 });
  });

  db.ref('typing/' + chatId).on('value', snap => {
    const data = snap.val() || {};
    const partnerKey = sanitizeEmail(partnerUser);
    if (data[partnerKey] && data[partnerKey].typing) {
      document.getElementById("typingIndicator").innerHTML = "Partner is typing<span class='dot'>.</span><span class='dot'>.</span><span class='dot'>.</span>";
    } else {
      document.getElementById("typingIndicator").innerHTML = "";
    }
  });
}

// --- Floating Hearts ---
function createHeart() {
  const heart = document.createElement("div");
  heart.className = "heart";
  heart.style.left = Math.random() * 90 + "vw";
  heart.style.animationDuration = 2 + Math.random() * 3 + "s";
  document.body.appendChild(heart);
  setTimeout(() => document.body.removeChild(heart), 4000);
}

setInterval(() => {
  const heart = document.createElement("div");
  heart.className = "heart";
  heart.style.left = Math.random() * 100 + "vw";
  heart.style.width = 10 + Math.random() * 20 + "px";
  heart.style.height = heart.style.width;
  heart.style.animationDuration = 4 + Math.random() * 4 + "s";
  document.body.appendChild(heart);
  setTimeout(() => document.body.removeChild(heart), 6000);
}, 2000);

// --- Theme Toggle ---
function toggleTheme() {
  if (currentTheme === 'theme-pink') { document.body.className = 'theme-night'; currentTheme = 'theme-night'; }
  else if (currentTheme === 'theme-night') { document.body.className = 'theme-purple'; currentTheme = 'theme-purple'; }
  else { document.body.className = 'theme-pink'; currentTheme = 'theme-pink'; }
}