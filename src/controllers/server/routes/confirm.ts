/**
 * 路由 — POST /api/confirm 用户确认/拒绝
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import type { AppContext } from '../../../infrastructure/di/context.js';
import type { HitlSessionStore } from '../../../infrastructure/di/index.js';
import type { ConfirmResponse } from '../../../models/domain/dto/ApiResponses.js';

/** 创建 confirm 路由 — 从 ctx 解析依赖 */
export function createConfirmRouter(ctx: AppContext): Router {
  const router = Router();
  const sessionStore = ctx.get<HitlSessionStore>('sessionStore');

  router.post('/confirm', (req: Request, res: Response) => {
    const { approved, sessionId } = req.body;
    const hitl = sessionStore.get(sessionId || 'default');

    if (!hitl) {
      const noSession: ConfirmResponse = { ok: false, message: '无活跃会话' };
      res.json(noSession);
      return;
    }
    if (approved) {
      const ok = hitl.approve();
      const result: ConfirmResponse = { ok, message: ok ? '已确认' : '无待确认请求' };
      res.json(result);
    } else {
      const ok = hitl.reject();
      const result: ConfirmResponse = { ok, message: ok ? '已拒绝' : '无待确认请求' };
      res.json(result);
    }
  });

  return router;
}
