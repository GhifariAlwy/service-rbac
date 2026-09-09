import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import type { IdParam, ListQuery } from '../users/schema';
import * as service from './service';
import type { RoleMenuAccessInput, RoleUpsertInput } from './schema';

export async function list(req: Request, res: Response): Promise<void> {
  sendSuccess(res, await service.list(req.query as unknown as ListQuery));
}

export async function detail(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as IdParam;
  sendSuccess(res, await service.detail(id));
}

export async function create(req: Request, res: Response): Promise<void> {
  const data = await service.create(req.body as RoleUpsertInput);
  sendSuccess(res, data, 'Role berhasil dibuat', 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as IdParam;
  const data = await service.update(id, req.body as RoleUpsertInput);
  sendSuccess(res, data, 'Role berhasil diperbarui');
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as IdParam;
  await service.remove(id);
  sendSuccess(res, null, 'Role berhasil dihapus');
}

export async function setMenuAccess(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as IdParam;
  const data = await service.setMenuAccess(id, req.body as RoleMenuAccessInput);
  sendSuccess(res, data, 'Akses menu role berhasil diperbarui');
}
