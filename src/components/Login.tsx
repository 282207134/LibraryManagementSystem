import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { BrandLogo } from './BrandLogo';
import { ForgotPassword } from './ForgotPassword';

interface LoginProps {
  onToggleMode: () => void;
}

export const Login = ({ onToggleMode }: LoginProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { signIn } = useAuth();

  if (showForgotPassword) {
    return (
      <ForgotPassword
        onBack={() => setShowForgotPassword(false)}
        onSuccess={() => setShowForgotPassword(false)}
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        setError(error.message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '登录失败，请重试';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050816] flex items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-cyan-500/25 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-white/10 backdrop-blur-xl shadow-[0_20px_80px_-20px_rgba(56,189,248,0.6)] p-8 text-white">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex justify-center">
            <BrandLogo size="md" className="ring-2 ring-white/20" />
          </div>
          <h1 className="text-3xl font-bold mb-2 tracking-wide">图书馆</h1>
          <p className="text-cyan-100/80">登录您的账户</p>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-rose-500/15 text-rose-100 border border-rose-300/30">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-cyan-100 mb-1">
              邮箱地址
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              className="w-full px-4 py-2.5 border border-white/20 bg-white/10 rounded-xl text-white placeholder:text-cyan-100/50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              placeholder="your@email.com"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-cyan-100">
                密码
              </label>
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-cyan-200 hover:text-cyan-100 font-medium"
              >
                忘记密码？
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              className="w-full px-4 py-2.5 border border-white/20 bg-white/10 rounded-xl text-white placeholder:text-cyan-100/50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-violet-600 text-white rounded-xl hover:from-cyan-400 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/30"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-cyan-100/80">
            还没有账户？{' '}
            <button
              onClick={onToggleMode}
              className="text-cyan-300 hover:text-cyan-100 font-medium"
            >
              立即注册
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
