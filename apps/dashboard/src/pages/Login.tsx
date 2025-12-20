import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Bot, Mail, Lock, User, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface FormErrors {
  email?: string;
  password?: string;
  name?: string;
  general?: string;
}

// Componente de input - FORA do Login para evitar re-render
function InputField({
  id,
  type,
  value,
  onChange,
  onBlur,
  label,
  placeholder,
  icon: Icon,
  error,
  showError,
  hint,
}: {
  id: string;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  label: string;
  placeholder: string;
  icon: React.ElementType;
  error?: string;
  showError: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-2" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={type === 'password' ? 'current-password' : type === 'email' ? 'email' : 'name'}
          className={`w-full pl-11 pr-10 py-3 bg-white/5 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
            showError && error
              ? 'border-red-500/50 focus:ring-red-500/30'
              : value && !error
              ? 'border-green-500/30 focus:ring-green-500/30'
              : 'border-white/10 focus:ring-primary focus:border-transparent'
          }`}
        />
        {/* Indicador de status */}
        {showError && error ? (
          <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-400" />
        ) : value && !error ? (
          <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-400" />
        ) : null}
      </div>
      {/* Mensagem de erro ou dica */}
      {showError && error ? (
        <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500 mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
}

export function Login() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Validação de email
  const validateEmail = (value: string): string | undefined => {
    if (!value.trim()) {
      return 'Email é obrigatório';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'Email inválido';
    }
    return undefined;
  };

  // Validação de senha
  const validatePassword = (value: string): string | undefined => {
    if (!value) {
      return 'Senha é obrigatória';
    }
    if (value.length < 6) {
      return 'Senha deve ter pelo menos 6 caracteres';
    }
    return undefined;
  };

  // Validação de nome
  const validateName = (value: string): string | undefined => {
    if (isRegister && !value.trim()) {
      return 'Nome é obrigatório';
    }
    return undefined;
  };

  // Valida todos os campos
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    newErrors.email = validateEmail(email);
    newErrors.password = validatePassword(password);
    
    if (isRegister) {
      newErrors.name = validateName(name);
    }

    // Remove undefined values
    Object.keys(newErrors).forEach(key => {
      if (newErrors[key as keyof FormErrors] === undefined) {
        delete newErrors[key as keyof FormErrors];
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handler de blur para mostrar erro ao sair do campo
  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    
    // Valida o campo específico
    let error: string | undefined;
    switch (field) {
      case 'email':
        error = validateEmail(email);
        break;
      case 'password':
        error = validatePassword(password);
        break;
      case 'name':
        error = validateName(name);
        break;
    }
    
    setErrors(prev => ({
      ...prev,
      [field]: error,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Marca todos os campos como tocados
    setTouched({ email: true, password: true, name: true });
    
    // Valida o formulário
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      if (isRegister) {
        await register(email, password, name);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setErrors({
        general: err instanceof Error ? err.message : 'Erro ao processar',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white">Agent Hub</h1>
          <p className="text-slate-400 mt-2">
            {isRegister ? 'Crie sua conta' : 'Entre na sua conta'}
          </p>
        </div>

        {/* Form */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {isRegister && (
              <InputField
                id="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
                }}
                onBlur={() => handleBlur('name')}
                label="Nome"
                placeholder="Seu nome"
                icon={User}
                error={errors.name}
                showError={touched.name || false}
              />
            )}

            <InputField
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
              }}
              onBlur={() => handleBlur('email')}
              label="Email"
              placeholder="seu@email.com"
              icon={Mail}
              error={errors.email}
              showError={touched.email || false}
            />

            <InputField
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
              }}
              onBlur={() => handleBlur('password')}
              label="Senha"
              placeholder="••••••••"
              icon={Lock}
              error={errors.password}
              showError={touched.password || false}
              hint={isRegister ? 'Mínimo 6 caracteres' : undefined}
            />

            {/* Erro geral */}
            {errors.general && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errors.general}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-primary hover:bg-primary/90 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isRegister ? 'Criando conta...' : 'Entrando...'}
                </>
              ) : (
                <>{isRegister ? 'Criar conta' : 'Entrar'}</>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setErrors({});
                setTouched({});
              }}
              className="text-slate-400 hover:text-white transition-colors text-sm"
            >
              {isRegister ? (
                <>
                  Já tem uma conta?{' '}
                  <span className="text-primary font-medium">Entrar</span>
                </>
              ) : (
                <>
                  Não tem conta?{' '}
                  <span className="text-primary font-medium">Criar conta</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          Seus agentes de IA para automatizar tarefas
        </p>
      </div>
    </div>
  );
}
