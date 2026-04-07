import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Target, AlertCircle } from 'lucide-react';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setIsLoading(true);
    clearError();
    
    try {
      await register(email, password, name);
      navigate('/dashboard');
    } catch (err) {
      // Error is handled by store, but log for debugging in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Registration error:', err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [email, password, name, register, navigate, clearError]);

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Panel - Brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-950 text-white flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <Target className="w-8 h-8" strokeWidth={1.5} />
          <span className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
            AI Proctor
          </span>
        </div>
        
        <div className="max-w-md">
          <h1 className="text-5xl font-black tracking-tighter mb-6" style={{ fontFamily: 'var(--font-heading)' }}>
            Start hiring better candidates today
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            Create AI-powered interviews, invite candidates, and get detailed evaluations with proctoring insights.
          </p>
          
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 border border-gray-700 flex items-center justify-center text-sm font-bold">1</div>
              <span className="text-gray-300">Create interview sessions</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 border border-gray-700 flex items-center justify-center text-sm font-bold">2</div>
              <span className="text-gray-300">Send invites to candidates</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 border border-gray-700 flex items-center justify-center text-sm font-bold">3</div>
              <span className="text-gray-300">Review AI-scored results</span>
            </div>
          </div>
        </div>

        <div className="text-sm text-gray-500">
          © 2024 AI Proctor. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <Target className="w-8 h-8" strokeWidth={1.5} />
            <span className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
              AI Proctor
            </span>
          </div>

          <div className="mb-8">
            <p className="overline mb-2">Get started</p>
            <h2 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
              Create your account
            </h2>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 flex items-start gap-3" data-testid="register-error">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="input-swiss h-12"
                required
                data-testid="register-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">Work Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="input-swiss h-12"
                required
                data-testid="register-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="input-swiss h-12"
                minLength={6}
                required
                data-testid="register-password"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full h-12"
              data-testid="register-submit"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : (
                'Create account'
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="link-swiss font-semibold" data-testid="login-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
