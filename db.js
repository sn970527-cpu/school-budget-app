// db.js
// 로컬 스토리지를 이용해 schema.sql의 테이블 구조(users, projects, project_owners, expenses)를 모방하는 데이터베이스 엔진

(function() {
  const DB_KEY = 'school_budget_db';

  // 초기 시드 데이터 정의
  const initialSchema = {
    users: [
      {
        id: 'user-admin-1',
        email: 'admin@school.kr',
        password_hash: 'admin123', // 교육용 단순 비밀번호 매칭 (실제 환경에서는 bcrypt 적용 권장)
        name: '홍길동',
        position: '행정실',
        role: 'admin',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'user-teacher-1',
        email: 'kim@school.kr',
        password_hash: 'teacher123',
        name: '김교사',
        position: '도서관 담당',
        role: 'teacher',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'user-teacher-2',
        email: 'park@school.kr',
        password_hash: 'teacher123',
        name: '박교사',
        position: '환경교육 담당',
        role: 'teacher',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'user-teacher-3',
        email: 'lee@school.kr',
        password_hash: 'teacher123',
        name: '이교사',
        position: '체육부',
        role: 'teacher',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ],
    projects: [],
    project_owners: [],
    expenses: []
  };

  // DB 로드 또는 초기화
  function loadDB() {
    const data = localStorage.getItem(DB_KEY);
    if (!data) {
      localStorage.setItem(DB_KEY, JSON.stringify(initialSchema));
      return initialSchema;
    }
    return JSON.parse(data);
  }

  // DB 저장
  function saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  window.SchoolDB = {
    // 1. 사용자 관련 API
    getUsers: function() {
      const db = loadDB();
      return db.users;
    },
    getUserByEmail: function(email) {
      const db = loadDB();
      return db.users.find(u => u.email === email && u.is_active);
    },
    getUserById: function(id) {
      const db = loadDB();
      return db.users.find(u => u.id === id);
    },
    
    // 2. 프로젝트 관련 API
    getProjects: function() {
      const db = loadDB();
      return db.projects;
    },
    
    createProject: function({ year, name, department, allocatedAmount, note, ownerName, createdBy }) {
      const db = loadDB();
      
      // 동일 연도 + 사업명 중복 검증
      const duplicate = db.projects.find(p => p.year === parseInt(year) && p.name.trim() === name.trim());
      if (duplicate) {
        throw new Error(`이미 해당 연도(${year})에 동일한 사업명(${name})이 존재합니다.`);
      }

      if (parseFloat(allocatedAmount) < 0) {
        throw new Error('배정액은 0원 이상이어야 합니다.');
      }

      // 담당 교사 이름 기반으로 유저 조회 또는 자동 신규 등록
      let user = db.users.find(u => u.name.trim() === ownerName.trim());
      if (!user) {
        const newUserId = 'user-' + Math.random().toString(36).substring(2, 11);
        user = {
          id: newUserId,
          email: `${ownerName.trim()}@school.kr`, // 자동 생성 이메일
          password_hash: 'teacher123',
          name: ownerName.trim(),
          position: department.trim() + ' 담당',
          role: 'teacher',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        db.users.push(user);
      }

      const projectId = 'proj-' + Math.random().toString(36).substring(2, 11);
      const newProject = {
        id: projectId,
        year: parseInt(year),
        name: name.trim(),
        department: department.trim(),
        allocated_amount: parseFloat(allocatedAmount),
        note: note ? note.trim() : '',
        created_by: createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // 프로젝트 추가
      db.projects.push(newProject);

      // 프로젝트 소유자(담당 교사) 매핑 추가
      db.project_owners.push({
        project_id: projectId,
        user_id: user.id,
        assigned_at: new Date().toISOString()
      });

      saveDB(db);
      return newProject;
    },

    // 특정 프로젝트의 담당 교사 목록 가져오기
    getProjectOwners: function(projectId) {
      const db = loadDB();
      const mappings = db.project_owners.filter(po => po.project_id === projectId);
      return mappings.map(po => db.users.find(u => u.id === po.user_id)).filter(Boolean);
    },

    // 3. 잔액 계산 뷰 (project_balance 뷰 모방)
    getProjectBalances: function(userId, userRole) {
      const db = loadDB();
      
      // RLS 적용: 일반 교사인 경우 본인이 소유한 프로젝트만 필터링
      let filteredProjects = db.projects;
      if (userRole === 'teacher') {
        const ownedProjectIds = db.project_owners
          .filter(po => po.user_id === userId)
          .map(po => po.project_id);
        filteredProjects = db.projects.filter(p => ownedProjectIds.includes(p.id));
      }

      return filteredProjects.map(p => {
        // 해당 프로젝트의 사용액 계산 (삭제되지 않은 내역만)
        const projectExpenses = db.expenses.filter(e => e.project_id === p.id && !e.deleted_at);
        const usedAmount = projectExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        const balance = p.allocated_amount - usedAmount;
        
        // 담당 교사 이름 결합
        const owners = db.project_owners
          .filter(po => po.project_id === p.id)
          .map(po => {
            const u = db.users.find(user => user.id === po.user_id);
            return u ? u.name : '';
          })
          .filter(Boolean)
          .join(', ');

        return {
          project_id: p.id,
          year: p.year,
          name: p.name,
          department: p.department || '',
          allocated_amount: p.allocated_amount,
          used_amount: usedAmount,
          balance: balance,
          owners: owners || '없음'
        };
      });
    },

    // 4. 사용 내역 (지출) 관련 API
    getExpenses: function(projectId, userId, userRole) {
      const db = loadDB();
      
      // RLS 조회 제한: 일반 교사는 본인이 담당하는 프로젝트의 지출 내역만 조회 가능
      if (userRole === 'teacher') {
        const isOwner = db.project_owners.some(po => po.project_id === projectId && po.user_id === userId);
        if (!isOwner) {
          throw new Error('이 프로젝트의 지출 내역을 조회할 권한이 없습니다.');
        }
      }

      // 해당 프로젝트의 사용 내역 중 soft delete되지 않은 것 필터링
      const list = db.expenses.filter(e => e.project_id === projectId && !e.deleted_at);
      
      // 작성자 이름 결합하여 반환
      return list.map(e => {
        const creator = db.users.find(u => u.id === e.created_by);
        return {
          ...e,
          creator_name: creator ? creator.name : '알 수 없음'
        };
      }).sort((a, b) => new Date(b.used_date) - new Date(a.used_date)); // 최신 사용일 순 정렬
    },

    createExpense: function({ projectId, itemName, amount, usedDate, receiptFileUrl, memo, createdBy, userRole }) {
      const db = loadDB();

      // RLS 등록 제한: 일반 교사는 본인이 담당하는 프로젝트에만 지출 등록 가능
      if (userRole === 'teacher') {
        const isOwner = db.project_owners.some(po => po.project_id === projectId && po.user_id === createdBy);
        if (!isOwner) {
          throw new Error('담당 프로젝트가 아니므로 지출을 등록할 수 없습니다.');
        }
      }

      if (parseFloat(amount) <= 0) {
        throw new Error('지출 금액은 0원보다 커야 합니다.');
      }

      const expenseId = 'exp-' + Math.random().toString(36).substring(2, 11);
      const newExpense = {
        id: expenseId,
        project_id: projectId,
        item_name: itemName.trim(),
        amount: parseFloat(amount),
        used_date: usedDate,
        receipt_file_url: receiptFileUrl || null,
        memo: memo || '',
        created_by: createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null
      };

      db.expenses.push(newExpense);
      saveDB(db);
      return newExpense;
    },

    updateExpense: function(expenseId, { itemName, amount, usedDate, receiptFileUrl }, userId, userRole) {
      const db = loadDB();
      const expense = db.expenses.find(e => e.id === expenseId);
      if (!expense) {
        throw new Error('지출 내역을 찾을 수 없습니다.');
      }

      // RLS 수정 제한: 일반 교사는 본인이 작성한 지출만 수정 가능
      if (userRole === 'teacher' && expense.created_by !== userId) {
        throw new Error('본인이 등록한 지출 내역만 수정할 수 있습니다.');
      }

      if (parseFloat(amount) <= 0) {
        throw new Error('지출 금액은 0원보다 커야 합니다.');
      }

      expense.item_name = itemName.trim();
      expense.amount = parseFloat(amount);
      expense.used_date = usedDate;
      if (receiptFileUrl !== undefined) {
        expense.receipt_file_url = receiptFileUrl;
      }
      expense.updated_at = new Date().toISOString();

      saveDB(db);
      return expense;
    },

    deleteExpense: function(expenseId, userId, userRole) {
      const db = loadDB();
      const expense = db.expenses.find(e => e.id === expenseId);
      if (!expense) {
        throw new Error('지출 내역을 찾을 수 없습니다.');
      }

      // RLS 삭제 제한: 관리자만 지출 삭제 가능 (소프트 삭제)
      if (userRole !== 'admin') {
        throw new Error('지출 내역 삭제 권한이 없습니다. (관리자 전용)');
      }

      expense.deleted_at = new Date().toISOString();
      saveDB(db);
      return expense;
    }
  };
})();
