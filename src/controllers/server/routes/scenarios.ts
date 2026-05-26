/**
 * 路由 — GET /api/scenarios 获取可用场景列表
 *
 * 前端可据此渲染场景选择器，或通过 URL 参数指定场景。
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { registry } from '../../../models/scenarios/registry.js';

/** 创建 scenarios 路由 */
export function createScenariosRouter(): Router {
  const router = Router();

  router.get('/scenarios', (_req: Request, res: Response) => {
    const list = Object.entries(registry).map(([id, p]) => ({
      id,
      displayName: p.displayName,
      fieldCount: p.fields?.length || 0,
      suggestions: p.suggestions || [],
    }));
    res.json({ scenarios: list });
  });

  return router;
}
