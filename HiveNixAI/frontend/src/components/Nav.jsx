import { Bot, Sparkles } from "lucide-react";

const Nav = () => {
    return (
        <div className="relative flex h-[82px] shrink-0 items-center justify-between overflow-hidden border-b border-[#3B2712]/10 bg-gradient-to-r from-[#FFFDF8] via-[#FFFBF2] to-[#FFF1D3] px-4 sm:h-[94px] sm:px-5">

            {/* Background Pattern */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.05]"
                style={{
                    backgroundImage: `
                        linear-gradient(
                            30deg,
                            #DE8A0B 12%,
                            transparent 12.5%,
                            transparent 87%,
                            #DE8A0B 87.5%,
                            #DE8A0B
                        ),
                        linear-gradient(
                            150deg,
                            #DE8A0B 12%,
                            transparent 12.5%,
                            transparent 87%,
                            #DE8A0B 87.5%,
                            #DE8A0B
                        )
                    `,
                    backgroundSize: "44px 76px",
                }}
                aria-hidden="true"
            />

            {/* LEFT - AGENT */}
            <div className="relative flex min-w-0 items-center gap-3 sm:gap-4">

                {/* Agent Icon */}
                <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center bg-gradient-to-br from-[#F3A712] via-[#EA9A0E] to-[#DE8A0B] shadow-[0_5px_14px_-5px_rgba(222,138,11,0.6)] sm:h-[50px] sm:w-[50px] translate-x-15 sm:translate-0"
                    style={{
                        clipPath:
                            "polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)",
                    }}
                >
                    <Bot
                        size={20}
                        className="text-white sm:h-[23px] sm:w-[23px] "
                        strokeWidth={2.25}
                    />
                </div>

                {/* Agent Info */}
                <div className="min-w-0 translate-x-15 sm:translate-0">

                    <p className="truncate text-[18px] font-semibold text-[#B96B08] sm:text-[21px] ">
                        Agent Router
                    </p>

                    <div className="flex items-center gap-1.5">

                        <span className="h-2 w-2 shrink-0 rounded-full bg-[#4CAF50] shadow-[0_0_6px_rgba(76,175,80,0.7)]" />

                        <span className="truncate text-[12px] text-[#8A6A42] sm:text-[14px]">
                            Online · free
                        </span>

                    </div>
                </div>
            </div>

            {/* DAY BUILD */}
            <span className="relative hidden shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-[#F3A712]/15 to-[#DE8A0B]/15 px-4 py-2 text-[13px] font-medium text-[#B96B08] ring-1 ring-[#F3A712]/25 sm:flex">
                <Sparkles size={14} />
                Day 5 build
            </span>

        </div>
    );
};

export default Nav;