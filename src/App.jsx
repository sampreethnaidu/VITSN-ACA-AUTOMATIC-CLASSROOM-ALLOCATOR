import React from 'react';

// --- Icons used in the screen ---
const VitsnLogo = ({ className }) => ( 
    <svg className={className} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"> 
        <path fill="currentColor" d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm0 192a88 88 0 1 1 88-88a88.1 88.1 0 0 1-88 88Z"/> 
        <path fill="currentColor" d="M168 96h-24.51l-24-40a16 16 0 0 0-27 0l-24 40H40a8 8 0 0 0 0 16h22.1l-22.78 38a8 8 0 0 0 6.92 12h123.52a8 8 0 0 0 6.92-12L145.9 112H168a8 8 0 0 0 0-16Zm-68.58 0L128 51.81L156.58 96ZM88 144l24-40h32l24 40Z"/> 
    </svg> 
);

// --- MAINTENANCE MODE COMPONENT ---
export default function App() {
    return (
        <div className="min-h-screen bg-slate-50 font-sans flex flex-col items-center justify-center p-4">
            <div className="bg-white p-8 md:p-10 rounded-xl shadow-lg border border-slate-200 max-w-lg w-full text-center space-y-6">
                
                {/* Logo Animation */}
                <div className="flex justify-center">
                    <VitsnLogo className="w-20 h-20 text-blue-600 animate-pulse" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-slate-800">Under Maintenance</h1>
                    <p className="text-slate-500 font-medium">
                        VITSN ACA is currently being upgraded.
                    </p>
                </div>

                {/* Feature List */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-5 text-left">
                    <p className="text-sm font-semibold text-blue-800 mb-3 uppercase tracking-wide">
                        🚀 Adding New Features:
                    </p>
                    <ul className="space-y-2 text-slate-700 text-sm font-medium">
                        <li className="flex items-center gap-2">
                            <span className="text-green-500">✔</span> Vigilance Module
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="text-green-500">✔</span> PDF & Excel Export Module
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="text-green-500">✔</span> Bulk CSV Uploads
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="text-green-500">✔</span> Interactive Timetable
                        </li>
                    </ul>
                </div>

                {/* Progress Bar Visual */}
                <div className="space-y-2 pt-2">
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-blue-600 h-2 rounded-full animate-[loading_2s_ease-in-out_infinite] w-3/4"></div>
                    </div>
                    <p className="text-xs text-slate-400 font-mono">System Update in Progress...</p>
                </div>
            </div>

            {/* CSS for the loading bar animation */}
            <style>{`
                @keyframes loading {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(0%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
}