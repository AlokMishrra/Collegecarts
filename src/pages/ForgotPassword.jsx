import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Mail, Lock, Loader2, ArrowLeft, ShieldCheck, User, CheckCircle } from 'lucide-react';

const BTN_BASE = 'w-full h-12 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed';

const OTP_LENGTH = 6;

const OTPInput = ({ value, onChange }) => {
  const digits = (value + ' '.repeat(OTP_LENGTH)).slice(0, OTP_LENGTH).split('');

  const handleKey = (e, idx) => {
    if (e.key === 'Backspace') {
      const next = [...digits];
      if (next[idx].trim()) {
        next[idx] = ' ';
        onChange(next.join('').trimEnd());
      } else if (idx > 0) {
        document.getElementById(`fp-otp-${idx - 1}`)?.focus();
      }
      return;
    }
    if (!/^\d$/.test(e.key)) return;
    const next = [...digits];
    next[idx] = e.key;
    onChange(next.join('').trimEnd());
    if (idx < OTP_LENGTH - 1) document.getElementById(`fp-otp-${idx + 1}`)?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    onChange(pasted);
    document.getElementById(`fp-otp-${Math.min(pasted.length, OTP_LENGTH - 1)}`)?.focus();
  };

  return (
    <div className="flex gap-1.5 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => {
        const filled = d.trim() !== '';
        return (
          <input
            key={i}
            id={`fp-otp-${i}`}
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

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [view, setView] = useState('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const clearError = useCallback(() => setError(''), []);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!email) { setError('Please enter your email'); return; }
    setIsLoading(true);
    clearError();
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const otpRes = await fetch(`${supabaseUrl}/functions/v1/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ email }),
      });

      const otpData = await otpRes.json();
      if (!otpRes.ok || otpData.error) {
        setError(otpData.error || 'Failed to send code. Please try again.');
        return;
      }

      setView('otp');
      setResendCooldown(120);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e?.preventDefault();
    const code = otp.replace(/\s/g, '');
    if (code.length !== 6) { setError('Enter the 6-digit code'); return; }
    setIsLoading(true);
    clearError();
    try {
      const { data: isValid, error: verifyErr } = await supabase.rpc('verify_otp', {
        p_email: email,
        p_code: code,
      });

      if (verifyErr || !isValid) {
        setError('This code is invalid or has expired. Please request a new one.');
        return;
      }

      setView('new_password');
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!password || !confirmPassword) { setError('Please fill in all fields'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setIsLoading(true);
    clearError();
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to reset password. Please try again.');
        return;
      }

      setView('success');
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    clearError();
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const otpRes = await fetch(`${supabaseUrl}/functions/v1/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ email }),
      });

      const otpData = await otpRes.json();
      if (!otpRes.ok || otpData.error) {
        setError(otpData.error || 'Failed to resend code.');
        return;
      }

      setResendCooldown(120);
    } catch (err) {
      setError('Failed to resend. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 1: Enter email ─────────────────────────────────────────────────
  if (view === 'email') return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-green-500" />
        <div className="p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-md mb-3 bg-white border border-gray-100">
              <img src="/favicon.png" alt="CollegeCart" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">We'll send you a verification code</p>
          </div>

          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5"
          >
            <ArrowLeft size={15} /> Back to login
          </button>

          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-3">
              <Mail size={28} className="text-emerald-600" />
            </div>
            <p className="text-gray-500 text-sm text-center">
              Enter your email address and we'll send you a 6-digit code to reset your password.
            </p>
          </div>

          <form onSubmit={handleSendOTP} className="space-y-4">
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
                  autoFocus
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-xl">{error}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className={`${BTN_BASE} bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm`}
            >
              {isLoading ? <><Loader2 size={16} className="animate-spin" /> Sending code...</> : 'Send Verification Code'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  // ── Step 2: Enter OTP ───────────────────────────────────────────────────
  if (view === 'otp') return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-green-500" />
        <div className="p-8">
          <button
            onClick={() => { setView('email'); setOtp(''); clearError(); }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5"
          >
            <ArrowLeft size={15} /> Back
          </button>

          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-3">
              <ShieldCheck size={28} className="text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Verify your email</h2>
            <p className="text-gray-500 text-sm text-center mt-1">
              We sent a 6-digit code to<br />
              <span className="font-semibold text-gray-700">{email}</span>
            </p>
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mt-3 text-center">
              Code expires in 10 minutes — check your spam folder too
            </p>
          </div>

          <form onSubmit={handleVerifyOTP} className="space-y-5">
            <OTPInput value={otp} onChange={setOtp} />

            {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-xl text-center">{error}</p>}

            <button
              type="submit"
              disabled={isLoading || otp.replace(/\s/g, '').length !== 6}
              className={`${BTN_BASE} bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm`}
            >
              {isLoading ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : 'Verify Code'}
            </button>
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
        </div>
      </div>
    </div>
  );

  // ── Step 3: Enter new password ──────────────────────────────────────────
  if (view === 'new_password') return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-green-500" />
        <div className="p-8">
          <button
            onClick={() => { setView('otp'); setOtp(''); clearError(); }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5"
          >
            <ArrowLeft size={15} /> Back
          </button>

          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-3">
              <Lock size={28} className="text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Set new password</h2>
            <p className="text-gray-500 text-sm text-center mt-1">
              Create a new password for<br />
              <span className="font-semibold text-gray-700">{email}</span>
            </p>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <Input
                  type="password"
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pl-9 h-12 rounded-xl"
                  required
                  autoFocus
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <Input
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="pl-9 h-12 rounded-xl"
                  required
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-xl">{error}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className={`${BTN_BASE} bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm`}
            >
              {isLoading ? <><Loader2 size={16} className="animate-spin" /> Resetting...</> : 'Reset Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  // ── Step 4: Success ─────────────────────────────────────────────────────
  if (view === 'success') return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-green-500" />
        <div className="p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle size={36} className="text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 text-center">Password Reset Successfully!</h2>
            <p className="text-gray-500 text-sm text-center mt-2">
              Your password has been updated.<br />
              You can now sign in with your new password.
            </p>
          </div>

          <button
            onClick={() => navigate('/login')}
            className={`${BTN_BASE} bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm mt-4`}
          >
            Go to Sign In
          </button>
        </div>
      </div>
    </div>
  );

  return null;
}
