import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBukN8wDNA0KKFFlU5L-hKkYVbdMUa3hdc",
    authDomain: "attendence-3c92a.firebaseapp.com",
    projectId: "attendence-3c92a",
    storageBucket: "attendence-3c92a.firebasestorage.app",
    messagingSenderId: "256631640444",
    appId: "1:256631640444:web:a1d8170ea6934bfe6d14f9",
    measurementId: "G-DTV1VPV163"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// GLOBAL STATE
let globalSubjects = [];

// Make global for inline onclicks
window.updateAttendance = updateAttendance;
window.fillAdminForm = fillAdminForm;
window.deleteSubject = deleteSubject;
window.deleteStudent = deleteStudent;
window.cloneStudentData = cloneStudentData;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Attach Event Listeners
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('register-btn').addEventListener('click', handleRegister);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // Admin Buttons (may be hidden initially)
    const adminBtn = document.getElementById('admin-btn');
    if(adminBtn) adminBtn.addEventListener('click', showAdminPanel);

    const showStudentBtn = document.getElementById('show-student-view-btn');
    if(showStudentBtn) showStudentBtn.addEventListener('click', showStudentView);

    const addSubBtn = document.getElementById('add-subject-btn');
    if(addSubBtn) addSubBtn.addEventListener('click', addSubject);

    const saveDataBtn = document.getElementById('save-data-btn');
    if(saveDataBtn) saveDataBtn.addEventListener('click', saveStudentData);
});

// --- AUTHENTICATION ---
onAuthStateChanged(auth, (user) => {
    const loginView = document.getElementById('login-view');
    const appView = document.getElementById('app-view');
    
    if (user) {
        loginView.classList.add('hidden');
        appView.classList.remove('hidden');
        initAppData(user.email);
    } else {
        loginView.classList.remove('hidden');
        appView.classList.add('hidden');
    }
});

async function handleLogin() {
    const userIn = document.getElementById('username-in').value.trim();
    const passIn = document.getElementById('pass-in').value;
    const err = document.getElementById('login-error');

    if (!userIn || !passIn) {
        err.textContent = "Enter username and password.";
        err.classList.remove('hidden');
        return;
    }

    const email = userIn + "@uni.com";
    err.textContent = "Logging in...";
    err.classList.remove('hidden');

    try {
        await signInWithEmailAndPassword(auth, email, passIn);
        err.classList.add('hidden');
    } catch (e) {
        err.textContent = "Login Failed: " + e.message;
    }
}

async function handleRegister() {
    const fullNameIn = document.getElementById('fullname-in').value.trim();
    const userIn = document.getElementById('username-in').value.trim();
    const passIn = document.getElementById('pass-in').value;
    const err = document.getElementById('login-error');

    if (!userIn || !passIn) {
        err.textContent = "Enter a username and password to register.";
        err.classList.remove('hidden');
        return;
    }

    const email = userIn + "@uni.com";
    err.textContent = "Creating account...";
    err.classList.remove('hidden');

    try {
        // 1. Create Auth User
        await createUserWithEmailAndPassword(auth, email, passIn);
        
        // 2. Set/Update User Data
        // We use merge: true so we don't wipe out subjects if Admin pre-added them.
        const docRef = doc(db, "attendance", email);
        const displayName = fullNameIn || userIn; // Use Full Name if provided

        await setDoc(docRef, {
            name: displayName
        }, { merge: true });

        // Ensure subjects array exists if it's a brand new doc
        const snap = await getDoc(docRef);
        if (snap.exists() && !snap.data().subjects) {
            await setDoc(docRef, { subjects: [] }, { merge: true });
        }

        err.textContent = "Success! Logging in...";
        // Reload to ensure UI picks up the correct name (avoid race condition with initAppData)
        location.reload(); 
    } catch (e) {
        if(e.code === 'auth/email-already-in-use') {
            err.textContent = "Username '" + userIn + "' is already taken.";
        } else {
            err.textContent = "Register Failed: " + e.message;
        }
    }
}

function handleLogout() {
    signOut(auth).then(() => location.reload());
}

