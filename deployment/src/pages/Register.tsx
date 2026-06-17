import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = [
  { value: 'OC', label: 'OC — Open Competition' },
  { value: 'EWS', label: 'EWS — Economically Weaker Section' },
  { value: 'BC_A', label: 'BC-A' },
  { value: 'BC_B', label: 'BC-B' },
  { value: 'BC_C', label: 'BC-C' },
  { value: 'BC_D', label: 'BC-D' },
  { value: 'BC_E', label: 'BC-E' },
  { value: 'SC', label: 'SC — Scheduled Caste' },
  { value: 'ST', label: 'ST — Scheduled Tribe' },
];

const RegisterInner: React.FC<{ categories: { value: string; label: string }[] }> = ({ categories }) => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [rank, setRank] = useState<string>('');
  const [category, setCategory] = useState('OC');
  const [gender, setGender] = useState('Boys');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rankNum = Number(rank);
    if (!rankNum || rankNum < 1 || rankNum > 200000) {
      setError('Enter a valid rank between 1 and 2,00,000');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        rank: rankNum,
        category,
        gender,
        phone: phone.trim() || undefined,
      });
      navigate('/app/recommendations', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="material-symbols-outlined text-primary text-4xl">school</span>
            <span className="text-2xl font-bold text-on-surface">College Kurchi</span>
          </div>
          <h1 className="text-xl font-semibold text-on-surface">Create your account</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Enter your TS EAMCET details for personalized guidance
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0px_4px_20px_rgba(30,58,138,0.07)] p-8 space-y-5"
        >
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-on-surface-variant block mb-1.5">Full name</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Rahul Sharma"
              className="w-full border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-sm font-medium text-on-surface-variant block mb-1.5">Email address</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-sm font-medium text-on-surface-variant block mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="w-full border border-outline-variant rounded-lg px-3 py-2.5 pr-10 text-on-surface bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface">
                <span className="material-symbols-outlined text-xl">{showPw ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>

          <hr className="border-outline-variant/30" />
          <p className="text-xs text-outline font-medium uppercase tracking-wide">TS EAMCET Details</p>

          {/* Rank */}
          <div>
            <label className="text-sm font-medium text-on-surface-variant block mb-1.5">
              Your TS EAMCET Rank
            </label>
            <input
              type="number"
              required
              min={1}
              max={200000}
              value={rank}
              onChange={e => setRank(e.target.value)}
              placeholder="e.g. 12500"
              className="w-full border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-lg font-semibold"
            />
          </div>

          {/* Category + Gender side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-on-surface-variant block mb-1.5">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                {categories.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-on-surface-variant block mb-1.5">Gender</label>
              <select
                value={gender}
                onChange={e => setGender(e.target.value)}
                className="w-full border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="Boys">Male</option>
                <option value="Girls">Female</option>
              </select>
            </div>
          </div>

          {/* Phone (optional) */}
          <div>
            <label className="text-sm font-medium text-on-surface-variant block mb-1.5">
              Phone <span className="font-normal text-outline">(optional)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+91 9876543210"
              className="w-full border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {error && (
            <p className="text-error text-sm bg-error/5 border border-error/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-on-primary rounded-xl py-3 font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-xl ${loading ? 'animate-spin' : ''}`}>
              {loading ? 'progress_activity' : 'person_add'}
            </span>
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          <p className="text-center text-sm text-on-surface-variant">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

// Wrapper: try to get categories from DataContext if loaded, else fall back to static list
const Register: React.FC = () => {
  // DataContext may not be available here (outside /app), so we use the static list
  return <RegisterInner categories={CATEGORIES} />;
};

export default Register;
