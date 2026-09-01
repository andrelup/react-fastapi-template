import { Link } from 'react-router-dom';
import { RegisterForm } from '@/features/auth';

const RegisterPage = () => (
  <div className="flex min-h-full flex-col items-center justify-center">
    <div className="w-full max-w-[400px] rounded-lg px-0 py-0 md:border md:border-border md:bg-surface md:px-[34px] md:py-9 md:shadow-card">
      <h1 className="mb-6 text-2xl font-serif font-bold text-ink md:text-[26px]">Crear cuenta</h1>
      <RegisterForm />
    </div>
    <p className="mt-[18px] text-center text-sm text-body">
      ¿Ya tienes cuenta?{' '}
      <Link to="/login" className="font-medium text-primary hover:underline">
        Inicia sesión
      </Link>
    </p>
  </div>
);

// Default export required for React.lazy().
export default RegisterPage;
