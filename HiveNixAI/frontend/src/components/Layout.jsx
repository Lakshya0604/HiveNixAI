// src/components/Layout.jsx

import Sidebar from "./Sidebar";
import Artifact from "./Artifact";

const Layout = ({ children }) => {
    return (
        <div className="flex h-screen overflow-hidden bg-[#FFF8EC]">

            {/* SIDEBAR */}
            <Sidebar />

            {/* MAIN CHAT AREA */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {children}
            </div>

            {/* ARTIFACT */}
            <div className="hidden flex-col overflow-hidden md:flex">
                <Artifact />
            </div>

        </div>
    );
};

export default Layout;