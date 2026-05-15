// AI 图片优化 API - 火山引擎即梦 AI
// Next.js API Route

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// 火山引擎 API 配置
const VOLC_API_HOST = 'visual.volcengineapi.com';
const VOLC_API_REGION = 'cn-north-1';
const VOLC_API_SERVICE = 'cv';

// 加载 .env.production (standalone 模式不自动加载)
function loadEnvProduction() {
  const possiblePaths = [
    path.join(process.cwd(), '.env.production'),
    path.resolve(__dirname, '../../../../../.env.production'),
    path.resolve(__dirname, '../../../../.env.production'),
  ];
  for (const envPath of possiblePaths) {
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
          const m = line.match(/^([A-Za-z_]+)=(.*)$/);
          if (m) process.env[m[1]] = m[2];
        });
        console.log('[DEBUG] Loaded env from:', envPath);
        return;
      }
    } catch { /* skip */ }
  }
  console.log('[DEBUG] Could not find .env.production, __dirname:', __dirname);
}

// Uint8Array 转 hex 字符串
function toHex(buf: Uint8Array | Buffer): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

// HMAC-SHA256
function hmac(key: Buffer, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest();
}

// SHA256 哈希
function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// URI 编码
function uriEscape(str: string): string {
  return encodeURIComponent(str)
    .replace(/[^A-Za-z0-9_.~\-%]+/g, (c) => c)
    .replace(/[*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
}

// 查询参数转字符串
function queryParamsToString(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((key) => {
      const val = params[key];
      if (typeof val === 'undefined' || val === null) return undefined;
      const escapedKey = uriEscape(key);
      if (!escapedKey) return undefined;
      return `${escapedKey}=${uriEscape(val)}`;
    })
    .filter((v): v is string => v !== undefined)
    .join('&');
}

// 需要忽略的 headers
const HEADER_KEYS_TO_IGNORE = new Set([
  'authorization',
  'content-length',
  'content-type',
  'user-agent',
]);

// 获取签名 headers
function getSignHeaders(originHeaders: Record<string, string>, needSignHeaders?: string[]): [string, string] {
  function trimHeaderValue(header: string): string {
    return header?.toString().trim().replace(/\s+/g, ' ') ?? '';
  }

  let h = Object.keys(originHeaders);
  if (Array.isArray(needSignHeaders)) {
    const needSignSet = new Set([...needSignHeaders, 'x-date', 'host'].map((k) => k.toLowerCase()));
    h = h.filter((k) => needSignSet.has(k.toLowerCase()));
  }
  h = h.filter((k) => !HEADER_KEYS_TO_IGNORE.has(k.toLowerCase()));
  const signedHeaderKeys = h
    .slice()
    .map((k) => k.toLowerCase())
    .sort()
    .join(';');
  const canonicalHeaders = h
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
    .map((k) => `${k.toLowerCase()}:${trimHeaderValue(originHeaders[k])}`)
    .join('\n');
  return [signedHeaderKeys, canonicalHeaders];
}

// 生成火山引擎签名
async function generateSignature(
  method: string,
  pathName: string,
  query: Record<string, string>,
  headers: Record<string, string>,
  bodySha: string,
  accessKeyId: string,
  secretAccessKey: string
): Promise<string> {
  const datetime = headers['X-Date'] || headers['x-date'];
  const date = datetime.substring(0, 8);

  const [signedHeaders, canonicalHeaders] = getSignHeaders(headers);
  const emptyBodyHash = sha256('');
  const canonicalRequest = [
    method.toUpperCase(),
    pathName,
    queryParamsToString(query) || '',
    `${canonicalHeaders}\n`,
    signedHeaders,
    bodySha || emptyBodyHash,
  ].join('\n');

  const credentialScope = [date, VOLC_API_REGION, VOLC_API_SERVICE, 'request'].join('/');
  const canonicalRequestHash = sha256(canonicalRequest);
  const stringToSign = ['HMAC-SHA256', datetime, credentialScope, canonicalRequestHash].join('\n');

  const secretKey = Buffer.from(secretAccessKey);
  const kDate = hmac(secretKey, date);
  const kRegion = hmac(kDate, VOLC_API_REGION);
  const kService = hmac(kRegion, VOLC_API_SERVICE);
  const kSigning = hmac(kService, 'request');
  const kSignature = hmac(kSigning, stringToSign);
  const signature = toHex(kSignature);

  return [
    'HMAC-SHA256',
    `Credential=${accessKeyId}/${credentialScope},`,
    `SignedHeaders=${signedHeaders},`,
    `Signature=${signature}`,
  ].join(' ');
}

// 获取当前时间（ISO 格式，去掉分隔符）
function getDateTimeNow(): string {
  const now = new Date();
  return now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
}

// 提交任务到即梦 AI
async function submitTask(imageBase64: string, prompt: string) {
  const accessKeyId = process.env.VOLC_ACCESS_KEY_ID;
  const secretAccessKey = process.env.VOLC_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('VOLC_ACCESS_KEY_ID or VOLC_SECRET_ACCESS_KEY not configured');
  }

  const base64Data = imageBase64.includes(',')
    ? imageBase64.split(',')[1]
    : imageBase64;

  const requestBody = {
    req_key: 'jimeng_t2i_v40',
    binary_data_base64: [base64Data],
    prompt: prompt,
    scale: 0.5,
    force_single: true,
  };

  const body = JSON.stringify(requestBody);
  const bodySha = sha256(body);

  const query = {
    Action: 'CVSync2AsyncSubmitTask',
    Version: '2022-08-31'
  };

  const xDate = getDateTimeNow();

  const headers: Record<string, string> = {
    'host': VOLC_API_HOST,
    'X-Date': xDate,
    'content-type': 'application/json'
  };

  const authorization = await generateSignature(
    'POST',
    '/',
    query,
    headers,
    bodySha,
    accessKeyId,
    secretAccessKey
  );

  const queryString = queryParamsToString(query);
  const response = await fetch(`https://${VOLC_API_HOST}/?${queryString}`, {
    method: 'POST',
    headers: {
      ...headers,
      'Authorization': authorization,
      'Content-Length': Buffer.byteLength(body).toString()
    },
    body: body
  });

  const responseText = await response.text();
  console.log('Submit API Response:', response.status, responseText);

  if (!response.ok) {
    try {
      const errorData = JSON.parse(responseText);
      const errorCode = errorData.status || errorData.code;
      const errorMessage = errorData.message || '';

      if (errorCode === 50411 || errorMessage.includes('Risk')) {
        throw new Error('IMAGE_RISK: 图片未能通过安全检测，请尝试使用其他图片。');
      }
    } catch (e) {
      if ((e as Error).message.includes('IMAGE_RISK')) throw e;
    }
    throw new Error(`API request failed: ${response.status}`);
  }

  const data = JSON.parse(responseText);
  if (data.status && data.status !== 10000) {
    const errorCode = data.status;
    const errorMessage = data.message || '';

    if (errorCode === 50411 || errorMessage.includes('Risk')) {
      throw new Error('IMAGE_RISK: 图片未能通过安全检测，请尝试使用其他图片。');
    }
  }

  return data;
}

// 查询任务结果
async function queryTask(taskId: string) {
  const accessKeyId = process.env.VOLC_ACCESS_KEY_ID;
  const secretAccessKey = process.env.VOLC_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('VOLC keys not configured');
  }

  const requestBody = {
    req_key: 'jimeng_t2i_v40',
    task_id: taskId
  };

  const body = JSON.stringify(requestBody);
  const bodySha = sha256(body);

  const query = {
    Action: 'CVSync2AsyncGetResult',
    Version: '2022-08-31'
  };

  const xDate = getDateTimeNow();

  const headers: Record<string, string> = {
    'host': VOLC_API_HOST,
    'X-Date': xDate,
    'content-type': 'application/json'
  };

  const authorization = await generateSignature(
    'POST',
    '/',
    query,
    headers,
    bodySha,
    accessKeyId,
    secretAccessKey
  );

  const queryString = queryParamsToString(query);
  const response = await fetch(`https://${VOLC_API_HOST}/?${queryString}`, {
    method: 'POST',
    headers: {
      ...headers,
      'Authorization': authorization,
      'Content-Length': Buffer.byteLength(body).toString()
    },
    body: body
  });

  const responseText = await response.text();
  console.log('Query API Response:', response.status, responseText);

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`API query failed: ${response.status}`);
  }

  if (!response.ok) {
    const errorCode = data.status || data.code;
    const errorMessage = data.message || '';

    if (errorCode === 50411 || errorMessage.includes('Risk')) {
      throw new Error('IMAGE_RISK: 图片未能通过安全检测。');
    }
    throw new Error(`API query failed: ${response.status}`);
  }

  if (data.status && data.status !== 10000) {
    const errorCode = data.status;
    const errorMessage = data.message || '';

    if (errorCode === 50411 || errorMessage.includes('Risk')) {
      throw new Error('IMAGE_RISK: 图片未能通过安全检测。');
    }
  }

  return data;
}

