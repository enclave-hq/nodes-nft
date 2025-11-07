# Node NFT 토큰 생태계

> **언어 선택:** [English](README.md) | [中文](README.zh.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

BSC 기반 NFT 토큰 배포 플랫폼. 지분 분할, 이중 보상 메커니즘, O(1) 전역 인덱스 최적화를 지원합니다.

## 프로젝트 구조

```
node-nft/
├── contracts/          # 스마트 컨트랙트 (Hardhat 프로젝트)
│   ├── contracts/      # Solidity 컨트랙트 소스 코드
│   ├── scripts/        # 배포 스크립트
│   ├── test/          # 컨트랙트 테스트
│   └── hardhat.config.ts
│
├── frontend/          # 프론트엔드 애플리케이션 (Next.js + wallet-sdk)
│   ├── app/           # Next.js App Router
│   ├── components/    # React 컴포넌트
│   ├── lib/           # 유틸리티 함수, hooks, stores
│   └── package.json
│
├── backend/           # 관리 백엔드 서비스 (NestJS/Express)
│   ├── src/           # 백엔드 소스 코드
│   │   ├── modules/   # 기능 모듈 (auth, invite-codes, users 등)
│   │   └── config/    # 설정 파일
│   └── package.json
│
└── docs/              # 설계 문서 (frontend/docs/ 디렉토리 내)
```

## 핵심 기능

- ✅ **O(1) 전역 인덱스** - 오라클 배포로 고정 ~30k Gas
- ✅ **이중 보상 메커니즘** - TKN 생산 + USDT 보상
- ✅ **NFT 상태 관리** - Live/Dissolved 이중 상태
- ✅ **온체인 지분 시장** - P2P 전송 + 주문장 거래
- ✅ **단계적 잠금 해제** - 1년 후 시작, 25개월에 완료

## 빠른 시작

### 컨트랙트 개발

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
```

### 프론트엔드 개발

```bash
cd frontend
npm install
npm run dev
```

### 백엔드 개발 (관리)

```bash
cd backend
npm install
npm run dev
```

## 문서

자세한 설계 문서는 `../docs/node-nft/` 디렉토리를 참조하세요:
- [설계 문서](../docs/node-nft/design-story.md)
- [시나리오 워크스루](../docs/node-nft/scenario-walkthrough.md)
- [요구사항 명세](../docs/node-nft/requirements.md)
- [컨트랙트 명세](../docs/node-nft/contract-spec.md)
- [기술 FAQ](../docs/node-nft/technical-faq.md)

## 라이선스

MIT

