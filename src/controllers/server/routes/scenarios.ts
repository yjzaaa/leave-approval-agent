/**
 * 路由 — GET /api/scenarios 获取可用场景列表
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import type { AppContext } from '../../../infrastructure/di/context.js';
import type { ScenarioResolver } from '../../../models/scenarios/di.js';

/** 创建 scenarios 路由 — 从 ctx 解析依赖 */
export function createScenariosRouter(ctx: AppContext): Router {
  const router = Router();
  const scenarioResolver = ctx.get<ScenarioResolver>('scenarioResolver');

  router.get('/scenarios', (_req: Request, res: Response) => {
    const list = scenarioResolver.listScenarios();
    res.json({ scenarios: list });
  });

  return router;
}
