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
let currentViewMode = 'today'; // 'today' or 'all'

// Make global for inline onclicks
window.updateAttendance = updateAttendance;
window.fillAdminForm = fillAdminForm;
window.deleteSubject = deleteSubject;
window.deleteStudent = deleteStudent;
window.cloneStudentData = cloneStudentData;
window.updateSubjectDay = updateSubjectDay;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Attach Event Listeners
    // Auth Forms
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('do-register-btn').addEventListener('click', handleRegister);
    
    // Toggles
    document.getElementById('show-register-btn').addEventListener('click', () => toggleAuthForm('register'));
    document.getElementById('show-login-btn').addEventListener('click', () => toggleAuthForm('login'));

    // View Switcher
    const viewToday = document.getElementById('view-today-btn');
    const viewAll = document.getElementById('view-all-btn');
    if(viewToday && viewAll) {
        viewToday.addEventListener('click', () => setViewMode('today'));
        viewAll.addEventListener('click', () => setViewMode('all'));
    }

    // Date Picker Listener
    const datePicker = document.getElementById('attendance-date');
    if (datePicker) {
        datePicker.addEventListener('change', () => {
            if (auth.currentUser) loadStudentData(auth.currentUser.email);
        });
    }

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

    const adminDeptSelect = document.getElementById('admin-dept-select');
    if(adminDeptSelect) {
        adminDeptSelect.addEventListener('change', async (e) => {
            await loadGlobalSubjects(e.target.value);
            renderAdminSubjects();
            renderAdminStudentInputs();
        });
    }
});

function setViewMode(mode) {
    currentViewMode = mode;
    
    // UI Highlight
    const btnToday = document.getElementById('view-today-btn');
    const btnAll = document.getElementById('view-all-btn');
    
    if(mode === 'today') {
        btnToday.classList.add('bg-white', 'shadow', 'text-blue-600');
        btnToday.classList.remove('text-gray-500');
        btnAll.classList.remove('bg-white', 'shadow', 'text-blue-600');
        btnAll.classList.add('text-gray-500');
    } else {
        btnAll.classList.add('bg-white', 'shadow', 'text-blue-600');
        btnAll.classList.remove('text-gray-500');
        btnToday.classList.remove('bg-white', 'shadow', 'text-blue-600');
        btnToday.classList.add('text-gray-500');
    }

    // Reload Data to reflect view
    const userEmail = auth.currentUser ? auth.currentUser.email : null;
    if(userEmail) loadStudentData(userEmail);
}

