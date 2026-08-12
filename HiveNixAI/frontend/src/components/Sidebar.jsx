import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
    Bot,
    Network,
    MessageSquare,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    Menu,
    X,
    PlusIcon,
    User,
} from "lucide-react";

import { createConversation } from "../features/createConversation";
import { getConversations } from "../features/getConversations";
import {
    setConversations,
    addConversation,
    setselectedConversation,
} from "../redux/conversationSlice";
import { setUserData } from "../redux/userSlice";
import logOut from "../features/logOut";

const Sidebar = () => {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [imageError, setImageError] = useState(false);

    const dispatch = useDispatch();

    // =====================================================
    // REDUX STATE
    // =====================================================

    const convoState = useSelector(
        (state) => state.conversation
    );

    const conversations =
        convoState?.conversations ?? [];

    const selectedConversation =
        convoState?.selectedConversation;

    const { userData } = useSelector(
        (state) => state.user
    );

    // =====================================================
    // GET CONVERSATIONS
    // =====================================================

    useEffect(() => {
        const getConv = async () => {
            try {
                const data = await getConversations();

                console.log(
                    "CONVERSATIONS:",
                    data
                );

                dispatch(setConversations(data));
            } catch (error) {
                console.error(
                    "Failed to get conversations:",
                    error
                );
            }
        };

        getConv();
    }, [userData?._id, dispatch]);

    // =====================================================
    // RESPONSIVE SIDEBAR
    // =====================================================

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1200) {
                setCollapsed(true);
            }

            if (window.innerWidth >= 768) {
                setMobileOpen(false);
            }
        };

        handleResize();

        window.addEventListener(
            "resize",
            handleResize
        );

        return () => {
            window.removeEventListener(
                "resize",
                handleResize
            );
        };
    }, []);

    // =====================================================
    // CLOSE MOBILE SIDEBAR
    // =====================================================

    const closeMobileSidebar = () => {
        if (window.innerWidth < 768) {
            setMobileOpen(false);
        }
    };

    // =====================================================
    // NEW CHAT
    // =====================================================

    const handleNewChat = async () => {
        console.log("New Chat clicked");

        try {
            const conversation =
                await createConversation();

            console.log(
                "Created conversation:",
                conversation
            );

            // Add conversation to sidebar
            dispatch(
                addConversation(conversation)
            );

            // IMPORTANT:
            // Make newly created conversation active
            dispatch(
                setselectedConversation(
                    conversation
                )
            );

            console.log(
                "Selected new conversation:",
                conversation
            );

        } catch (error) {
            console.error(
                "Failed to create conversation:",
                error
            );
        }

        closeMobileSidebar();
    };

    // =====================================================
    // SELECT EXISTING CONVERSATION
    // =====================================================

    const handleSelectConversation = (
        conversation
    ) => {
        console.log(
            "Selecting conversation:",
            conversation
        );

        dispatch(
            setselectedConversation(
                conversation
            )
        );

        closeMobileSidebar();
    };

    // =====================================================
    // AGENTS
    // =====================================================

    const handleAgents = () => {
        console.log("Agents clicked");

        closeMobileSidebar();
    };

    // =====================================================
    // GATEWAY
    // =====================================================

    const handleGateway = () => {
        console.log("Gateway clicked");

        closeMobileSidebar();
    };

    // =====================================================
    // CONVERSATIONS
    // =====================================================

    const handleConversations = () => {
        console.log(
            "Conversations clicked"
        );

        closeMobileSidebar();
    };

    // =====================================================
    // SETTINGS
    // =====================================================

    const handleSettings = () => {
        console.log("Settings clicked");

        closeMobileSidebar();
    };

    // =====================================================
    // LOGOUT
    // =====================================================

    const handleLogout = async () => {
        try {
            await logOut();

            dispatch(
                setUserData(null)
            );

        } catch (error) {
            console.error(
                "Logout failed:",
                error
            );
        }
    };

    // =====================================================
    // UI
    // =====================================================

    return (
        <>
            {/* =====================================================
                MOBILE MENU BUTTON
            ====================================================== */}

            <button
                onClick={() =>
                    setMobileOpen(true)
                }
                className="
                    fixed left-3 top-3 z-[60]
                    flex h-11 w-11
                    items-center justify-center
                    rounded-xl
                    border border-[#E9DCC5]
                    bg-[#FFFDF7]
                    text-[#703F10]
                    shadow-md
                    md:hidden
                "
                aria-label="Open sidebar"
            >
                <Menu size={22} />
            </button>

            {/* =====================================================
                MOBILE OVERLAY
            ====================================================== */}

            {mobileOpen && (
                <div
                    onClick={() =>
                        setMobileOpen(false)
                    }
                    className="
                        fixed inset-0 z-[70]
                        bg-[#573A1D]/20
                        backdrop-blur-[2px]
                        md:hidden
                    "
                />
            )}

            {/* =====================================================
                SIDEBAR
            ====================================================== */}

            <aside
                className={`
                    fixed left-0 top-0 z-[80]
                    flex h-[100dvh]
                    flex-col
                    overflow-hidden
                    border-r border-[#E9DCC5]
                    bg-[#FFFDF7]
                    text-[#573A1D]
                    shadow-xl
                    transition-all duration-300 ease-in-out

                    md:relative
                    md:z-50
                    md:shadow-none

                    ${mobileOpen
                        ? "translate-x-0"
                        : "-translate-x-full md:translate-x-0"
                    }

                    ${collapsed
                        ? "w-[92px]"
                        : "w-[min(370px,30vw)]"
                    }

                    max-md:w-[300px]
                `}
            >

                {/* =================================================
                    BACKGROUND PATTERN
                ================================================== */}

                <div
                    className="
                        pointer-events-none
                        absolute inset-0
                        opacity-50
                    "
                    style={{
                        backgroundImage: `
                            linear-gradient(
                                30deg,
                                #F7EEDB 12%,
                                transparent 12.5%,
                                transparent 87%,
                                #F7EEDB 87.5%,
                                #F7EEDB
                            ),
                            linear-gradient(
                                150deg,
                                #F7EEDB 12%,
                                transparent 12.5%,
                                transparent 87%,
                                #F7EEDB 87.5%,
                                #F7EEDB
                            )
                        `,
                        backgroundSize:
                            "80px 140px",
                    }}
                />

                {/* =================================================
                    HEADER
                ================================================== */}

                <div
                    className={`
                        relative z-10
                        flex h-[78px]
                        shrink-0
                        items-center
                        border-b border-[#E9DCC5]
                        transition-all duration-300

                        ${collapsed
                            ? "justify-center px-3"
                            : "px-5"
                        }
                    `}
                >

                    {/* LOGO */}

                    <div
                        className="
                            flex h-[52px] w-[52px]
                            shrink-0
                            items-center
                            justify-center
                            bg-[#F0A000]
                            text-white
                        "
                        style={{
                            clipPath:
                                "polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0% 50%)",
                        }}
                    >
                        <Sparkles size={23} />
                    </div>

                    {/* BRAND */}

                    {!collapsed && (
                        <div className="ml-4 min-w-0">

                            <h1
                                className="
                                    whitespace-nowrap
                                    font-serif
                                    text-[22px]
                                    font-bold
                                    text-[#703F10]
                                "
                            >
                                HiveNixAI
                            </h1>

                            <p
                                className="
                                    whitespace-nowrap
                                    text-[14px]
                                    text-[#8C7254]
                                "
                            >
                                Multi-agent console
                            </p>

                        </div>
                    )}

                    {/* MOBILE CLOSE */}

                    <button
                        onClick={() =>
                            setMobileOpen(false)
                        }
                        className="
                            ml-auto
                            rounded-lg
                            p-2
                            text-[#8E6C42]
                            hover:bg-[#FFF0D6]
                            md:hidden
                        "
                    >
                        <X size={20} />
                    </button>

                </div>

                {/* =================================================
                    NAVIGATION
                ================================================== */}

                <div
                    className="
                        relative z-10
                        min-h-0
                        flex-1
                        overflow-y-auto
                        px-3
                        pt-7
                    "
                >

                    {/* WORKSPACE */}

                    {!collapsed && (
                        <p
                            className="
                                mb-3
                                px-3
                                text-[12px]
                                font-medium
                                uppercase
                                tracking-[0.15em]
                                text-[#A27C4D]
                            "
                        >
                            Workspace
                        </p>
                    )}

                    <nav className="space-y-2">

                        {/* =================================================
                            NEW CHAT
                        ================================================== */}

                        <button
                            onClick={
                                handleNewChat
                            }
                            title={
                                collapsed
                                    ? "New Chat"
                                    : ""
                            }
                            className={`
                                group
                                relative
                                flex
                                h-[60px]
                                w-full
                                items-center
                                rounded-[16px]
                                bg-[#EEA000]
                                text-white
                                shadow-lg
                                shadow-[#E89A00]/20
                                transition
                                hover:bg-[#E59600]

                                ${collapsed
                                    ? "justify-center"
                                    : "gap-4 px-3"
                                }
                            `}
                        >

                            <span
                                className="
                                    flex
                                    h-[42px]
                                    w-[42px]
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-[13px]
                                    bg-white/20
                                "
                            >
                                <PlusIcon
                                    size={21}
                                />
                            </span>

                            {!collapsed && (
                                <span className="text-[16px] font-semibold">
                                    New Chat
                                </span>
                            )}

                            {collapsed && (
                                <span className="sidebar-tooltip">
                                    New Chat
                                </span>
                            )}

                        </button>

                        {/* =================================================
                            AGENTS
                        ================================================== */}

                        <button
                            onClick={
                                handleAgents
                            }
                            title={
                                collapsed
                                    ? "Agents"
                                    : ""
                            }
                            className={`
                                group
                                relative
                                flex
                                h-[60px]
                                w-full
                                items-center
                                rounded-[16px]
                                text-[#573A1D]
                                transition
                                hover:bg-[#FFF0D6]

                                ${collapsed
                                    ? "justify-center"
                                    : "gap-4 px-3"
                                }
                            `}
                        >

                            <span
                                className="
                                    flex
                                    h-[42px]
                                    w-[42px]
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-[13px]
                                    bg-[#FFF0D6]
                                    text-[#E49300]
                                "
                            >
                                <Bot size={21} />
                            </span>

                            {!collapsed && (
                                <span className="text-[16px] font-medium">
                                    Agents
                                </span>
                            )}

                            {collapsed && (
                                <span className="sidebar-tooltip">
                                    Agents
                                </span>
                            )}

                        </button>

                        {/* =================================================
                            GATEWAY
                        ================================================== */}

                        <button
                            onClick={
                                handleGateway
                            }
                            title={
                                collapsed
                                    ? "Gateway"
                                    : ""
                            }
                            className={`
                                group
                                relative
                                flex
                                h-[60px]
                                w-full
                                items-center
                                rounded-[16px]
                                text-[#573A1D]
                                transition
                                hover:bg-[#FFF0D6]

                                ${collapsed
                                    ? "justify-center"
                                    : "gap-4 px-3"
                                }
                            `}
                        >

                            <span
                                className="
                                    flex
                                    h-[42px]
                                    w-[42px]
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-[13px]
                                    bg-[#FFF0D6]
                                    text-[#D78300]
                                "
                            >
                                <Network
                                    size={21}
                                />
                            </span>

                            {!collapsed && (
                                <span className="text-[16px] font-medium">
                                    Gateway
                                </span>
                            )}

                            {collapsed && (
                                <span className="sidebar-tooltip">
                                    Gateway
                                </span>
                            )}

                        </button>

                        {/* =================================================
                            CONVERSATIONS
                        ================================================== */}

                        <button
                            onClick={
                                handleConversations
                            }
                            title={
                                collapsed
                                    ? "Conversations"
                                    : ""
                            }
                            className={`
                                group
                                relative
                                flex
                                h-[60px]
                                w-full
                                items-center
                                rounded-[16px]
                                text-[#573A1D]
                                transition
                                hover:bg-[#FFF0D6]

                                ${collapsed
                                    ? "justify-center"
                                    : "gap-4 px-3"
                                }
                            `}
                        >

                            <span
                                className="
                                    flex
                                    h-[42px]
                                    w-[42px]
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-[13px]
                                    bg-[#FFF0D6]
                                    text-[#E85C42]
                                "
                            >
                                <MessageSquare
                                    size={21}
                                />
                            </span>

                            {!collapsed && (
                                <span className="text-[16px] font-medium">
                                    Conversations
                                </span>
                            )}

                            {collapsed && (
                                <span className="sidebar-tooltip">
                                    Conversations
                                </span>
                            )}

                        </button>

                    </nav>

                    {/* =================================================
                        RECENT CONVERSATIONS
                    ================================================== */}

                    {!collapsed && (
                        <div className="mt-6 px-3">

                            <p
                                className="
                                    mb-3
                                    text-[12px]
                                    font-medium
                                    uppercase
                                    tracking-[0.15em]
                                    text-[#A27C4D]
                                "
                            >
                                Recent conversations
                            </p>

                            {conversations.length > 0 ? (

                                <div className="space-y-2">

                                    {conversations.map(
                                        (conversation) => {

                                            const isSelected =
                                                selectedConversation?._id ===
                                                conversation._id;

                                            return (
                                                <button
                                                    key={
                                                        conversation._id
                                                    }
                                                    onClick={() =>
                                                        handleSelectConversation(
                                                            conversation
                                                        )
                                                    }
                                                    className={`
                                                        w-full
                                                        rounded-[14px]
                                                        border
                                                        px-3
                                                        py-3
                                                        text-left
                                                        text-sm
                                                        transition

                                                        ${isSelected
                                                            ? "border-[#EEA000] bg-[#FFF0D6] text-[#573A1D]"
                                                            : "border-[#E9DCC5] bg-[#FFFDF7] text-[#573A1D] hover:bg-[#FFF7E7]"
                                                        }
                                                    `}
                                                >
                                                    {conversation.title ||
                                                        "Chat"}
                                                </button>
                                            );
                                        }
                                    )}

                                </div>

                            ) : (

                                <div
                                    className="
                                        rounded-[14px]
                                        border
                                        border-dashed
                                        border-[#E9DCC5]
                                        bg-[#FFFDF7]
                                        px-3
                                        py-4
                                        text-sm
                                        text-[#8C7254]
                                    "
                                >
                                    No conversations yet.
                                </div>

                            )}

                        </div>
                    )}

                    {/* =================================================
                        ACCOUNT
                    ================================================== */}

                    <div className="mt-7">

                        {!collapsed && (
                            <p
                                className="
                                    mb-3
                                    px-3
                                    text-[12px]
                                    font-medium
                                    uppercase
                                    tracking-[0.15em]
                                    text-[#A27C4D]
                                "
                            >
                                Account
                            </p>
                        )}

                        {/* SETTINGS */}

                        <button
                            onClick={
                                handleSettings
                            }
                            title={
                                collapsed
                                    ? "Settings"
                                    : ""
                            }
                            className={`
                                group
                                relative
                                flex
                                h-[60px]
                                w-full
                                items-center
                                rounded-[16px]
                                text-[#573A1D]
                                transition
                                hover:bg-[#FFF0D6]

                                ${collapsed
                                    ? "justify-center"
                                    : "gap-4 px-3"
                                }
                            `}
                        >

                            <span
                                className="
                                    flex
                                    h-[42px]
                                    w-[42px]
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-[13px]
                                    bg-[#F6EDDC]
                                    text-[#8D7049]
                                "
                            >
                                <Settings
                                    size={21}
                                />
                            </span>

                            {!collapsed && (
                                <span className="text-[16px] font-medium">
                                    Settings
                                </span>
                            )}

                            {collapsed && (
                                <span className="sidebar-tooltip">
                                    Settings
                                </span>
                            )}

                        </button>

                    </div>

                </div>

                {/* =================================================
                    USER
                ================================================== */}

                <div className="relative z-10 shrink-0 px-3 pb-3">

                    <div
                        className={`
                            flex
                            h-[76px]
                            items-center
                            rounded-[17px]
                            border
                            border-[#EADDC8]
                            bg-[#FFFDF8]
                            shadow-sm

                            ${collapsed
                                ? "justify-center"
                                : "px-3"
                            }
                        `}
                    >

                        {/* AVATAR */}

                        <div
                            className="
                                flex
                                h-[46px]
                                w-[46px]
                                shrink-0
                                items-center
                                justify-center
                                overflow-hidden
                                rounded-full
                                bg-[#F0A000]
                                text-[14px]
                                font-semibold
                                text-white
                            "
                        >

                            {userData?.avatar &&
                                !imageError ? (

                                <img
                                    src={
                                        userData.avatar
                                    }
                                    alt={
                                        userData.name ||
                                        "user"
                                    }
                                    className="
                                        h-full
                                        w-full
                                        object-cover
                                    "
                                    onError={() =>
                                        setImageError(
                                            true
                                        )
                                    }
                                />

                            ) : (

                                <User />

                            )}

                        </div>

                        {/* USER DETAILS */}

                        {!collapsed && (
                            <>

                                <div className="ml-3 min-w-0 flex-1">

                                    <p
                                        className="
                                            truncate
                                            text-[15px]
                                            font-semibold
                                            text-[#573A1D]
                                        "
                                    >
                                        {
                                            userData?.name ||
                                            "New user"
                                        }
                                    </p>

                                    <p
                                        className="
                                            text-[13px]
                                            text-[#9B7953]
                                        "
                                    >
                                        Builder-free plan
                                    </p>

                                </div>

                                {/* LOGOUT */}

                                <button
                                    onClick={
                                        handleLogout
                                    }
                                    title="Logout"
                                    className="
                                        rounded-lg
                                        p-2
                                        text-[#8E6C42]
                                        transition
                                        hover:bg-[#FFF0D6]
                                        hover:text-[#D78300]
                                    "
                                >
                                    <LogOut
                                        size={19}
                                    />
                                </button>

                            </>
                        )}

                    </div>

                    {/* =================================================
                        COLLAPSE BUTTON
                    ================================================== */}

                    <button
                        onClick={() =>
                            setCollapsed(
                                !collapsed
                            )
                        }
                        className={`
                            group
                            relative
                            mt-2
                            flex
                            h-[48px]
                            w-full
                            items-center
                            justify-center
                            rounded-[14px]
                            border
                            border-[#EADDC8]
                            bg-[#FFF7E7]
                            text-[#916B3B]
                            transition
                            hover:bg-[#FCEBCB]
                            hover:text-[#C97900]

                            ${collapsed
                                ? ""
                                : "gap-2"
                            }
                        `}
                    >

                        {collapsed ? (
                            <ChevronRight
                                size={21}
                            />
                        ) : (
                            <>
                                <ChevronLeft
                                    size={18}
                                />

                                <span className="text-[14px] font-medium">
                                    Collapse
                                </span>
                            </>
                        )}

                        {collapsed && (
                            <span className="sidebar-tooltip">
                                Expand sidebar
                            </span>
                        )}

                    </button>

                </div>

            </aside>

            {/* =====================================================
                TOOLTIP
            ====================================================== */}

            <style>{`
                .sidebar-tooltip {
                    pointer-events: none;
                    position: absolute;
                    left: 82px;
                    z-index: 100;
                    display: none;
                    white-space: nowrap;
                    border-radius: 8px;
                    background: #573A1D;
                    padding: 8px 12px;
                    font-size: 12px;
                    color: white;
                    box-shadow: 0 8px 20px rgba(87, 58, 29, 0.2);
                }

                .group:hover .sidebar-tooltip {
                    display: block;
                }
            `}</style>
        </>
    );
};

export default Sidebar;