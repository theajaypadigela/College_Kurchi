import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { postChat } from '../api';
import type { ChatMessage, ChatSource } from '../api/types';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  chips?: string[];
  sources?: ChatSource[];
}

// Static fallback questions shown when no user is logged in
const GENERIC_QUESTIONS = [
  'Which CSE colleges can I get with 25,000 rank?',
  'Best colleges for ECE under 40,000 rank?',
  'Compare CBIT and Vasavi for placements',
  'Top colleges in Hyderabad for CSE',
  'Which colleges have the best average package?',
  'Affordable CSE colleges under 80000 fee',
  'BC-B girls CSE colleges for rank 30000',
  'How does TS EAMCET counseling work?',
];

const GENERIC_CHIPS = [
  'CSE colleges for rank 25000',
  'Top CSE in Hyderabad',
  'Compare CBIT and Vasavi',
  'Best placements',
];

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  const renderInline = (str: string): React.ReactNode => {
    const parts = str.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part
    );
  };

  for (const raw of lines) {
    const line = raw.replace(/^\s*[*-]\s+/, '• '); // normalize markdown bullets
    if (line.trim() === '') {
      elements.push(<div key={key++} className="h-2" />);
      continue;
    }
    if (line.startsWith('• ')) {
      elements.push(
        <div key={key++} className="flex gap-2 items-start">
          <span className="text-primary mt-0.5 flex-shrink-0">•</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\. /.test(line)) {
      const match = line.match(/^(\d+)\. (.*)/);
      if (match) {
        elements.push(
          <div key={key++} className="flex gap-2 items-start">
            <span className="text-primary font-semibold flex-shrink-0">{match[1]}.</span>
            <span>{renderInline(match[2])}</span>
          </div>
        );
      }
    } else {
      elements.push(<div key={key++}>{renderInline(line)}</div>);
    }
  }
  return <div className="space-y-1 text-sm leading-relaxed">{elements}</div>;
}

const TypingIndicator: React.FC = () => (
  <div className="flex items-end gap-3 max-w-xs">
    <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center flex-shrink-0">
      <span className="material-symbols-outlined text-on-secondary-container text-base">smart_toy</span>
    </div>
    <div className="bg-surface-container rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
      <span className="w-2 h-2 rounded-full bg-outline animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 rounded-full bg-outline animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 rounded-full bg-outline animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  </div>
);

