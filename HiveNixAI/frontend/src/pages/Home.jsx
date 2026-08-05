import { useEffect, useState } from 'react'
import { signInWithPopup } from 'firebase/auth'
import { auth, googleprovider } from '../../utils/firebase'
import api from '../../utils/axios'
import getCurrentUser from '../features/getCurrentUser.js'
import { useDispatch, useSelector } from 'react-redux'
import { setUserData } from '../redux/userSlice.js'

const Home = () => {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [remember, setRemember] = useState(false)
    const [error, setError] = useState("")
    const dispatch = useDispatch()
    const { userData } = useSelector(state => state.user)
    console.log(userData)

    const handleLogin = async (token) => {
        try {
            const { data } = await api.post("/api/auth/login", { token })
            dispatch(setUserData(data))
        }
        catch (error) {
            console.log(error)
            setError("Login failed. Try again.")
        }
    }

    const googleLogin = async () => {
        try {
            const data = await signInWithPopup(auth, googleprovider)
            const token = await data.user.getIdToken()
            await handleLogin(token)
        } catch (error) {
            console.log(error)
            setError("Google sign-in failed. Try again.")
        }
    }
    useEffect(() => {
        const getUser = async () => {
            await getCurrentUser()
        }
        getUser()
    }, [])
    const handleEmailLogin = (e) => {
        e.preventDefault()
        setError("")
        console.log({ email, password, remember })
        // TODO: call handleLogin with email/password flow if your
        // auth service supports it, or your own token exchange logic
    }

    return (<div className="min-h-screen w-full flex flex-col lg:flex-row" style={{ background: "var(--page-bg)" }}>
        <style>{`
        :root{
          --page-bg: #FFF8EC;
          --comb-base: #FFF1D3;
          --comb-line: #FBE3AE;
          --honey-gold: #F3A712;
          --amber-comb: #DE8A0B;
          --deep-honey: #B96B08;
          --ink-brown: #3B2712;
          --soft-brown: #8A6A42;
          --card-white: #FFFDF8;
          --sting-red: #D65A45;
        }
        .font-display{ font-family: 'Fraunces', serif; }
        .honeycomb-bg{
          position: relative;
          overflow: hidden;
          background-color: var(--comb-base);
          background-image:
            linear-gradient(30deg, var(--comb-line) 12%, transparent 12.5%, transparent 87%, var(--comb-line) 87.5%, var(--comb-line)),
            linear-gradient(150deg, var(--comb-line) 12%, transparent 12.5%, transparent 87%, var(--comb-line) 87.5%, var(--comb-line)),
            linear-gradient(30deg, var(--comb-line) 12%, transparent 12.5%, transparent 87%, var(--comb-line) 87.5%, var(--comb-line)),
            linear-gradient(150deg, var(--comb-line) 12%, transparent 12.5%, transparent 87%, var(--comb-line) 87.5%, var(--comb-line)),
            linear-gradient(60deg, #FCE7B9 25%, transparent 25.5%, transparent 75%, #FCE7B9 75%, #FCE7B9),
            linear-gradient(60deg, #FCE7B9 25%, transparent 25.5%, transparent 75%, #FCE7B9 75%, #FCE7B9);
          background-size: clamp(40px, 5vw, 64px) clamp(70px, 8.6vw, 111px);
          background-position: 0 0, 0 0, 32px 55px, 32px 55px, 0 0, 32px 55px;
        }
        .honeycomb-bg::after{
          content:'';
          position:absolute; inset:0;
          background: linear-gradient(180deg, rgba(255,248,236,0) 0%, rgba(255,248,236,0.35) 75%, rgba(255,248,236,0.7) 100%);
          pointer-events: none;
        }
        .bee-dot{
          width: 6px; height: 6px; border-radius: 9999px;
          background: var(--honey-gold);
          box-shadow: 0 0 12px 2px rgba(243,167,18,0.55);
          animation: drift 9s ease-in-out infinite;
        }
        @keyframes drift{
          0%, 100% { transform: translate(0,0); opacity:.9; }
          50% { transform: translate(14px,-18px); opacity:.4; }
        }
        .input-field{
          background: rgba(255,255,255,0.7);
          border: 1px solid rgba(59,39,18,0.14);
          transition: border-color .2s ease, box-shadow .2s ease, background .2s ease;
        }
        .input-field:focus{
          outline: none;
          border-color: var(--honey-gold);
          box-shadow: 0 0 0 3px rgba(243,167,18,0.18);
          background: #FFFFFF;
        }
        .input-field::placeholder{ color: rgba(59,39,18,0.35); }
        .btn-honey{
          background: linear-gradient(135deg, var(--honey-gold), var(--amber-comb));
          box-shadow: 0 6px 18px -6px rgba(222,138,11,0.45);
          transition: transform .15s ease, box-shadow .15s ease, filter .15s ease;
        }
        .btn-honey:hover{ transform: translateY(-1px); filter: brightness(1.04); box-shadow: 0 10px 24px -6px rgba(222,138,11,0.55); }
        .btn-honey:active{ transform: translateY(0); }
        .hex-badge{ clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%); }
        a.link-honey{ color: var(--deep-honey); position: relative; }
        a.link-honey::after{
          content:''; position:absolute; left:0; bottom:-2px; width:0; height:1px;
          background: var(--deep-honey); transition: width .2s ease;
        }
        a.link-honey:hover::after{ width:100%; }
        @media (prefers-reduced-motion: reduce){ .bee-dot{ animation: none; } }
      `}</style>

        <div className="honeycomb-bg w-full lg:w-1/2 relative flex flex-col justify-between
                   px-6 sm:px-10 lg:px-14 py-8 sm:py-10 lg:py-12
                   min-h-[220px] sm:min-h-[260px] lg:min-h-screen">
            <div className="bee-dot absolute top-10 left-10 sm:top-16 sm:left-16 lg:top-24 lg:left-20" />
            <div className="bee-dot absolute top-24 right-10 sm:top-40 sm:right-20 lg:top-56 lg:right-28" style={{ animationDelay: "2s" }} />
            <div className="bee-dot absolute bottom-10 left-16 sm:bottom-24 sm:left-24 lg:bottom-40 lg:left-32 hidden sm:block" style={{ animationDelay: "4.5s" }} />

            <div className="relative z-10 flex items-center gap-3">
                <div className="hex-badge w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center shrink-0"
                    style={{ background: "linear-gradient(135deg, var(--honey-gold), var(--amber-comb))" }}>
                    <span className="font-display font-bold text-base sm:text-lg" style={{ color: "var(--card-white)" }}>🐝</span>
                </div>
                <span className="font-display text-lg sm:text-xl tracking-wide" style={{ color: "var(--ink-brown)" }}>
                    HiveNixAI
                </span>
            </div>

            <div className="relative z-10 max-w-md mt-4 lg:mt-0">
                <h1 className="font-display text-2xl sm:text-3xl lg:text-5xl leading-[1.12] font-semibold" style={{ color: "var(--ink-brown)" }}>
                    Every agent has its cell.{" "}
                    <span style={{ color: "var(--deep-honey)" }}>Together, a hive.</span>
                </h1>
                <p className="mt-3 lg:mt-6 text-sm lg:text-[15px] leading-relaxed opacity-80 hidden sm:block" style={{ color: "var(--soft-brown)" }}>
                    Sign in to orchestrate your multi-agent workflows
                </p>
            </div>

            <div className="relative z-10 hidden lg:flex items-center gap-2 text-xs opacity-70" style={{ color: "var(--soft-brown)" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--honey-gold)" }} />
                Built in public — Day by day, cell by cell.
            </div>
        </div>

        <div className="w-full lg:w-1/2 flex items-center justify-center px-5 sm:px-8 py-10 sm:py-12">
            <div className="w-full max-w-sm">
                <h2 className="font-display text-2xl sm:text-3xl font-semibold" style={{ color: "var(--ink-brown)" }}>
                    Welcome back
                </h2>
                <p className="mt-2 text-sm" style={{ color: "var(--soft-brown)" }}>
                    Log in to keep your agents buzzing.
                </p>

                {error && (
                    <div className="mt-5 rounded-lg px-4 py-2.5 text-sm"
                        style={{ background: "rgba(214,90,69,0.08)", color: "var(--sting-red)", border: "1px solid rgba(214,90,69,0.25)" }}>
                        {error}
                    </div>
                )}

                <form className="mt-8 sm:mt-9 space-y-4 sm:space-y-5" onSubmit={handleEmailLogin}>
                    <div>
                        <label htmlFor="email" className="block text-xs font-medium mb-1.5 tracking-wide uppercase" style={{ color: "var(--soft-brown)" }}>
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@hivenix.ai"
                            className="input-field w-full rounded-lg px-4 py-3 text-sm"
                            style={{ color: "var(--ink-brown)" }}
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label htmlFor="password" className="block text-xs font-medium tracking-wide uppercase" style={{ color: "var(--soft-brown)" }}>
                                Password
                            </label>
                            <a href="#" className="link-honey text-xs font-medium">Forgot?</a>
                        </div>
                        <input
                            id="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="input-field w-full rounded-lg px-4 py-3 text-sm"
                            style={{ color: "var(--ink-brown)" }}
                        />
                    </div>

                    <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: "var(--soft-brown)" }}>
                        <input
                            type="checkbox"
                            checked={remember}
                            onChange={(e) => setRemember(e.target.checked)}
                            className="w-3.5 h-3.5 rounded"
                            style={{ accentColor: "var(--honey-gold)" }}
                        />
                        Keep me signed in
                    </label>

                    <button type="submit" className="btn-honey w-full rounded-lg py-3 text-sm font-semibold tracking-wide" style={{ color: "var(--card-white)" }}>
                        Enter the hive
                    </button>
                </form>

                <div className="flex items-center gap-3 my-6 sm:my-7">
                    <div className="h-px flex-1" style={{ background: "rgba(59,39,18,0.12)" }} />
                    <span className="text-[11px] uppercase tracking-wider" style={{ color: "var(--soft-brown)" }}>or</span>
                    <div className="h-px flex-1" style={{ background: "rgba(59,39,18,0.12)" }} />
                </div>

                <button
                    type="button"
                    onClick={googleLogin}
                    className="input-field w-full flex items-center justify-center gap-2.5 rounded-lg py-3 text-sm font-medium"
                    style={{ color: "var(--ink-brown)" }}
                >
                    <svg width="16" height="16" viewBox="0 0 48 48">
                        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.9 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.4-.4-3.5z" />
                        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.5 15.5 18.9 12 24 12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3c-7.8 0-14.4 4.4-17.7 10.7z" />
                        <path fill="#4CAF50" d="M24 45c5.4 0 10.3-1.8 14.1-5l-6.5-5.5C29.6 36 26.9 37 24 37c-5.3 0-9.8-3.1-11.3-7.9l-6.6 5C9.5 40.4 16.2 45 24 45z" />
                        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 3-3.4 5.5-6.7 6.5l6.5 5.5C37.9 38.3 42 32.8 42 24c0-1.2-.1-2.4-.4-3.5z" />
                    </svg>
                    Continue with Google
                </button>

                <p className="mt-7 sm:mt-8 text-center text-sm" style={{ color: "var(--soft-brown)" }}>
                    New to the hive? <a href="#" className="link-honey font-medium">Create an account</a>
                </p>
            </div>
        </div>
    </div>
    )
}

export default Home