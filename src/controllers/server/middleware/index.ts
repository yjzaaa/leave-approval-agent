/**
 * HITL 会话存储 — 从 app.locals 获取 hitlSessions
 *
 * 路由通过 getHitlSessions(req.app) 获取 Map，
 * 不再依赖工厂函数参数注入。
 */
import type { HitlManager } from '../../../agent/hitl/index.js';

/** app.locals 上的 HITL 会话键 */
const HITL_SESSIONS_KEY = 'hitlSessions';

/** 初始化 hitlSessions 并挂载到 app.locals */
export function initHitlSessions(app: { locals: Record<string, unknown> }): Map<string, HitlManager> {
  const sessions = new Map<string, HitlManager>();
  app.locals[HITL_SESSIONS_KEY] = sessions;
  return sessions;
}

/** 从 app.locals 获取 hitlSessions Map */
export function getHitlSessions(app: { locals: Record<string, unknown> }): Map<string, HitlManager> {
  return app.locals[HITL_SESSIONS_KEY] as Map<string, HitlManager>;
}
