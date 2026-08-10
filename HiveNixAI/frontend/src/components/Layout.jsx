// src/components/Layout.jsx
import { useState } from "react";
import Sidebar from "./Sidebar";
import Artifact from "./Artifact";

const Layout = ({ children }) => {

    return (
        <div className="flex h-screen overflow-hidden bg-[#FFF8EC]">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden pt-14 md:pt-0">
                {children}
            </div>
            <div className="flex flex-col overflow-hidden pt-14 md:pt-0">
                <Artifact />
            </div>
        </div>
    );
};

export default Layout;