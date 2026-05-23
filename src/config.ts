import 'dotenv/config';

export const config = {
  /** 最大表单修正重试次数 */
  maxFormRetries: parseInt(process.env.MAX_FORM_RETRIES ?? '5', 10),
};
