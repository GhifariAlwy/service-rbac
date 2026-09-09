import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import type { IdParam, ListQuery } from '../users/schema';
import * as service from './service';
import type { MenuUpsertInput } from './schema';

export async function list(req: Request, res: Response): Promise<void> {
  sendSuccess(res, await service.list(req.query as unknown as ListQuery));
}

export async function detail(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as IdParam;
  sendSuccess(res, await service.detail(id));
}

export async function create(req: Request, res: Response): Promise<void> {
  const data = await service.create(req.body as MenuUpsertInput);
  sendSuccess(res, data, 'Menu berhasil dibuat', 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as IdParam;
  const data = await service.update(id, req.body as MenuUpsertInput);
  sendSuccess(res, data, 'Menu berhasil diperbarui');
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as IdParam;
  await service.remove(id);
  sendSuccess(res, null, 'Menu berhasil dihapus');
}
