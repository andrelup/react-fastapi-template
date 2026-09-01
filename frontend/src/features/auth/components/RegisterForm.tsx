import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useApi } from '@/hooks/useApi';
import { registerUser } from '../api/auth-api';
import type { UserRole } from '../types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

export const RegisterForm = () => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role] = useState<UserRole>('customer');
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const { execute, isLoading, error } = useApi(registerUser);
  const navigate = useNavigate();

  const validateEmail = (value: string): string | undefined => {
    if (!value.trim()) {
      return 'El email es obligatorio';
    }
    if (!EMAIL_REGEX.test(value)) {
      return 'Introduce un email válido';
    }
    return undefined;
  };

  const validatePassword = (value: string): string | undefined => {
    if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
      return `La contraseña debe tener entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres`;
    }
    return undefined;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const nextEmailError = validateEmail(email);
    const nextPasswordError = validatePassword(password);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    if (nextEmailError !== undefined || nextPasswordError !== undefined) {
      return;
    }

    const result = await execute({ email, name, password, role });
    if (result !== null) {
      // Registration only creates the account — there is no session to
      // start yet, so the user must log in explicitly.
      navigate('/login', { replace: true });
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4" noValidate>
      <Input
        id="name"
        label="Nombre"
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
      />
      <Input
        id="email"
        label="Correo electrónico"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={emailError}
        required
      />
      <div className="flex flex-col gap-1">
        <Input
          id="password"
          label="Contraseña"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={passwordError}
          required
        />
        <p className="text-sm text-muted">Mínimo 8 caracteres (máximo 128)</p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" isLoading={isLoading} className="w-full">
        Registrarse
      </Button>
    </form>
  );
};
