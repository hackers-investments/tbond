# TBOND 테스트 명령

- source init.cmd 실행하여 활성화 필요.
- 테스트 계정 admin, user1-4 => 0~4 번호로 매핑

| Command | Description |
| --- | --- |
| money [addr] | 테스트 계정에 ETH, TON, WTON 충전 |
| balance [user] | 잔고 확인 |
| make fundraisingPeriod stakingPeriod targetAmount | 본드 생성 |
| view [bond] [user] | 본드 정보 출력 |
| list | 본드 전체 출력 |
| invest bond amount user | 본드 투자 |
| stake bond | 본드 스테이킹 |
| unstake bond | 본드 언스테이킹 |
| withdraw bond | 본드로 출금 |
| claim bond amount user | 수익금 출금 |
| refund bond amount user | 투자금 회수 |
| mine number | 블럭 생성 |
| factory | TBond Factory 컨트랙트 배포 |
| exchange | Tbond Exchange 먼트랙트 배포 |
| sell bond bondAmount wtonAmount deadline user | 본드 판매 |
| buy bond user | 본드 구매 |
| auction | 판매 주문 목록 |
| cancel orderNumber | 판매 주문 취소 |
| trade | 거래소 디버깅 명령 조합 |
| bond | 본드 사이크 1회 명령 조합 |