import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type CredentialUser = {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string | null;
};

type StoredCredentialUser = {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

const STORE_PATH = path.join(process.cwd(), ".data", "credential-users.json");
const FALLBACK_PRISMA_ERROR_CODES = new Set(["P1001", "P1002", "P1017", "P2021", "P2022"]);

export class DuplicateCredentialUserError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "DuplicateCredentialUserError";
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toPublicCredentialUser(
  user: Pick<StoredCredentialUser, "id" | "email" | "name" | "passwordHash">
): CredentialUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    passwordHash: user.passwordHash,
  };
}

function parseStoredUser(value: unknown): StoredCredentialUser | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;

  const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
  const email =
    typeof candidate.email === "string" ? normalizeEmail(candidate.email) : "";
  const passwordHash =
    typeof candidate.passwordHash === "string" ? candidate.passwordHash : "";

  if (!id || !email || !passwordHash) return null;

  return {
    id,
    email,
    name: typeof candidate.name === "string" ? candidate.name : null,
    passwordHash,
    createdAt:
      typeof candidate.createdAt === "string"
        ? candidate.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof candidate.updatedAt === "string"
        ? candidate.updatedAt
        : new Date().toISOString(),
  };
}

async function readStoredUsers(): Promise<StoredCredentialUser[]> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(parseStoredUser)
      .filter((user): user is StoredCredentialUser => user !== null);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeStoredUsers(users: StoredCredentialUser[]): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(users, null, 2), "utf8");
}

async function findCredentialUserInFile(
  normalizedEmail: string
): Promise<CredentialUser | null> {
  const users = await readStoredUsers();
  const found = users.find((user) => user.email === normalizedEmail);
  return found ? toPublicCredentialUser(found) : null;
}

async function createCredentialUserInFile(params: {
  email: string;
  name: string | null;
  passwordHash: string;
}): Promise<CredentialUser> {
  const now = new Date().toISOString();
  const users = await readStoredUsers();

  if (users.some((user) => user.email === params.email)) {
    throw new DuplicateCredentialUserError();
  }

  const nextUser: StoredCredentialUser = {
    id: crypto.randomUUID(),
    email: params.email,
    name: params.name,
    passwordHash: params.passwordHash,
    createdAt: now,
    updatedAt: now,
  };

  users.push(nextUser);
  await writeStoredUsers(users);
  return toPublicCredentialUser(nextUser);
}

function shouldFallbackToFileStore(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    FALLBACK_PRISMA_ERROR_CODES.has(error.code)
  ) {
    return true;
  }

  return false;
}

export async function findCredentialUserByEmail(
  email: string
): Promise<CredentialUser | null> {
  const normalizedEmail = normalizeEmail(email);

  try {
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (user) {
      return {
        id: user.id,
        email: user.email ?? normalizedEmail,
        name: user.name,
        passwordHash: user.passwordHash,
      };
    }
  } catch (error) {
    if (!shouldFallbackToFileStore(error)) throw error;
    console.warn("[auth] Prisma lookup unavailable, falling back to file store.");
  }

  return findCredentialUserInFile(normalizedEmail);
}

export async function createCredentialUser(params: {
  email: string;
  name: string | null;
  passwordHash: string;
}): Promise<CredentialUser> {
  const normalizedEmail = normalizeEmail(params.email);
  const normalizedName = params.name?.trim() || null;

  try {
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: normalizedName,
        passwordHash: params.passwordHash,
      },
    });

    return {
      id: user.id,
      email: user.email ?? normalizedEmail,
      name: user.name,
      passwordHash: user.passwordHash,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new DuplicateCredentialUserError();
    }

    if (!shouldFallbackToFileStore(error)) throw error;

    console.warn("[auth] Prisma create unavailable, persisting user to file store.");

    return createCredentialUserInFile({
      email: normalizedEmail,
      name: normalizedName,
      passwordHash: params.passwordHash,
    });
  }
}
