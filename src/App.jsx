import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    onAuthStateChanged,
    signOut
} from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    onSnapshot
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// --- NEW IMPORTS FOR PDF/EXCEL EXPORT ---
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyD3gioUb0VJQKLslSt-swktUA-EB_1j75c",
  authDomain: "vitsn-aca-clasroon-allocator.firebaseapp.com",
  projectId: "vitsn-aca-clasroon-allocator",
  storageBucket: "vitsn-aca-clasroon-allocator.firebasestorage.app",
  messagingSenderId: "520269636919",
  appId: "1:520269636919:web:29ceff6523cd485353a6b2"
};


// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// --- SVG Icons ---
const VitsnLogo = ({ className }) => ( <svg className={className} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"> <path fill="currentColor" d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm0 192a88 88 0 1 1 88-88a88.1 88.1 0 0 1-88 88Z"/> <path fill="currentColor" d="M168 96h-24.51l-24-40a16 16 0 0 0-27 0l-24 40H40a8 8 0 0 0 0 16h22.1l-22.78 38a8 8 0 0 0 6.92 12h123.52a8 8 0 0 0 6.92-12L145.9 112H168a8 8 0 0 0 0-16Zm-68.58 0L128 51.81L156.58 96ZM88 144l24-40h32l24 40Z"/> </svg> );
const LogoutIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>);
const MenuIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>);
const CloseIcon = ({className="h-6 w-6"}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const TrashIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>);
const PlusIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>);
const EditIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>);
const UserIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 text-slate-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>);

// --- Helper function for logging actions ---
const logAction = async (userId, action, details) => {
    // Check if userId is valid
    if (!userId) {
        console.error("LogAction Error: No userId provided.");
        return;
    }
    const logEntry = {
        id: `log-${Date.now()}`,
        timestamp: new Date(),
        action,
        details,
    };
    try {
        const instituteRef = doc(db, "institutes", userId);
        await updateDoc(instituteRef, {
            logs: arrayUnion(logEntry)
        });
    } catch (error) {
        console.error("Error logging action:", error);
    }
};

// --- Main App Component ---
export default function App() {
    const [user, setUser] = useState(undefined);
    const [loading, setLoading] = useState(true);
    const [instituteData, setInstituteData] = useState(null);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (user === undefined) return;

        if (user === null) {
            setInstituteData(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        const docRef = doc(db, "institutes", user.uid);
        const unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setInstituteData(docSnap.data());
            } else {
                // User is authenticated but has no institute doc
                setInstituteData({ name: null }); // Signal to show setup page
            }
            setLoading(false);
        }, (error) => {
            console.error("Firestore snapshot error:", error);
            setInstituteData(null);
            setLoading(false);
        });

        return () => unsubscribeSnapshot();
    }, [user]);

    const handleGoogleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try { 
            await signInWithPopup(auth, provider);
            // Auth state change will handle the rest
        } 
        catch (error) { 
            console.error("Authentication error:", error);
            // Handle specific errors if needed
        }
    };
    
    const handleLogout = async () => { 
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    if (loading || user === undefined) { 
        return ( <div className="flex items-center justify-center h-screen bg-slate-100"><VitsnLogo className="w-16 h-16 animate-pulse text-blue-600" /></div> ); 
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {!user ? <LoginPage onLogin={handleGoogleLogin} /> : <MainDashboard user={user} instituteData={instituteData} onLogout={handleLogout} />}
        </div>
    );
}

// --- Login Page ---
function LoginPage({ onLogin }) {
    const [choice, setChoice] = useState(null);
    return (
        <main className="flex items-center justify-center min-h-screen bg-slate-100 p-4">
            <div className="w-full max-w-md p-6 md:p-8 space-y-6 bg-white rounded-xl shadow-lg border border-slate-200">
                <div className="text-center">
                    <VitsnLogo className="w-16 h-16 mx-auto mb-4 text-blue-600" />
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">VITSN ACA</h1>
                    <p className="text-slate-500 mt-1">Automatic Classroom Allocator</p>
                </div>
                <div className="border-t border-slate-200 pt-6 mt-6">
                    {!choice ? (
                         <div className="animate-fade-in text-center">
                            <h2 className="text-lg sm:text-xl font-semibold text-slate-700 mb-5">Select your organization type</h2>
                            <div className="flex flex-col sm:flex-row justify-center gap-4">
                                <button onClick={() => setChoice('institute')} className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-transform transform hover:scale-105">Institute</button>
                                <button onClick={() => setChoice('university')} className="px-6 py-3 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 transition-transform transform hover:scale-105">University</button>
                            </div>
                        </div>
                    ) : choice === 'university' ? (
                         <div className="p-5 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg text-left animate-fade-in">
                            <p className="font-bold">Coming Soon!</p>
                            <p className="text-sm">The University module is under active development.</p>
                            <button onClick={() => setChoice(null)} className="mt-3 text-sm font-semibold text-blue-600 hover:underline">← Go Back</button>
                        </div>
                    ) : (
                        <div className="animate-fade-in text-center">
                            <h2 className="text-lg sm:text-xl font-semibold text-slate-700 mb-2">Welcome!</h2>
                            <p className="text-slate-500 mb-6">Sign in with Google to continue.</p>
                            <button onClick={onLogin} className="w-full flex items-center justify-center px-4 py-3 border border-slate-300 rounded-lg shadow-sm bg-white text-slate-700 font-medium hover:bg-slate-50 transition">
                                <svg className="w-5 h-5 mr-3" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.82l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>
                                Sign in with Google
                            </button>
                            <button onClick={() => setChoice(null)} className="mt-4 text-sm font-semibold text-slate-500 hover:text-slate-700 hover:underline">← Go Back</button>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}

// --- Generic Modal Component ---
function Modal({ isOpen, onClose, title, children }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-xl font-semibold text-slate-800">{title}</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><CloseIcon /></button>
                </div>
                <div className="p-6 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
}

// --- Dashboard & Components ---
function MainDashboard({ user, instituteData, onLogout }) {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    // const [isSidebarCollapsed, setSidebarCollapsed] = useState(false); // --- REMOVED (REQUEST 1)
    const [timetableResult, setTimetableResult] = useState(null);
    const [lastGenerationLog, setLastGenerationLog] = useState(null);


    if (instituteData === null) { return ( <div className="flex items-center justify-center h-screen bg-slate-100"><VitsnLogo className="w-16 h-16 animate-pulse text-blue-600" /><p className="ml-4 text-slate-600 font-semibold">Loading Dashboard...</p></div> ); }
    if (instituteData.name === null) { return <SetupInstitute user={user} onLogout={onLogout} />; }
    
    const allData = {
        classrooms: instituteData.classrooms || [],
        departments: instituteData.departments || [],
        teachers: instituteData.teachers || [],
        subjects: instituteData.subjects || [],
        commonClasses: instituteData.commonClasses || [],
        settings: instituteData.settings || {},
        logs: instituteData.logs || [],
        generatedTimetables: instituteData.generatedTimetables || [],
    };

    const handleSetTimetable = (result, log) => {
        setTimetableResult(result);
        setLastGenerationLog(log || null);
    };

    if (timetableResult) {
        return <AllocationResultPage result={timetableResult} onBack={() => setTimetableResult(null)} allData={allData} generationLog={lastGenerationLog} />
    }

    return (
        <div className="h-screen flex bg-slate-100">
            <Sidebar 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                onLogout={onLogout} 
                isSidebarOpen={isSidebarOpen} 
                setSidebarOpen={setSidebarOpen}
                // isCollapsed={isSidebarCollapsed} // --- REMOVED (REQUEST 1)
            />
            {/* --- MODIFIED (REQUEST 1): Removed isSidebarCollapsed logic --- */}
            <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 md:ml-64`}>
                <Header 
                    user={user}
                    instituteName={instituteData.name} 
                    onMenuClick={() => setSidebarOpen(true)}
                    // onCollapseToggle={() => setSidebarCollapsed(!isSidebarCollapsed)} // --- REMOVED (REQUEST 1)
                />
                <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 md:p-8">
                    <div className="max-w-7xl mx-auto">
                       {activeTab === 'dashboard' && <Dashboard user={user} allData={allData} />}
                       {activeTab === 'classrooms' && <ClassroomsManager user={user} classrooms={allData.classrooms} departments={allData.departments} />}
                       {activeTab === 'departments' && <DepartmentsManager user={user} departments={allData.departments} />}
                       {/* --- MODIFIED (REQUEST 2): Pass settings to TeachersManager --- */}
                       {activeTab === 'teachers' && <TeachersManager user={user} teachers={allData.teachers} departments={allData.departments} subjects={allData.subjects} settings={allData.settings}/>}
                       {activeTab === 'subjects' && <SubjectsManager user={user} subjects={allData.subjects} departments={allData.departments} />}
                       {activeTab === 'common_classes' && <CommonClassesManager user={user} commonClasses={allData.commonClasses} subjects={allData.subjects} departments={allData.departments} />}
                       {activeTab === 'allocate' && <AllocationManager user={user} allData={allData} onGenerate={handleSetTimetable} />}
                       {activeTab === 'vigilance' && <VigilanceManager user={user} allData={allData} />}
                       {activeTab === 'logs' && <LogManager user={user} logs={allData.logs} />}
                       {activeTab === 'terms' && <Placeholder tabName="Terms & Semesters" />}
                       {!['dashboard', 'classrooms', 'departments', 'teachers', 'subjects', 'common_classes', 'allocate', 'vigilance', 'logs', 'terms'].includes(activeTab) && <Placeholder tabName={activeTab} />}
                    </div>
                </main>
            </div>
        </div>
    );
}

// --- MODIFIED (REQUEST 1): Removed onCollapseToggle ---
function Header({ user, instituteName, onMenuClick }) {
    return (
        <header className="bg-white shadow-sm p-4 flex items-center justify-between border-b border-slate-200 z-10 flex-shrink-0">
            <div className="flex items-center space-x-3">
                <button onClick={onMenuClick} className="p-2 rounded-md text-slate-600 hover:bg-slate-100 md:hidden"> 
                    <MenuIcon /> 
                </button>
                 {/* --- REMOVED (REQUEST 1): Desktop menu toggle button --- */}
                 {/* <button onClick={onCollapseToggle} className="p-2 rounded-md text-slate-600 hover:bg-slate-100 hidden md:block"> 
                    <MenuIcon /> 
                </button> */}
                <div className="flex items-center gap-2">
                    <VitsnLogo className="w-8 h-8 text-blue-600" />
                    <h1 className="text-lg sm:text-xl font-bold text-slate-800">VITSN ACA</h1>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                    <p className="font-semibold text-slate-700 text-sm">{instituteName}</p>
                    <p className="text-xs text-slate-500">{user.displayName}</p>
                </div>
                {user.photoURL ? <img src={user.photoURL} alt="User" className="w-9 h-9 rounded-full" /> : <UserIcon />}
            </div>
        </header>
    );
}

// --- MODIFIED (REQUEST 1): Removed isCollapsed ---
function Sidebar({ activeTab, setActiveTab, onLogout, isSidebarOpen, setSidebarOpen }) {
    const navItems = [
        { id: 'dashboard', label: 'Dashboard' }, 
        { id: 'classrooms', label: 'Classrooms' }, 
        { id: 'departments', label: 'Departments & Courses' }, 
        { id: 'teachers', label: 'Teachers' }, 
        { id: 'subjects', label: 'Subjects' }, 
        { id: 'common_classes', label: 'Common Classes' },
        { id: 'terms', label: 'Terms & Semesters' },
        { id: 'vigilance', label: 'Vigilance' },
        { id: 'logs', label: 'Activity Logs'},
        { id: 'allocate', label: 'ALLOCATE' }
    ];
    const sidebarRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target) && window.innerWidth < 768) {
                setSidebarOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [setSidebarOpen]);

    // --- MODIFIED (REQUEST 1): Removed isCollapsed logic ---
    const sidebarClasses = `
        bg-white border-r border-slate-200 flex flex-col 
        fixed inset-y-0 left-0 z-40 
        transition-transform duration-300 ease-in-out
        w-64
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
    `;

    return (
        <>
        <div className={`fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden transition-opacity ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setSidebarOpen(false)}></div>
        <nav ref={sidebarRef} className={sidebarClasses}>
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                <h2 className="font-bold text-lg text-slate-700 tracking-wide">Menu</h2>
                <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 rounded-md text-slate-600 hover:bg-slate-100"> <CloseIcon /> </button>
            </div>
            <div className="p-4 border-b border-slate-200">
                <input type="search" placeholder="Search..." className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <ul className="flex-1 py-4 overflow-y-auto">
                {navItems.map(item => (
                    <li key={item.id} className="px-4">
                        <button onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }} className={`w-full text-left flex items-center px-4 py-3 my-1 rounded-lg transition-colors duration-200 font-medium ${activeTab === item.id ? 'bg-blue-600 text-white font-semibold shadow' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'} ${item.id === 'allocate' ? 'mt-8 bg-green-500 text-white hover:bg-green-600' : ''}`}>
                            {item.label}
                        </button>
                    </li>
                ))}
            </ul>
            <div className="p-4 border-t border-slate-200 flex-shrink-0">
                <button onClick={onLogout} className="w-full flex items-center justify-center px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"> <LogoutIcon /> Logout </button>
            </div>
            <footer className="px-4 py-2 text-center text-xs text-slate-400 border-t border-slate-200">
                <p>&copy; {new Date().getFullYear()} Yellapu Sampreeth Naidu.</p>
                <p>All rights reserved.</p>
            </footer>
        </nav>
        </>
    );
}

