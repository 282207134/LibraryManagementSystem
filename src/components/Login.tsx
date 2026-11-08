import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { BrandLogo } from './BrandLogo';
import { ForgotPassword } from './ForgotPassword';
import { LanguageSwitcher } from './LanguageSwitcher';
import { supabase } from '../lib/supabaseClient';

interface LoginProps {
  onToggleMode: () => void;
}

export const Login = ({ onToggleMode }: LoginProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);
  const [resending, setResending] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { signIn } = useAuth();
  const { language } = useLanguage();

  const textMap = {
    zh: {
      library: '图书馆',
      subtitle: '登录您的账户',
      email: '邮箱地址',
      password: '密码',
      forgotPassword: '忘记密码？',
      signIn: '登录',
      signingIn: '登录中...',
      noAccount: '还没有账户？',
      signUpNow: '立即注册',
      loginFail: '登录失败，请重试',
      emailNotConfirmed: '邮箱尚未验证，请先打开确认邮件中的链接，再登录。',
      linkExpired: '邮箱确认链接已失效或已使用。已验证的账户可直接登录；尚未验证请填写邮箱并重新发送确认邮件。',
      linkFailed: '邮箱确认未完成，请重试或重新发送确认邮件。',
      resendConfirmation: '重新发送确认邮件',
      resending: '发送中...',
      enterEmail: '请先填写注册时使用的邮箱地址。',
      confirmationSent: '确认邮件已发送，请检查收件箱及垃圾邮件。验证成功后会返回网站。',
    },
    en: {
      library: 'Library',
      subtitle: 'Sign in to your account',
      email: 'Email',
      password: 'Password',
      forgotPassword: 'Forgot password?',
      signIn: 'Sign in',
      signingIn: 'Signing in...',
      noAccount: "Don't have an account?",
      signUpNow: 'Sign up now',
      loginFail: 'Sign-in failed, please try again',
      emailNotConfirmed: 'Please verify your email using the confirmation link before signing in.',
      linkExpired: 'This confirmation link has expired or has already been used. Sign in if already verified, or enter your email to request a new link.',
      linkFailed: 'Email confirmation failed. Try again or request a new confirmation email.',
      resendConfirmation: 'Resend confirmation email',
      resending: 'Sending...',
      enterEmail: 'Enter the email address you used to register first.',
      confirmationSent: 'Confirmation email sent. Check your inbox and spam folder. Verification will return you to this website.',
    },
    ja: {
      library: '図書館',
      subtitle: 'アカウントにログイン',
      email: 'メールアドレス',
      password: 'パスワード',
      forgotPassword: 'パスワードを忘れた？',
      signIn: 'ログイン',
      signingIn: 'ログイン中...',
      noAccount: 'アカウントをお持ちでないですか？',
      signUpNow: '今すぐ登録',
      loginFail: 'ログインに失敗しました。再試行してください',
      emailNotConfirmed: '確認メールのリンクでメールアドレスを認証してからログインしてください。',
      linkExpired: '確認リンクは期限切れか使用済みです。認証済みの場合はログインし、未認証の場合はメールアドレスを入力して確認メールを再送してください。',
      linkFailed: 'メール認証が完了しませんでした。再試行するか確認メールを再送してください。',
      resendConfirmation: '確認メールを再送する',
      resending: '送信中...',
      enterEmail: '登録時のメールアドレスを入力してください。',
      confirmationSent: '確認メールを送信しました。受信トレイと迷惑メールをご確認ください。認証後、このサイトに戻ります。',
    },
  } as const;
  const t = textMap[language];

  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.slice(1));
    const errorCode = hash.get('error_code') ?? url.searchParams.get('error_code');
    if (!errorCode && !hash.has('error') && !url.searchParams.has('error')) return;

    setError(errorCode === 'otp_expired' ? t.linkExpired : t.linkFailed);
    setCanResendConfirmation(true);
    // 清除已显示的错误参数，刷新或切换语言时不再重复处理。
    for (const key of ['error', 'error_code', 'error_description']) {
      url.searchParams.delete(key);
      hash.delete(key);
    }
    url.hash = hash.toString();
    window.history.replaceState(window.history.state, '', url);
  }, [t.linkExpired, t.linkFailed]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedNotice = window.sessionStorage.getItem('auth_notice');
    if (savedNotice) {
      setNotice(savedNotice);
      window.sessionStorage.removeItem('auth_notice');
    }
  }, []);

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
        const unconfirmed = ('code' in error && error.code === 'email_not_confirmed')
          || error.message === 'Email not confirmed';
        setError(unconfirmed ? t.emailNotConfirmed : error.message);
        setCanResendConfirmation(unconfirmed);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t.loginFail;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const resendConfirmation = async () => {
    if (!email.trim()) {
      setError(t.enterEmail);
      return;
    }
    setResending(true);
    setNotice(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: new URL('/', window.location.origin).href },
      });
      if (error) throw error;
      setError(null);
      setNotice(t.confirmationSent);
      setCanResendConfirmation(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.linkFailed);
    } finally {
      setResending(false);
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
        <div className="absolute right-4 top-4">
          <LanguageSwitcher />
        </div>
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex justify-center">
            <BrandLogo size="md" className="ring-2 ring-white/20" />
          </div>
          <h1 className="text-3xl font-bold mb-2 tracking-wide">{t.library}</h1>
          <p className="text-cyan-100/80">{t.subtitle}</p>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-rose-500/15 text-rose-100 border border-rose-300/30">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-4 p-4 rounded-xl bg-emerald-500/15 text-emerald-100 border border-emerald-300/30">
            {notice}
          </div>
        )}
        {canResendConfirmation && (
          <button
            type="button"
            onClick={resendConfirmation}
            disabled={resending}
            className="mb-4 text-cyan-200 underline disabled:opacity-50"
          >
            {resending ? t.resending : t.resendConfirmation}
          </button>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-cyan-100 mb-1">
              {t.email}
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
                {t.password}
              </label>
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-cyan-200 hover:text-cyan-100 font-medium"
              >
                {t.forgotPassword}
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
            {loading ? t.signingIn : t.signIn}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-cyan-100/80">
            {t.noAccount}{' '}
            <button
              onClick={onToggleMode}
              className="text-cyan-300 hover:text-cyan-100 font-medium"
            >
              {t.signUpNow}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