function toggleAuthForm(target) {
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    
    // Reset errors
    document.getElementById('login-error-msg').classList.add('hidden');
    document.getElementById('reg-error-msg').classList.add('hidden');

    if (target === 'register') {
        loginForm.classList.add('hidden');
        regForm.classList.remove('hidden');
    } else {
        regForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    }
}

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
    const userIn = document.getElementById('login-user').value.trim();
    const passIn = document.getElementById('login-pass').value;
    const err = document.getElementById('login-error-msg');

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
    const fullNameIn = document.getElementById('reg-fullname').value.trim();
    const deptIn = document.getElementById('reg-dept').value;
    const userIn = document.getElementById('reg-user').value.trim();
    const passIn = document.getElementById('reg-pass').value;
    const err = document.getElementById('reg-error-msg');

    if (!userIn || !passIn) {
        err.textContent = "All fields are required.";
        err.classList.remove('hidden');
        return;
    }
    
    if (!deptIn) {
        err.textContent = "Please select a department.";
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
        const docRef = doc(db, "attendance", email);
        const displayName = fullNameIn || userIn; 

        await setDoc(docRef, {
            name: displayName,
            department: deptIn
        }, { merge: true });

        // Ensure subjects array exists if it's a brand new doc
        const snap = await getDoc(docRef);
        if (snap.exists() && !snap.data().subjects) {
            await setDoc(docRef, { subjects: [] }, { merge: true });
        }

        err.textContent = "Success! Logging in...";
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
    const docRef = doc(db, "attendance", email);
    let snap = await getDoc(docRef);

    // SECURITY: If user is NOT Admin and doc is missing, they were deleted.
    if (!snap.exists()) {
        if (email === "tharusha@uni.com") {
            // Auto-create only for Admin if missing (prevent lockout)
            await setDoc(docRef, { name: "Admin", department: "CE", subjects: [] });
            snap = await getDoc(docRef);
        } else {
            // Force Logout for deleted students
            alert("Your account has been deactivated or deleted by the Admin.");
            await signOut(auth);
            location.reload();
            return;
        }
    }

    const userData = snap.data();
    const userDept = userData.department || 'CE';

    // 2. Load Global Subjects for this department
    await loadGlobalSubjects(userDept);

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

async function loadGlobalSubjects(dept = 'CE') {
    // CS and SE share the same subjects
    const targetDept = (dept === 'SE') ? 'CS' : dept;

    try {
        let snap = await getDoc(doc(db, "settings", `subjects_${targetDept}`));
        
        // Fallback for transition: if subjects_CE doesn't exist, check old 'subjects'
        if (!snap.exists() && targetDept === 'CE') {
            const oldSnap = await getDoc(doc(db, "settings", "subjects"));
            if (oldSnap.exists()) {
                // Migrate old list to objects with default day
                const oldList = oldSnap.data().list || [];
                globalSubjects = oldList.map(item => {
                    // Check if item is object or string (handle legacy)
                    if (typeof item === 'string') return { name: item, day: 'Monday' };
                    return { ...item, day: item.day || 'Monday' };
                });
                
                await setDoc(doc(db, "settings", "subjects_CE"), { list: globalSubjects });
                return;
            }
        }

        if (snap.exists()) {
            globalSubjects = snap.data().list || [];
        } else {
            // Default Init based on department (With Days)
            if (targetDept === 'CS') { 
                globalSubjects = [
                    {name:"Algorithms", day:"Monday"}, 
                    {name:"Machine Learning", day:"Tuesday"}, 
                    {name:"Data Science", day:"Wednesday"}, 
                    {name:"Networking", day:"Thursday"}
                ];
            } else {
                globalSubjects = [
                    {name:"OS", day:"Monday"}, 
                    {name:"CAL", day:"Tuesday"}, 
                    {name:"AOOP", day:"Wednesday"}, 
                    {name:"SDI", day:"Thursday"}
                ];
            }
            await setDoc(doc(db, "settings", `subjects_${targetDept}`), { list: globalSubjects });
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
    let sDept = 'CE';

    if (snap.exists()) {
        sName = snap.data().name;
        sSubjects = snap.data().subjects || [];
        sDept = snap.data().department || 'CE';
    }

    document.getElementById('user-name').textContent = `Hello, ${sName}`;
    document.getElementById('user-dept').textContent = sDept;
    
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

    // --- ALERT LOGIC (Scan ALL subjects) ---
    const lowAttSubjects = [];
    globalSubjects.forEach(sub => {
        const mySub = sSubjects.find(s => s.name === sub.name);
        const attended = mySub ? (parseInt(mySub.attended) || 0) : 0;
        const total = mySub ? (parseInt(mySub.total) || 0) : 0;
        
        // Only alert if classes have started (total > 0)
        if (total > 0) {
            const pct = Math.round((attended / total) * 100);
            if (pct < 80) lowAttSubjects.push(sub.name);
        }
    });

    const alertBox = document.getElementById('low-attendance-alert');
    const alertText = document.getElementById('alert-subjects');
    if (lowAttSubjects.length > 0) {
        alertBox.classList.remove('hidden');
        alertText.textContent = lowAttSubjects.join(', ');
    } else {
        alertBox.classList.add('hidden');
    }

    // --- RENDERING LOGIC ---
    const container = document.getElementById('subjects-container');
    container.innerHTML = '';
    
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    
    // Determine Day Name from Date Picker
    let targetDate = new Date();
    if (dateInput.value) {
        const [y, m, d] = dateInput.value.split('-').map(Number);
        targetDate = new Date(y, m - 1, d);
    }
    const todayIndex = targetDate.getDay(); // 0=Sun, 1=Mon...
    // Map JS Day (0=Sun) to our Array
    const jsDayMap = { 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday", 0: "Sunday" };
    const currentDayName = jsDayMap[todayIndex];

    let subjectsToRender = [];
    let isGroupedView = false;

    if (currentViewMode === 'today') {
        // Show only today's subjects
        subjectsToRender = globalSubjects.filter(s => s.day === currentDayName);
        if (subjectsToRender.length === 0) {
            container.innerHTML = `
                <div class="text-center p-8 bg-white rounded-xl shadow-sm border border-gray-100">
                    <p class="text-xl font-bold text-gray-400">No classes scheduled for ${currentDayName}!</p>
                    <p class="text-gray-400 mt-2">Enjoy your free time.</p>
                </div>`;
            // Calculate overall even if empty
            updateOverallChart(globalSubjects, sSubjects);
            return; 
        }
    } else {
        // 'all' view -> Use grouped rendering logic
        isGroupedView = true;
        subjectsToRender = globalSubjects; 
    }

    // Helper to generate card HTML
    const createCard = (sub) => {
        const mySub = sSubjects.find(s => s.name === sub.name);
        const attended = mySub ? (parseInt(mySub.attended) || 0) : 0;
        const total = mySub ? (parseInt(mySub.total) || 0) : 0;
        
        let pct = (total > 0) ? Math.round((attended / total) * 100) : 0;
        const color = pct < 80 ? "text-red-600" : "text-green-600";
        const border = pct < 80 ? "border-red-200" : "border-blue-100";
        const pctDisplay = (total === 0) ? "No Classes" : `${pct}%`;
        const pctColor = (total === 0) ? "text-gray-400" : color;

        let historyHTML = '';
        let isOnCooldown = false;
        let timeLeft = '';

        if (mySub && mySub.history && mySub.history.length > 0) {
            const lastEntry = mySub.history[mySub.history.length - 1];
            const lastDate = new Date(lastEntry.timestamp);
            const now = new Date();
            const diffHours = (now - lastDate) / (1000 * 60 * 60);

            if (diffHours < 24) {
                isOnCooldown = true;
                const hoursRemaining = Math.ceil(24 - diffHours);
                timeLeft = `${hoursRemaining}h wait`;
            }

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

        const btnState = isOnCooldown ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600 shadow-sm';
        const missState = isOnCooldown ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-200';
        const disabledAttr = isOnCooldown ? 'disabled' : '';
        const cooldownMsg = isOnCooldown ? `<span class="text-xs text-orange-500 font-bold ml-2">(${timeLeft})</span>` : '';

        return `
            <div class="p-5 rounded-xl border ${border} bg-white shadow-sm flex flex-col justify-between h-full fade-in">
                <div>
                    <div class="flex justify-between mb-2">
                        <h4 class="font-bold text-gray-700 text-lg flex items-center">
                            ${sub.name} 
                            ${cooldownMsg}
                        </h4>
                        <span class="text-xs font-bold px-2 py-1 rounded bg-gray-100 text-gray-500">${attended} / ${total}</span>
                    </div>
                    <div class="text-4xl font-bold ${pctColor} mb-4">${pctDisplay}</div>
                    
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
    };

    if (isGroupedView) {
        // Group by Day
        const subjectsByDay = {};
        days.concat(['Other']).forEach(d => subjectsByDay[d] = []);
        
        globalSubjects.forEach(sub => {
            const d = sub.day || 'Other';
            if(subjectsByDay[d]) subjectsByDay[d].push(sub);
            else subjectsByDay['Other'].push(sub);
        });

        days.concat(['Other']).forEach(dayName => {
            const daySubjects = subjectsByDay[dayName];
            if(!daySubjects || daySubjects.length === 0) return;

            const section = document.createElement('div');
            section.className = "day-section";
            section.innerHTML = `<h3 class="text-xl font-bold text-gray-800 mb-3 border-b pb-1 border-gray-200">${dayName}</h3>`;
            
            const grid = document.createElement('div');
            grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";
            
            daySubjects.forEach(sub => {
                grid.innerHTML += createCard(sub);
            });
            section.appendChild(grid);
            container.appendChild(section);
        });
    } else {
        // Flat List (Today View)
        const grid = document.createElement('div');
        grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";
        subjectsToRender.forEach(sub => {
            grid.innerHTML += createCard(sub);
        });
        container.appendChild(grid);
    }

    updateOverallChart(globalSubjects, sSubjects);
}

function updateOverallChart(allSubs, studentSubs) {
    let totalPercent = 0;
    let validCount = 0;

    allSubs.forEach(sub => {
        const mySub = studentSubs.find(s => s.name === sub.name);
        const attended = mySub ? (parseInt(mySub.attended) || 0) : 0;
        const total = mySub ? (parseInt(mySub.total) || 0) : 0;
        if (total > 0) {
            totalPercent += Math.round((attended / total) * 100);
            validCount++;
        }
    });

    const overall = validCount > 0 ? Math.round(totalPercent / validCount) : 0;
    
    // UPDATE CHART TEXT
    const ovEl = document.getElementById('overall-percent');
    if(ovEl) ovEl.textContent = overall + "%";
    
    // UPDATE CHART RING
    const ring = document.getElementById('chart-ring');
    const color = overall < 80 ? '#f87171' : '#4ade80'; 
    const emptyColor = '#ffffff33';
    if(ring) ring.style.background = `conic-gradient(${color} 0% ${overall}%, ${emptyColor} ${overall}% 100%)`;
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
    // Sort by Day then Name
    const daysOrder = { "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6, "Sunday": 7 };
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    const sorted = [...globalSubjects].sort((a, b) => {
        const da = daysOrder[a.day] || 8;
        const db = daysOrder[b.day] || 8;
        return da - db;
    });

    sorted.forEach(s => {
        // Build Day Options
        let dayOptions = '';
        days.forEach(d => {
            const sel = (s.day === d) ? 'selected' : '';
            // Show short name (Mon, Tue) in dropdown to save space
            dayOptions += `<option value="${d}" ${sel}>${d.substring(0,3)}</option>`;
        });

        box.innerHTML += `
            <div class="bg-blue-50 text-blue-800 px-2 py-1 rounded-full text-sm font-bold flex items-center gap-2 border border-blue-200 shadow-sm">
                <select onchange="updateSubjectDay('${s.name}', this.value)" class="bg-white border border-blue-200 rounded text-xs font-bold text-gray-500 uppercase focus:outline-none cursor-pointer py-0.5 px-1">
                    ${dayOptions}
                </select>
                <span>${s.name}</span>
                <button onclick="deleteSubject('${s.name}')" class="text-red-400 hover:text-red-600 ml-1 font-bold px-1 rounded hover:bg-red-50">×</button>
            </div>
        `;
    });
}

async function updateSubjectDay(name, newDay) {
    let dept = document.getElementById('admin-dept-select').value;
    if (dept === 'SE') dept = 'CS';

    // Update local state
    const subIndex = globalSubjects.findIndex(s => s.name === name);
    if(subIndex > -1) {
        globalSubjects[subIndex].day = newDay;
    }

    try {
        await setDoc(doc(db, "settings", `subjects_${dept}`), { list: globalSubjects });
        renderAdminSubjects(); // Re-sort and render
    } catch (e) {
        alert("Error updating day: " + e.message);
        renderAdminSubjects(); // Revert on error
    }
}

async function addSubject() {
    const input = document.getElementById('new-subject-name');
    const dayInput = document.getElementById('new-subject-day');
    const val = input.value.trim();
    const dayVal = dayInput.value;
    
    let dept = document.getElementById('admin-dept-select').value;
    
    // CS and SE share the same subjects
    if (dept === 'SE') dept = 'CS';

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
        const snap = await getDoc(doc(db, "settings", `subjects_${dept}`));
        let currentList = [];
        if(snap.exists()) currentList = snap.data().list || [];

        currentList.push({name: val, day: dayVal});
        
        await setDoc(doc(db, "settings", `subjects_${dept}`), { list: currentList });
        
        // Update local state
        globalSubjects = currentList;
        
        input.value = '';
        renderAdminSubjects();
        renderAdminStudentInputs();
        alert(`Added subject: ${val} (${dayVal}) to ${dept}`);
    } catch (e) {
        alert("Error adding subject: " + e.message);
    }
}
async function deleteSubject(name) {
    if(!confirm("Delete " + name + "?")) return;
    let dept = document.getElementById('admin-dept-select').value;
    // CS and SE share the same subjects
    if (dept === 'SE') dept = 'CS';

    globalSubjects = globalSubjects.filter(s => s.name !== name);
    await setDoc(doc(db, "settings", `subjects_${dept}`), { list: globalSubjects });
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
    const department = document.getElementById('admin-dept-input').value;
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

    await setDoc(docRef, { name, subjects: subs, department });
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
            const deptDisplay = data.department || "CE";

            const json = JSON.stringify(data.subjects || []);
            
            list.innerHTML += `
                <div class="flex items-center justify-between p-3 border rounded hover:bg-gray-50 transition">
                    <div class="cursor-pointer flex-1" onclick='fillAdminForm("${userDisplay}", "${nameDisplay}", ${json}, "${deptDisplay}")'>
                        <span class="font-bold block text-gray-800">${nameDisplay}</span>
                        <span class="text-xs text-gray-400">${userDisplay} | ${deptDisplay}</span>
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
    if(!confirm(`Copy all attendance details from "${sourceId}" to ALL matching students?\n(CS & SE are linked, CE is separate)`)) return;

    try {
        const snap = await getDoc(doc(db, "attendance", sourceId));
        if(!snap.exists()) return;
        
        const sourceData = snap.data();
        const sourceSubjects = sourceData.subjects || [];
        const sourceDept = sourceData.department || 'CE';
        
        // Determine Target Group
        const isSourceCS_SE = (sourceDept === 'CS' || sourceDept === 'SE');

        const allStudentsSnap = await getDocs(collection(db, "attendance"));
        
        let count = 0;
        const promises = [];

        allStudentsSnap.forEach(studentDoc => {
            if (studentDoc.id !== sourceId) {
                const targetData = studentDoc.data();
                const targetDept = targetData.department || 'CE';
                const isTargetCS_SE = (targetDept === 'CS' || targetDept === 'SE');

                // Logic: 
                // If Source is CS/SE, clone to all CS & SE students.
                // If Source is CE, clone only to CE students.
                
                let shouldClone = false;
                if (isSourceCS_SE && isTargetCS_SE) shouldClone = true;
                if (!isSourceCS_SE && !isTargetCS_SE) shouldClone = true; // CE -> CE

                if (shouldClone) {
                    // Update their doc with source subjects but keep their name & dept
                    promises.push(setDoc(doc(db, "attendance", studentDoc.id), {
                        name: targetData.name,
                        department: targetDept,
                        subjects: sourceSubjects
                    }));
                    count++;
                }
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

async function fillAdminForm(user, name, subs, dept) {
    document.getElementById('admin-username-input').value = user;
    document.getElementById('admin-name').value = name;
    if(document.getElementById('admin-dept-input')) {
        document.getElementById('admin-dept-input').value = dept || 'CE';
    }
    
    // Set dept selector and load those subjects
    const deptSelect = document.getElementById('admin-dept-select');
    if(deptSelect && dept) {
        deptSelect.value = dept;
        await loadGlobalSubjects(dept);
        renderAdminSubjects();
        renderAdminStudentInputs();
    }
    
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
