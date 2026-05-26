/**
 * 路由 — POST /api/confirm 用户确认/拒绝
 *
 * 通过 sessionId 查找对应的 HitlManager，执行 approve 或 reject。
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import type { HitlManager } from '../../../agent/hitl/hitl.js';
import type { ConfirmResponse } from '../../../models/domain/dto/ApiResponses.js';

/**
 * 创建 confirm 路由
 * @param hitlSessions sessionId → HitlManager 映射
 */
export function createConfirmRouter(hitlSessions: Map<string, HitlManager>): Router {
  const router = Router();

  router.post('/confirm', (req: Request, res: Response) => {
    const { approved, sessionId } = req.body;
    const hitl = hitlSessions.get(sessionId || 'default');
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