// --- DATA LOADING ---
async function initAppData(email) {
    // 1. Load Global Subjects
    await loadGlobalSubjects();

    // 2. Ensure User Document Exists (Auto-Create)
    const docRef = doc(db, "attendance", email);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
        await setDoc(docRef, {
            name: email.split('@')[0], // Default name
            subjects: []
        });
    }

    // 3. Load Student Data
    await loadStudentData(email);

    // 4. Check Admin
    if (email === "tharusha@uni.com") {
        document.getElementById('admin-btn').classList.remove('hidden');
        loadAllStudentsList();
        renderAdminSubjects();
        renderAdminStudentInputs();
    }
}

async function loadGlobalSubjects() {
    try {
        const snap = await getDoc(doc(db, "settings", "subjects"));
        if (snap.exists()) {
            globalSubjects = snap.data().list || [];
        } else {
            // Default Init
            globalSubjects = [{name:"OS"}, {name:"CAL"}, {name:"AOOP"}, {name:"SDI"}];
            await setDoc(doc(db, "settings", "subjects"), { list: globalSubjects });
        }
    } catch (e) {
        console.error("Subject Load Error", e);
    }
}

// --- STUDENT UI ---
async function loadStudentData(email) {
    // 1. Ensure Global Subjects are loaded
    if (globalSubjects.length === 0) {
        await loadGlobalSubjects();
    }

    const snap = await getDoc(doc(db, "attendance", email));
    
    let sName = email.split('@')[0];
    let sSubjects = [];

    if (snap.exists()) {
        sName = snap.data().name;
        sSubjects = snap.data().subjects || [];
    }

    document.getElementById('user-name').textContent = `Hello, ${sName}`;
    
    // Set Date Picker to Today (Colombo Time)
    const dateInput = document.getElementById('attendance-date');
    if (!dateInput.value) {
        try {
            // Force Sri Lanka Timezone: YYYY-MM-DD
            dateInput.value = new Intl.DateTimeFormat('en-CA', { 
                timeZone: 'Asia/Colombo',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(new Date());
        } catch (e) {
            // Fallback to local
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            dateInput.value = `${year}-${month}-${day}`;
        }
    }

    const container = document.getElementById('subjects-container');
    container.innerHTML = '';

    let totalPercent = 0;
    let validCount = 0;

    // 2. Iterate over GLOBAL subjects (so everyone sees the same list)
    globalSubjects.forEach(sub => {
        // Find if student has personal data for this subject
        const mySub = sSubjects.find(s => s.name === sub.name);
        
        // Default to 0 if not found
        const attended = mySub ? (parseInt(mySub.attended) || 0) : 0;
        const total = mySub ? (parseInt(mySub.total) || 0) : 0;
        
        let pct = (total > 0) ? Math.round((attended / total) * 100) : 0;
        const color = pct < 80 ? "text-red-600" : "text-green-600";
        const border = pct < 80 ? "border-red-200" : "border-blue-100";

        // If total is 0, show a neutral state
        const pctDisplay = (total === 0) ? "No Classes" : `${pct}%`;
        const pctColor = (total === 0) ? "text-gray-400" : color;

        // Generate History HTML & Check Cooldown
        let historyHTML = '';
        let isOnCooldown = false;
        let timeLeft = '';

        if (mySub && mySub.history && mySub.history.length > 0) {
            // Check Cooldown
            const lastEntry = mySub.history[mySub.history.length - 1];
            const lastDate = new Date(lastEntry.timestamp);
            const now = new Date();
            const diffHours = (now - lastDate) / (1000 * 60 * 60);

            if (diffHours < 24) {
                isOnCooldown = true;
                const hoursRemaining = Math.ceil(24 - diffHours);
                timeLeft = `${hoursRemaining}h wait`;
            }

            // Show last 5 entries
            const reversed = [...mySub.history].reverse().slice(0, 5);
            reversed.forEach(h => {
                const badgeColor = h.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
                historyHTML += `
                    <div class="flex justify-between text-xs mb-1">
                        <span class="text-gray-500">${h.displayDate || h.timestamp.split('T')[0]}</span>
                        <span class="${badgeColor} px-1 rounded uppercase font-bold text-[10px]">${h.status}</span>
                    </div>
                `;
            });
        } else {
            historyHTML = '<p class="text-xs text-gray-400 italic">No history yet.</p>';
        }

        // Button Styles based on Cooldown
        const btnState = isOnCooldown ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600 shadow-sm';
        const missState = isOnCooldown ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-200';
        const disabledAttr = isOnCooldown ? 'disabled' : '';
        const cooldownMsg = isOnCooldown ? `<span class="text-xs text-orange-500 font-bold ml-2">(${timeLeft})</span>` : '';

        container.innerHTML += `
            <div class="p-5 rounded-xl border ${border} bg-white shadow-sm flex flex-col justify-between h-full">
                <div>
                    <div class="flex justify-between mb-2">
                        <h4 class="font-bold text-gray-700 text-lg flex items-center">
                            ${sub.name} 
                            ${cooldownMsg}
                        </h4>
                        <span class="text-xs font-bold px-2 py-1 rounded bg-gray-100 text-gray-500">${attended} / ${total}</span>
                    </div>
                    <div class="text-4xl font-bold ${pctColor} mb-4">${pctDisplay}</div>
                    
                    <!-- HISTORY SECTION -->
                    <div class="mb-4 border-t pt-2">
                        <p class="text-xs font-bold text-gray-400 mb-1">RECENT ACTIVITY</p>
                        <div class="space-y-1">
                            ${historyHTML}
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2 mt-auto">
                    <button onclick="updateAttendance('${email}', '${sub.name}', 'present')" ${disabledAttr} class="bg-green-500 text-white py-2 rounded-lg font-bold transition ${btnState}">Present</button>
                    <button onclick="updateAttendance('${email}', '${sub.name}', 'absent')" ${disabledAttr} class="bg-red-100 text-red-500 py-2 rounded-lg font-bold transition ${missState}">Missed</button>
                </div>
            </div>
        `;

        if (total > 0) {
            totalPercent += pct;
            validCount++;
        }
    });

    const overall = validCount > 0 ? Math.round(totalPercent / validCount) : 0;
    
    // UPDATE CHART TEXT
    const ovEl = document.getElementById('overall-percent');
    ovEl.textContent = overall + "%";
    
    // UPDATE CHART RING (CSS Conic Gradient)
    const ring = document.getElementById('chart-ring');
    const color = overall < 80 ? '#f87171' : '#4ade80'; // Red if low, Green if good
    const emptyColor = '#ffffff33';
    
    // Example: conic-gradient(green 0% 80%, white 80% 100%)
    ring.style.background = `conic-gradient(${color} 0% ${overall}%, ${emptyColor} ${overall}% 100%)`;
}

async function updateAttendance(email, subName, status) {
    const isPresent = (status === 'present');
    
    // Get Selected Date
    const dateInput = document.getElementById('attendance-date');
    const selectedDateStr = dateInput.value; // YYYY-MM-DD
    if (!selectedDateStr) {
        alert("Please select a date.");
        return;
    }
    const selectedDate = new Date(selectedDateStr);

    if (!confirm(`Mark ${subName} as ${status.toUpperCase()} for ${selectedDateStr}?`)) return;

    const docRef = doc(db, "attendance", email);
    const snap = await getDoc(docRef);
    let data = { name: email.split('@')[0], subjects: [] };
    if (snap.exists()) data = snap.data();

    let idx = data.subjects.findIndex(s => s.name === subName);
    
    // Create subject if new
    if (idx === -1) {
        data.subjects.push({ 
            name: subName, 
            attended: 0, 
            total: 0,
            history: []
        });
        idx = data.subjects.length - 1;
    }

    const subject = data.subjects[idx];

    // 1. CHECK FOR DUPLICATE ENTRY ON THIS DATE
    if (subject.history && subject.history.length > 0) {
        // Check if any entry matches the selected date (YYYY-MM-DD)
        const alreadyMarked = subject.history.some(h => {
            // Compare just the date part strings
            const hDate = h.timestamp.split('T')[0]; 
            return hDate === selectedDateStr;
        });

        if (alreadyMarked) {
            alert(`You already marked attendance for ${subName} on ${selectedDateStr}.`);
            return;
        }
    }

    // 2. UPDATE COUNTS
    subject.total = (parseInt(subject.total) || 0) + 1;
    if (isPresent) {
        subject.attended = (parseInt(subject.attended) || 0) + 1;
    }

    // 3. ADD TO HISTORY (Sort by date later if needed, but append is fine)
    if (!subject.history) subject.history = [];
    subject.history.push({
        status: status,
        timestamp: selectedDate.toISOString(), // Save Full ISO
        displayDate: selectedDateStr // Simple YYYY-MM-DD for display
    });
    
    // Optional: Sort history by date so the list looks right
    subject.history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    await setDoc(docRef, data);
    loadStudentData(email); // Refresh UI
}

// --- ADMIN UI ---
function showAdminPanel() {
    document.getElementById('student-dashboard').classList.add('hidden');
    document.getElementById('admin-dashboard').classList.remove('hidden');
}
function showStudentView() {
    document.getElementById('admin-dashboard').classList.add('hidden');
    document.getElementById('student-dashboard').classList.remove('hidden');
}

// 1. Manage Subjects
function renderAdminSubjects() {
    const box = document.getElementById('admin-subjects-list');
    box.innerHTML = '';
    globalSubjects.forEach(s => {
        box.innerHTML += `
            <span class="bg-blue-50 text-blue-800 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 border border-blue-200">
                ${s.name} <button onclick="deleteSubject('${s.name}')" class="text-red-500 ml-1">x</button>
            </span>
        `;
    });
}
async function addSubject() {
    const input = document.getElementById('new-subject-name');
    const val = input.value.trim();
    if(!val) {
        alert("Please enter a subject name.");
        return;
    }
    
    // Check for duplicate
    if (globalSubjects.some(s => s.name.toLowerCase() === val.toLowerCase())) {
        alert("Subject already exists!");
        return;
    }

    try {
        // Fetch latest list first to be safe
        const snap = await getDoc(doc(db, "settings", "subjects"));
        let currentList = [];
        if(snap.exists()) currentList = snap.data().list || [];

        currentList.push({name: val});
        
        await setDoc(doc(db, "settings", "subjects"), { list: currentList });
        
        // Update local state
        globalSubjects = currentList;
        
        input.value = '';
        renderAdminSubjects();
        renderAdminStudentInputs();
        alert(`Added subject: ${val}`);
    } catch (e) {
        alert("Error adding subject: " + e.message);
    }
}
async function deleteSubject(name) {
    if(!confirm("Delete " + name + "?")) return;
    globalSubjects = globalSubjects.filter(s => s.name !== name);
    await setDoc(doc(db, "settings", "subjects"), { list: globalSubjects });
    renderAdminSubjects();
    renderAdminStudentInputs();
}

// 2. Edit Student Inputs
function renderAdminStudentInputs() {
    const box = document.getElementById('dynamic-subject-inputs');
    box.innerHTML = '';
    globalSubjects.forEach(s => {
        const safe = s.name.replace(/\s+/g, '-');
        box.innerHTML += `
            <div class="bg-gray-50 p-2 rounded border">
                <label class="block text-xs font-bold text-gray-500 mb-1">${s.name}</label>
                <div class="flex gap-2">
                    <input id="att-${safe}" type="number" placeholder="Att" class="w-1/2 p-1 border rounded text-sm">
                    <input id="tot-${safe}" type="number" placeholder="Tot" class="w-1/2 p-1 border rounded text-sm">
                </div>
            </div>
        `;
    });
}

async function saveStudentData() {
    const user = document.getElementById('admin-username-input').value;
    const name = document.getElementById('admin-name').value;
    if(!user || !name) { alert("Enter username & name"); return; }

    const email = user + "@uni.com";
    const docRef = doc(db, "attendance", email);

    // Fetch existing data to preserve history
    let existingSubjects = [];
    try {
        const snap = await getDoc(docRef);
        if(snap.exists()) {
            existingSubjects = snap.data().subjects || [];
        }
    } catch(e) {
        console.error("Error fetching existing data", e);
    }

    const subs = globalSubjects.map(s => {
        const safe = s.name.replace(/\s+/g, '-');
        const att = document.getElementById('att-'+safe).value;
        const tot = document.getElementById('tot-'+safe).value;
        
        // Find existing history for this subject
        const existingSub = existingSubjects.find(ex => ex.name === s.name);
        let savedHistory = existingSub ? (existingSub.history || []) : [];

        // RULE: If Admin reduces Total, TRIM the history to match.
        // If Total is 0, history becomes empty.
        // If Total is 1, keep the first 1 entry, etc.
        const newTotal = tot ? parseInt(tot) : 0;
        
        if (savedHistory.length > newTotal) {
            // Keep the oldest entries, remove the newest ones
            // (assuming history is stored in chronological order of creation)
            savedHistory = savedHistory.slice(0, newTotal);
        }

        return {
            name: s.name,
            attended: att ? parseInt(att) : 0,
            total: newTotal,
            history: savedHistory
        };
    });

    await setDoc(docRef, { name, subjects: subs });
    alert("Saved! (History synced to counts)");
    loadAllStudentsList();
}

// 3. Student List
async function loadAllStudentsList() {
    const list = document.getElementById('admin-list');
    list.innerHTML = 'Loading...';
    
    try {
        const snap = await getDocs(collection(db, "attendance"));
        list.innerHTML = '';
        
        if (snap.empty) {
            list.innerHTML = '<p class="text-gray-400 text-sm">No students found.</p>';
            return;
        }

        snap.forEach(d => {
            const data = d.data();
            // Fallback for ID display if not ending in @uni.com
            let userDisplay = d.id;
            if (d.id.includes('@uni.com')) {
                userDisplay = d.id.replace('@uni.com', '');
            }

            // Fallback for Name
            const nameDisplay = data.name || "Unknown Name";

            const json = JSON.stringify(data.subjects || []);
            
            list.innerHTML += `
                <div class="flex items-center justify-between p-3 border rounded hover:bg-gray-50 transition">
                    <div class="cursor-pointer flex-1" onclick='fillAdminForm("${userDisplay}", "${nameDisplay}", ${json})'>
                        <span class="font-bold block text-gray-800">${nameDisplay}</span>
                        <span class="text-xs text-gray-400">${userDisplay}</span>
                    </div>
                    <div class="flex gap-1">
                        <button onclick="cloneStudentData('${d.id}')" class="bg-blue-50 text-blue-500 p-2 rounded hover:bg-blue-100 transition" title="Clone to All">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                            </svg>
                        </button>
                        <button onclick="deleteStudent('${d.id}')" class="bg-red-50 text-red-500 p-2 rounded hover:bg-red-100 transition" title="Delete Student">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        });
    } catch (e) {
        list.innerHTML = `<p class="text-red-500 text-sm">Error: ${e.message}</p>`;
    }
}

async function cloneStudentData(sourceId) {
    if(!confirm(`Copy all attendance details from "${sourceId}" to ALL other students?\nThis will overwrite their current data!`)) return;

    try {
        const snap = await getDoc(doc(db, "attendance", sourceId));
        if(!snap.exists()) return;
        
        const sourceSubjects = snap.data().subjects || [];
        const allStudentsSnap = await getDocs(collection(db, "attendance"));
        
        let count = 0;
        const promises = [];

        allStudentsSnap.forEach(studentDoc => {
            if (studentDoc.id !== sourceId) {
                const studentName = studentDoc.data().name;
                // Update their doc with source subjects but keep their name
                promises.push(setDoc(doc(db, "attendance", studentDoc.id), {
                    name: studentName,
                    subjects: sourceSubjects
                }));
                count++;
            }
        });

        await Promise.all(promises);
        alert(`Successfully cloned data to ${count} students!`);
        loadAllStudentsList();
    } catch (e) {
        alert("Error cloning: " + e.message);
    }
}

async function deleteStudent(docId) {
    if(!confirm(`Are you sure you want to delete data for "${docId}"?\nThis cannot be undone.`)) return;
    
    try {
        await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js")
            .then(m => m.deleteDoc(doc(db, "attendance", docId)));
        
        alert("Student data deleted.");
        loadAllStudentsList(); // Refresh list
    } catch (e) {
        alert("Error deleting: " + e.message);
    }
}

function fillAdminForm(user, name, subs) {
    document.getElementById('admin-username-input').value = user;
    document.getElementById('admin-name').value = name;
    renderAdminStudentInputs(); // Reset
    
    subs.forEach(s => {
        const safe = s.name.replace(/\s+/g, '-');
        const att = document.getElementById('att-'+safe);
        const tot = document.getElementById('tot-'+safe);
        if(att) att.value = s.attended;
        if(tot) tot.value = s.total;
    });

    // Mobile: Scroll to form
    if(window.innerWidth < 1024) {
        document.getElementById('admin-username-input').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}