function SetupInstitute({ user, onLogout }) {
    const [name, setName] = useState('');

    const defaultTimings = [
        { day: 'Monday', isAvailable: true, startTime: '09:00', endTime: '17:00' },
        { day: 'Tuesday', isAvailable: true, startTime: '09:00', endTime: '17:00' },
        { day: 'Wednesday', isAvailable: true, startTime: '09:00', endTime: '17:00' },
        { day: 'Thursday', isAvailable: true, startTime: '09:00', endTime: '17:00' },
        { day: 'Friday', isAvailable: true, startTime: '09:00', endTime: '17:00' },
        { day: 'Saturday', isAvailable: true, startTime: '09:00', endTime: '13:00' },
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (name.trim() === '') return;
        const institutePayload = { 
            name: name.trim(), 
            owner: user.uid, 
            createdAt: new Date(), 
            classrooms: [], 
            departments: [], 
            teachers: [],
            subjects: [],
            commonClasses: [],
            logs: [],
            generatedTimetables: [],
            settings: {
                timings: defaultTimings,
                lunchStart: '13:00',
                lunchEnd: '14:00',
            }
        };
        try {
            await setDoc(doc(db, "institutes", user.uid), institutePayload);
            await logAction(user.uid, "INSTITUTE_CREATED", `Institute '${name.trim()}' was created.`);
        } catch (error) { console.error("Error creating institute:", error); }
    };

    return (
        <main className="flex items-center justify-center min-h-screen bg-slate-100 p-4">
            <div className="w-full max-w-lg p-6 sm:p-10 space-y-6 bg-white rounded-xl shadow-lg border border-slate-200">
                <div className="text-center">
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Setup Your Institute</h2>
                    <p className="mt-2 text-slate-500">Welcome, {user.displayName}! Let's start by giving your institute a name.</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                    <div>
                        <label htmlFor="instituteName" className="block text-sm font-medium text-slate-700 mb-2">Institute Name</label>
                        <input id="instituteName" type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full px-4 py-3 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., Vanguard Institute of Technology" required />
                    </div>
                    <button type="submit" className="w-full px-4 py-3 font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-transform transform hover:scale-105">Save and Continue</button>
                     <div className="text-center pt-4 border-t border-slate-200">
                        <button type="button" onClick={onLogout} className="text-sm font-semibold text-slate-500 hover:text-slate-700 hover:underline">Logout and start over</button>
                    </div>
                </form>
            </div>
        </main>
    );
}

// --- Dashboard Home Page ---
function Dashboard({ allData }) {
    const stats = [
        { name: 'Classrooms', value: allData.classrooms.length },
        { name: 'Departments', value: allData.departments.length },
        { name: 'Teachers', value: allData.teachers.length },
        { name: 'Subjects', value: allData.subjects.length },
    ];

    return (
         <div className="space-y-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Dashboard</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map(stat => (
                    <div key={stat.name} className="bg-white p-6 rounded-lg shadow-lg border border-slate-200">
                        <p className="text-sm font-medium text-slate-500">{stat.name}</p>
                        <p className="mt-2 text-3xl font-bold text-slate-800">{stat.value}</p>
                    </div>
                ))}
            </div>
            <div className="bg-white p-6 rounded-lg shadow-lg border border-slate-200">
                <h3 className="text-xl font-semibold text-slate-700 mb-4">Quick Start Guide</h3>
                <ol className="list-decimal list-inside space-y-2 text-slate-600">
                    <li>Add your <span className="font-semibold">Classrooms</span> with capacities and types.</li>
                    <li>Define your institute structure in <span className="font-semibold">Departments & Courses</span>.</li>
                    <li>Add your <span className="font-semibold">Subjects</span> and assign them to branches.</li>
                    <li>Add your <span className="font-semibold">Teachers</span>, assign their subjects, and set their <span className="font-semibold text-blue-600">Availability</span>.</li>
                    <li>Configure <span className="font-semibold">Common Classes</span> for shared subjects.</li>
                    <li>Go to the <span className="font-semibold text-green-600">ALLOCATE</span> tab to generate the timetable!</li>
                </ol>
            </div>
         </div>
    );
}


// --- Reusable Branch Selector Component ---
function BranchSelector({ departments, selectedBranchIds, onBranchChange }) {
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('');

    const allBranchesFlat = useMemo(() => departments.flatMap(dept => 
        dept.courses.flatMap(course => 
            course.branches.map(branch => ({
                ...branch,
                courseName: course.name,
                deptName: dept.name,
                deptId: dept.id,
                courseId: course.id,
            }))
        )
    ), [departments]);

    const handleAddBranch = () => {
        if (!selectedBranch || selectedBranchIds.includes(selectedBranch)) return;
        onBranchChange([...selectedBranchIds, selectedBranch]);
        setSelectedBranch('');
    };
    
    const handleRemoveBranch = (branchId) => {
        onBranchChange(selectedBranchIds.filter(id => id !== branchId));
    };

    const coursesInSelectedDept = selectedDept ? departments.find(d => d.id === selectedDept)?.courses || [] : [];
    const branchesInSelectedCourse = selectedCourse ? coursesInSelectedDept.find(c => c.id === selectedCourse)?.branches || [] : [];

    return (
        <div className="border p-3 rounded-md bg-slate-50 space-y-3">
            <h4 className="font-semibold text-slate-600">Assign to Branches</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                <select value={selectedDept} onChange={e => { setSelectedDept(e.target.value); setSelectedCourse(''); setSelectedBranch(''); }} className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white text-sm">
                    <option value="">Select Department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select value={selectedCourse} onChange={e => { setSelectedCourse(e.target.value); setSelectedBranch(''); }} disabled={!selectedDept} className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white text-sm">
                    <option value="">Select Course</option>
                    {coursesInSelectedDept.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} disabled={!selectedCourse} className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white text-sm">
                    <option value="">Select Branch</option>
                    {branchesInSelectedCourse.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
            </div>
            <button type="button" onClick={handleAddBranch} disabled={!selectedBranch} className="w-full text-sm bg-blue-500 text-white p-2 rounded-lg shadow hover:bg-blue-600 disabled:bg-slate-300">
                Add Selected Branch
            </button>
            <div>
                <h5 className="text-xs font-medium text-slate-500 mt-2">Assigned Branches:</h5>
                <div className="mt-1 space-y-1">
                    {selectedBranchIds.length > 0 ? selectedBranchIds.map(id => {
                        const branch = allBranchesFlat.find(b => b.id === id);
                        return (
                            <div key={id} className="flex justify-between items-center bg-white p-1.5 rounded-md text-xs">
                                <span>{branch ? `${branch.deptName} > ${branch.courseName} > ${branch.name}` : 'Unknown Branch'}</span>
                                <button type="button" onClick={() => handleRemoveBranch(id)} className="text-red-500 hover:text-red-700">
                                    <CloseIcon className="h-4 w-4"/>
                                </button>
                            </div>
                        );
                    }) : <p className="text-xs text-slate-400">No branches assigned yet.</p>}
                </div>
            </div>
        </div>
    );
}

// --- Reusable Availability Selector (Object-based for Classrooms) ---
function AvailabilitySelector({ availability, onAvailabilityChange }) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const handleDayToggle = (day) => {
        const newAvailability = { ...availability };
        newAvailability[day].isAvailable = !newAvailability[day].isAvailable;
        onAvailabilityChange(newAvailability);
    };

    const handleTimeChange = (day, timeType, value) => {
        const newAvailability = { ...availability };
        newAvailability[day][timeType] = value;
        onAvailabilityChange(newAvailability);
    };

    return (
        <div className="border p-3 rounded-md bg-slate-50 space-y-2">
            <h4 className="font-semibold text-slate-600 mb-2">Weekly Availability</h4>
            {days.map(day => (
                <div key={day} className="grid grid-cols-3 gap-2 items-center">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id={`avail-${day}`}
                            checked={availability[day].isAvailable}
                            onChange={() => handleDayToggle(day)}
                            className="h-4 w-4 rounded"
                        />
                        <label htmlFor={`avail-${day}`} className="font-medium text-sm">{day}</label>
                    </div>
                    <input
                        type="time"
                        value={availability[day].startTime}
                        onChange={(e) => handleTimeChange(day, 'startTime', e.target.value)}
                        disabled={!availability[day].isAvailable}
                        className="p-1 border border-slate-300 rounded-md text-sm disabled:bg-slate-200"
                    />
                    <input
                        type="time"
                        value={availability[day].endTime}
                        onChange={(e) => handleTimeChange(day, 'endTime', e.target.value)}
                        disabled={!availability[day].isAvailable}
                        className="p-1 border border-slate-300 rounded-md text-sm disabled:bg-slate-200"
                    />
                </div>
            ))}
        </div>
    );
}


