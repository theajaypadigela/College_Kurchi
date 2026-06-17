import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'How does the rank predictor work?',
      a: 'Our rank predictor analyzes 10 years of TS EAMCET cutoff data to estimate your chances of admission. Enter your rank, category, and preferred branch to get personalized predictions with probability scores for hundreds of colleges.',
    },
    {
      q: 'What is TS EAMCET counseling?',
      a: 'TS EAMCET (Telangana State Engineering, Agriculture & Medical Common Entrance Test) counseling is the process by which qualified students are allotted seats in engineering colleges based on their rank, category, and web options (preferences) submitted online.',
    },
    {
      q: 'How are cutoff ranks determined?',
      a: 'Cutoff ranks are the closing ranks at which seats in a particular college/branch/category were filled in the previous year. They depend on the number of applicants, seats available, and student preferences. Cutoffs vary each year based on competition.',
    },
  ];

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Sticky Nav */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-outline-variant/30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">school</span>
            <span className="font-bold text-on-surface text-xl">College Kurchi</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <Link
              to="/app/colleges"
              className="text-on-surface-variant hover:text-on-surface text-sm font-medium transition-colors"
            >
              College Explorer
            </Link>
            <Link
              to="/app/predictor"
              className="text-on-surface-variant hover:text-on-surface text-sm font-medium transition-colors"
            >
              Predictor
            </Link>
            <Link
              to="/app/shortlist"
              className="text-on-surface-variant hover:text-on-surface text-sm font-medium transition-colors"
            >
              Shortlist
            </Link>
          </div>
          <button
            onClick={() => navigate('/app/ai-counselor')}
            className="bg-primary text-on-primary px-5 py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">smart_toy</span>
            Consult AI
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-secondary-container text-on-secondary-container px-4 py-2 rounded-full text-sm font-medium mb-6">
              <span className="material-symbols-outlined text-base">verified</span>
              Trusted by 50,000+ students
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-on-surface leading-tight mb-6">
              Master TS EAMCET
              <br />
              <span className="text-primary">Counseling with AI</span>
            </h1>
            <p className="text-on-surface-variant text-lg mb-8 leading-relaxed">
              Navigate your engineering admissions with confidence. Explore 300+ colleges, analyze 10
              years of cutoff data, and get AI-powered predictions tailored to your rank.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => navigate('/app/predictor')}
                className="bg-primary text-on-primary px-8 py-3.5 rounded-xl font-semibold text-base hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-primary/20"
              >
                <span className="material-symbols-outlined">analytics</span>
                Start Predicting
              </button>
              <button
                onClick={() => navigate('/app/colleges')}
                className="border-2 border-primary text-primary px-8 py-3.5 rounded-xl font-semibold text-base hover:bg-primary/5 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined">travel_explore</span>
                Explore Colleges
              </button>
            </div>
          </div>
          <div className="relative">
            <div className="bg-gradient-to-br from-primary to-secondary rounded-2xl aspect-square flex flex-col items-center justify-center text-white shadow-2xl shadow-primary/30">
              <span className="material-symbols-outlined text-white/30 text-9xl mb-4">school</span>
              <div className="text-2xl font-bold">AI-Powered Predictions</div>
              <div className="text-white/70 mt-2 text-sm">Real-time counseling insights</div>
              <div className="mt-8 flex gap-4">
                <div className="bg-white/10 rounded-xl px-4 py-3 text-center backdrop-blur-sm">
                  <div className="text-2xl font-bold">300+</div>
                  <div className="text-white/70 text-xs mt-1">Colleges</div>
                </div>
                <div className="bg-white/10 rounded-xl px-4 py-3 text-center backdrop-blur-sm">
                  <div className="text-2xl font-bold">10yr</div>
                  <div className="text-white/70 text-xs mt-1">Data</div>
                </div>
                <div className="bg-white/10 rounded-xl px-4 py-3 text-center backdrop-blur-sm">
                  <div className="text-2xl font-bold">95%</div>
                  <div className="text-white/70 text-xs mt-1">Accuracy</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl shadow-[0px_4px_20px_rgba(30,58,138,0.05)] border border-outline-variant/30 bg-white p-8 text-center">
            <div className="text-5xl font-bold text-primary mb-2">300+</div>
            <div className="text-on-surface-variant font-medium">Engineering Colleges</div>
            <div className="text-sm text-outline mt-1">Across Telangana &amp; AP</div>
          </div>
          <div className="rounded-xl bg-primary text-on-primary p-8 text-center shadow-lg shadow-primary/20">
            <div className="text-5xl font-bold mb-2">10 Years</div>
            <div className="font-medium opacity-90">Cutoff Data</div>
            <div className="text-sm opacity-70 mt-1">Historical rank analysis</div>
          </div>
          <div className="rounded-xl shadow-[0px_4px_20px_rgba(30,58,138,0.05)] border border-outline-variant/30 bg-white p-8 text-center">
            <div className="text-5xl font-bold text-primary mb-2">50K+</div>
            <div className="text-on-surface-variant font-medium">Students Helped</div>
            <div className="text-sm text-outline mt-1">Every counseling cycle</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-on-surface text-center mb-4">Everything You Need</h2>
        <p className="text-on-surface-variant text-center mb-12 max-w-2xl mx-auto">
          From rank prediction to college exploration, we have all the tools to make your counseling
          journey smooth.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl shadow-[0px_4px_20px_rgba(30,58,138,0.05)] border border-outline-variant/30 bg-white p-6 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-secondary-container rounded-xl flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-on-secondary-container text-2xl">
                smart_toy
              </span>
            </div>
            <h3 className="font-bold text-on-surface text-lg mb-2">AI Counselor</h3>
            <p className="text-on-surface-variant text-sm mb-4">
              Get instant answers to all your counseling queries from our AI assistant trained on TS
              EAMCET data.
            </p>
            <Link
              to="/app/ai-counselor"
              className="text-primary font-semibold text-sm hover:underline flex items-center gap-1"
            >
              Try Now{' '}
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
          </div>
          <div className="rounded-xl shadow-[0px_4px_20px_rgba(30,58,138,0.05)] border border-outline-variant/30 bg-white p-6 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-primary text-2xl">analytics</span>
            </div>
            <h3 className="font-bold text-on-surface text-lg mb-2">Rank Predictor</h3>
            <p className="text-on-surface-variant text-sm mb-4">
              Input your rank and get probability-based predictions for hundreds of colleges and
              branches.
            </p>
            <Link
              to="/app/predictor"
              className="text-primary font-semibold text-sm hover:underline flex items-center gap-1"
            >
              Try Now{' '}
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
          </div>
          <div className="rounded-xl shadow-[0px_4px_20px_rgba(30,58,138,0.05)] border border-outline-variant/30 bg-white p-6 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-primary text-2xl">
                travel_explore
              </span>
            </div>
            <h3 className="font-bold text-on-surface text-lg mb-2">College Explorer</h3>
            <p className="text-on-surface-variant text-sm mb-4">
              Browse and filter 300+ colleges by district, branch, type, and more with detailed
              cutoff histories.
            </p>
            <Link
              to="/app/colleges"
              className="text-primary font-semibold text-sm hover:underline flex items-center gap-1"
            >
              Try Now{' '}
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-on-surface text-center mb-12">
          Frequently Asked Questions
        </h2>
        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl border border-outline-variant/30 bg-white overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left font-semibold text-on-surface hover:bg-surface-container transition-colors"
              >
                {faq.q}
                <span
                  className="material-symbols-outlined text-outline transition-transform duration-200"
                  style={{ transform: openFaq === i ? 'rotate(180deg)' : 'none' }}
                >
                  expand_more
                </span>
              </button>
              {openFaq === i && (
                <div className="px-6 pb-4 text-on-surface-variant text-sm leading-relaxed border-t border-outline-variant/20 pt-4">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-outline-variant/30 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">school</span>
            <span className="font-bold text-on-surface">College Kurchi</span>
          </div>
          <div className="text-on-surface-variant text-sm">
            &copy; 2024 College Kurchi. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm text-on-surface-variant">
            <Link to="/app/colleges" className="hover:text-on-surface transition-colors">
              Colleges
            </Link>
            <Link to="/app/predictor" className="hover:text-on-surface transition-colors">
              Predictor
            </Link>
            <Link to="/app/ai-counselor" className="hover:text-on-surface transition-colors">
              AI Counselor
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
