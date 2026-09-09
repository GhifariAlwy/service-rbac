import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import * as service from './service';
import type { IdParam, ListQuery, UserCreateInput, UserUpdateInput } from './schema';

export async function list(req: Request, res: Response): Promise<void> {
  const data = await service.list(req.query as unknown as ListQuery);
  sendSuccess(res, data);
}

export async function detail(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as IdParam;
  sendSuccess(res, await service.detail(id));
}

export async function create(req: Request, res: Response): Promise<void> {
  const data = await service.create(req.body as UserCreateInput);
  sendSuccess(res, data, 'User berhasil dibuat', 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as IdParam;
  const data = await service.update(id, req.body as UserUpdateInput);
  sendSuccess(res, data, 'User berhasil diperbarui');
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as IdParam;
  await service.remove(id, BigInt(req.user!.id));
  sendSuccess(res, null, 'User berhasil dihapus');
}
