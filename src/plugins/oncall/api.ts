/**
 * 值班排班 Mock API
 */

/** 排班记录 */
interface OncallRecord {
  date: string;
  person: string;
  department: string;
  shift: string;
}

/** 模拟当前排班数据 */
const SCHEDULE: OncallRecord[] = [
  { date: '2026-05-26', person: '张三', department: '技术部', shift: '白班 09:00-18:00' },
  { date: '2026-05-26', person: '李四', department: '技术部', shift: '夜班 18:00-09:00' },
  { date: '2026-05-27', person: '王五', department: '运维部', shift: '白班 09:00-18:00' },
  { date: '2026-05-27', person: '赵六', department: '运维部', shift: '夜班 18:00-09:00' },
  { date: '2026-05-28', person: '张三', department: '技术部', shift: '夜班 18:00-09:00' },
  { date: '2026-05-29', person: '李四', department: '技术部', shift: '白班 09:00-18:00' },
];

/** 查询排班 */
export async function querySchedule(date: string, department?: string): Promise<{ success: boolean; data: OncallRecord[] }> {
  const filtered = SCHEDULE.filter(s => {
    if (date && s.date !== date) return false;
    if (department && s.department !== department) return false;
    return true;
  });
  return { success: true, data: filtered };
}

/** 换班申请 */
export async function submitSwapRequest(
  requester: string,
  targetDate: string,
  targetShift: string,
  reason: string,
): Promise<{ success: boolean; requestId: string; message: string }> {
  const id = `SW-${Date.now().toString(36).toUpperCase()}`;
  return {
    success: true,
    requestId: id,
    message: `换班申请已提交：${requester} 申请 ${targetDate} ${targetShift} 换班。原因：${reason}`,
  };
}