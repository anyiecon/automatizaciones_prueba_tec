/** Base de toda la jerarquia de errores del dominio. Preserva `cause` para diagnostico. */
export class DomainError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** DNS roto, TCP caido, body no es JSON valido — transitorio, reintentable. */
export class NetworkError extends DomainError {}

/** La request fue abortada por exceder el timeout configurado — reintentable. */
export class TimeoutError extends DomainError {}

/** Respuesta HTTP con codigo no exitoso. Solo 408/425/429/5xx son reintentables. */
export class HttpStatusError extends DomainError {
  constructor(public readonly status: number, message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** El payload no cumple el schema esperado (Zod). NO se reintenta — es un bug de contrato. */
export class ValidationError extends DomainError {}

/** Se agotaron los intentos del retry. Error terminal con la causa original encadenada. */
export class RetryExhaustedError extends DomainError {
  constructor(public readonly attempts: number, message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}
