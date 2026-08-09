import { useState } from "react";
import {
    LayoutDashboard,
    Bot,
    Network,
    MessagesSquare,
    Settings,
    LogOut,
    ChevronsLeft,
    ChevronsRight,
    Hexagon,
    Menu,
    X,
} from "lucide-react";

const NAV_SECTIONS = [
    {
        label: "Workspace",
        items: [
            { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, accent: "#F3A712" },
            { key: "agents", label: "Agents", icon: Bot, accent: "#DE8A0B" },
            { key: "gateway", label: "Gateway", icon: Network, accent: "#B96B08" },
            { key: "conversations", label: "Conversations", icon: MessagesSquare, accent: "#D65A45" },
        ],
    },
    {
        label: "Account",
        items: [{ key: "settings", label: "Settings", icon: Settings, accent: "#8A6A42" }],
    },
]
const Sidebar = () => {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [active, setActive] = useState("dashboard");

    const selectItem = (key) => {
        setActive(key);
        setMobileOpen(false); // mobile pe item choose karte hi drawer band ho jaye
    };

    return (
        <div className="flex h-screen bg-[#FFF8EC]">
            {/* Mobile top bar — sirf < md screens pe dikhta hai */}
            <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-[#3B2712]/10 bg-[#FFFDF8]/95 px-4 backdrop-blur md:hidden">
                <div className="flex items-center gap-2">
                    <div
                        className="flex h-7 w-7 items-center justify-center bg-gradient-to-br from-[#F3A712] to-[#DE8A0B]"
                        style={{ clipPath: "polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)" }}
                    >
                        <span className="text-xs">🐝</span>
                    </div>
                    <span className="font-serif text-sm font-semibold text-[#3B2712]">HiveNixAI</span>
                </div>
                <button
                    type="button"
                    onClick={() => setMobileOpen(true)}
                    className="rounded-md p-2 text-[#3B2712] hover:bg-[#FFF1D3]"
                    aria-label="Open menu"
                >
                    <Menu size={20} />
                </button>
            </div>

            {/* Backdrop — sirf mobile drawer open hone par */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-[#3B2712]/40 backdrop-blur-sm md:hidden"
                    onClick={() => setMobileOpen(false)}
                    aria-hidden="true"
                />
            )}
            <aside
                className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[260px] flex-col overflow-hidden border-r border-[#3B2712]/10 bg-gradient-to-b from-[#FFFDF8] via-[#FFFBF2] to-[#FFF1D3] transition-transform duration-300 ease-out md:relative md:z-auto md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"
                    } ${collapsed ? "md:w-[76px]" : "md:w-[260px]"}`}
            >
                {/* mobile-only close button */}
                <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-[#8A6A42] hover:bg-[#FFF1D3] md:hidden"
                    aria-label="Close menu"
                >
                    <X size={18} />
                </button>

                {/* faint honeycomb texture */}
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(30deg,#DE8A0B_12%,transparent_12.5%,transparent_87%,#DE8A0B_87.5%,#DE8A0B),linear-gradient(150deg,#DE8A0B_12%,transparent_12.5%,transparent_87%,#DE8A0B_87.5%,#DE8A0B)] [background-size:44px_76px]"
                    aria-hidden="true"
                />
                {/* golden edge glow */}
                <div
                    className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-[#F3A712]/50 to-transparent"
                    aria-hidden="true"
                />

                {/* Logo / brand */}
                <div className="relative flex items-center gap-3 px-4 pt-5 pb-4">
                    <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center bg-gradient-to-br from-[#F3A712] via-[#EA9A0E] to-[#DE8A0B] shadow-[0_8px_20px_-6px_rgba(222,138,11,0.65)] ring-2 ring-[#FFF1D3]"
                        style={{ clipPath: "polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)" }}
                    >
                        <span className="text-base">🐝</span>
                    </div>
                    {!collapsed && (
                        <div className="min-w-0">
                            <p className="truncate bg-gradient-to-r from-[#B96B08] to-[#3B2712] bg-clip-text font-serif text-[15px] font-semibold tracking-wide text-transparent">
                                HiveNixAI
                            </p>
                            <p className="truncate text-[11px] text-[#8A6A42]">
                                Multi-agent console
                            </p>
                        </div>
                    )}
                </div>

                <div className="relative mx-4 h-px bg-gradient-to-r from-transparent via-[#3B2712]/15 to-transparent" />

                {/* Nav */}
                <nav className="relative flex-1 overflow-y-auto px-3 py-4">
                    {NAV_SECTIONS.map((section) => (
                        <div key={section.label} className="mb-6 last:mb-0">
                            {!collapsed && (
                                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A6A42]/70">
                                    {section.label}
                                </p>
                            )}
                            <ul className="space-y-1.5">
                                {section.items.map(({ key, label, icon: Icon, accent }) => {
                                    const isActive = active === key;
                                    return (
                                        <li key={key}>
                                            <button
                                                type="button"
                                                onClick={() => selectItem(key)}
                                                title={collapsed ? label : undefined}
                                                className={`group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-all ${isActive
                                                    ? "bg-gradient-to-r from-[#F3A712] to-[#DE8A0B] text-[#FFFDF8] shadow-[0_8px_18px_-8px_rgba(222,138,11,0.7)]"
                                                    : "text-[#5A4128] hover:bg-white hover:shadow-sm"
                                                    } ${collapsed ? "justify-center" : ""}`}
                                            >
                                                <span
                                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors"
                                                    style={{
                                                        backgroundColor: isActive ? "rgba(255,255,255,0.22)" : `${accent}1A`,
                                                    }}
                                                >
                                                    <Icon
                                                        size={16}
                                                        strokeWidth={2.25}
                                                        style={{ color: isActive ? "#FFFDF8" : accent }}
                                                    />
                                                </span>
                                                {!collapsed && <span className="truncate">{label}</span>}
                                                {collapsed && isActive && (
                                                    <span className="absolute -right-3 h-5 w-1 rounded-full bg-[#F3A712]" />
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>

                <div className="relative mx-4 h-px bg-gradient-to-r from-transparent via-[#3B2712]/15 to-transparent" />

                {/* User + collapse toggle */}
                <div className="relative px-3 py-4">
                    <div
                        className={`flex items-center gap-3 rounded-xl bg-white/60 px-2 py-2 ring-1 ring-[#3B2712]/5 ${collapsed ? "justify-center" : ""
                            }`}
                    >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#F3A712] to-[#DE8A0B] text-xs font-semibold text-[#FFFDF8] shadow-sm">
                            LK
                        </div>
                        {!collapsed && (
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-[#3B2712]">
                                    Lakshya
                                </p>
                                <p className="truncate text-[11px] text-[#8A6A42]">
                                    Builder
                                </p>
                            </div>
                        )}
                        {!collapsed && (
                            <button
                                type="button"
                                title="Log out"
                                className="shrink-0 rounded-md p-1.5 text-[#8A6A42] transition-colors hover:bg-[#FFF1D3] hover:text-[#D65A45]"
                            >
                                <LogOut size={16} />
                            </button>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => setCollapsed((c) => !c)}
                        className="mt-3 hidden w-full items-center justify-center gap-2 rounded-lg border border-[#3B2712]/10 py-2 text-xs font-medium text-[#8A6A42] transition-colors hover:bg-[#FFF1D3] hover:text-[#3B2712] md:flex"
                    >
                        {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
                        {!collapsed && "Collapse"}
                    </button>
                </div>
            </aside>
        </div>
    );
}

export default Sidebar