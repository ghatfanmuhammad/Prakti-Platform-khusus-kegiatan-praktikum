import type { CurrentUser, Role } from '../../types';

export const ROLE_LABELS: Record<Role, string> = { aslab: 'Aslab', asprak: 'Asprak', praktikan: 'Praktikan' };
export const isRole = (role: unknown): role is Role => role === 'aslab' || role === 'asprak' || role === 'praktikan';
export const userUid = (user: CurrentUser) => user.role === 'praktikan' ? user.praktikan.id : user.asisten.id;

export const ROUTES: Record<Role, readonly string[]> = {
  aslab: ['index', 'profile', 'data', 'maps', 'rekap'],
  asprak: ['index', 'profile', 'data', 'maps', 'jadwal', 'sesi', 'rekap', 'izin'],
  praktikan: ['index', 'profile', 'data', 'maps', 'jadwal', 'sesi', 'presensi', 'riwayat', 'status-izin', 'ajukan-izin'],
};
export const canOpenRoute = (role: Role, route: string) => ROUTES[role].includes(route);
