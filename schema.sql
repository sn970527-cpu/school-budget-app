-- =========================================================
-- 학교 예산 사용 관리 웹앱 — 데이터베이스 스키마 (PostgreSQL 기준)
-- Supabase 사용 시 그대로 SQL Editor에 붙여넣어 실행 가능
-- Firebase(Firestore) 사용 시에는 본 스키마를 컬렉션/문서 구조로 변환해서 참고
-- =========================================================

-- -----------------------------
-- 1. users (교직원 계정)
-- -----------------------------
create table users (
  id              uuid primary key default gen_random_uuid(),
  email           varchar(255) not null unique,        -- 로그인 이메일(학교 계정)
  password_hash   varchar(255) not null,                -- 비밀번호 해시 (Firebase/Supabase Auth 사용 시 불필요, Auth가 대신 처리)
  name            varchar(100) not null,                -- 실명
  position        varchar(100),                         -- 직책/부서
  role            varchar(20) not null default 'teacher'
                    check (role in ('admin', 'teacher')),
  is_active       boolean not null default true,        -- 비활성화(퇴직/전출) 처리용
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table users is '교직원 계정. 학생 정보는 저장하지 않음.';

-- -----------------------------
-- 2. projects (연도별 프로젝트/사업)
-- -----------------------------
create table projects (
  id                 uuid primary key default gen_random_uuid(),
  year               int not null,                      -- 회계연도 (예: 2026)
  name               varchar(200) not null,              -- 사업명
  allocated_amount   numeric(14,2) not null check (allocated_amount >= 0), -- 배정액
  note               text,                                -- 비고
  created_by         uuid references users(id),          -- 등록한 관리자
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  unique (year, name)                                   -- 동일 연도+사업명 중복 방지
);

comment on table projects is '연도+사업 단위 예산 배정 정보.';

-- -----------------------------
-- 3. project_owners (프로젝트 담당 교사 매핑, N:M)
-- -----------------------------
create table project_owners (
  project_id   uuid not null references projects(id) on delete cascade,
  user_id      uuid not null references users(id) on delete cascade,
  assigned_at  timestamptz not null default now(),

  primary key (project_id, user_id)
);

comment on table project_owners is '프로젝트별 담당 교사 매핑. 한 프로젝트에 여러 담당자 지정 가능.';

-- -----------------------------
-- 4. expenses (예산 사용 내역)
-- -----------------------------
create table expenses (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id) on delete restrict,
  item_name         varchar(200) not null,               -- 사용 항목명
  amount            numeric(14,2) not null check (amount > 0), -- 사용 금액
  used_date         date not null,                        -- 사용일자
  receipt_file_url  text,                                  -- 증빙 파일 경로(Storage URL)
  created_by        uuid not null references users(id),   -- 작성자
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz                           -- soft delete (관리자만 삭제 가능, 이력 보존)
);

comment on table expenses is '실제 예산 집행 내역. 승인 절차 없이 등록 즉시 반영됨.';

-- 자주 조회되는 컬럼에 인덱스
create index idx_expenses_project_id on expenses(project_id) where deleted_at is null;
create index idx_expenses_created_by on expenses(created_by);
create index idx_project_owners_user_id on project_owners(user_id);

-- -----------------------------
-- 5. 잔액 계산용 뷰 (대시보드에서 바로 SELECT)
-- -----------------------------
create view project_balance as
select
  p.id              as project_id,
  p.year,
  p.name,
  p.allocated_amount,
  coalesce(sum(e.amount) filter (where e.deleted_at is null), 0) as used_amount,
  p.allocated_amount - coalesce(sum(e.amount) filter (where e.deleted_at is null), 0) as balance
from projects p
left join expenses e on e.project_id = p.id
group by p.id, p.year, p.name, p.allocated_amount;

comment on view project_balance is '대시보드 표시용: 프로젝트별 배정액/사용액/잔액 실시간 계산.';

-- =========================================================
-- 6. 권한 정책 (Supabase Row Level Security 예시)
-- Firebase 사용 시 Firestore Security Rules로 동일 로직 구현 필요
-- =========================================================

alter table projects enable row level security;
alter table expenses enable row level security;
alter table project_owners enable row level security;

-- 관리자는 전체 조회/수정 가능
create policy admin_full_access_projects on projects
  for all
  using (exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin'));

-- 일반 교사는 본인이 담당인 프로젝트만 조회 가능
create policy teacher_view_owned_projects on projects
  for select
  using (
    exists (
      select 1 from project_owners po
      where po.project_id = projects.id and po.user_id = auth.uid()
    )
  );

-- 일반 교사는 본인 담당 프로젝트에만 사용 내역 등록 가능
create policy teacher_insert_owned_expenses on expenses
  for insert
  with check (
    exists (
      select 1 from project_owners po
      where po.project_id = expenses.project_id and po.user_id = auth.uid()
    )
  );

-- 일반 교사는 본인이 작성한 내역만 수정 가능 (삭제는 정책에서 제외 → 관리자만 가능)
create policy teacher_update_own_expenses on expenses
  for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- 관리자는 모든 사용 내역 조회/수정/삭제 가능
create policy admin_full_access_expenses on expenses
  for all
  using (exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin'));

-- =========================================================
-- 참고: Antigravity / AI 코딩 도구에 전달할 때 함께 안내할 내용
-- - Supabase 사용 시: 위 SQL을 SQL Editor에서 그대로 실행
-- - Firebase 사용 시: users/projects/expenses 컬렉션으로 변환,
--   project_owners는 projects 문서 내 owner_ids 배열 필드로 대체 가능
-- - 증빙 파일은 Supabase Storage 또는 Firebase Storage에 업로드 후
--   receipt_file_url 컬럼에 다운로드 URL만 저장
-- =========================================================
