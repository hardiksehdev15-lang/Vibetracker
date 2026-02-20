import { useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const navigate = useNavigate();

  const handleAuth = async (type: 'LOGIN' | 'SIGNUP') => {
    setLoading(true);
    setMessage(null);
    
    const { data, error } = type === 'LOGIN' 
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else if (type === 'SIGNUP' && !data.session) {
      setMessage({ type: 'success', text: 'Check your email for the confirmation link!' });
    } else {
      navigate("/");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-4 text-white">
      <div className="w-full max-w-md space-y-8 bg-white/5 p-8 rounded-2xl border border-white/10 backdrop-blur-md">
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight">
            Vibe<span className="text-orange-400">Tracker</span>
          </h1>
          <p className="mt-2 text-white/40 text-sm">Sign in to track your streaks</p>
        </div>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email address"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400 transition"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400 transition"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-sm ${message.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
            {message.text}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={() => handleAuth('LOGIN')}
            disabled={loading}
            className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-orange-400 hover:text-white transition disabled:opacity-50"
          >
            {loading ? "Processing..." : "Sign In"}
          </button>
          <button
            onClick={() => handleAuth('SIGNUP')}
            disabled={loading}
            className="w-full bg-transparent border border-white/10 font-bold py-3 rounded-xl hover:bg-white/5 transition text-white/60 hover:text-white"
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}