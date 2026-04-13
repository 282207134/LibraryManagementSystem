import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { BrandLogo } from './BrandLogo';
import { LanguageSwitcher } from './LanguageSwitcher';

interface RegisterProps {
  onToggleMode: () => void;
}

export const Register = ({ onToggleMode }: RegisterProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { language } = useLanguage();

  const textMap = {
    zh: {
      appTitle: '图书管理系统',
      subtitle: '创建新的账户',
      name: '姓名',
      email: '邮箱地址',
      password: '密码',
      confirmPassword: '确认密码',
      namePlaceholder: '张三',
      emailPlaceholder: 'your@email.com',
      passwordPlaceholder: '不少于 6 位',
      confirmPasswordPlaceholder: '再次输入密码',
      creating: '注册中...',
      createAccount: '创建账户',
      hasAccount: '已经有账户了？',
      loginNow: '立即登录',
      passwordMismatch: '两次输入的密码不一致',
      passwordTooShort: '密码长度至少为 6 位',
      registerSuccess: '注册成功！请检查邮箱以验证您的账户。',
      registerFail: '注册失败，请重试',
    },
    en: {
      appTitle: 'Library Management System',
      subtitle: 'Create a new account',
      name: 'Name',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      namePlaceholder: 'John Doe',
      emailPlaceholder: 'your@email.com',
      passwordPlaceholder: 'At least 6 characters',
      confirmPasswordPlaceholder: 'Enter password again',
      creating: 'Creating...',
      createAccount: 'Create Account',
      hasAccount: 'Already have an account?',
      loginNow: 'Sign in now',
      passwordMismatch: 'Passwords do not match',
      passwordTooShort: 'Password must be at least 6 characters',
      registerSuccess: 'Registration successful! Please check your email to verify your account.',
      registerFail: 'Registration failed, please try again',
    },
    ja: {
      appTitle: '図書管理システム',
      subtitle: '新しいアカウントを作成',
      name: '氏名',
      email: 'メールアドレス',
      password: 'パスワード',
      confirmPassword: 'パスワード確認',
      namePlaceholder: '山田 太郎',
      emailPlaceholder: 'your@email.com',
      passwordPlaceholder: '6文字以上',
      confirmPasswordPlaceholder: 'もう一度入力',
      creating: '登録中...',
      createAccount: 'アカウント作成',
      hasAccount: 'すでにアカウントがありますか？',
      loginNow: '今すぐログイン',
      passwordMismatch: 'パスワードが一致しません',
      passwordTooShort: 'パスワードは6文字以上必要です',
      registerSuccess: '登録に成功しました。メールを確認してアカウントを認証してください。',
      registerFail: '登録に失敗しました。再試行してください',
    },
  } as const;
  const t = textMap[language];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }

    if (password.length < 6) {
      setError(t.passwordTooShort);
      return;
    }

    setLoading(true);
    try {
      const { error } = await signUp(email.trim(), password, name.trim());
      if (error) {
        setError(error.message);
      } else {
        setSuccess(t.registerSuccess);
        setName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t.registerFail;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8">
        <div className="flex justify-end mb-2">
          <LanguageSwitcher light />
        </div>
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex justify-center">
            <BrandLogo size="md" className="ring-2 ring-gray-200" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t.appTitle}</h1>
          <p className="text-gray-600">{t.subtitle}</p>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-100 text-red-800 border border-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 rounded-lg bg-green-100 text-green-800 border border-green-200">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.name}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
                if (success) setSuccess(null);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t.namePlaceholder}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.email}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t.emailPlaceholder}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.password}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t.passwordPlaceholder}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.confirmPassword}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t.confirmPasswordPlaceholder}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? t.creating : t.createAccount}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            {t.hasAccount}{' '}
            <button
              onClick={onToggleMode}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              {t.loginNow}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
