import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContextBase';

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // 明确约束：必须在 AuthProvider 内部使用
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
