# nestjs-safe-response 로드맵 (v0.1.0 → v1.0.0)

## v0.1.0에서 달성한 항목 (원래 v1.0.0 목표)

- [x] 단위 테스트 커버리지 90%+ (핵심 로직 100%)
- [x] E2E 테스트 (실제 NestJS 앱 기반)
- [x] GitHub Actions CI/CD
- [x] 영문 + 한국어 README
- [x] npm 배포 + provenance

---

## v0.2.0 — 멀티 컨텍스트 지원

| 항목 | 난이도 | 설명 |
|------|--------|------|
| spec 파일 dist 제외 | 하 | `.spec.ts`가 dist에 빌드됨. `tsconfig.build.json` 분리 필요. 패키지 크기 118KB → ~48KB |
| Fastify 어댑터 지원 | 중 | 현재 Express 전용(`Request`, `Response` 타입). Fastify도 NestJS에서 많이 사용됨 |
| ExecutionContext 분기 | 중 | 현재 `switchToHttp()`만 사용. RPC/WebSocket 컨텍스트에서 에러 방지 |

> 설계 문서의 GraphQL/Microservices 지원은 복잡도 대비 수요가 불확실.
> GraphQL은 자체 에러 포맷이 있고, Microservices는 HTTP 응답 구조와 근본적으로 다름.
> 실제 사용자 피드백이 있을 때 추가 권장.

## v0.3.0 — DX 개선

| 항목 | 난이도 | 설명 |
|------|--------|------|
| `@Exclude()` 연동 | 중 | `class-transformer`의 직렬화와 통합하여 응답 필드 필터링 |
| 커스텀 성공 코드 매핑 | 하 | 에러 코드처럼 성공 응답에도 커스텀 코드 부여 옵션 |
| 응답 변환 훅 | 중 | `transformResponse` 옵션으로 래핑 전 데이터 가공 가능 |

## v0.4.0 — 안정성

| 항목 | 난이도 | 설명 |
|------|--------|------|
| NestJS v10 실제 테스트 | 중 | 현재 v11에서만 테스트됨. CI 매트릭스에 v10 추가 |
| @nestjs/swagger v7/v8 호환 테스트 | 중 | peerDependencies에 선언했지만 실제 테스트 없음 |
| 에지 케이스 테스트 보강 | 하 | Streaming 응답, Buffer 반환, undefined 반환 등 |

## v1.0.0 — 정식 릴리스

| 항목 | 설명 |
|------|------|
| API 안정화 선언 | 인터페이스/데코레이터 시그니처 확정, breaking change 없음 보장 |
| 실사용 검증 | 최소 1개 프로덕션 프로젝트에서 사용 확인 |
| 문서 사이트 | GitHub Pages 또는 별도 문서 페이지 (선택) |
| semver 준수 시작 | v1.0.0 이후 breaking change는 major 버전에서만 |

---

## 우선순위 권장 순서

```
v0.2.0  spec 파일 dist 제외 + Fastify 지원 + ExecutionContext 분기
v0.3.0  @Exclude() 연동 + 응답 변환 훅
v0.4.0  NestJS v10/swagger v7~v8 호환 테스트 매트릭스
v1.0.0  API 확정 + 실사용 검증
```
