/**
 * Funções de validação para formulários
 */

/**
 * Remove caracteres não numéricos
 */
export const removeNonNumeric = (value: string): string => {
  return value.replace(/\D/g, '');
};

/**
 * Formata CPF: 000.000.000-00
 */
export const formatCPF = (value: string): string => {
  const numbers = removeNonNumeric(value);
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
};

/**
 * Valida CPF
 */
export const validateCPF = (cpf: string): boolean => {
  const numbers = removeNonNumeric(cpf);
  
  if (numbers.length !== 11) return false;
  if (/^(\d)\1+$/.test(numbers)) return false; // Todos os dígitos iguais
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(numbers.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(numbers.charAt(10))) return false;
  
  return true;
};

/**
 * Formata telefone: (00) 00000-0000
 */
export const formatPhone = (value: string): string => {
  const numbers = removeNonNumeric(value);
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

/**
 * Valida telefone (mínimo 10 dígitos)
 */
export const validatePhone = (phone: string): boolean => {
  const numbers = removeNonNumeric(phone);
  return numbers.length >= 10 && numbers.length <= 11;
};

/**
 * Valida email
 */
export const validateEmail = (email: string): boolean => {
  if (!email) return true; // Email é opcional
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

/**
 * Valida data de nascimento (deve ser no passado)
 */
export const validateBirthDate = (date: string): boolean => {
  if (!date) return false;
  const birthDate = new Date(date);
  const today = new Date();
  return birthDate < today;
};

