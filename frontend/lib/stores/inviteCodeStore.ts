/**
 * 邀请码存储模块
 * 在生产环境中应该使用数据库（如PostgreSQL、MongoDB等）
 */

export interface InviteCode {
  code: string;
  creator: string;
  createdAt: number;
  usageCount: number;
  active: boolean;
}

// 内存存储（生产环境应该使用数据库）
const inviteCodes = new Map<string, InviteCode>();

// 从环境变量或配置文件初始化一些示例邀请码
if (inviteCodes.size === 0) {
  // 可以在这里初始化一些默认邀请码
  inviteCodes.set('WELCOME2024', {
    code: 'WELCOME2024',
    creator: 'admin',
    createdAt: Date.now(),
    usageCount: 0,
    active: true,
  });
}

export const inviteCodeStore = {
  /**
   * 获取所有邀请码
   */
  getAll(): InviteCode[] {
    return Array.from(inviteCodes.values());
  },

  /**
   * 获取单个邀请码
   */
  get(code: string): InviteCode | undefined {
    return inviteCodes.get(code);
  },

  /**
   * 创建邀请码
   */
  create(code: string, creator: string = 'admin'): InviteCode {
    if (inviteCodes.has(code)) {
      throw new Error('Invite code already exists');
    }

    const inviteCode: InviteCode = {
      code,
      creator,
      createdAt: Date.now(),
      usageCount: 0,
      active: true,
    };

    inviteCodes.set(code, inviteCode);
    return inviteCode;
  },

  /**
   * 撤销邀请码
   */
  revoke(code: string): boolean {
    const inviteCode = inviteCodes.get(code);
    if (!inviteCode) {
      return false;
    }

    inviteCode.active = false;
    inviteCodes.set(code, inviteCode);
    return true;
  },

  /**
   * 验证邀请码
   */
  validate(code: string): { valid: boolean; error?: string } {
    const inviteCode = inviteCodes.get(code);

    if (!inviteCode) {
      return { valid: false, error: 'Invite code not found' };
    }

    if (!inviteCode.active) {
      return { valid: false, error: 'Invite code has been revoked' };
    }

    return { valid: true };
  },

  /**
   * 增加使用次数
   */
  incrementUsage(code: string): void {
    const inviteCode = inviteCodes.get(code);
    if (inviteCode) {
      inviteCode.usageCount++;
      inviteCodes.set(code, inviteCode);
    }
  },
};