function ClassroomsManager({ user, classrooms, departments }) {
    const defaultAvailability = {
        Monday: { isAvailable: true, startTime: '09:00', endTime: '17:00' },
        Tuesday: { isAvailable: true, startTime: '09:00', endTime: '17:00' },
        Wednesday: { isAvailable: true, startTime: '09:00', endTime: '17:00' },
        Thursday: { isAvailable: true, startTime: '09:00', endTime: '17:00' },
        Friday: { isAvailable: true, startTime: '09:00', endTime: '17:00' },
        Saturday: { isAvailable: false, startTime: '09:00', endTime: '13:00' },
    };

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClassroom, setEditingClassroom] = useState(null);
    const [formData, setFormData] = useState({ 
        number: '', 
        capacity: '', 
        type: 'Lecture', 
        isFixed: false, 
        fixedForBranches: [], 
        features: '',
        availability: defaultAvailability
    });

    useEffect(() => {
        if (editingClassroom) {
            setFormData({
                number: editingClassroom.number,
                capacity: editingClassroom.capacity,
                type: editingClassroom.type || 'Lecture',
                isFixed: editingClassroom.isFixed || false,
                fixedForBranches: editingClassroom.fixedForBranches || [],
                features: (editingClassroom.features || []).join(', '),
                availability: editingClassroom.availability || defaultAvailability
            });
            setIsModalOpen(true);
        }
    }, [editingClassroom, defaultAvailability]);

    const handleOpenAddModal = () => {
        setEditingClassroom(null);
        setFormData({ number: '', capacity: '', type: 'Lecture', isFixed: false, fixedForBranches: [], features: '', availability: defaultAvailability });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingClassroom(null);
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const classroomData = {
            ...formData,
            capacity: parseInt(formData.capacity, 10),
            features: formData.features.split(',').map(f => f.trim()).filter(Boolean)
        };
        
        // Ensure capacity is a valid number
        if (isNaN(classroomData.capacity) || classroomData.capacity <= 0) {
            alert("Please enter a valid capacity.");
            return;
        }

        const instituteRef = doc(db, "institutes", user.uid);
        try {
            if (editingClassroom) {
                const updatedClassrooms = classrooms.map(c => c.id === editingClassroom.id ? { ...editingClassroom, ...classroomData } : c);
                await updateDoc(instituteRef, { classrooms: updatedClassrooms });
                await logAction(user.uid, "CLASSROOM_EDITED", `Edited classroom: ${classroomData.number}`);
            } else {
                const newClassroom = { id: `cls-${Date.now()}`, ...classroomData };
                await updateDoc(instituteRef, { classrooms: arrayUnion(newClassroom) });
                await logAction(user.uid, "CLASSROOM_ADDED", `Added classroom: ${classroomData.number}`);
            }
            handleCloseModal();
        } catch (error) {
            console.error("Error saving classroom:", error);
        }
    };
    
    const handleDeleteClassroom = async (classroomToDelete) => {
        // Use custom modal instead of window.confirm
        if (true) { // Replace with custom confirm modal logic if available
            try {
                const instituteRef = doc(db, "institutes", user.uid);
                await updateDoc(instituteRef, { classrooms: arrayRemove(classroomToDelete) });
                await logAction(user.uid, "CLASSROOM_DELETED", `Deleted classroom: ${classroomToDelete.number}`);
            } catch (error) {
                console.error("Error deleting classroom:", error);
            }
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Manage Classrooms</h2>
                <button onClick={handleOpenAddModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 font-semibold transition-transform transform hover:scale-105 flex items-center gap-2">
                    <PlusIcon /> Add Classroom
                </button>
            </div>
            
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingClassroom ? "Edit Classroom" : "Add New Classroom"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600">Classroom Number*</label>
                            <input name="number" value={formData.number} onChange={handleFormChange} required className="mt-1 w-full p-2 border border-slate-300 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600">Capacity*</label>
                            <input name="capacity" type="number" value={formData.capacity} onChange={handleFormChange} required className="mt-1 w-full p-2 border border-slate-300 rounded-md shadow-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600">Type*</label>
                        <select name="type" value={formData.type} onChange={handleFormChange} className="mt-1 w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white">
                            <option>Lecture</option>
                            <option>Lab</option>
                            <option>Both</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-600">Features (comma-separated)</label>
                        <input name="features" value={formData.features} onChange={handleFormChange} placeholder="Projector, AC" className="mt-1 w-full p-2 border border-slate-300 rounded-md shadow-sm" />
                    </div>
                     <AvailabilitySelector 
                        availability={formData.availability} 
                        onAvailabilityChange={(newAvail) => setFormData(prev => ({...prev, availability: newAvail}))} 
                    />
                    <div className="flex items-center gap-2">
                        <input id="isFixed" name="isFixed" type="checkbox" checked={formData.isFixed} onChange={handleFormChange} className="h-4 w-4 rounded text-blue-600" />
                        <label htmlFor="isFixed" className="font-medium text-slate-700">Fixed Allocation (Lock for specific branches)</label>
                    </div>
                    {formData.isFixed && (
                        <BranchSelector departments={departments} selectedBranchIds={formData.fixedForBranches} onBranchChange={(ids) => setFormData(prev => ({...prev, fixedForBranches: ids}))}/>
                    )}
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold">Save Classroom</button>
                    </div>
                </form>
            </Modal>

            <div className="bg-white p-6 rounded-lg shadow-lg border border-slate-200">
                <h3 className="text-xl font-semibold text-slate-700 mb-4">Existing Classrooms ({classrooms.length})</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="p-3 text-sm font-semibold text-slate-600 uppercase tracking-wider">Room</th>
                                <th className="p-3 text-sm font-semibold text-slate-600 uppercase tracking-wider">Capacity</th>
                                <th className="p-3 text-sm font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                                <th className="p-3 text-sm font-semibold text-slate-600 uppercase tracking-wider">Fixed For</th>
                                <th className="p-3 text-sm font-semibold text-slate-600 uppercase tracking-wider text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {classrooms.length > 0 ? classrooms.map(c => (
                                <tr key={c.id} className="border-b border-slate-200 hover:bg-slate-50">
                                    <td className="p-3 font-medium text-slate-800">{c.number}</td>
                                    <td className="p-3 text-slate-600">{c.capacity}</td>
                                    <td className="p-3 text-slate-600">{c.type}</td>
                                    <td className="p-3 text-slate-600 text-xs">
                                        {c.isFixed ? `${c.fixedForBranches.length} branch(es)` : <span className="text-slate-400">N/A</span>}
                                    </td>
                                    <td className="p-3 text-center flex items-center justify-center gap-2">
                                        <button onClick={() => setEditingClassroom(c)} className="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-100"><EditIcon /></button>
                                        <button onClick={() => handleDeleteClassroom(c)} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100"><TrashIcon /></button>
                                    </td>
                                </tr>
                            )) : ( 
                                <tr><td colSpan="5" className="p-4 text-center text-slate-500">No classrooms added yet.</td></tr>
                             )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// --- MODIFIED (REQUEST 2): Added settings prop and Availability Selector ---
function TeachersManager({ user, teachers, departments, subjects, settings }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState(null);

    // Default timings from settings or a hardcoded fallback
    const defaultTimings = useMemo(() => settings?.timings || [
        { day: 'Monday', isAvailable: true, startTime: '09:00', endTime: '17:00' },
        { day: 'Tuesday', isAvailable: true, startTime: '09:00', endTime: '17:00' },
        { day: 'Wednesday', isAvailable: true, startTime: '09:00', endTime: '17:00' },
        { day: 'Thursday', isAvailable: true, startTime: '09:00', endTime: '17:00' },
        { day: 'Friday', isAvailable: true, startTime: '09:00', endTime: '17:00' },
        { day: 'Saturday', isAvailable: true, startTime: '09:00', endTime: '13:00' },
    ], [settings?.timings]);

    const [formData, setFormData] = useState({ 
        name: '', 
        misId: '', 
        load: '', 
        departmentId: '', 
        assignedBranches: [], 
        assignedSubjects: [],
        availability: defaultTimings // --- ADDED (REQUEST 2)
    });
    
    useEffect(() => {
        if (editingTeacher) {
            setFormData({ 
                name: editingTeacher.name, 
                misId: editingTeacher.misId, 
                load: editingTeacher.load,
                departmentId: editingTeacher.departmentId || '',
                assignedBranches: editingTeacher.assignedBranches || [],
                assignedSubjects: editingTeacher.assignedSubjects || [],
                availability: editingTeacher.availability || defaultTimings // --- ADDED (REQUEST 2)
            });
            setIsModalOpen(true);
        }
    }, [editingTeacher, defaultTimings]);

    const handleOpenAddModal = () => {
        setEditingTeacher(null);
        setFormData({ 
            name: '', 
            misId: '', 
            load: '', 
            departmentId: '', 
            assignedBranches: [], 
            assignedSubjects: [],
            availability: defaultTimings // --- ADDED (REQUEST 2)
        });
        setIsModalOpen(true);
    };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingTeacher(null); };
    
    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        if(name === 'assignedSubjects') {
            const newSubjects = checked 
                ? [...formData.assignedSubjects, value] 
                : formData.assignedSubjects.filter(id => id !== value);
            setFormData(prev => ({...prev, assignedSubjects: newSubjects}));
        } else {
            setFormData(prev => ({...prev, [name]: value}));
        }
    };
    
    const handleBranchChange = (newBranchIds) => {
        setFormData(prev => ({...prev, assignedBranches: newBranchIds}));
    };

    // --- ADDED (REQUEST 2) ---
    const handleAvailabilityChange = (newAvailability) => {
        setFormData(prev => ({ ...prev, availability: newAvailability }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const teacherData = { ...formData, load: parseInt(formData.load, 10) };
        
        if (isNaN(teacherData.load) || teacherData.load <= 0) {
            alert("Please enter a valid weekly load.");
            return;
        }

        const instituteRef = doc(db, "institutes", user.uid);
        try {
            if (editingTeacher) {
                const updatedTeachers = teachers.map(t => t.id === editingTeacher.id ? {...editingTeacher, ...teacherData} : t);
                await updateDoc(instituteRef, { teachers: updatedTeachers });
                await logAction(user.uid, "TEACHER_EDITED", `Edited teacher: ${teacherData.name}`);
            } else {
                const newTeacher = { id: `teacher-${Date.now()}`, ...teacherData };
                await updateDoc(instituteRef, { teachers: arrayUnion(newTeacher) });
                await logAction(user.uid, "TEACHER_ADDED", `Added teacher: ${teacherData.name}`);
            }
            handleCloseModal();
        } catch (error) {
            console.error("Error saving teacher:", error);
        }
    };
    
    const handleDeleteTeacher = async (teacherToDelete) => {
        // Use custom modal instead of window.confirm
        if (true) { // Replace with custom confirm modal logic if available
            try {
                const instituteRef = doc(db, "institutes", user.uid);
                await updateDoc(instituteRef, { teachers: arrayRemove(teacherToDelete) });
                await logAction(user.uid, "TEACHER_DELETED", `Deleted teacher: ${teacherToDelete.name}`);
            } catch (error) {
                console.error("Error deleting teacher:", error);
            }
        }
    };

    const availableSubjects = useMemo(() => {
        if (formData.assignedBranches.length === 0) return [];
        return subjects.filter(subject => 
            subject.branches.some(branchId => formData.assignedBranches.includes(branchId))
        );
    }, [subjects, formData.assignedBranches]);

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                 <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Manage Teachers</h2>
                 <button onClick={handleOpenAddModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 font-semibold transition-transform transform hover:scale-105 flex items-center gap-2"><PlusIcon /> Add Teacher</button>
            </div>
            
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-slate-600">Teacher Name*</label>
                        <input name="name" value={formData.name} onChange={handleFormChange} required className="mt-1 w-full p-2 border border-slate-300 rounded-md shadow-sm" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-600">MIS ID*</label>
                        <input name="misId" value={formData.misId} onChange={handleFormChange} required className="mt-1 w-full p-2 border border-slate-300 rounded-md shadow-sm" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-600">Weekly Load (hours)*</label>
                        <input name="load" type="number" value={formData.load} onChange={handleFormChange} required className="mt-1 w-full p-2 border border-slate-300 rounded-md shadow-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600">Primary Department*</label>
                        <select name="departmentId" value={formData.departmentId} onChange={handleFormChange} required className="mt-1 w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white">
                            <option value="">Select a department</option>
                            {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                        </select>
                    </div>

                    {/* --- ADDED (REQUEST 2): Availability Selector for Teachers --- */}
                    <div className="border p-3 rounded-md bg-slate-50 space-y-2">
                        <DayWiseAvailabilitySelector 
                            availability={formData.availability} 
                            onAvailabilityChange={handleAvailabilityChange} 
                        />
                    </div>

                    <BranchSelector departments={departments} selectedBranchIds={formData.assignedBranches} onBranchChange={handleBranchChange} />

                    <div className="border p-3 rounded-md bg-slate-50 max-h-48 overflow-y-auto">
                        <h4 className="font-semibold text-slate-600 mb-2">Assign Subjects</h4>
                        {availableSubjects.length > 0 ? availableSubjects.map(subject => (
                            <div key={subject.id} className="flex items-center gap-2">
                                <input type="checkbox" id={`teacher-subj-${subject.id}`} name="assignedSubjects" value={subject.id} checked={formData.assignedSubjects.includes(subject.id)} onChange={handleFormChange} className="h-4 w-4 rounded" />
                                <label htmlFor={`teacher-subj-${subject.id}`} className="text-sm">{subject.name} ({subject.code})</label>
                            </div>
                        )) : <p className="text-sm text-slate-500">Assign branches to see available subjects.</p>}
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold">Save Teacher</button>
                    </div>
                </form>
            </Modal>

            <div className="bg-white p-6 rounded-lg shadow-lg border border-slate-200">
                <h3 className="text-xl font-semibold text-slate-700 mb-4">Existing Teachers ({teachers.length})</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="p-3 text-sm font-semibold text-slate-600 uppercase tracking-wider">Name</th>
                                <th className="p-3 text-sm font-semibold text-slate-600 uppercase tracking-wider">Department</th>
                                <th className="p-3 text-sm font-semibold text-slate-600 uppercase tracking-wider">Branches</th>
                                <th className="p-3 text-sm font-semibold text-slate-600 uppercase tracking-wider">Subjects</th>
                                <th className="p-3 text-sm font-semibold text-slate-600 uppercase tracking-wider text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {teachers.length > 0 ? teachers.map(t => {
                                const dept = departments.find(d => d.id === t.departmentId);
                                return (
                                <tr key={t.id} className="border-b border-slate-200 hover:bg-slate-50">
                                    <td className="p-3 font-medium text-slate-800">{t.name} <span className="text-xs text-slate-400">({t.misId})</span></td>
                                    <td className="p-3 text-slate-600">{dept ? dept.name : 'N/A'}</td>
                                    <td className="p-3 text-slate-600 text-xs">{(t.assignedBranches || []).length} assigned</td>
                                    <td className="p-3 text-slate-600 text-xs">{(t.assignedSubjects || []).length} assigned</td>
                                    <td className="p-3 text-center flex items-center justify-center gap-2">
                                        <button onClick={() => setEditingTeacher(t)} className="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-100"><EditIcon /></button>
                                        <button onClick={() => handleDeleteTeacher(t)} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100"><TrashIcon /></button>
                                    </td>
                                </tr>
                                )
                            }) : ( 
                                <tr><td colSpan="5" className="p-4 text-center text-slate-500">No teachers added yet.</td></tr>
                             )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// --- DepartmentsManager ---
function DepartmentsManager({ user, departments }) {
    const [newDeptName, setNewDeptName] = useState('');
    const [editingDept, setEditingDept] = useState(null);
    const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);

    useEffect(() => {
        if(editingDept) {
            setNewDeptName(editingDept.name);
            setIsDeptModalOpen(true);
        }
    }, [editingDept]);

    const handleOpenAddModal = () => {
        setNewDeptName('');
        setIsDeptModalOpen(true);
        setEditingDept(null);
    }
    const handleCloseDeptModal = () => {
        setIsDeptModalOpen(false);
        setEditingDept(null);
    }

    const handleDeptSubmit = async (e) => {
        e.preventDefault();
        if (!newDeptName.trim()) return;

        const instituteRef = doc(db, "institutes", user.uid);
        try {
            if(editingDept){
                const updatedDepts = departments.map(d => d.id === editingDept.id ? {...d, name: newDeptName} : d);
                await updateDoc(instituteRef, { departments: updatedDepts });
                await logAction(user.uid, "DEPARTMENT_EDITED", `Edited department: ${newDeptName}`);
            } else {
                const newDept = { id: `dept-${Date.now()}`, name: newDeptName.trim(), courses: [] };
                await updateDoc(instituteRef, { departments: arrayUnion(newDept) });
                await logAction(user.uid, "DEPARTMENT_ADDED", `Added department: ${newDeptName.trim()}`);
            }
            handleCloseDeptModal();
        } catch (error) {
            console.error("Error saving department:", error);
        }
    };

    const handleDeleteDepartment = async (deptToDelete) => {
        // Use custom modal instead of window.confirm
        if (true) { // Replace with custom confirm modal logic if available
            try {
                const instituteRef = doc(db, "institutes", user.uid);
                await updateDoc(instituteRef, { departments: arrayRemove(deptToDelete) });
                await logAction(user.uid, "DEPARTMENT_DELETED", `Deleted department: ${deptToDelete.name}`);
            } catch (error) {
                console.error("Error deleting department:", error);
            }
        }
    };

    const handleUpdate = async (updatedDepartments, logMsg) => {
        try {
            const instituteRef = doc(db, "institutes", user.uid);
            await updateDoc(instituteRef, { departments: updatedDepartments });
            if(logMsg) await logAction(user.uid, logMsg.action, logMsg.details);
        } catch (error) {
            console.error("Error updating departments:", error);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                 <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Manage Departments & Courses</h2>
                 <button onClick={handleOpenAddModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 font-semibold transition-transform transform hover:scale-105 flex items-center gap-2"><PlusIcon /> Add Department</button>
            </div>

            <Modal isOpen={isDeptModalOpen} onClose={handleCloseDeptModal} title={editingDept ? 'Edit Department' : 'Add New Department'}>
                <form onSubmit={handleDeptSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-600">Department Name*</label>
                        <input value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} required className="mt-1 w-full p-2 border border-slate-300 rounded-md shadow-sm" />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={handleCloseDeptModal} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold">Save Department</button>
                    </div>
                </form>
            </Modal>
            
            <div className="space-y-4">
                <h3 className="text-xl font-semibold text-slate-700">Existing Departments ({departments.length})</h3>
                {departments.length > 0 ? departments.map(dept => ( <DepartmentCard key={dept.id} department={dept} onDelete={handleDeleteDepartment} onUpdate={handleUpdate} departments={departments} setEditingDept={setEditingDept}/> )) : <p className="text-center text-slate-500 py-4">No departments created yet.</p>}
            </div>
        </div>
    );
}

function DepartmentCard({ department, onDelete, onUpdate, departments, setEditingDept }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const handleCourseUpdate = (updatedCourse, isDeletion = false, originalCourseName = '') => {
        let updatedCourses;
        let logMsg;
        if(isDeletion){
            updatedCourses = department.courses.filter(c => c.id !== updatedCourse.id);
            logMsg = { action: "COURSE_DELETED", details: `Deleted course '${updatedCourse.name}' from '${department.name}'` };
        } else {
            updatedCourses = department.courses.map(c => c.id === updatedCourse.id ? updatedCourse : c);
            logMsg = { action: "COURSE_EDITED", details: `Edited course from '${originalCourseName}' to '${updatedCourse.name}' in '${department.name}'` };
        }
        const updatedDept = {...department, courses: updatedCourses};
        const updatedDepartments = departments.map(d => d.id === department.id ? updatedDept : d);
        onUpdate(updatedDepartments, logMsg);
    };

    const handleAddCourse = (courseName) => {
        const newCourse = { id: `course-${Date.now()}`, name: courseName, branches: [] };
        const updatedDept = { ...department, courses: [...department.courses, newCourse] };
        const updatedDepartments = departments.map(d => d.id === department.id ? updatedDept : d);
        const logMsg = { action: "COURSE_ADDED", details: `Added course '${courseName}' to '${department.name}'` };
        onUpdate(updatedDepartments, logMsg);
    };
    
    const handleCourseDelete = (courseToDelete) => {
        // Use custom modal instead of window.confirm
        if (true) { // Replace with custom confirm modal logic if available
            handleCourseUpdate(courseToDelete, true);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-lg border border-slate-200">
            <div className="p-4 flex justify-between items-center cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <h4 className="text-lg font-bold text-slate-800">{department.name}</h4>
                <div className="flex items-center gap-2">
                    <button onClick={(e) => {e.stopPropagation(); setEditingDept(department)}} className="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-100"><EditIcon/></button>
                    <button onClick={(e) => {e.stopPropagation(); onDelete(department)}} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100"><TrashIcon /></button>
                    <span className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                </div>
            </div>
            {isExpanded && (
                <div className="p-4 border-t border-slate-200 space-y-4">
                    <AddCourseForm onAddCourse={handleAddCourse} />
                    <div className="space-y-2">
                         {department.courses.length > 0 ? department.courses.map(course => (
                            <CourseCard key={course.id} course={course} onCourseUpdate={handleCourseUpdate} onCourseDelete={handleCourseDelete} departmentName={department.name} />
                        )) : <p className="text-sm text-center text-slate-500 py-2">No courses in this department yet.</p>}
                    </div>
                </div>
            )}
        </div>
    );
}

function AddCourseForm({ onAddCourse }) {
    const [name, setName] = useState('');
    const handleSubmit = (e) => { e.preventDefault(); if (!name.trim()) return; onAddCourse(name.trim()); setName(''); };
    return (
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <div className="flex-grow">
                <label className="text-xs font-medium text-slate-500">New Course Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Bachelors of Technology" className="w-full p-2 border border-slate-300 rounded-md shadow-sm" />
            </div>
            <button type="submit" className="bg-green-500 text-white p-2 rounded-lg shadow hover:bg-green-600"><PlusIcon /></button>
        </form>
    );
}

function CourseCard({ course, onCourseUpdate, onCourseDelete, departmentName }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingName, setEditingName] = useState(course.name);

    const handleEditSubmit = (e) => {
        e.preventDefault();
        if (!editingName.trim()) return;
        onCourseUpdate({...course, name: editingName}, false, course.name);
        setIsEditing(false);
    };
    
    const handleBranchUpdate = (updatedBranches, logDetails) => {
        const logMsg = {action: 'BRANCH_UPDATE', details: logDetails};
        onCourseUpdate({...course, branches: updatedBranches}, false, logMsg);
    };
    
    const handleAddBranch = (branchName, studentCount) => {
        const newBranch = { id: `branch-${Date.now()}`, name: branchName, students: parseInt(studentCount, 10) };
        const updatedBranches = [...course.branches, newBranch];
        const logDetails = `Added branch '${branchName}' to course '${course.name}'`;
        handleBranchUpdate(updatedBranches, logDetails);
    };

    const handleBranchDelete = (branchId) => {
        // Use custom modal instead of window.confirm
        if (true) { // Replace with custom confirm modal logic if available
            const branchName = course.branches.find(b => b.id === branchId)?.name || 'unknown';
            const updatedBranches = course.branches.filter(b => b.id !== branchId);
            const logDetails = `Deleted branch '${branchName}' from course '${course.name}'`;
            handleBranchUpdate(updatedBranches, logDetails);
        }
    };

    return (
        <div className="bg-slate-50 p-3 rounded-md border">
            {isEditing ? (
                 <form onSubmit={handleEditSubmit} className="flex items-center gap-2">
                    <input value={editingName} onChange={e => setEditingName(e.target.value)} className="w-full p-1 border border-slate-300 rounded-md"/>
                    <button type="submit" className="bg-blue-500 text-white px-2 py-1 rounded">Save</button>
                    <button type="button" onClick={() => setIsEditing(false)} className="bg-slate-200 px-2 py-1 rounded">Cancel</button>
                </form>
            ) : (
                <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                    <h5 className="font-semibold text-slate-700">{course.name}</h5>
                    <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-100"><EditIcon /></button>
                        <button onClick={(e) => {e.stopPropagation(); onCourseDelete(course)}} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100"><TrashIcon /></button>
                        <span className={`transform transition-transform duration-200 text-xs ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                </div>
            )}
            {isExpanded && (
                <div className="pt-3 mt-3 border-t space-y-3">
                    <AddBranchForm onAddBranch={handleAddBranch} />
                    {course.branches.length > 0 && 
                        <table className="w-full text-sm">
                            <tbody>
                            {course.branches.map(branch => (
                                <tr key={branch.id}>
                                    <td className="py-1">{branch.name}</td>
                                    <td className="py-1 text-right">{branch.students} students</td>
                                    <td className="py-1 text-right w-16 flex justify-end gap-2">
                                        <button className="text-blue-500 hover:text-blue-700 opacity-50 cursor-not-allowed" title="Edit coming soon"><EditIcon /></button>
                                        <button onClick={() => handleBranchDelete(branch.id)} className="text-red-400 hover:text-red-600"><TrashIcon /></button>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    }
                </div>
            )}
        </div>
    );
}

function AddBranchForm({ onAddBranch }) {
    const [name, setName] = useState('');
    const [count, setCount] = useState('');
    const handleSubmit = (e) => { 
        e.preventDefault(); 
        if (!name.trim() || !count || parseInt(count, 10) <= 0) {
            alert("Please enter a valid branch name and student count.");
            return;
        }
        onAddBranch(name.trim(), count); 
        setName(''); 
        setCount(''); 
    };

    return (
        <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-2 items-end">
            <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500">New Branch/Division</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Section A" className="w-full p-1 border border-slate-300 rounded-md"/>
            </div>
            <div>
                <label className="text-xs font-medium text-slate-500">Students</label>
                <input type="number" value={count} onChange={e => setCount(e.target.value)} placeholder="e.g., 60" className="w-full p-1 border border-slate-300 rounded-md"/>
            </div>
            <button type="submit" className="col-span-3 bg-blue-500 text-white p-2 rounded-lg shadow hover:bg-blue-600 text-sm">Add Branch</button>
        </form>
    );
}

// --- SubjectsManager ---
function SubjectsManager({ user, subjects, departments }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSubject, setEditingSubject] = useState(null);
    const [formData, setFormData] = useState({ name: '', code: '', type: 'Theory', hours: '', branches: [] });
    
    useEffect(() => {
        if (editingSubject) {
            setFormData({
                name: editingSubject.name,
                code: editingSubject.code,
                type: editingSubject.type,
                hours: editingSubject.hours,
                branches: editingSubject.branches || []
            });
            setIsModalOpen(true);
        }
    }, [editingSubject]);
    
    const handleOpenAddModal = () => {
        setEditingSubject(null);
        setFormData({ name: '', code: '', type: 'Theory', hours: '', branches: [] });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingSubject(null);
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    };
    
    const handleBranchChange = (newBranchIds) => {
        setFormData(prev => ({...prev, branches: newBranchIds}));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const subjectData = {...formData, hours: parseInt(formData.hours, 10)};
        
        if (isNaN(subjectData.hours) || subjectData.hours <= 0) {
            alert("Please enter a valid number of weekly hours.");
            return;
        }

        const instituteRef = doc(db, "institutes", user.uid);
        try {
            if (editingSubject) {
                const updatedSubjects = subjects.map(s => s.id === editingSubject.id ? {...editingSubject, ...subjectData} : s);
                await updateDoc(instituteRef, { subjects: updatedSubjects });
                await logAction(user.uid, "SUBJECT_EDITED", `Edited subject: ${subjectData.name}`);
            } else {
                const newSubject = { id: `subj-${Date.now()}`, ...subjectData };
                await updateDoc(instituteRef, { subjects: arrayUnion(newSubject) });
                await logAction(user.uid, "SUBJECT_ADDED", `Added subject: ${subjectData.name}`);
            }
            handleCloseModal();
        } catch (error) {
            console.error("Error saving subject:", error);
        }
    };

    const handleDeleteSubject = async (subjectToDelete) => {
        // Use custom modal instead of window.confirm
        if (true) { // Replace with custom confirm modal logic if available
            try {
                const instituteRef = doc(db, "institutes", user.uid);
                await updateDoc(instituteRef, { subjects: arrayRemove(subjectToDelete) });
                await logAction(user.uid, "SUBJECT_DELETED", `Deleted subject: ${subjectToDelete.name}`);
            } catch (error) {
                console.error("Error deleting subject:", error);
            }
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Manage Subjects</h2>
                <button onClick={handleOpenAddModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 font-semibold transition-transform transform hover:scale-105 flex items-center gap-2">
                    <PlusIcon /> Add Subject
                </button>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingSubject ? 'Edit Subject' : 'Add New Subject'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600">Subject Name*</label>
                            <input name="name" value={formData.name} onChange={handleFormChange} required className="mt-1 w-full p-2 border border-slate-300 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600">Subject Code*</label>
                            <input name="code" value={formData.code} onChange={handleFormChange} required className="mt-1 w-full p-2 border border-slate-300 rounded-md shadow-sm" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600">Type*</label>
                            <select name="type" value={formData.type} onChange={handleFormChange} className="mt-1 w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white">
                                <option>Theory</option>
                                <option>Lab</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600">Weekly Hours*</label>
                            <input name="hours" type="number" value={formData.hours} onChange={handleFormChange} required className="mt-1 w-full p-2 border border-slate-300 rounded-md shadow-sm" />
                        </div>
                    </div>
                    
                    <BranchSelector departments={departments} selectedBranchIds={formData.branches} onBranchChange={handleBranchChange} />

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold">Save Subject</button>
                    </div>
                </form>
            </Modal>

            <div className="bg-white p-6 rounded-lg shadow-lg border border-slate-200">
                <h3 className="text-xl font-semibold text-slate-700 mb-4">Existing Subjects ({subjects.length})</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                         <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="p-3 text-sm font-semibold text-slate-600 uppercase tracking-wider">Subject Name</th>
                                <th className="p-3 text-sm font-semibold text-slate-600 uppercase tracking-wider">Code</th>
                                <th className="p-3 text-sm font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                                <th className="p-3 text-sm font-semibold text-slate-600 uppercase tracking-wider">Hours/Week</th>
                                <th className="p-3 text-sm font-semibold text-slate-600 uppercase tracking-wider text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subjects.length > 0 ? subjects.map(s => (
                                <tr key={s.id} className="border-b border-slate-200 hover:bg-slate-50">
                                    <td className="p-3 font-medium text-slate-800">{s.name}</td>
                                    <td className="p-3 text-slate-600">{s.code}</td>
                                    <td className="p-3 text-slate-600">{s.type}</td>
                                    <td className="p-3 text-slate-600">{s.hours}</td>
                                    <td className="p-3 text-center flex items-center justify-center gap-2">
                                        <button onClick={() => setEditingSubject(s)} className="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-100"><EditIcon /></button>
                                        <button onClick={() => handleDeleteSubject(s)} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100"><TrashIcon /></button>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="5" className="p-4 text-center text-slate-500">No subjects added yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// --- CommonClassesManager ---
function CommonClassesManager({ user, commonClasses, subjects, departments }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClass, setEditingClass] = useState(null);
    const [formData, setFormData] = useState({ subjectId: '', branchIds: [] });

    useEffect(() => {
        if (editingClass) {
            setFormData({
                subjectId: editingClass.subjectId,
                branchIds: editingClass.branchIds || []
            });
            setIsModalOpen(true);
        }
    }, [editingClass]);

    const handleOpenAddModal = () => {
        setEditingClass(null);
        setFormData({ subjectId: '', branchIds: [] });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingClass(null);
    };
    
    const handleBranchChange = (newBranchIds) => {
        setFormData(prev => ({ ...prev, branchIds: newBranchIds }));
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const classData = { ...formData };

        if (!classData.subjectId || classData.branchIds.length < 2) {
            alert("Please select a subject and at least two branches for a common class.");
            return;
        }

        const instituteRef = doc(db, "institutes", user.uid);
        try {
            if (editingClass) {
                const updatedClasses = commonClasses.map(c => c.id === editingClass.id ? { ...editingClass, ...classData } : c);
                await updateDoc(instituteRef, { commonClasses: updatedClasses });
                await logAction(user.uid, "COMMON_CLASS_EDITED", `Edited a common class configuration.`);
            } else {
                const newClass = { id: `cc-${Date.now()}`, ...classData };
                await updateDoc(instituteRef, { commonClasses: arrayUnion(newClass) });
                await logAction(user.uid, "COMMON_CLASS_ADDED", `Added a new common class configuration.`);
            }
            handleCloseModal();
        } catch (error) {
            console.error("Error saving common class:", error);
        }
    };

    const handleDeleteClass = async (classToDelete) => {
        // Use custom modal instead of window.confirm
        if (true) { // Replace with custom confirm modal logic if available
            try {
                const instituteRef = doc(db, "institutes", user.uid);
                await updateDoc(instituteRef, { commonClasses: arrayRemove(classToDelete) });
                await logAction(user.uid, "COMMON_CLASS_DELETED", `Deleted a common class configuration.`);
            } catch (error) {
                console.error("Error deleting common class:", error);
            }
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Manage Common Classes</h2>
                <button onClick={handleOpenAddModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 font-semibold transition-transform transform hover:scale-105 flex items-center gap-2">
                    <PlusIcon /> Add Common Class
                </button>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingClass ? 'Edit Common Class' : 'Add New Common Class'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-600">Subject*</label>
                        <select name="subjectId" value={formData.subjectId} onChange={handleFormChange} required className="mt-1 w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white">
                            <option value="">Select a subject</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                        </select>
                    </div>

                    <BranchSelector departments={departments} selectedBranchIds={formData.branchIds} onBranchChange={handleBranchChange} />
                    
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold">Save Configuration</button>
                    </div>
                </form>
            </Modal>

            <div className="bg-white p-6 rounded-lg shadow-lg border border-slate-200">
                <h3 className="text-xl font-semibold text-slate-700 mb-4">Existing Configurations ({commonClasses.length})</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="p-3 text-sm font-semibold text-slate-600 uppercase tracking-wider">Subject</th>
                                <th className="p-3 text-sm font-semibold text-slate-600 uppercase tracking-wider">Branches Assigned</th>
                                <th className="p-3 text-sm font-semibold text-slate-600 uppercase tracking-wider text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {commonClasses.length > 0 ? commonClasses.map(c => {
                                const subject = subjects.find(s => s.id === c.subjectId);
                                return (
                                <tr key={c.id} className="border-b border-slate-200 hover:bg-slate-50">
                                    <td className="p-3 font-medium text-slate-800">{subject ? `${subject.name} (${subject.code})` : 'Unknown Subject'}</td>
                                    <td className="p-3 text-slate-600">{c.branchIds.length}</td>
                                    <td className="p-3 text-center flex items-center justify-center gap-2">
                                        <button onClick={() => setEditingClass(c)} className="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-100"><EditIcon /></button>
                                        <button onClick={() => handleDeleteClass(c)} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100"><TrashIcon /></button>
                                    </td>
                                </tr>
                                )
                            }) : (
                                <tr><td colSpan="3" className="p-4 text-center text-slate-500">No common classes configured yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// --- MODIFIED (REQUEST 2): Allocation Algorithm ---
function AllocationManager({ user, allData, onGenerate }) {
    const [isTimingsModalOpen, setIsTimingsModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [localSettings, setLocalSettings] = useState({
        timings: [
            { day: 'Monday', isAvailable: true, startTime: '09:00', endTime: '17:00' },
            { day: 'Tuesday', isAvailable: true, startTime: '09:00', endTime: '17:00' },
            { day: 'Wednesday', isAvailable: true, startTime: '09:00', endTime: '17:00' },
            { day: 'Thursday', isAvailable: true, startTime: '09:00', endTime: '17:00' },
            { day: 'Friday', isAvailable: true, startTime: '09:00', endTime: '17:00' },
            { day: 'Saturday', isAvailable: true, startTime: '09:00', endTime: '13:00' },
        ],
        lunchStart: '13:00',
        lunchEnd: '14:00',
    });

    useEffect(() => {
        if (allData.settings) {
            setLocalSettings(prev => ({...prev, ...allData.settings}));
        }
    }, [allData.settings]);

    const handleTimingsChange = (updatedTimings) => {
        setLocalSettings(prev => ({ ...prev, timings: updatedTimings }));
    };

    const handleLunchChange = (e) => {
        setLocalSettings(prev => ({...prev, [e.target.name]: e.target.value}));
    };

    const handleSaveSettings = async () => {
        try {
            const instituteRef = doc(db, "institutes", user.uid);
            await updateDoc(instituteRef, {
                settings: localSettings
            });
            await logAction(user.uid, "SETTINGS_UPDATED", `Institute timings were updated.`);
            setIsTimingsModalOpen(false);
            // Don't use alert
        } catch (error) {
            console.error("Error saving settings:", error);
        }
    };

    // --- NEW (REQUEST 2): Allocation Algorithm ---
    const runAllocationAlgorithm = () => {
        const { classrooms, departments, teachers, subjects, commonClasses, settings } = allData;
        
        // --- 1. Helper Functions ---
        const parseTime = (time) => { // e.g., "09:00" -> 540
            const [hours, minutes] = time.split(':').map(Number);
            return hours * 60 + minutes;
        };
        const lunchStart = parseTime(settings.lunchStart || '13:00');
        const lunchEnd = parseTime(settings.lunchEnd || '14:00');

        const allBranches = departments.flatMap(d => d.courses.flatMap(c => c.branches));
        
        // --- 2. Generate Master Time Slots ---
        const masterTimeSlots = [];
        (settings.timings || []).forEach(day => {
            if (day.isAvailable) {
                let current = parseTime(day.startTime);
                const end = parseTime(day.endTime);
                while (current < end) {
                    const slotEnd = current + 60;
                    if (current < lunchStart && slotEnd > lunchStart) {
                        current = lunchEnd; // Skip to after lunch
                        continue;
                    }
                    if (current >= lunchStart && current < lunchEnd) {
                        current = lunchEnd;
                        continue;
                    }
                    if (slotEnd > end) break; // Don't go past end time

                    const slotId = `${String(Math.floor(current/60)).padStart(2,'0')}:${String(current%60).padStart(2,'0')}-${String(Math.floor(slotEnd/60)).padStart(2,'0')}:${String(slotEnd%60).padStart(2,'0')}`;
                    masterTimeSlots.push({ day: day.day, slot: slotId, start: current, end: slotEnd });
                    current += 60; // 1-hour slots
                }
            }
        });

        // --- 3. Initialize Empty Timetables ---
        let branchTimetable = {}; // { [branchId]: { [day]: { [slot]: {...} } } }
        let teacherTimetable = {}; // { [teacherId]: { [day]: { [slot]: true } } }
        let roomTimetable = {};    // { [roomId]: { [day]: { [slot]: true } } }

        allBranches.forEach(b => { branchTimetable[b.id] = {}; });
        teachers.forEach(t => { teacherTimetable[t.id] = {}; });
        classrooms.forEach(c => { roomTimetable[c.id] = {}; });

        // --- 4. Create Workload (Jobs to be Scheduled) ---
        let workload = [];
        let jobId = 0;

        // Add Common Classes
        commonClasses.forEach(cc => {
            const subject = subjects.find(s => s.id === cc.subjectId);
            if (!subject) return;
            const teacher = teachers.find(t => t.assignedSubjects.includes(subject.id));
            if (!teacher) return;
            
            const branchesInJob = allBranches.filter(b => cc.branchIds.includes(b.id));
            const totalStudents = branchesInJob.reduce((sum, b) => sum + (b.students || 0), 0);
            
            for (let i = 0; i < subject.hours; i++) {
                workload.push({
                    id: `job-${jobId++}`,
                    subjectId: subject.id,
                    subjectName: subject.name,
                    teacherId: teacher.id,
                    teacherName: teacher.name,
                    branchIds: cc.branchIds,
                    studentCount: totalStudents,
                    type: subject.type,
                    duration: 1,
                    isCommon: true,
                    splitGroupId: subject.id // To ensure split classes are on different days
                });
            }
        });

        // Add Regular Classes
        subjects.forEach(subject => {
            // Skip subjects already handled by common classes
            if (commonClasses.some(cc => cc.subjectId === subject.id)) return;

            const teacher = teachers.find(t => t.assignedSubjects.includes(subject.id));
            if (!teacher) return; // No teacher for this subject

            subject.branches.forEach(branchId => {
                const branch = allBranches.find(b => b.id === branchId);
                if (!branch) return;

                for (let i = 0; i < subject.hours; i++) {
                    workload.push({
                        id: `job-${jobId++}`,
                        subjectId: subject.id,
                        subjectName: subject.name,
                        teacherId: teacher.id,
                        teacherName: teacher.name,
                        branchIds: [branchId],
                        studentCount: branch.students || 0,
                        type: subject.type,
                        duration: 1,
                        isCommon: false,
                        splitGroupId: `${subject.id}-${branchId}` // Unique group for this subject + branch
                    });
                }
            });
        });

        // --- 5. Sort Workload (Hardest first) ---
        workload.sort((a, b) => {
            // Common classes first
            if (a.isCommon && !b.isCommon) return -1;
            if (!a.isCommon && b.isCommon) return 1;
            // Then by student count (desc)
            return b.studentCount - a.studentCount;
        });

        let unallocatedJobs = [];
        let scheduledCountByGroup = {}; // { [splitGroupId]: { [day]: true } }

        // --- 6. The Allocation Loop ---
        workload.forEach(job => {
            let scheduled = false;
            
            // Try to find a slot
            for (const slot of masterTimeSlots) {
                const { day, start, end } = slot;

                // --- RULE 1: Subject Spreading (Don't schedule same subject twice on one day for a group) ---
                if (scheduledCountByGroup[job.splitGroupId] && scheduledCountByGroup[job.splitGroupId][day]) {
                    continue; // Already scheduled this subject group today, skip
                }

                // --- RULE 2: Branch(es) Availability ---
                let branchesFree = true;
                for (const branchId of job.branchIds) {
                    if (branchTimetable[branchId][day] && branchTimetable[branchId][day][slot.slot]) {
                        branchesFree = false;
                        break;
                    }
                }
                if (!branchesFree) continue;

                // --- RULE 3: Teacher Availability ---
                const teacher = teachers.find(t => t.id === job.teacherId);
                const teacherDayAvail = teacher.availability.find(d => d.day === day);
                
                if (!teacherDayAvail || !teacherDayAvail.isAvailable) continue; // Teacher not available this day
                const teacherStart = parseTime(teacherDayAvail.startTime);
                const teacherEnd = parseTime(teacherDayAvail.endTime);
                if (start < teacherStart || end > teacherEnd) continue; // Slot is outside teacher's hours
                
                if (teacherTimetable[job.teacherId][day] && teacherTimetable[job.teacherId][day][slot.slot]) {
                    continue; // Teacher clash
                }

                // --- RULE 4: Find a Suitable Classroom ---
                const suitableRooms = classrooms.filter(room => {
                    // Check capacity
                    if (room.capacity < job.studentCount) return false;
                    // Check type (Lab/Lecture)
                    if (job.type === 'Lab' && room.type === 'Lecture') return false;
                    if (job.type === 'Theory' && room.type === 'Lab') return false;
                    // Check room availability (from settings)
                    const roomDayAvail = room.availability[day];
                    if (!roomDayAvail || !roomDayAvail.isAvailable) return false;
                    const roomStart = parseTime(roomDayAvail.startTime);
                    const roomEnd = parseTime(roomDayAvail.endTime);
                    if (start < roomStart || end > roomEnd) return false;
                    // Check room timetable (clash)
                    if (roomTimetable[room.id][day] && roomTimetable[room.id][day][slot.slot]) return false;

                    return true;
                });

                if (suitableRooms.length > 0) {
                    // --- PREFERENCE: Try to use the same room branch used today ---
                    let chosenRoom = suitableRooms[0]; // Default to first available
                    const branchHomeRoomId = Object.values(branchTimetable[job.branchIds[0]][day] || {}).find(s => s.roomId)?.roomId;
                    if (branchHomeRoomId) {
                        const homeRoom = suitableRooms.find(r => r.id === branchHomeRoomId);
                        if (homeRoom) chosenRoom = homeRoom;
                    }

                    // --- BOOK THE SLOT ---
                    const session = {
                        subject: job.subjectName,
                        subjectId: job.subjectId,
                        teacher: job.teacherName,
                        teacherId: job.teacherId,
                        room: chosenRoom.number,
                        roomId: chosenRoom.id,
                        type: job.type
                    };

                    job.branchIds.forEach(branchId => {
                        if (!branchTimetable[branchId][day]) branchTimetable[branchId][day] = {};
                        branchTimetable[branchId][day][slot.slot] = session;
                    });

                    if (!teacherTimetable[job.teacherId][day]) teacherTimetable[job.teacherId][day] = {};
                    teacherTimetable[job.teacherId][day][slot.slot] = true;

                    if (!roomTimetable[chosenRoom.id][day]) roomTimetable[chosenRoom.id][day] = {};
                    roomTimetable[chosenRoom.id][day][slot.slot] = true;

                    // Mark as scheduled for subject spreading
                    if (!scheduledCountByGroup[job.splitGroupId]) scheduledCountByGroup[job.splitGroupId] = {};
                    scheduledCountByGroup[job.splitGroupId][day] = true;
                    
                    scheduled = true;
                    break; // Move to next job
                }
            } // end slot loop

            if (!scheduled) {
                unallocatedJobs.push(job);
            }
        }); // end workload loop

        // --- 7. Finalize and Return ---
        const generationLog = {
            totalJobs: workload.length,
            allocated: workload.length - unallocatedJobs.length,
            unallocated: unallocatedJobs.length,
            unallocatedDetails: unallocatedJobs,
        };

        const newTimetable = {
            id: `tt-${Date.now()}`,
            createdAt: new Date(),
            data: branchTimetable, // This is the structured data for the result page
        };
        
        return { newTimetable, generationLog };
    };

    const handleConfirmGenerate = async () => {
        setIsConfirmModalOpen(false);
        setIsGenerating(true);
        
        // Run algorithm in a timeout to allow UI to update
        setTimeout(async () => {
            try {
                const { newTimetable, generationLog } = runAllocationAlgorithm();

                // Save the new timetable to Firestore
                const instituteRef = doc(db, "institutes", user.uid);
                await updateDoc(instituteRef, {
                    generatedTimetables: arrayUnion(newTimetable)
                });
                await logAction(user.uid, "TIMETABLE_GENERATED", `Generated new timetable. ${generationLog.allocated}/${generationLog.totalJobs} classes scheduled.`);
                
                setIsGenerating(false);
                // Pass both the timetable and the log to the parent
                onGenerate(newTimetable, generationLog);

            } catch (error) {
                console.error("Error generating timetable:", error);
                await logAction(user.uid, "TIMETABLE_ERROR", `Failed to generate timetable: ${error.message}`);
                setIsGenerating(false);
            }
        }, 50); // 50ms delay
    };
    
    const canGenerate = allData.classrooms.length > 0 && allData.subjects.length > 0 && allData.teachers.length > 0;

    return (
        <div className="space-y-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Generate Master Timetable</h2>
            
            {isGenerating && (
                <div className="bg-blue-100 border border-blue-300 text-blue-800 p-6 rounded-lg shadow-lg text-center">
                    <h3 className="text-xl font-semibold mb-2">Generating Timetable...</h3>
                    <p>Please wait, this may take a moment. The algorithm is processing all rules and constraints.</p>
                </div>
            )}

            <div className="bg-white p-6 rounded-lg shadow-lg border border-slate-200 text-center">
                 <h3 className="text-xl font-semibold text-slate-700 mb-4">Generate New Timetable</h3>
                 <p className="text-slate-500 mb-6">Once all data is entered and settings are saved, click the button below to generate the master timetable.</p>
                 <button onClick={() => setIsConfirmModalOpen(true)} disabled={isGenerating} className="bg-green-600 text-white px-8 py-3 rounded-lg shadow-lg hover:bg-green-700 font-bold text-lg transition-transform transform hover:scale-105 disabled:bg-slate-400 disabled:cursor-not-allowed">
                    {isGenerating ? "Generating..." : "✨ Generate Now"}
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-lg border border-slate-200">
                    <h3 className="text-xl font-semibold text-slate-700 mb-4">Configuration</h3>
                    <button onClick={() => setIsTimingsModalOpen(true)} className="w-full text-left bg-blue-50 p-4 rounded-lg hover:bg-blue-100 text-blue-800 font-semibold">
                        Configure Institute Timings
                    </button>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-lg border border-slate-200">
                    <h3 className="text-xl font-semibold text-slate-700 mb-4">History</h3>
                    <button onClick={() => setIsHistoryModalOpen(true)} className="w-full text-left bg-blue-50 p-4 rounded-lg hover:bg-blue-100 text-blue-800 font-semibold">
                        View Previous Timetables ({allData.generatedTimetables.length})
                    </button>
                </div>
            </div>

            <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title="Confirm Generation">
                <div>
                    <p className="mb-4">You are about to generate a timetable using the following data:</p>
                    <ul className="list-disc list-inside space-y-2 mb-6">
                        <li><span className="font-semibold">{allData.classrooms.length}</span> Classrooms</li>
                        <li><span className="font-semibold">{allData.subjects.length}</span> Subjects</li>
                        <li><span className="font-semibold">{allData.teachers.length}</span> Teachers</li>
                        <li><span className="font-semibold">{allData.departments.flatMap(d => d.courses.flatMap(c => c.branches)).length}</span> Total Branches</li>
                    </ul>
                    {!canGenerate && <p className="text-red-600 font-semibold text-center p-3 bg-red-50 rounded-md">Warning: One or more data categories are empty. Please add data before generating.</p>}
                     <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setIsConfirmModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">Cancel</button>
                        <button onClick={handleConfirmGenerate} disabled={!canGenerate} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed">Proceed</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isTimingsModalOpen} onClose={() => setIsTimingsModalOpen(false)} title="Configure Institute Timings">
                <div className="space-y-6">
                    <div>
                        <DayWiseAvailabilitySelector 
                            availability={localSettings.timings} 
                            onAvailabilityChange={handleTimingsChange} 
                        />
                    </div>
                    <div className="space-y-4 border-t pt-4">
                        <h4 className="font-semibold text-slate-600">Break Timings</h4>
                        <div className="flex items-center gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600">Lunch Start</label>
                                <input type="time" name="lunchStart" value={localSettings.lunchStart} onChange={handleLunchChange} className="mt-1 p-2 border border-slate-300 rounded-md shadow-sm w-full"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600">Lunch End</label>
                                <input type="time" name="lunchEnd" value={localSettings.lunchEnd} onChange={handleLunchChange} className="mt-1 p-2 border border-slate-300 rounded-md shadow-sm w-full"/>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setIsTimingsModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">Cancel</button>
                        <button onClick={handleSaveSettings} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold">Save Settings</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} title="Previous Timetables">
                {allData.generatedTimetables.length > 0 ? (
                    <ul className="space-y-2">
                        {[...allData.generatedTimetables].reverse().map(tt => ( // Show newest first
                            <li key={tt.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-md">
                                <span className="text-sm">Timetable from {new Date(tt.createdAt.seconds * 1000).toLocaleString()}</span>
                                <button onClick={() => { onGenerate(tt, null); setIsHistoryModalOpen(false); }} className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-md hover:bg-blue-200">View</button>
                            </li>
                        ))}
                    </ul>
                 ) : (
                    <p className="text-center text-slate-500 py-4">No timetables generated yet.</p>
                 )}
            </Modal>
        </div>
    );
}

// --- MODIFIED (REQUEST 4): Implemented PDF/Excel Export ---
function AllocationResultPage({ result, onBack, allData, generationLog }) {
    const allBranchesFlat = useMemo(() => allData.departments.flatMap(dept => 
        dept.courses.flatMap(course => 
            course.branches.map(branch => ({
                ...branch, courseName: course.name, deptName: dept.name,
            }))
        )
    ), [allData.departments]);

    const [selectedBranchId, setSelectedBranchId] = useState(allBranchesFlat[0]?.id || '');
    
    // Create a list of time slots (e.g., 09:00, 10:00, etc.)
    const timeSlots = useMemo(() => {
        const slots = new Set();
        // This is a simplified slot generation. A real one would use the settings.
        const lunchStart = parseTime(allData.settings.lunchStart || '13:00');
        const lunchEnd = parseTime(allData.settings.lunchEnd || '14:00');

        (allData.settings.timings || []).forEach(day => {
            if (day.isAvailable) {
                let current = parseTime(day.startTime);
                const end = parseTime(day.endTime);
                while (current < end) {
                    const slotEnd = current + 60;
                    if (current < lunchStart && slotEnd > lunchStart) { current = lunchEnd; continue; }
                    if (current >= lunchStart && current < lunchEnd) { current = lunchEnd; continue; }
                    if (slotEnd > end) break;
                    const slotId = `${String(Math.floor(current/60)).padStart(2,'0')}:${String(current%60).padStart(2,'0')}-${String(Math.floor(slotEnd/60)).padStart(2,'0')}:${String(slotEnd%60).padStart(2,'0')}`;
                    slots.add(slotId);
                    current += 60;
                }
            }
        });
        return Array.from(slots).sort();
    }, [allData.settings]);

    const parseTime = (time) => {
        if (!time) return 0;
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const branchTimetable = result.data[selectedBranchId] || {};
    const selectedBranchName = allBranchesFlat.find(b => b.id === selectedBranchId)?.name || "Selected Branch";

    const getTimetableData = (forExcel = false) => {
        const head = [['Time', ...days]];
        const body = timeSlots.map(slot => {
            const row = [slot];
            days.forEach(day => {
                const session = branchTimetable[day]?.[slot];
                if (session) {
                    const cellContent = `${session.subject}\n${session.teacher}\nRoom: ${session.room}`;
                    row.push(cellContent);
                } else {
                    row.push('');
                }
            });
            return row;
        });
        return { head, body };
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(16);
        doc.text(`Timetable for ${selectedBranchName}`, 14, 15);
        
        const { head, body } = getTimetableData();
        
        doc.autoTable({
            head: head,
            body: body,
            startY: 20,
            styles: {
                fontSize: 7,
                cellPadding: 2,
                valign: 'middle',
                halign: 'center'
            },
            headStyles: {
                fillColor: [41, 128, 185], // Blue
                textColor: 255,
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            }
        });
        
        doc.save(`${selectedBranchName}_Timetable.pdf`);
    };

    const handleDownloadExcel = () => {
        const { head, body } = getTimetableData(true);
        const data = [...head, ...body];

        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // --- Cell Styling (basic width) ---
        const colWidths = head[0].map((_, i) => ({
            wch: i === 0 ? 15 : 25 // Time column vs other day columns
        }));
        ws['!cols'] = colWidths;

        // Note: xlsx cell styling for newlines is complex, this will export the raw string
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Timetable");
        XLSX.writeFile(wb, `${selectedBranchName}_Timetable.xlsx`);
    };

    return (
        <div className="min-h-screen bg-slate-100 p-4 sm:p-6 md:p-8">
             <header className="bg-white shadow-sm p-4 flex items-center justify-between border-b border-slate-200 rounded-t-lg">
                <div className="flex items-center space-x-3">
                    <VitsnLogo className="w-10 h-10 text-blue-600" />
                    <div>
                        <h1 className="text-lg sm:text-xl font-bold text-slate-800">Allocation Results</h1>
                        <p className="text-xs sm:text-sm text-slate-500">Master Timetable (Generated: {new Date(result.createdAt.seconds * 1000).toLocaleString()})</p>
                    </div>
                </div>
                <button onClick={onBack} className="text-sm font-semibold text-blue-600 hover:underline">← Back to Dashboard</button>
            </header>

            <div className="bg-white p-6 rounded-b-lg shadow-lg border border-slate-200">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <div>
                        <label htmlFor="branch-select" className="text-sm font-medium text-slate-600 mr-2">Select Branch:</label>
                        <select id="branch-select" value={selectedBranchId} onChange={e => setSelectedBranchId(e.target.value)} className="p-2 border border-slate-300 rounded-md shadow-sm bg-white">
                            {allBranchesFlat.map(branch => (
                                <option key={branch.id} value={branch.id}>
                                    {branch.deptName} - {branch.courseName} - {branch.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleDownloadPDF} className="text-sm bg-red-500 text-white px-3 py-2 rounded-md hover:bg-red-600 font-semibold flex items-center gap-1">Download PDF</button>
                        <button onClick={handleDownloadExcel} className="text-sm bg-green-500 text-white px-3 py-2 rounded-md hover:bg-green-600 font-semibold flex items-center gap-1">Download Excel</button>
                    </div>
                </div>

                {/* --- NEW (REQUEST 2): Generation Log --- */}
                {generationLog && (
                    <div className={`p-4 rounded-md mb-6 ${generationLog.unallocated > 0 ? 'bg-yellow-50 border border-yellow-300' : 'bg-green-50 border border-green-300'}`}>
                        <h4 className={`text-lg font-semibold ${generationLog.unallocated > 0 ? 'text-yellow-800' : 'text-green-800'}`}>
                            Generation Report
                        </h4>
                        <p className="text-sm">
                            Successfully scheduled <span className="font-bold">{generationLog.allocated}</span> out of <span className="font-bold">{generationLog.totalJobs}</span> total classes.
                        </p>
                        {generationLog.unallocated > 0 && (
                            <div className="mt-2">
                                <p className="text-sm font-semibold text-yellow-800">Failed to schedule {generationLog.unallocated} classes:</p>
                                <ul className="list-disc list-inside text-xs text-yellow-700 max-h-32 overflow-y-auto mt-1">
                                    {generationLog.unallocatedDetails.map(job => (
                                        <li key={job.id}>{job.subjectName} for {job.isCommon ? `${job.branchIds.length} branches` : `Branch ID ${job.branchIds[0]}`}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50">
                                <th className="p-2 border border-slate-200 text-sm font-semibold text-slate-600">Time</th>
                                {days.map(day => <th key={day} className="p-2 border border-slate-200 text-sm font-semibold text-slate-600">{day}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {timeSlots.map(slot => (
                                <tr key={slot}>
                                    <td className="p-2 border border-slate-200 text-xs font-medium text-slate-500 text-center whitespace-nowrap">{slot}</td>
                                    {days.map(day => {
                                        const session = branchTimetable[day]?.[slot];
                                        return (
                                            <td key={day} className="p-2 border border-slate-200 text-center align-top h-24 w-1/6">
                                                {session ? (
                                                    <div className={`h-full flex flex-col justify-center p-2 rounded-md text-xs ${session.type === 'Lab' ? 'bg-blue-100 text-blue-800' : 'bg-indigo-100 text-indigo-800'}`}>
                                                        <p className="font-bold text-sm">{session.subject}</p>
                                                        <p className="text-xs">{session.teacher}</p>
                                                        <p className="text-xs font-medium mt-1">Room: {session.room}</p>
                                                    </div>
                                                ) : <div className="h-full"></div>}
                                            </td>
                                        )
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    )
}

// --- Vigilance Manager ---
function VigilanceManager({ user, allData }) {
    const { generatedTimetables } = allData;
    const latestTimetable = generatedTimetables.length > 0 ? [...generatedTimetables].pop() : null; // Get the last one

    const ongoingClasses = useMemo(() => {
        if (!latestTimetable) return [];
        
        const now = new Date();
        const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }); // e.g., "Monday"
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const currentClasses = [];

        Object.entries(latestTimetable.data).forEach(([branchId, branchTimetable]) => {
            const daySchedule = branchTimetable[currentDay];
            if(daySchedule) {
                Object.entries(daySchedule).forEach(([slot, session]) => {
                    const [start, end] = slot.split('-').map(time => {
                        const [hours, minutes] = time.split(':');
                        return parseInt(hours, 10) * 60 + parseInt(minutes, 10);
                    });
                    
                    if(currentTime >= start && currentTime < end) {
                        currentClasses.push({
                            id: `${branchId}-${slot}`,
                            branchId: branchId,
                            time: slot,
                            ...session
                        });
                    }
                });
            }
        });
        return currentClasses;

    }, [latestTimetable]);

    if (!latestTimetable) {
        return (
             <div className="space-y-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Vigilance Check</h2>
                <div className="bg-white p-8 rounded-lg shadow-lg border border-slate-200 text-center">
                    <p className="text-slate-500">No active timetable has been generated. Please generate a timetable in the "ALLOCATE" tab first.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Vigilance Check</h2>
                <button className="bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 font-semibold">Generate Report</button>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-lg border border-slate-200">
                <h3 className="text-xl font-semibold text-slate-700 mb-4">Currently Ongoing Classes ({ongoingClasses.length})</h3>
                <div className="space-y-4">
                    {ongoingClasses.length > 0 ? ongoingClasses.map(c => (
                        <div key={c.id} className="border p-4 rounded-lg bg-slate-50">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                                <div><strong>Time:</strong> {c.time}</div>
                                <div><strong>Subject:</strong> {c.subject}</div>
                                <div><strong>Teacher:</strong> {c.teacher}</div>
                                <div><strong>Room:</strong> {c.room}</div>
                            </div>
                            <div className="mt-4">
                                <textarea className="w-full p-2 border rounded-md" placeholder="Add comments..."></textarea>
                                <div className="text-right mt-2">
                                     <input type="file" id={`file-${c.id}`} className="hidden" />
                                     <label htmlFor={`file-${c.id}`} className="cursor-pointer text-sm bg-blue-500 text-white px-3 py-2 rounded-md hover:bg-blue-600">Attach Photo</label>
                                </div>
                            </div>
                        </div>
                    )) : <p className="text-slate-500 text-center py-4">No classes are currently scheduled.</p>}
                </div>
            </div>
        </div>
    );
}

// --- Log Manager ---
function LogManager({ logs }) {
    const sortedLogs = useMemo(() => {
        if (!logs || logs.length === 0) return [];
        return [...logs]
            .filter(log => log && log.timestamp) // Filter out any undefined/null logs
            .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
    }, [logs]);

    return (
        <div className="space-y-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Activity Logs</h2>
            <div className="bg-white p-6 rounded-lg shadow-lg border border-slate-200">
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="p-3 text-sm font-semibold text-slate-600 uppercase tracking-wider">Timestamp</th>
                                <th className="p-3 text-sm font-semibold text-slate-600 uppercase tracking-wider">Action</th>
                                <th className="p-3 text-sm font-semibold text-slate-600 uppercase tracking-wider">Details</th>
                                <th className="p-3 text-sm font-semibold text-slate-600 uppercase tracking-wider text-center">Revert</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedLogs.length > 0 ? sortedLogs.map(log => (
                                <tr key={log.id} className="border-b border-slate-200 hover:bg-slate-50 text-sm">
                                    <td className="p-3 text-slate-500 whitespace-nowrap">
                                        {new Date(log.timestamp.seconds * 1000).toLocaleString()}
                                    </td>
                                    <td className="p-3 font-medium text-slate-600">{log.action}</td>
                                    <td className="p-3 text-slate-800">{log.details}</td>
                                    <td className="p-3 text-center">
                                        <button className="text-xs bg-slate-200 px-2 py-1 rounded hover:bg-slate-300 disabled:opacity-50" disabled>Revert</button>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="4" className="p-4 text-center text-slate-500">No activity recorded yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                 </div>
            </div>
        </div>
    );
}

// --- Reusable Array-based Availability Selector (for Settings & Teachers) ---
function DayWiseAvailabilitySelector({ availability, onAvailabilityChange }) {
    const handleDayToggle = (day) => {
        const newAvailability = availability.map(d => d.day === day ? {...d, isAvailable: !d.isAvailable} : d);
        onAvailabilityChange(newAvailability);
    };

    const handleTimeChange = (day, timeType, value) => {
        const newAvailability = availability.map(d => d.day === day ? {...d, [timeType]: value} : d);
        onAvailabilityChange(newAvailability);
    };

    return (
         <div className="space-y-2">
            <h4 className="font-semibold text-slate-600 mb-2">Weekly Timings</h4>
            {availability.map(dayInfo => (
                <div key={dayInfo.day} className="grid grid-cols-3 gap-2 items-center">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id={`day-avail-${dayInfo.day}`}
                            checked={dayInfo.isAvailable}
                            onChange={() => handleDayToggle(dayInfo.day)}
                            className="h-4 w-4 rounded"
                        />
                        <label htmlFor={`day-avail-${dayInfo.day}`} className="font-medium text-sm">{dayInfo.day}</label>
                    </div>
                    <input
                        type="time"
                        value={dayInfo.startTime}
                        onChange={(e) => handleTimeChange(dayInfo.day, 'startTime', e.target.value)}
                        disabled={!dayInfo.isAvailable}
                        className="p-1 border border-slate-300 rounded-md text-sm disabled:bg-slate-200"
                    />
                    <input
                        type="time"
                        value={dayInfo.endTime}
                        onChange={(e) => handleTimeChange(dayInfo.day, 'endTime', e.target.value)}
                        disabled={!dayInfo.isAvailable}
                        className="p-1 border border-slate-300 rounded-md text-sm disabled:bg-slate-200"
                    />
                </div>
            ))}
        </div>
    );
}


// --- Placeholder Component ---
function Placeholder({ tabName }) {
    return(
        <div className="bg-white p-8 rounded-lg shadow-lg border border-slate-200 text-center">
            <h2 className="text-2xl font-bold text-slate-800 mb-4 capitalize">{tabName.replace(/_/g, ' ')}</h2>
            <p className="text-slate-500">This section is under construction.</p>
        </div>
    );
}
