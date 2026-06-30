// app.js
// 클라이언트 사이드 웹앱 제어 및 UI 렌더링 스크립트

// 글로벌 함수 정의 (HTML에서 직접 호출)
window.openModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
  }
};

window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
};

(function() {
  // 상태 관리
  let currentUser = null;
  let selectedProjectId = null;
  let currentReceiptDataUrl = null;
  let editingExpenseId = null;

  // DOM 요소 참조 (1단계 공통)
  const screenLogin = document.getElementById('screen-login');
  const screenProjectReg = document.getElementById('screen-project-registration');
  const appHeader = document.getElementById('app-header');
  const navUserName = document.getElementById('nav-user-name');
  const navRoleBadge = document.getElementById('nav-role-badge');
  const btnLogout = document.getElementById('btn-logout');

  // 로그인 폼
  const formLogin = document.getElementById('form-login');
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const loginAlert = document.getElementById('login-alert');
  const btnForgotPassword = document.getElementById('btn-forgot-password');

  // 프로젝트 등록 폼
  const formProjectReg = document.getElementById('form-project-reg');
  const regYear = document.getElementById('reg-year');
  const regDept = document.getElementById('reg-dept');
  const regName = document.getElementById('reg-name');
  const regAmount = document.getElementById('reg-amount');
  const regOwnerName = document.getElementById('reg-owner-name');
  const regNote = document.getElementById('reg-note');
  const regAlert = document.getElementById('reg-alert');
  const btnRegCancel = document.getElementById('btn-reg-cancel');

  // 2단계 추가 DOM 요소 참조
  const screenDashboard = document.getElementById('screen-dashboard');
  const adminActions = document.getElementById('admin-actions');
  const btnGoToReg = document.getElementById('btn-go-to-reg');
  const dashboardProjectCards = document.getElementById('dashboard-project-cards');
  const dashboardProjectTable = document.getElementById('dashboard-project-table').querySelector('tbody');

  const screenProjectDetail = document.getElementById('screen-project-detail');
  const btnBackToDashboard = document.getElementById('btn-back-to-dashboard');
  const projectSummaryCard = document.getElementById('project-summary-card');
  
  const cardExpenseReg = document.getElementById('card-expense-reg');
  const formExpenseReg = document.getElementById('form-expense-reg');
  const expenseFormTitle = document.getElementById('expense-form-title');
  const expItemName = document.getElementById('exp-item-name');
  const expAmount = document.getElementById('exp-amount');
  const expDate = document.getElementById('exp-date');
  const expReceipt = document.getElementById('exp-receipt');
  const receiptPreviewFilename = document.getElementById('receipt-preview-filename');
  const expenseWarning = document.getElementById('expense-warning');
  const expenseAlert = document.getElementById('expense-alert');
  const btnSaveExpense = document.getElementById('btn-save-expense');
  const btnCancelExpenseEdit = document.getElementById('btn-cancel-expense-edit');
  const expMemo = document.getElementById('exp-memo');
  const expenseTotalSum = document.getElementById('expense-total-sum');

  const expenseListTable = document.getElementById('expense-list-table').querySelector('tbody');
  
  const modalReceipt = document.getElementById('modal-receipt');
  const modalReceiptBody = document.getElementById('modal-receipt-body');

  // 푸터 링크
  const linkPrivacy = document.getElementById('link-privacy');
  const linkTerms = document.getElementById('link-terms');

  // 1. 초기 로딩 및 세션 확인
  function init() {
    loadSession();
    bindEvents();
    loadPolicyDocuments();
  }

  function loadSession() {
    const savedUser = sessionStorage.getItem('current_user');
    if (savedUser) {
      currentUser = JSON.parse(savedUser);
      showAuthenticatedView();
    } else {
      showLoginView();
    }
  }

  function showLoginView() {
    screenLogin.style.display = 'flex';
    screenProjectReg.style.display = 'none';
    screenDashboard.style.display = 'none';
    screenProjectDetail.style.display = 'none';
    appHeader.style.display = 'none';
    loginAlert.style.display = 'none';
  }

  function showAuthenticatedView() {
    screenLogin.style.display = 'none';
    appHeader.style.display = 'block';
    
    // 네비게이션 헤더 정보 업데이트
    navUserName.textContent = currentUser.name;
    navRoleBadge.textContent = currentUser.role === 'admin' ? '관리자' : '일반 교사';
    navRoleBadge.className = 'logo-badge ' + currentUser.role;

    // 대시보드로 이동
    goDashboard();
  }

  function goDashboard() {
    screenLogin.style.display = 'none';
    screenProjectReg.style.display = 'none';
    screenProjectDetail.style.display = 'none';
    screenDashboard.style.display = 'block';

    if (currentUser.role === 'admin') {
      adminActions.style.display = 'block';
    } else {
      adminActions.style.display = 'none';
    }

    renderDashboard();
  }

  // 2. 대시보드 렌더링
  function renderDashboard() {
    const balances = window.SchoolDB.getProjectBalances(currentUser.id, currentUser.role);
    
    // 카드 뷰 렌더링
    dashboardProjectCards.innerHTML = '';
    if (balances.length === 0) {
      dashboardProjectCards.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted); background: white; border: 1px dashed var(--border); border-radius: var(--radius);">
          등록되었거나 담당으로 배정된 프로젝트가 없습니다.
        </div>
      `;
    } else {
      balances.forEach(b => {
        const useRate = b.allocated_amount > 0 ? (b.used_amount / b.allocated_amount) * 100 : 0;
        const isOver = b.balance < 0;
        
        const card = document.createElement('div');
        card.className = 'project-card';
        card.onclick = () => showProjectDetail(b.project_id);
        
        card.innerHTML = `
          <div class="project-card-header">
            <span class="project-card-title">${b.year} · ${b.name}</span>
            <span class="project-card-dept">${b.department || '미지정'}</span>
          </div>
          <div style="font-size: 13px; margin-top: 8px; color: var(--text-muted);">
            배정액: ${b.allocated_amount.toLocaleString()}원 / 사용액: ${b.used_amount.toLocaleString()}원
          </div>
          <div class="bar-bg">
            <div class="bar-fill ${isOver ? 'danger' : ''}" style="width: ${Math.min(useRate, 100)}%;"></div>
          </div>
          <div style="font-size: 12px; margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span class="${isOver ? 'danger-text' : 'success-text'}">
              ${isOver ? `잔액 초과: ${(b.balance * -1).toLocaleString()}원 초과` : `잔액: ${b.balance.toLocaleString()}원`}
            </span>
            <span style="color: var(--text-muted); font-size: 11px;">사용률: ${Math.round(useRate)}%</span>
          </div>
        `;
        dashboardProjectCards.appendChild(card);
      });
    }

    // 테이블 뷰 렌더링
    dashboardProjectTable.innerHTML = '';
    if (balances.length === 0) {
      dashboardProjectTable.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 20px;">데이터가 없습니다.</td>
        </tr>
      `;
    } else {
      balances.forEach(b => {
        const isOver = b.balance < 0;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${b.year}</td>
          <td>${b.department || '미지정'}</td>
          <td style="font-weight: 600; color: var(--primary); cursor: pointer;" onclick="window.showProjectDetail('${b.project_id}')">${b.name}</td>
          <td>${b.allocated_amount.toLocaleString()}</td>
          <td>${b.used_amount.toLocaleString()}</td>
          <td class="${isOver ? 'danger-text' : ''}">${b.balance.toLocaleString()}</td>
          <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${b.owners}</td>
          <td>
            <a style="color: var(--primary); text-decoration: none; font-weight: 600; cursor: pointer;" onclick="window.showProjectDetail('${b.project_id}')">상세 ▸</a>
          </td>
        `;
        dashboardProjectTable.appendChild(tr);
      });
    }
  }

  // 3. 프로젝트 상세 및 지출 관리 화면 전환
  window.showProjectDetail = function(projectId) {
    selectedProjectId = projectId;
    screenDashboard.style.display = 'none';
    screenProjectReg.style.display = 'none';
    screenProjectDetail.style.display = 'block';
    
    // 지출 등록 폼 리셋
    resetExpenseForm();
    
    renderProjectDetail();
  };

  function renderProjectDetail() {
    const db = window.SchoolDB;
    const balances = db.getProjectBalances(currentUser.id, currentUser.role);
    const proj = balances.find(b => b.project_id === selectedProjectId);
    
    if (!proj) {
      alert('프로젝트를 조회할 수 없거나 권한이 없습니다.');
      goDashboard();
      return;
    }

    // 프로젝트 요약 헤더 렌더링
    const useRate = proj.allocated_amount > 0 ? (proj.used_amount / proj.allocated_amount) * 100 : 0;
    const isOver = proj.balance < 0;
    
    projectSummaryCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 4px;">${proj.year} · ${proj.name}</h2>
          <div style="font-size: 13px; color: var(--text-muted);">
            부서: <strong style="color: var(--text-main);">${proj.department || '미지정'}</strong> | 
            담당 교사: <strong style="color: var(--text-main);">${proj.owners}</strong>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 12px; color: var(--text-muted);">배정 예산액</div>
          <div style="font-size: 22px; font-weight: 700; color: var(--text-main);">${proj.allocated_amount.toLocaleString()}원</div>
        </div>
      </div>
      <div class="bar-bg" style="height: 12px;">
        <div class="bar-fill ${isOver ? 'danger' : ''}" style="width: ${Math.min(useRate, 100)}%;"></div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 13px;">
        <span class="${isOver ? 'danger-text' : 'success-text'}">
          ${isOver ? `예산 초과: ${(proj.balance * -1).toLocaleString()}원 초과 지출` : `사용 가능 잔액: ${proj.balance.toLocaleString()}원`}
        </span>
        <span style="color: var(--text-muted);">총 누적 지출액: ${proj.used_amount.toLocaleString()}원 (${Math.round(useRate)}% 사용)</span>
      </div>
    `;

    // RLS 권한 제어: 일반 교사는 본인이 담당자인 프로젝트에만 지출 등록 가능
    if (currentUser.role === 'teacher') {
      const owners = db.getProjectOwners(selectedProjectId);
      const isOwner = owners.some(o => o.id === currentUser.id);
      if (!isOwner) {
        cardExpenseReg.style.display = 'none'; // 담당자가 아니면 지출 등록 폼 숨김
      } else {
        cardExpenseReg.style.display = 'block';
      }
    } else {
      cardExpenseReg.style.display = 'block'; // 관리자는 모든 프로젝트 등록 가능
    }

    // 사용 내역 목록 가져오기 및 테이블 렌더링
    const expenses = db.getExpenses(selectedProjectId, currentUser.id, currentUser.role);
    expenseListTable.innerHTML = '';
    
    if (expenses.length === 0) {
      expenseListTable.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">등록된 지출 내역이 없습니다.</td>
        </tr>
      `;
      // Update total sum display
      const totalSumElem = document.getElementById('expense-total-sum');
      if (totalSumElem) {
        totalSumElem.textContent = `총 사용액: ${proj.used_amount.toLocaleString()}원`;
      }
    } else {
      expenses.forEach(e => {
        const canEdit = currentUser.role === 'admin' || e.created_by === currentUser.id;
        const canDelete = currentUser.role === 'admin'; // 삭제는 관리자만

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${e.used_date}</td>
          <td style="font-weight: 500;">${e.item_name}</td>
          <td style="font-weight: 600;">${parseFloat(e.amount).toLocaleString()}원</td>
          <td>
            ${e.receipt_file_url ? `<span class="badge-outline" style="cursor: pointer; color: var(--primary); border-color: rgba(37,99,235,0.3); background-color: var(--primary-light);" onclick="window.viewReceipt('${e.id}', '${e.item_name}')">영수증 보기</span>` : '<span style="color: var(--text-muted); font-size: 11px;">없음</span>'}
          </td>
          <td>${e.creator_name}</td>
          <td>
            ${canEdit ? `<a style="color: var(--primary); text-decoration: none; margin-right: 12px; font-weight: 500; cursor: pointer;" onclick="window.editExpense('${e.id}')">수정</a>` : ''}
            ${canDelete ? `<a style="color: var(--danger); text-decoration: none; font-weight: 500; cursor: pointer;" onclick="window.deleteExpense('${e.id}')">삭제</a>` : ''}
            ${!canEdit && !canDelete ? '<span style="color: var(--text-muted); font-size: 11px;">권한 없음</span>' : ''}
          </td>
        `;
        expenseListTable.appendChild(tr);
      });
    }
    // Update total sum display
    const totalSumElem = document.getElementById('expense-total-sum');
    if (totalSumElem) {
      totalSumElem.textContent = `총 사용액: ${proj.used_amount.toLocaleString()}원`;
    }
  }

  // 4. 지출 등록 및 실시간 잔액 초과 경고 검증
  function checkLiveBalance() {
    if (!selectedProjectId) return;
    const db = window.SchoolDB;
    const balances = db.getProjectBalances(currentUser.id, currentUser.role);
    const proj = balances.find(b => b.project_id === selectedProjectId);
    if (!proj) return;

    let enteredVal = parseFloat(expAmount.value) || 0;
    let available = proj.balance;

    // 만약 수정 모드인 경우, 수정 중인 지출 내역의 원래 금액만큼 잔액에 더해놓고 실시간 검증을 수행
    if (editingExpenseId) {
      const dbAll = JSON.parse(localStorage.getItem('school_budget_db'));
      const originalExpense = dbAll.expenses.find(e => e.id === editingExpenseId);
      if (originalExpense) {
        available += parseFloat(originalExpense.amount);
      }
    }

    if (enteredVal > available) {
      expenseWarning.style.display = 'block';
    } else {
      expenseWarning.style.display = 'none';
    }
  }

  // 5. 증빙 파일 업로드 및 Base64 변환
  function handleReceiptUpload(event) {
    const file = event.target.files[0];
    if (!file) {
      currentReceiptDataUrl = null;
      receiptPreviewFilename.style.display = 'none';
      return;
    }

    // 용량 제한 검증 (10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert('파일 용량이 10MB를 초과합니다.');
      expReceipt.value = '';
      currentReceiptDataUrl = null;
      receiptPreviewFilename.style.display = 'none';
      return;
    }

    // 확장자 검증
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('지원되지 않는 파일 형식입니다. JPG, PNG, PDF만 첨부 가능합니다.');
      expReceipt.value = '';
      currentReceiptDataUrl = null;
      receiptPreviewFilename.style.display = 'none';
      return;
    }

    // Base64 인코딩
    const reader = new FileReader();
    reader.onload = function(e) {
      currentReceiptDataUrl = e.target.result;
      receiptPreviewFilename.textContent = `영수증 등록 완료: ${file.name}`;
      receiptPreviewFilename.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  // 6. 지출 내역 수정/삭제/취소 글로벌 바인딩
  window.editExpense = function(expenseId) {
    const dbAll = JSON.parse(localStorage.getItem('school_budget_db'));
    const expense = dbAll.expenses.find(e => e.id === expenseId);
    if (!expense) return;

    editingExpenseId = expenseId;
    expenseFormTitle.textContent = '지출 내역 수정';
    expItemName.value = expense.item_name;
    expAmount.value = expense.amount;
    expDate.value = expense.used_date;
    currentReceiptDataUrl = expense.receipt_file_url;
    
    if (expense.receipt_file_url) {
      receiptPreviewFilename.textContent = '기존 업로드된 증빙 보존됨 (변경하려면 파일 선택)';
      receiptPreviewFilename.style.display = 'block';
    } else {
      receiptPreviewFilename.style.display = 'none';
    }

    btnCancelExpenseEdit.style.display = 'inline-flex';
    btnSaveExpense.textContent = '수정 완료';
    expenseAlert.style.display = 'none';

    // 폼으로 자동 스크롤
    cardExpenseReg.scrollIntoView({ behavior: 'smooth' });
    checkLiveBalance();
  };

  window.deleteExpense = function(expenseId) {
    if (!confirm('정말로 이 지출 내역을 삭제하시겠습니까?\n(일반 교사는 삭제가 제한되며 관리자만 수행 가능합니다)')) {
      return;
    }

    try {
      window.SchoolDB.deleteExpense(expenseId, currentUser.id, currentUser.role);
      renderProjectDetail();
      alert('지출 내역이 정상적으로 삭제되었습니다.');
    } catch (err) {
      alert(err.message);
    }
  };

  function resetExpenseForm() {
    editingExpenseId = null;
    currentReceiptDataUrl = null;
    formExpenseReg.reset();
    expenseFormTitle.textContent = '사용 내역 등록';
    btnSaveExpense.textContent = '저장 (즉시 반영)';
    btnCancelExpenseEdit.style.display = 'none';
    receiptPreviewFilename.style.display = 'none';
    expenseWarning.style.display = 'none';
    expenseAlert.style.display = 'none';
    
    // 사용일자를 오늘 날짜로 자동 지정
    const today = new Date().toISOString().split('T')[0];
    expDate.value = today;
  }

  // 7. 영수증 팝업 보기
  window.viewReceipt = function(expenseId, itemName) {
    const dbAll = JSON.parse(localStorage.getItem('school_budget_db'));
    const expense = dbAll.expenses.find(e => e.id === expenseId);
    if (!expense || !expense.receipt_file_url) return;

    const fileUrl = expense.receipt_file_url;
    modalReceiptBody.innerHTML = '';

    // PDF 여부 판별
    if (fileUrl.startsWith('data:application/pdf') || fileUrl.endsWith('.pdf')) {
      const iframe = document.createElement('iframe');
      iframe.src = fileUrl;
      iframe.className = 'receipt-iframe';
      modalReceiptBody.appendChild(iframe);
    } else {
      // 이미지인 경우
      const img = document.createElement('img');
      img.src = fileUrl;
      img.alt = itemName;
      img.className = 'receipt-img';
      modalReceiptBody.appendChild(img);
    }

    window.openModal('modal-receipt');
  };

  // 8. 이벤트 바인딩
  function bindEvents() {
    // 로그인 제출
    formLogin.addEventListener('submit', function() {
      const email = loginEmail.value.trim();
      const password = loginPassword.value;
      
      const user = window.SchoolDB.getUserByEmail(email);
      if (user && user.password_hash === password) {
        currentUser = user;
        sessionStorage.setItem('current_user', JSON.stringify(currentUser));
        showAuthenticatedView();
      } else {
        loginAlert.textContent = '이메일 또는 비밀번호가 올바르지 않거나 비활성화된 계정입니다. (관리자: admin@school.kr / admin123)';
        loginAlert.style.display = 'block';
      }
    });

    // 비밀번호 분실 알림
    btnForgotPassword.addEventListener('click', function(e) {
      e.preventDefault();
      alert('비밀번호 재설정 기능은 1단계에서는 시뮬레이션으로 제공됩니다.\n관리자 계정: admin@school.kr / admin123\n일반교사 계정: kim@school.kr / teacher123 을 사용하여 로그인해 주세요.');
    });

    // 로그아웃
    btnLogout.addEventListener('click', function() {
      sessionStorage.removeItem('current_user');
      currentUser = null;
      showLoginView();
    });

    // 프로젝트 등록 페이지 이동 (관리자 전용)
    btnGoToReg.addEventListener('click', function() {
      screenDashboard.style.display = 'none';
      screenProjectReg.style.display = 'block';
      regAlert.style.display = 'none';
    });

    // 프로젝트 등록 취소 및 목록 복귀
    btnRegCancel.addEventListener('click', function() {
      goDashboard();
    });

    // 프로젝트 등록 제출
    formProjectReg.addEventListener('submit', function() {
      if (currentUser.role !== 'admin') return;

      const year = regYear.value;
      const dept = regDept.value.trim();
      const name = regName.value.trim();
      const amount = regAmount.value;
      const ownerName = regOwnerName.value.trim();
      const note = regNote.value;

      if (!dept) {
        showAlert(regAlert, 'danger', '담당 부서명을 입력해 주세요.');
        return;
      }

      if (!ownerName) {
        showAlert(regAlert, 'danger', '사업 담당 교사 이름을 입력해 주세요.');
        return;
      }

      try {
        window.SchoolDB.createProject({
          year: year,
          name: name,
          department: dept,
          allocatedAmount: amount,
          note: note,
          ownerName: ownerName,
          createdBy: currentUser.id
        });

        showAlert(regAlert, 'success', `프로젝트 "${name}"이(가) 성공적으로 등록되었습니다!`);
        formProjectReg.reset();
        
        // 1.5초 후 대시보드로 복귀하여 데이터 갱신
        setTimeout(() => {
          goDashboard();
        }, 1500);
      } catch (err) {
        showAlert(regAlert, 'danger', err.message);
      }
    });

    // 지출 취소 및 대시보드 복귀
    btnBackToDashboard.addEventListener('click', function() {
      goDashboard();
    });

    // 지출 실시간 잔액 초과 경고 바인딩
    expAmount.addEventListener('input', checkLiveBalance);

    // 지출 파일 업로드 바인딩
    expReceipt.addEventListener('change', handleReceiptUpload);

    // 지출 취소
    btnCancelExpenseEdit.addEventListener('click', resetExpenseForm);

    // 지출 등록/수정 저장 제출
    formExpenseReg.addEventListener('submit', function() {
      const itemName = expItemName.value.trim();
      const amount = expAmount.value;
      const date = expDate.value;

      try {
        if (editingExpenseId) {
          // 수정 모드
          window.SchoolDB.updateExpense(editingExpenseId, {
            itemName: itemName,
            amount: amount,
            usedDate: date,
            receiptFileUrl: currentReceiptDataUrl
          }, currentUser.id, currentUser.role);

          showAlert(expenseAlert, 'success', '지출 내역이 성공적으로 수정되었습니다.');
        } else {
          // 추가 모드
          window.SchoolDB.createExpense({
            projectId: selectedProjectId,
            itemName: itemName,
            amount: amount,
            usedDate: date,
            receiptFileUrl: currentReceiptDataUrl,
            createdBy: currentUser.id,
            userRole: currentUser.role
          });

          showAlert(expenseAlert, 'success', '지출 내역이 등록되었습니다.');
        }

        resetExpenseForm();
        renderProjectDetail();
      } catch (err) {
        showAlert(expenseAlert, 'danger', err.message);
      }
    });

    // 푸터 모달 연결
    linkPrivacy.addEventListener('click', () => window.openModal('modal-privacy'));
    linkTerms.addEventListener('click', () => window.openModal('modal-terms'));
  }

  // 9. UI 헬퍼 함수
  function showAlert(alertEl, type, message) {
    alertEl.textContent = message;
    alertEl.className = `alert alert-${type}`;
    alertEl.style.display = 'block';
    
    if (type === 'success') {
      setTimeout(() => {
        alertEl.style.display = 'none';
      }, 3000);
    }
  }

  // 10. 개인정보처리방침 / 이용약관 동적 파일 로드 (CORS 등 실패 대비 Fallback 적용)
  function loadPolicyDocuments() {
    const privacyBody = document.getElementById('modal-privacy-body');
    const termsBody = document.getElementById('modal-terms-body');

    const privacyFallback = `### 제1조 (개인정보의 처리 목적)
본 서비스는 교직원 업무용 행정 시스템으로서 다음의 목적을 위해 최소한의 개인정보를 처리합니다.
- 포털 및 서비스 제공, 예산 집행 등록 내역 관리, 사용자 권한 확인.

### 제2조 (개인정보의 처리 및 보유기간)
- 교직원 계정 정보: 재직 기간 및 퇴직/전출 후 1년 간 보관 후 파기합니다.
- 예산 지출 내역 및 증빙: 관련 회계 규정에 따라 5년 간 보관합니다.

### 제3조 (처리하는 개인정보 항목)
- 필수 항목: 이름, 이메일(학교 계정), 직책/부서, 역할(관리자/교사), 비밀번호 해시.

### 제4조 (안전성 확보조치)
- 비밀번호 암호화 저장, 전송 구간 HTTPS 암호화 적용.

### 제8조 (개인정보 보호책임자)
- 성명: 조정연 (서울언북초등학교 교사)
- 연락처: 02-514-5981
- 시행일: 2026년 6월 27일`;

    const termsFallback = `### 제1조 (목적)
본 약관은 서울언북초등학교 조정연 교사가 교육 행정 업무 지원을 위해 제공하는 학교 예산 관리 시스템의 이용에 관한 사항을 규정합니다.

### 제2조 (이용자의 의무)
- 이용자는 본 서비스를 신뢰성 있는 학교 회계 업무 처리를 위해 올바른 목적으로만 사용해야 합니다.
- 허위 내역 등록 또는 무단 권한 우회 시도를 금지합니다.

### 제3조 (책임 제한)
- 본 시스템은 학교 내부용 모의 예산 관리 도구로써 상업적 이용 및 외부 유출을 금지합니다.

- 시행일: 2026년 6월 27일`;

    fetch('개인정보처리방침.md')
      .then(r => r.text())
      .then(text => {
        privacyBody.textContent = text;
      })
      .catch(() => {
        privacyBody.textContent = privacyFallback;
      });

    fetch('이용약관.md')
      .then(r => r.text())
      .then(text => {
        termsBody.textContent = text;
      })
      .catch(() => {
        termsBody.textContent = termsFallback;
      });
  }

  // 앱 기동
  init();
})();
