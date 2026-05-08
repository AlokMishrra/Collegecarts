import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Mail, Lock, Loader2, ArrowLeft, ShieldCheck, User } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// All helper components are defined at MODULE level — never inside Login().
// Defining them inside the parent causes React to treat them as new component
// types on every render, unmounting + remounting inputs and losing focus.
// ─────────────────────────────────────────────────────────────────────────────

const BTN_BASE = 'w-full h-12 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_STYLES = {
  primary: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm',
  outline: 'border-2 border-gray-200 hover:border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
  ghost:   'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50',
};

const Btn = ({ children, onClick, disabled, variant = 'primary', type = 'button', className = '' }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`${BTN_BASE} ${BTN_STYLES[variant]} ${className}`}
  >
    {children}
  </button>
);

// ─── OTP 8-box input ─────────────────────────────────────────────────────────
const OTP_LENGTH = 8;

const OTPInput = ({ value, onChange }) => {
  const digits = (value + ' '.repeat(OTP_LENGTH)).slice(0, OTP_LENGTH).split('');

  const handleKey = (e, idx) => {
    if (e.key === 'Backspace') {
      const next = [...digits];
      if (next[idx].trim()) {
        next[idx] = ' ';
        onChange(next.join('').trimEnd());
      } else if (idx > 0) {
        document.getElementById(`otp-${idx - 1}`)?.focus();
      }
      return;
    }
    if (!/^\d$/.test(e.key)) return;
    const next = [...digits];
    next[idx] = e.key;
    onChange(next.join('').trimEnd());
    if (idx < OTP_LENGTH - 1) document.getElementById(`otp-${idx + 1}`)?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    onChange(pasted);
    document.getElementById(`otp-${Math.min(pasted.length, OTP_LENGTH - 1)}`)?.focus();
  };

  return (
    <div className="flex gap-1.5 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => {
        const filled = d.trim() !== '';
        return (
          <input
            key={i}
            id={`otp-${i}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={filled ? d : ''}
            onChange={() => {}}
            onKeyDown={(e) => handleKey(e, i)}
            className={[
              'w-9 h-12 text-center text-lg font-bold rounded-xl border-2 outline-none transition-all',
              filled
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-gray-200 bg-gray-50 text-gray-900',
              'focus:border-emerald-500 focus:bg-white focus:shadow-sm',
            ].join(' ')}
          />
        );
      })}
    </div>
  );
};

// ─── Card shell (logo + optional back button + children) ─────────────────────
const Shell = ({ children, onBack }) => (
  <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 flex items-center justify-center p-4">
    <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-green-500" />
      <div className="p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-md mb-3 bg-white border border-gray-100">
            <img src="/favicon.png" alt="CollegeCart" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">CollegeCart</h1>
          <p className="text-xs text-emerald-600 font-medium mt-0.5">Smart Shopping, Better Living</p>
        </div>

        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 -mt-2"
          >
            <ArrowLeft size={15} /> Back
          </button>
        )}

        {children}
      </div>
    </div>
  </div>
);

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Login component
// ─────────────────────────────────────────────────────────────────────────────
export default function Login() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from?.pathname || '/Shop';

  const [view,           setView]           = useState('landing');
  const [email,          setEmail]          = useState('');
  const [password,       setPassword]       = useState('');
  const [fullName,       setFullName]       = useState('');
  const [otp,            setOtp]            = useState('');
  const [isLoading,      setIsLoading]      = useState(false);
  const [error,          setError]          = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Check user role and redirect accordingly
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        if (userData?.role === 'delivery') {
          navigate('/Delivery', { replace: true });
        } else if (userData?.role === 'admin') {
          navigate('/CCA', { replace: true });
        } else {
          navigate(from, { replace: true });
        }
      }
    });
  }, []); // eslint-disable-line

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const clearError = useCallback(() => setError(''), []);

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setIsLoading(true);
    clearError();
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${from}` },
    });
    setIsLoading(false);
    if (e) setError(e.message);
  };

  // ── Sign in ───────────────────────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setIsLoading(true);
    clearError();
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      if (data?.session) {
        await ensureProfile(data.session.user);
        
        // Check user role and redirect accordingly
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', data.session.user.id)
          .single();
        
        if (userData?.role === 'delivery') {
          navigate('/Delivery', { replace: true });
        } else if (userData?.role === 'admin') {
          navigate('/CCA', { replace: true });
        } else {
          navigate(from, { replace: true });
        }
      }
    } catch (err) {
      setError(err.message);
    }
    setIsLoading(false);
  };

  // ── Sign up → send OTP ────────────────────────────────────────────────────
  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!email || !password || !fullName) { setError('Please fill in all fields'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setIsLoading(true);
    clearError();
    try {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}${from}`,
        },
      });
      if (err) {
        if (err.status === 429 || err.message?.toLowerCase().includes('rate limit') || err.message?.toLowerCase().includes('too many')) {
          setError('Too many attempts. Please wait 2 minutes before trying again.');
          setResendCooldown(120);
        } else {
          setError(err.message);
        }
        return;
      }
      setView('otp_verify');
      setResendCooldown(120);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const handleVerifyOTP = async (e) => {
    e?.preventDefault();
    const code = otp.replace(/\s/g, '');
    if (code.length !== 8) { setError('Enter the 8-digit code'); return; }
    setIsLoading(true);
    clearError();
    try {
      // Supabase OTP type for email signup confirmation is 'email'
      // (not 'signup' — that's for magic-link flow)
      const { data, error: err } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      });
      if (err) {
        // Give a clear message instead of the raw Supabase error
        if (err.message?.toLowerCase().includes('expired') || err.message?.toLowerCase().includes('invalid') || err.status === 403) {
          setError('This code is invalid or has expired. Please request a new one.');
        } else {
          setError(err.message);
        }
        return;
      }
      if (data?.session) {
        await ensureProfile(data.session.user, fullName);
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    clearError();
    try {
      // Re-trigger signup to get a fresh OTP sent
      const { error: err } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (err) {
        if (err.status === 429) {
          setError('Too many attempts. Please wait a few minutes before requesting a new code.');
          setResendCooldown(120);
        } else {
          setError(err.message);
        }
        return;
      }
      setResendCooldown(120); // 2 min cooldown to avoid rate limits
    } catch (err) {
      setError('Failed to resend. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Create/link user profile row ─────────────────────────────────────────
  const ensureProfile = async (authUser, name) => {
    try {
      await supabase.rpc('link_user_by_email', {
        p_auth_id:   authUser.id,
        p_email:     authUser.email || '',
        p_full_name: name || authUser.user_metadata?.full_name || authUser.user_metadata?.name || '',
        p_phone:     authUser.phone || '',
      });
    } catch (_) {}
  };

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════

  if (view === 'landing') return (
    <Shell>
      <h2 className="text-xl font-bold text-gray-900 text-center mb-1">Welcome back 👋</h2>
      <p className="text-gray-500 text-sm text-center mb-7">Sign in or create your account</p>

      <Btn variant="outline" onClick={handleGoogle} disabled={isLoading}>
        {isLoading ? <Loader2 size={18} className="animate-spin" /> : <GoogleIcon />}
        Continue with Google
      </Btn>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 font-medium">OR</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <div className="flex gap-3">
        <Btn variant="primary" onClick={() => { setView('signin'); clearError(); }}>Sign In</Btn>
        <Btn variant="outline" onClick={() => { setView('signup'); clearError(); }}>Sign Up</Btn>
      </div>

      {error && <p className="mt-4 text-red-500 text-sm bg-red-50 p-3 rounded-xl text-center">{error}</p>}
    </Shell>
  );

  if (view === 'signin') return (
    <Shell onBack={() => { setView('landing'); clearError(); }}>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Sign in</h2>
      <p className="text-gray-500 text-sm mb-6">Welcome back to CollegeCart</p>

      <form onSubmit={handleSignIn} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="pl-9 h-12 rounded-xl"
              required
              autoComplete="email"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="pl-9 h-12 rounded-xl"
              required
              autoComplete="current-password"
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-xl">{error}</p>}

        <Btn type="submit" disabled={isLoading}>
          {isLoading ? <><Loader2 size={16} className="animate-spin" /> Signing in...</> : 'Sign In'}
        </Btn>
      </form>

      <p className="text-center text-sm text-gray-500 mt-5">
        No account?{' '}
        <button onClick={() => { setView('signup'); clearError(); }} className="text-emerald-600 font-semibold hover:underline">
          Sign up
        </button>
      </p>
    </Shell>
  );

  if (view === 'signup') return (
    <Shell onBack={() => { setView('landing'); clearError(); }}>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Create account</h2>
      <p className="text-gray-500 text-sm mb-6">We'll send an 8-digit code to verify your email</p>

      <form onSubmit={handleSignUp} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Full Name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Your name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="pl-9 h-12 rounded-xl"
              required
              autoComplete="name"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="pl-9 h-12 rounded-xl"
              required
              autoComplete="email"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              type="password"
              placeholder="Min. 6 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="pl-9 h-12 rounded-xl"
              required
              autoComplete="new-password"
            />
          </div>
        </div>

        {error && (
          <div className="text-red-500 text-sm bg-red-50 p-3 rounded-xl">
            <p>{error}</p>
            {resendCooldown > 0 && error.includes('Too many') && (
              <p className="text-xs text-red-400 mt-1 font-medium">
                Try again in {resendCooldown}s
              </p>
            )}
          </div>
        )}

        <Btn type="submit" disabled={isLoading || (resendCooldown > 0 && !!error)}>
          {isLoading ? <><Loader2 size={16} className="animate-spin" /> Sending code...</> : 'Send Verification Code'}
        </Btn>
      </form>

      <p className="text-center text-sm text-gray-500 mt-5">
        Already have an account?{' '}
        <button onClick={() => { setView('signin'); clearError(); }} className="text-emerald-600 font-semibold hover:underline">
          Sign in
        </button>
      </p>
    </Shell>
  );

  if (view === 'otp_verify') return (
    <Shell onBack={() => { setView('signup'); setOtp(''); setError(''); clearError(); }}>
      <div className="flex flex-col items-center mb-6">
        <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-3">
          <ShieldCheck size={28} className="text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Verify your email</h2>
        <p className="text-gray-500 text-sm text-center mt-1">
          We sent an 8-digit code to<br />
          <span className="font-semibold text-gray-700">{email}</span>
        </p>
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mt-3 text-center">
          ⏱ Code expires in 10 minutes — check your spam folder too
        </p>
      </div>

      <form onSubmit={handleVerifyOTP} className="space-y-5">
        <OTPInput value={otp} onChange={setOtp} />

        {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-xl text-center">{error}</p>}

        <Btn type="submit" disabled={isLoading || otp.replace(/\s/g, '').length !== 8}>
          {isLoading ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : 'Verify & Continue'}
        </Btn>
      </form>

      <div className="text-center mt-5">
        <p className="text-sm text-gray-500">Didn't receive the code?</p>
        <button
          onClick={handleResend}
          disabled={resendCooldown > 0 || isLoading}
          className="text-sm font-semibold text-emerald-600 hover:underline disabled:text-gray-400 disabled:no-underline mt-1"
        >
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
        </button>
      </div>
    </Shell>
  );

  return null;
}
