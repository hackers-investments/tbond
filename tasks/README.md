# TBOND Protocol 테스트 절차

## 01. tbond 테슽 커맨드 설정
source commands

## 02. 서버 실행
start

## 03. 명령 실행
all : 채권 라이프사이클 1바퀴를 돌려주는 all in one 명령  
money : 계정에 돈 넣기 (admin, user1, user2, user3, user4 계정이 있음)  
balance [user] : 계정 계좌 확인  
deploy : TBondFactory 배포  
make fundraisingPeriod stakingPeriod targetAmount : 채권 생성 ex) make 100 100 10000  
view [bond] [user] : 채권 정보 조회  
list : 채권 전부 출력  
invest bond amount user : 채권에 투자 ex) invest 1 1000 user1  
stake bond : 채권 스테이킹  
unstake bond : 채권 언스테이킹  
withdraw bond : 채권 출금  
claim bond amount user : 만기된 채권에서 인출  
refund bond amount user : 투자 진행 중 채권에서 투자 취소  
mine number : number 만큼 블럭생성
