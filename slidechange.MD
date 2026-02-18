0) 목표

기존: 전체 슬라이드 요약 완료 후 한 번에 렌더

변경: 슬라이드별 요약을 동시 K개로 병렬 처리하면서, 완료되는 대로 즉시 화면에 표시

UX: 첫 결과 빨리 노출 + 진행률 표시 + 실패 슬라이드 개별 재시도

1) 아키텍처 선택 (권장안)
권장: “클라이언트 슬라이딩 윈도우 + 서버 단건 요약 API”

서버는 슬라이드 1장 요약을 수행하는 API만 제공 (idempotent)

클라이언트가 동시 요청 K개 유지하면서 1..N을 처리

응답 오면 해당 slideIndex 슬롯에 즉시 반영

서버는 결과를 DB/캐시에 저장해 중복 호출 시 즉시 반환 가능

MVP 단계에서 가장 구현 빠르고, 이후 job queue/SSE로 확장도 쉬움.

2) 데이터 모델 / 상태 설계
2.1 프론트 상태(필수)

슬라이드 N장에 대해 배열로 상태 관리:

status: idle | loading | done | error

summary: string or JSON

errorMessage: string

startedAt / finishedAt(옵션)

전체 진행률: doneCount / total

2.2 서버 저장(권장)

slide_summaries 테이블(or 기존 summary 저장소)에:

doc_id, slide_index, model, prompt_version, summary_json, created_at

캐시 키: docId + slideIndex + promptVersion + model
→ 같은 문서/같은 프롬프트면 즉시 반환(비용/속도 절감)

3) API 설계 (단건 슬라이드 요약)
Endpoint

POST /api/slide-summary

Request

docId

slideIndex

slideText(또는 slideId로 서버가 가져오게)

promptVersion(필수)

(옵션) forceRegenerate: boolean

Response

docId

slideIndex

summary(JSON)

cached: boolean

model

latencyMs

서버 로직 핵심

입력 검증

캐시/DB 조회 → 있으면 바로 반환

없으면 OpenAI 호출

결과 저장 후 반환

4) 핵심 기능: “슬라이딩 윈도우 병렬 처리” (프론트)
파라미터

CONCURRENCY = 5 (초기값 추천: 4~6)

RETRY_MAX = 2

RETRY_BACKOFF_MS = 500 * 2^attempt

동작 정의

한 번에 최대 5개 슬라이드만 loading

하나 끝나면 다음 슬라이드를 즉시 시작

응답이 늦어도 UI는 각 슬라이드 슬롯에 독립적으로 채워짐

사용자는 1번부터 읽기 때문에 UI는 1..N 슬롯을 먼저 렌더(스켈레톤)

구현 체크리스트

“현재 실행 중인 요청 수”를 추적하는 큐/세마포어 로직

AbortController로 “문서 이동/취소” 시 요청 취소

에러 슬라이드는 error로 표시 + “재시도” 버튼 제공

5) UI/UX 변경 사항
5.1 화면 구성

상단:

슬라이드 요약 생성 중 (done/total)

Progress bar

(옵션) “백그라운드 생성 계속” 토글

본문:

슬라이드 카드 리스트(1..N)

각 카드:

로딩 스켈레톤(요약 자리)

완료 시 요약 내용 렌더

실패 시 에러 표시 + 재시도 버튼

5.2 체감 속도 극대화

첫 1~2개 결과가 뜨면 “즉시 스크롤/읽기 가능”

1~N 슬롯을 미리 렌더해서 “순서대로 나온다” 인식 강화

완료된 카드에 “방금 생성됨” 같은 subtle indicator(옵션)

6) OpenAI 호출 최적화 (서버)

슬라이드 요약은 저비용/저지연이 목표:

모델: gpt-5-nano 우선

응답 형식: JSON schema 강제(파싱 안정)

max_output_tokens를 슬라이드 요약에 맞게 낮게 설정

reasoning_effort는 최소로(가능한 옵션이면)

“슬라이드별 요약”은 길게 쓰지 않게 제한해야 속도가 확 줄어듦.

7) 실패/재시도 정책
실패 유형

429/레이트리밋: backoff 후 재시도

5xx: backoff 후 재시도

파싱 실패: 1회만 재시도(프롬프트/스키마 문제 가능)

클라이언트 취소: 즉시 중단

UI

실패한 슬라이드는 error 표시

“해당 슬라이드만 재시도”

“실패한 것만 다시 시도” 버튼(옵션)

8) 성능 관측(필수 로그)

서버: latencyMs, cached, model, tokens_in/out(가능하면)

프론트:

TTFR(첫 요약 렌더까지 시간)

전체 완료까지 시간

실패율

이거로 CONCURRENCY=3/5/8을 A/B해서 최적값 찾으면 됨.

9) 단계별 구현 순서 (Cursor 작업 순서)

프론트: 슬라이드 카드 리스트 + 상태 모델 + 스켈레톤 UI

서버: /api/slide-summary 단건 요약 구현(캐시 없이 먼저)

프론트: 슬라이딩 윈도우 병렬 로직 붙이기(CONCURRENCY=5)

서버: 캐시/DB 저장 & 재요청 시 즉시 반환

에러 처리: retry/backoff + UI 재시도

관측: latency 로그/진행률/TTFR 측정

10) Cursor에게 줄 “작업 지시 문장” (복붙용)

“슬라이드 요약 생성 UX를 개선한다. 슬라이드 1..N에 대해 요약을 단건 API로 요청하고, 클라이언트에서 동시성 K(기본 5)로 슬라이딩 윈도우 병렬 처리한다. 응답이 도착하는 즉시 해당 slideIndex 카드에 summary를 채워 넣고, 상단에 진행률(done/total)과 progress bar를 표시한다. 실패한 슬라이드는 error 상태로 두고 backoff 재시도(최대 2회) 후에도 실패하면 사용자에게 재시도 버튼을 제공한다. 문서를 떠나면 AbortController로 미완료 요청을 취소한다. 서버는 동일 docId+slideIndex+promptVersion+model 조합은 캐시/DB에 저장하고, 재요청 시 즉시 cached=true로 반환한다.”