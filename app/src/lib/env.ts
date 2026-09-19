export class MissingEnvError extends Error {
  constructor(name: string) {
    super(`${name} is not set`);
    this.name = "MissingEnvError";
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new MissingEnvError(name);
  return value;
}

export function appPassword(): string {
  return required("APP_PASSWORD");
}

export function sessionSecret(): string {
  return required("SESSION_SECRET");
}

export function diagramsTable(): string {
  return required("DIAGRAMS_TABLE");
}

export function scenesBucket(): string {
  return required("SCENES_BUCKET");
}
