import React, { useState } from "react";
import { Bot, X, Copy, Check } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ---------- Copy button for code blocks ----------
const CodeBlock = ({ children, className }) => {
    const [copied, setCopied] = useState(false);
    const codeText = String(children).replace(/\n$/, "");

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(codeText);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (err) {
            console.error("Copy failed:", err);
        }
    };

    return (
        <div className="relative my-3 max-w-full">
            <button
                type="button"
                onClick={handleCopy}
                className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md border border-[#E9DCC5] bg-white/90 px-2 py-1 text-[11px] font-medium text-[#3B2712] shadow-sm transition hover:bg-white"
            >
                {copied ? (
                    <>
                        <Check size={12} /> Copied
                    </>
                ) : (
                    <>
                        <Copy size={12} /> Copy
                    </>
                )}
            </button>
            <pre className="max-w-full overflow-x-auto rounded-lg bg-[#FFF7E8] p-4 pt-10 text-sm">
                <code className={className}>{codeText}</code>
            </pre>
        </div>
    );
};

const MessageBubble = ({ messages = [] }) => {
    const [lightBox, setLightBox] = useState(null);

    const safeMessages = messages.map((msg) => {
        let content = msg.content;

        if (typeof content !== "string") {
            if (content && typeof content === "object" && "answer" in content) {
                content = content.answer;
            } else if (content == null) {
                content = "";
            } else {
                content = String(content);
            }
        }

        return { ...msg, content };
    });

    return (
        <>
            {safeMessages.map((msg, index) => (
                <div
                    key={msg._id || msg.id || `${msg.role}-${index}`}
                    className={`flex items-end gap-3 min-w-0 ${msg.role === "user" ? "flex-row-reverse" : ""
                        }`}
                >
                    {/* AGENT ICON */}
                    {msg.role === "agent" && (
                        <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center bg-gradient-to-br from-[#F3A712] to-[#DE8A0B] shadow-[0_4px_10px_-3px_rgba(222,138,11,0.6)]"
                            style={{
                                clipPath:
                                    "polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)",
                            }}
                        >
                            <Bot
                                size={17}
                                className="text-white"
                                strokeWidth={2}
                            />
                        </div>
                    )}

                    {/* MESSAGE BUBBLE */}
                    <div
                        className={`min-w-0 max-w-[78%] rounded-2xl px-5 py-4 text-[17px] leading-relaxed shadow-sm ${msg.role === "user"
                            ? "rounded-br-md bg-gradient-to-br from-[#F3A712] to-[#DE8A0B] text-[#FFFDF8] shadow-[0_8px_18px_-8px_rgba(222,138,11,0.65)]"
                            : "rounded-bl-md border border-[#3B2712]/10 border-l-2 border-l-[#F3A712] bg-white text-[#3B2712]"
                            }`}
                    >
                        {/* MESSAGE TEXT */}
                        {msg.content && (
                            <div className="min-w-0 max-w-full break-words text-[15px] leading-relaxed">
                                <Markdown
                                    remarkPlugins={[remarkGfm]}
                                    urlTransform={(url) => url} // keep raw links (http/https/mailto) untouched
                                    components={{
                                        p: ({ children }) => (
                                            <p className="mb-3 last:mb-0 break-words">
                                                {children}
                                            </p>
                                        ),

                                        pre: ({ children }) => {
                                            const codeEl = children;
                                            const className = codeEl?.props?.className || "";
                                            const codeChildren = codeEl?.props?.children;
                                            return (
                                                <CodeBlock className={className}>
                                                    {codeChildren}
                                                </CodeBlock>
                                            );
                                        },

                                        code: ({ children, className, inline }) => {
                                            if (inline) {
                                                return (
                                                    <code
                                                        className={`${className || ""} break-normal rounded bg-[#FFF1D3] px-1.5 py-0.5 text-[14px]`}
                                                    >
                                                        {children}
                                                    </code>
                                                );
                                            }
                                            return <code className={className}>{children}</code>;
                                        },

                                        h1: ({ children }) => (
                                            <h1 className="mb-3 mt-4 text-2xl font-bold text-[#3B2712]">
                                                {children}
                                            </h1>
                                        ),

                                        h2: ({ children }) => (
                                            <h2 className="mb-2 mt-4 text-xl font-bold text-[#3B2712]">
                                                {children}
                                            </h2>
                                        ),

                                        h3: ({ children }) => (
                                            <h3 className="mb-2 mt-3 text-lg font-semibold text-[#3B2712]">
                                                {children}
                                            </h3>
                                        ),

                                        ul: ({ children }) => (
                                            <ul className="mb-3 list-disc pl-6">
                                                {children}
                                            </ul>
                                        ),

                                        ol: ({ children }) => (
                                            <ol className="mb-3 list-decimal pl-6">
                                                {children}
                                            </ol>
                                        ),

                                        li: ({ children }) => (
                                            <li className="mb-1.5 break-words">
                                                {children}
                                            </li>
                                        ),

                                        // Tables — wrap in a scrollable container
                                        table: ({ children }) => (
                                            <div className="my-3 max-w-full overflow-x-auto rounded-lg border border-[#E9DCC5]">
                                                <table className="min-w-full border-collapse text-[14px]">
                                                    {children}
                                                </table>
                                            </div>
                                        ),

                                        thead: ({ children }) => (
                                            <thead className="bg-[#FFF7E7]">
                                                {children}
                                            </thead>
                                        ),

                                        tbody: ({ children }) => (
                                            <tbody className="divide-y divide-[#E9DCC5]">
                                                {children}
                                            </tbody>
                                        ),

                                        tr: ({ children }) => (
                                            <tr>
                                                {children}
                                            </tr>
                                        ),

                                        th: ({ children }) => (
                                            <th className="px-4 py-2.5 text-left font-semibold text-[#3B2712]">
                                                {children}
                                            </th>
                                        ),

                                        td: ({ children }) => (
                                            <td className="px-4 py-2.5 text-[#3B2712] align-top">
                                                {children}
                                            </td>
                                        ),

                                        img: ({ src, alt }) => (
                                            <img
                                                src={src}
                                                alt={alt || ""}
                                                loading="lazy"
                                                className="my-3 max-w-full rounded-lg shadow-sm"
                                            />
                                        ),

// Clickable links — opens in new tab, styled + underlined
                                        a: ({ href, children }) => (
                                            <a
                                                href={href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-medium text-[#B96B08] underline underline-offset-2 decoration-[#DE8A0B]/60 hover:text-[#DE8A0B] hover:decoration-[#DE8A0B]"
                                            >
                                                {children}
                                            </a>
                                        ),

                                        blockquote: ({ children }) => (
                                            <blockquote className="my-3 border-l-4 border-l-[#F3A712] bg-[#FFFDF8] pl-4 py-1 italic text-[#6F4A20]">
                                                {children}
                                            </blockquote>
                                        ),
                                    }}
                                >
                                    {msg.content}
                                </Markdown>
                            </div>
                        )}

                        {/* INLINE IMAGES */}
                        {msg.images && msg.images.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {msg.images.map((url, i) => (
                                    <img
                                        key={i}
                                        src={url}
                                        onClick={() => setLightBox(url)}
                                        alt={`Result ${i + 1}`}
                                        loading="lazy"
                                        className="h-28 w-40 cursor-zoom-in rounded-xl border border-amber-200 object-cover transition hover:opacity-90"
                                        onError={(e) => {
                                            e.currentTarget.style.display = "none";
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        {/* TIME */}
                        {msg.time && (
                            <p
                                className={`mt-2 text-[12px] ${msg.role === "user"
                                    ? "text-[#FFFDF8]/75"
                                    : "text-[#B96B08]"
                                }`}
                            >
                                {msg.time}
                            </p>
                        )}
                    </div>
                </div>
            ))}

            {/* IMAGE LIGHTBOX */}
            {lightBox && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
                    onClick={() => setLightBox(null)}
                >
                    <button
                        type="button"
                        onClick={() => setLightBox(null)}
                        className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-lg transition hover:bg-white"
                        aria-label="Close image"
                    >
                        <X size={22} />
                    </button>

                    <img
                        src={lightBox}
                        alt="Full size result"
                        onClick={(e) => e.stopPropagation()}
                        className="max-h-[90vh] max-w-[90vw] rounded-xl object-cover shadow-2xl"
                    />
                </div>
            )}
        </>
    );
};

export default MessageBubble;