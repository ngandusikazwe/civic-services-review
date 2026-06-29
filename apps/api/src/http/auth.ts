import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Role } from "@workflow/workflow";
import type { ApplicationRepository } from "../repositories/application-repository.js";
import type { User } from "../types.js";
import { unauthorized } from "./errors.js";

export type AuthenticatedRequest = Request & {
  user: User;
};

type TokenPayload = {
  sub: string;
  role: Role;
  exp: number;
};

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");

  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export function signToken(params: {
  user: Pick<User, "id" | "role">;
  secret: string;
  expiresInSeconds?: number;
}): string {
  const payload: TokenPayload = {
    sub: params.user.id,
    role: params.user.role,
    exp: Math.floor(Date.now() / 1000) + (params.expiresInSeconds ?? 60 * 60 * 8)
  };
  const encodedHeader = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = createSignature(`${encodedHeader}.${encodedPayload}`, params.secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyToken(token: string, secret: string): TokenPayload {
  const [header, payload, signature] = token.split(".");

  if (!header || !payload || !signature) {
    throw unauthorized("Invalid token.");
  }

  const expected = createSignature(`${header}.${payload}`, secret);

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw unauthorized("Invalid token signature.");
  }

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TokenPayload;

  if (parsed.exp < Math.floor(Date.now() / 1000)) {
    throw unauthorized("Token has expired.");
  }

  return parsed;
}

export function authMiddleware(repo: ApplicationRepository, secret: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.header("authorization");
      const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

      if (!token) {
        throw unauthorized();
      }

      const payload = verifyToken(token, secret);
      const user = await repo.findUserById(payload.sub);

      if (!user || user.role !== payload.role) {
        throw unauthorized("Token user is no longer valid.");
      }

      (req as AuthenticatedRequest).user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

function createSignature(value: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function base64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}
