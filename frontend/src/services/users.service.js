/**
 * Users / RBAC service (admin).
 *
 * The backend already returns users in camelCase (id, fullName, email, phone,
 * isActive, lastLoginAt, roles[], createdAt, updatedAt). User creation goes
 * through the admin-only `POST /auth/register`.
 */
import { config } from '@/config/env';
import { http } from '@/api/httpClient';
import { endpoints } from '@/api/endpoints';
import { simulate } from '@/services/mock/mockUtils';

/** @typedef {import('@/types').User} User */

const MOCK_USERS = /** @type {User[]} */ ([
  { id: '1', email: 'admin@nuruya.com', fullName: 'Ops Admin', phone: '+233200000001', isActive: true, roles: ['admin'], lastLoginAt: '2026-06-15', createdAt: '2026-01-01', updatedAt: '2026-06-01' },
  { id: '2', email: 'manager@nuruya.com', fullName: 'Kwame Mensah', phone: '+233200000002', isActive: true, roles: ['manager'], lastLoginAt: '2026-06-12', createdAt: '2026-02-10', updatedAt: '2026-06-01' },
  { id: '3', email: 'finance@nuruya.com', fullName: 'Ama Boateng', phone: '+233200000003', isActive: true, roles: ['finance'], lastLoginAt: '2026-06-10', createdAt: '2026-03-05', updatedAt: '2026-06-01' },
  { id: '4', email: 'agent@nuruya.com', fullName: 'Yaw Acheampong', phone: '+233200000004', isActive: false, roles: ['agent'], lastLoginAt: null, createdAt: '2026-04-20', updatedAt: '2026-06-01' },
]);

const MOCK_ROLES = [
  { id: 1, slug: 'super_admin', name: 'Super Admin', description: 'Accès total' },
  { id: 2, slug: 'admin', name: 'Administrateur', description: 'Gestion complète' },
  { id: 3, slug: 'manager', name: 'Manager', description: 'Commandes, produits, finance' },
  { id: 4, slug: 'finance', name: 'Finance', description: 'Données financières' },
  { id: 5, slug: 'agent', name: 'Agent', description: 'Gestion des commandes' },
];

let users = MOCK_USERS.map((u) => ({ ...u }));

export const usersService = {
  /** @returns {Promise<User[]>} */
  async getAll(params) {
    if (config.useMock) {
      return simulate(() => {
        const q = params?.search?.toLowerCase();
        const list = q
          ? users.filter((u) => u.email.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q))
          : users;
        return list.map((u) => ({ ...u }));
      });
    }
    const { data } = await http.getRaw(endpoints.users.root, { params: { limit: 100, ...params } });
    return Array.isArray(data) ? data : data?.items ?? [];
  },

  async getRoles() {
    if (config.useMock) return simulate(() => MOCK_ROLES.map((r) => ({ ...r })));
    return http.get(endpoints.users.roles);
  },

  async getById(id) {
    if (config.useMock) return simulate(() => ({ ...users.find((u) => String(u.id) === String(id)) }));
    return http.get(endpoints.users.byId(id));
  },

  /**
   * Create a user (admin-only register).
   * @param {{ fullName:string, email:string, password:string, phone?:string, roles?:string[] }} payload
   */
  async create(payload) {
    if (config.useMock) {
      return simulate(() => {
        const user = {
          id: String(users.length + 1),
          email: payload.email,
          fullName: payload.fullName,
          phone: payload.phone || '',
          isActive: true,
          roles: payload.roles?.length ? payload.roles : ['agent'],
          lastLoginAt: null,
          createdAt: new Date().toISOString().slice(0, 10),
          updatedAt: new Date().toISOString().slice(0, 10),
        };
        users = [user, ...users];
        return { ...user };
      });
    }
    return http.post(endpoints.auth.register, payload);
  },

  /** @param {{ fullName?:string, phone?:string }} payload */
  async update(id, payload) {
    if (config.useMock) {
      return simulate(() => {
        users = users.map((u) => (String(u.id) === String(id) ? { ...u, ...payload } : u));
        return { ...users.find((u) => String(u.id) === String(id)) };
      });
    }
    return http.put(endpoints.users.byId(id), payload);
  },

  async setRoles(id, roles) {
    if (config.useMock) {
      return simulate(() => {
        users = users.map((u) => (String(u.id) === String(id) ? { ...u, roles } : u));
        return { ...users.find((u) => String(u.id) === String(id)) };
      });
    }
    return http.patch(endpoints.users.setRoles(id), { roles });
  },

  async setActive(id, isActive) {
    if (config.useMock) {
      return simulate(() => {
        users = users.map((u) => (String(u.id) === String(id) ? { ...u, isActive } : u));
        return { ...users.find((u) => String(u.id) === String(id)) };
      });
    }
    return http.patch(endpoints.users.setActive(id), { isActive });
  },

  async remove(id) {
    if (config.useMock) {
      return simulate(() => {
        users = users.filter((u) => String(u.id) !== String(id));
      });
    }
    await http.delete(endpoints.users.byId(id));
  },
};

export default usersService;
