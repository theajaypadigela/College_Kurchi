// Client-side auth (no server).
//
// The original backend issued JWTs and stored users in MongoDB. With no
// backend, accounts live in the browser's localStorage. This keeps the
// register/login/profile flow working for the demo — but note it is NOT real
// authentication: anyone with the device can read the stored data, and
// accounts don't sync across devices.

import { setToken } from './client';
import type { LoginResponse, RegisterRequest, User } from './types';

const USERS_KEY = 'ck_users'; // email -> { user, password }
const SESSION_KEY = 'ck_session_email';

interface StoredAccount {
  user: User;
  password: string;
}

function readUsers(): Record<string, StoredAccount> {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? '{}');
  } catch {
    return {};
  }
}
function writeUsers(users: Record<string, StoredAccount>): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// A stable, non-cryptographic id (Date/Math.random are fine in the browser).
function makeId(email: string): string {
  return 'usr_' + btoa(unescape(encodeURIComponent(email))).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
}

export async function authRegister(body: RegisterRequest): Promise<LoginResponse> {
  const users = readUsers();
  const email = body.email.trim().toLowerCase();
  if (users[email]) throw new Error('An account with this email already exists');

  const user: User = {
    id: makeId(email),
    name: body.name,
    email,
    rank: body.rank,
    category: body.category,
    gender: body.gender,
    phone: body.phone ?? null,
  };
  users[email] = { user, password: body.password };
  writeUsers(users);
  localStorage.setItem(SESSION_KEY, email);

  const token = `local.${user.id}`;
  setToken(token);
  return { access_token: token, token_type: 'bearer', user };
}

export async function authLogin(email: string, password: string): Promise<LoginResponse> {
  const users = readUsers();
  const key = email.trim().toLowerCase();
  const acct = users[key];
  if (!acct || acct.password !== password) throw new Error('Invalid email or password');

  localStorage.setItem(SESSION_KEY, key);
  const token = `local.${acct.user.id}`;
  setToken(token);
  return { access_token: token, token_type: 'bearer', user: acct.user };
}

export async function authMe(): Promise<User> {
  const email = localStorage.getItem(SESSION_KEY);
  const users = readUsers();
  const acct = email ? users[email] : undefined;
  if (!acct) throw new Error('Not authenticated');
  return acct.user;
}
