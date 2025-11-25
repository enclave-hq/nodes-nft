import { Injectable } from '@nestjs/common';
import * as promClient from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly register: promClient.Registry;

  // ============================================
  // 操作地址余额指标
  // ============================================
  public readonly operatorBalance: promClient.Gauge;

  // ============================================
  // NFT 铸造指标
  // ============================================
  public readonly nftMintSuccess: promClient.Counter;
  public readonly nftMintFailed: promClient.Counter;
  public readonly nftMintDuration: promClient.Histogram;
  public readonly nftTotalMinted: promClient.Gauge;

  // ============================================
  // 错误统计指标
  // ============================================
  public readonly errorsTotal: promClient.Counter;
  public readonly errorsByType: promClient.Counter;

  constructor() {
    // 创建注册表
    this.register = new promClient.Registry();

    // 收集默认指标（CPU、内存等）
    promClient.collectDefaultMetrics({ register: this.register });

    // 操作地址余额
    this.operatorBalance = new promClient.Gauge({
      name: 'node_nft_operator_balance',
      help: 'Operator address balance',
      labelNames: ['address', 'chain'],
      registers: [this.register],
    });

    // NFT 铸造成功
    this.nftMintSuccess = new promClient.Counter({
      name: 'node_nft_mint_success_total',
      help: 'Total successful NFT minting operations',
      registers: [this.register],
    });

    // NFT 铸造失败
    this.nftMintFailed = new promClient.Counter({
      name: 'node_nft_mint_failed_total',
      help: 'Total failed NFT minting operations',
      labelNames: ['error_type'],
      registers: [this.register],
    });

    // NFT 铸造耗时
    this.nftMintDuration = new promClient.Histogram({
      name: 'node_nft_mint_duration_seconds',
      help: 'NFT minting operation duration in seconds',
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.register],
    });

    // NFT 总铸造数
    this.nftTotalMinted = new promClient.Gauge({
      name: 'node_nft_total_minted',
      help: 'Total number of NFTs minted',
      registers: [this.register],
    });

    // 错误总数
    this.errorsTotal = new promClient.Counter({
      name: 'node_nft_errors_total',
      help: 'Total number of errors',
      registers: [this.register],
    });

    // 按类型分类的错误
    this.errorsByType = new promClient.Counter({
      name: 'node_nft_errors_by_type_total',
      help: 'Total number of errors by type',
      labelNames: ['error_type'],
      registers: [this.register],
    });
  }

  /**
   * 获取 metrics 数据
   */
  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  /**
   * 获取注册表
   */
  getRegister(): promClient.Registry {
    return this.register;
  }
}



