// 正确检查UUPS代理合约
const https = require('https');

async function checkUUPSProxyCorrectly() {
  console.log('🔍 正确检查UUPS代理合约...');
  console.log('📋 代理合约地址: 0x20A0D9ac405daAe983A2C59880aD1e032Ee71D42');
  
  const proxyAddress = '0x20A0D9ac405daAe983A2C59880aD1e032Ee71D42';
  
  try {
    // 1. 检查代理合约的代码
    console.log('\n📋 检查代理合约代码...');
    const proxyCode = await getContractCode(proxyAddress);
    console.log('✅ 代理合约代码长度:', proxyCode.length, 'bytes');
    
    if (proxyCode === '0x') {
      console.log('❌ 代理合约地址没有代码');
      return;
    }
    
    // 2. 检查实现合约地址
    console.log('\n📋 检查实现合约地址...');
    const implementationAddress = await getImplementationAddress(proxyAddress);
    console.log('✅ 实现合约地址:', implementationAddress);
    
    if (implementationAddress === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      console.log('❌ 实现合约地址为空 - 代理合约没有正确初始化');
      return;
    }
    
    // 3. 检查实现合约的代码
    console.log('\n📋 检查实现合约代码...');
    const implCode = await getContractCode(implementationAddress);
    console.log('✅ 实现合约代码长度:', implCode.length, 'bytes');
    
    // 4. 通过代理合约调用函数
    console.log('\n📋 通过代理合约调用函数...');
    await testProxyCalls(proxyAddress);
    
    // 5. 直接调用实现合约函数
    console.log('\n📋 直接调用实现合约函数...');
    await testImplementationCalls(implementationAddress);
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  }
}

async function getImplementationAddress(proxyAddress) {
  // UUPS代理的实现地址存储位置
  const implementationSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
  return await getStorageAt(proxyAddress, implementationSlot);
}

async function testProxyCalls(proxyAddress) {
  const functions = [
    { name: 'owner', selector: '0x8da5cb5b' },
    { name: 'usdtToken', selector: '0x5c60da1b' },
    { name: 'treasury', selector: '0x8d8f1f67' },
    { name: 'oracle', selector: '0x7dc0d1d0' },
    { name: 'nodeNFT', selector: '0x6352211e' }
  ];
  
  for (const func of functions) {
    try {
      const result = await callContract(proxyAddress, func.selector);
      console.log(`✅ ${func.name}:`, result);
    } catch (error) {
      console.log(`❌ ${func.name}: 调用失败`);
    }
  }
}

async function testImplementationCalls(implementationAddress) {
  const functions = [
    { name: 'owner', selector: '0x8da5cb5b' },
    { name: 'usdtToken', selector: '0x5c60da1b' },
    { name: 'treasury', selector: '0x8d8f1f67' },
    { name: 'oracle', selector: '0x7dc0d1d0' },
    { name: 'nodeNFT', selector: '0x6352211e' }
  ];
  
  for (const func of functions) {
    try {
      const result = await callContract(implementationAddress, func.selector);
      console.log(`✅ ${func.name}:`, result);
    } catch (error) {
      console.log(`❌ ${func.name}: 调用失败`);
    }
  }
}

async function getContractCode(contractAddress) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_getCode",
      params: [contractAddress, "latest"],
      id: 1
    });
    
    const options = {
      hostname: 'data-seed-prebsc-1-s1.binance.org',
      port: 8545,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          if (result.result) {
            resolve(result.result);
          } else {
            reject(new Error(result.error?.message || 'Unknown error'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function getStorageAt(contractAddress, slot) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_getStorageAt",
      params: [contractAddress, slot, "latest"],
      id: 1
    });
    
    const options = {
      hostname: 'data-seed-prebsc-1-s1.binance.org',
      port: 8545,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          if (result.result) {
            resolve(result.result);
          } else {
            reject(new Error(result.error?.message || 'Unknown error'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function callContract(contractAddress, data) {
  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [
        {
          to: contractAddress,
          data: data
        },
        "latest"
      ],
      id: 1
    });
    
    const options = {
      hostname: 'data-seed-prebsc-1-s1.binance.org',
      port: 8545,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': requestData.length
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          if (result.result) {
            resolve(result.result);
          } else {
            reject(new Error(result.error?.message || 'Unknown error'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(requestData);
    req.end();
  });
}

checkUUPSProxyCorrectly();