// 轮询等待任务完成
async function waitForTaskCompletion(taskId: string, maxAttempts = 60, intervalMs = 3000): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    console.log(`Polling attempt ${attempt + 1}/${maxAttempts}...`);
    const result = await queryTask(taskId);

    if (result.data && result.data.status === 'done') {
      if (result.data.image_urls && result.data.image_urls.length > 0) {
        return result.data.image_urls[0];
      } else if (result.data.binary_data_base64 && result.data.binary_data_base64.length > 0) {
        const base64Data = result.data.binary_data_base64[0];
        return `data:image/jpeg;base64,${base64Data}`;
      }
      throw new Error('Task completed but no image data returned');
    } else if (result.data && result.data.status === 'failed') {
      const errorCode = result.status || result.code;
      const errorMessage = result.message || 'Unknown error';

      if (errorCode === 50411 || errorMessage.includes('Risk')) {
        throw new Error('IMAGE_RISK: 图片未能通过安全检测。');
      }
      throw new Error(`Task failed: ${errorMessage}`);
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('Task timeout');
}

// POST /api/ai-optimize
export async function POST(request: NextRequest) {
  loadEnvProduction();

  // Debug: verify env loaded correctly
  const akId = process.env.VOLC_ACCESS_KEY_ID;
  const skKey = process.env.VOLC_SECRET_ACCESS_KEY;
  console.log('[DEBUG] VOLC_ACCESS_KEY_ID:', akId ? `${akId.substring(0, 8)}...(${akId.length})` : 'NOT SET');
  console.log('[DEBUG] VOLC_SECRET_ACCESS_KEY:', skKey ? `${skKey.substring(0, 8)}...(${skKey.length})` : 'NOT SET');
  console.log('[DEBUG] CWD:', process.cwd());

  try {
    const { imageBase64, prompt } = await request.json();

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'Missing imageBase64 parameter' },
        { status: 400 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        { error: 'Missing prompt parameter' },
        { status: 400 }
      );
    }

    console.log('Submitting AI optimization task...');
    const submitResult = await submitTask(imageBase64, prompt);

    if (!submitResult.data || !submitResult.data.task_id) {
      return NextResponse.json(
        { error: 'Failed to submit task' },
        { status: 500 }
      );
    }

    const taskId = submitResult.data.task_id;
    console.log('Task submitted, ID:', taskId);

    const imageUrl = await waitForTaskCompletion(taskId);

    return NextResponse.json({
      success: true,
      imageUrl: imageUrl,
      taskId: taskId
    });

  } catch (error) {
    console.error('AI optimization error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isRisk = message.includes('IMAGE_RISK');

    return NextResponse.json(
      {
        error: isRisk ? '图片未能通过安全检测' : 'AI 优化失败',
        message: message
      },
      { status: isRisk ? 400 : 500 }
    );
  }
}
