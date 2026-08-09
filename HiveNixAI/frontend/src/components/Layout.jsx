// src/components/Layout.jsx
import Sidebar from "./Sidebar";

const Layout = ({ children }) => {
    return (
        <div className="flex h-screen overflow-hidden bg-[#FFF8EC]">
            <Sidebar />
            {/* pt-14: mobile top bar ke neeche jagah, md pe zaroorat nahi */}
            <div className="flex flex-1 flex-col overflow-hidden pt-14 md:pt-0">
                {children}
            </div>
        </div>
    );
};

export default Layout;