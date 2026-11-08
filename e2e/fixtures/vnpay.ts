import { createHmac } from 'node:crypto';
import type { APIRequestContext, Page } from '@playwright/test';
import { API_URL, VNPAY_HASH_SECRET, VNPAY_TMN_CODE } from './env';
import { vnpayTimestamp } from './time';

const PAY_HOST = 'https://sandbox.vnpayment.vn';

export interface GatewayCheckout {
  /** Số tiền thật gửi sang cổng (VND), đã chia lại cho 100. */
  amount: number;
  txnRef: string;
  orderInfo: string;
  returnUrl: string;
}

export interface GatewayOptions {
  responseCode?: string;
  /** Giá trị vnp_Amount gửi về, mặc định khớp đơn hàng. */
  rawAmount?: number;
  tamperSignature?: boolean;
}

/** Tương đương URLEncoder.encode(value, US_ASCII) ở VnpaySignatureBuilder. */
function javaUrlEncode(value: string): string {
  return encodeURIComponent(value.replace(/[^\x00-\x7F]/g, '?'))
    .replace(/%20/g, '+')
    .replace(/[!'()~]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function sign(params: Record<string, string>): string {
  const hashData = Object.keys(params)
    .sort()
    .map((name) => `${name}=${javaUrlEncode(params[name])}`)
    .join('&');
  return createHmac('sha512', VNPAY_HASH_SECRET).update(hashData).digest('hex');
}

/**
 * Thay trang của VNPay: chặn redirect sang sandbox, rồi đóng vai cổng gửi IPN có
 * chữ ký và đưa trình duyệt về site. Backend vẫn tự kiểm tra chữ ký và số tiền.
 */
export class FakeVnpay {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext,
  ) {}

  async install(): Promise<void> {
    await this.page.route(`${PAY_HOST}/**`, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<h1>Cổng VNPay giả lập</h1>' }),
    );
  }

  /** Chờ app chuyển sang cổng và đọc thông tin đơn hàng trên URL. */
  async checkout(): Promise<GatewayCheckout> {
    await this.page.waitForURL(`${PAY_HOST}/**`);
    const params = new URL(this.page.url()).searchParams;
    return {
      amount: Number(params.get('vnp_Amount')) / 100,
      txnRef: params.get('vnp_TxnRef') ?? '',
      orderInfo: params.get('vnp_OrderInfo') ?? '',
      returnUrl: params.get('vnp_ReturnUrl') ?? '',
    };
  }

  /** Gửi IPN như VNPay và trả về RspCode của backend. */
  async sendIpn(checkout: GatewayCheckout, options: GatewayOptions = {}): Promise<string> {
    const params = this.signedParams(checkout, options);
    const response = await this.request.get(`${API_URL}/api/v1/public/vnpay/ipn`, { params });
    const body = await response.json();
    return String(body.RspCode ?? body.rspCode);
  }

  /** Đưa trình duyệt về return URL giống VNPay sau khi khách thanh toán. */
  async returnToSite(checkout: GatewayCheckout, options: GatewayOptions = {}): Promise<void> {
    const query = new URLSearchParams(this.signedParams(checkout, options));
    await this.page.goto(`${checkout.returnUrl}?${query.toString()}`);
  }

  private signedParams(checkout: GatewayCheckout, options: GatewayOptions): Record<string, string> {
    const { responseCode = '00', rawAmount = checkout.amount * 100, tamperSignature = false } = options;
    const params: Record<string, string> = {
      vnp_Amount: String(rawAmount),
      vnp_BankCode: 'NCB',
      vnp_BankTranNo: `VNP${Date.now()}`,
      vnp_CardType: 'ATM',
      vnp_OrderInfo: checkout.orderInfo,
      vnp_PayDate: vnpayTimestamp(),
      vnp_ResponseCode: responseCode,
      vnp_TmnCode: VNPAY_TMN_CODE,
      vnp_TransactionNo: String(Date.now()).slice(-8),
      vnp_TransactionStatus: responseCode,
      vnp_TxnRef: checkout.txnRef,
    };
    const signature = sign(params);
    // Đổi ký tự cuối thành giá trị khác hẳn, để chữ ký chắc chắn sai.
    const tampered = `${signature.slice(0, -1)}${signature.endsWith('0') ? '1' : '0'}`;
    return { ...params, vnp_SecureHash: tamperSignature ? tampered : signature };
  }
}