const AICounselor: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Build personalised questions using the actual user rank/category
  const rank = user?.rank;
  const category = user?.category;
  const gender = user?.gender;

  const suggestedQuestions = rank
    ? [
        `Which CSE colleges can I get with rank ${rank.toLocaleString('en-IN')}?`,
        `Best ECE colleges for ${category ?? 'OC'} ${gender ?? 'Boys'} rank ${rank.toLocaleString('en-IN')}?`,
        'Compare CBIT and Vasavi for placements',
        'Top colleges in Hyderabad for CSE',
        'Which colleges have the best average package?',
        'Affordable CSE colleges under 80000 fee',
        `${category ?? 'OC'} ${gender ?? 'Boys'} CSE colleges for rank ${rank.toLocaleString('en-IN')}`,
        'How does TS EAMCET counseling work?',
      ]
    : GENERIC_QUESTIONS;

  const initialChips = rank
    ? [
        `CSE colleges for rank ${rank.toLocaleString('en-IN')}`,
        `Top ${category ?? 'OC'} CSE colleges`,
        'Compare CBIT and Vasavi',
        'Best placements',
      ]
    : GENERIC_CHIPS;
  const welcomeText = user
    ? `Hi ${user.name}! 👋 I'm your TS EAMCET AI Counselor. I can see your rank is **${user.rank.toLocaleString('en-IN')}** under the **${user.category}** category (${user.gender}). Ask me about the best colleges for your rank, cutoffs, fees, placements, or anything else — I answer from the official 2025 data. What would you like to know?`
    : "Hi! I'm your TS EAMCET AI Counselor. Ask me about colleges for your rank, comparisons, cutoffs, fees, or placements — I answer from the official 2025 last-ranks data. What would you like to know?";

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'ai',
      text: welcomeText,
      chips: initialChips,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', text: text.trim() };
    const history: ChatMessage[] = messages
      .filter((m) => m.id !== '0')
      .map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }));

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      const res = await postChat({
        message: text.trim(),
        history,
        userRank: user?.rank ?? null,
        userCategory: user?.category ?? null,
        userGender: user?.gender ?? null,
      });
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now() + 1}`, role: 'ai', text: res.answer, sources: res.sources },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now() + 1}`,
          role: 'ai',
          text: `Sorry, I couldn't reach the counseling service (${(e as Error).message}). Please make sure the backend is running and try again.`,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(inputText);
  };

  const handleChipClick = (chip: string) => void sendMessage(chip);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] lg:h-screen overflow-hidden bg-background">
      {/* Suggestions sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-surface-container-lowest border-r border-outline-variant/30 flex-shrink-0">
        <div className="px-5 py-5 border-b border-outline-variant/30">
          <h2 className="font-bold text-on-surface text-base">Suggested Questions</h2>
          <p className="text-on-surface-variant text-xs mt-1">Tap to ask instantly</p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {suggestedQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => handleChipClick(q)}
              className="w-full text-left px-4 py-3 rounded-lg bg-white border border-outline-variant/30 text-on-surface-variant text-sm hover:bg-surface-container hover:text-on-surface hover:border-primary/30 transition-all"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="px-4 py-4 border-t border-outline-variant/30">
          <div className="bg-secondary-container rounded-xl p-4 text-center">
            <span className="material-symbols-outlined text-on-secondary-container text-2xl">tips_and_updates</span>
            <p className="text-on-secondary-container text-xs mt-2 font-medium">
              Answers are grounded in the official TS EAMCET dataset.
            </p>
          </div>
        </div>
      </aside>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-outline-variant/30 bg-surface-container-lowest flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-on-secondary-container text-xl">smart_toy</span>
          </div>
          <div>
            <div className="font-bold text-on-surface text-base">AI Counselor</div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-on-surface-variant">Online — RAG-grounded answers</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.role === 'user' ? (
                <div className="flex justify-end">
                  <div className="bg-primary text-on-primary rounded-2xl rounded-br-sm px-4 py-3 max-w-sm lg:max-w-lg text-sm leading-relaxed">
                    {msg.text}
                  </div>
                </div>
              ) : (
                <div className="flex items-end gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-on-secondary-container text-base">smart_toy</span>
                  </div>
                  <div className="flex flex-col gap-2 max-w-sm lg:max-w-lg">
                    <div className="bg-surface-container rounded-2xl rounded-bl-sm px-4 py-3 text-on-surface">
                      {renderMarkdown(msg.text)}
                    </div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-xs text-outline mr-1">Sources:</span>
                        {msg.sources.map((s) => (
                          <button
                            key={s.code}
                            onClick={() => navigate(`/app/colleges/${s.code}`)}
                            title={s.name}
                            className="bg-white border border-outline-variant/30 text-primary text-xs font-medium px-2.5 py-1 rounded-full hover:bg-primary/5 hover:border-primary/30 transition-colors"
                          >
                            {s.code}
                          </button>
                        ))}
                      </div>
                    )}
                    {msg.chips && msg.chips.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {msg.chips.map((chip, ci) => (
                          <button
                            key={ci}
                            onClick={() => handleChipClick(chip)}
                            className="bg-white border border-outline-variant/30 text-primary text-xs font-medium px-3 py-1.5 rounded-full hover:bg-primary/5 hover:border-primary/30 transition-colors"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-outline-variant/30 bg-surface-container-lowest px-4 py-3">
          <div className="md:hidden flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-none">
            {initialChips.map((chip, i) => (
              <button
                key={i}
                onClick={() => handleChipClick(chip)}
                className="flex-shrink-0 bg-white border border-outline-variant/30 text-primary text-xs font-medium px-3 py-1.5 rounded-full hover:bg-primary/5 transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex gap-3 items-center">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask about colleges, ranks, fees, placements..."
              className="flex-1 bg-white border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface placeholder-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isTyping}
              className="bg-primary text-on-primary w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-xl">send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AICounselor;
