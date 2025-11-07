#!/usr/bin/env python3
"""
提取三种回购金额下1-10年每年的价格
"""

import subprocess
import sys

def get_price(repo_amount, year):
    """获取指定回购金额和年份的价格"""
    cmd = f"python3 calculate_final_model.py {repo_amount} 10 1.0 2>&1"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    lines = result.stdout.split('\n')
    
    for line in lines:
        if line.startswith(f"{year} "):
            parts = line.split()
            if len(parts) >= 2:
                price_str = parts[1].replace('$', '')
                try:
                    return float(price_str)
                except:
                    return None
    return None

def main():
    print("=" * 80)
    print("三种回购金额下 1-10 年每年的价格对比")
    print("=" * 80)
    print()
    
    # 表头
    print(f"{'年份':<6} {'回购 $10K':<15} {'回购 $50K':<15} {'回购 $100K':<15}")
    print("-" * 60)
    
    # 初始价格
    initial_price = 1.0
    
    for year in range(1, 11):
        price10 = get_price(10000, year)
        price50 = get_price(50000, year)
        price100 = get_price(100000, year)
        
        if price10 and price50 and price100:
            change10 = ((price10 - initial_price) / initial_price) * 100
            change50 = ((price50 - initial_price) / initial_price) * 100
            change100 = ((price100 - initial_price) / initial_price) * 100
            
            print(f"{year:<6} ${price10:<7.4f} ({change10:+.1f}%) ${price50:<7.4f} ({change50:+.1f}%) ${price100:<7.4f} ({change100:+.1f}%)")
    
    print()
    print("=" * 80)

if __name__ == "__main__":
    main()






