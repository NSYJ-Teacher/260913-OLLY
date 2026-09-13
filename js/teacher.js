/**
 * 교사용 대시보드 스크립트 (학생 사안 관리, 성찰문 피드백, 행발 초안 자동 생성)
 */

document.addEventListener("DOMContentLoaded", () => {
  // DOM 요소 참조
  const teacherLoginOverlay = document.getElementById("teacherLoginOverlay");
  const teacherApp = document.getElementById("teacherApp");
  const formTeacherLogin = document.getElementById("formTeacherLogin");
  const teacherEmail = document.getElementById("teacherEmail");
  const teacherPassword = document.getElementById("teacherPassword");
  const teacherEmailLabel = document.getElementById("teacherEmailLabel");
  const btnTeacherLogout = document.getElementById("btnTeacherLogout");

  // 헤더 컨트롤
  const btnToggleSelfIntro = document.getElementById("btnToggleSelfIntro");
  const btnOpenPinModal = document.getElementById("btnOpenPinModal");
  const pinManagementModal = document.getElementById("pinManagementModal");
  const btnClosePinModal = document.getElementById("btnClosePinModal");
  const pinTableBody = document.getElementById("pinTableBody");
  const btnRegenerateAllPins = document.getElementById("btnRegenerateAllPins");

  // 성찰문 문구 설정 모달
  const btnOpenQuestionTextModal = document.getElementById("btnOpenQuestionTextModal");
  const questionTextModal = document.getElementById("questionTextModal");
  const btnCloseQuestionTextModal = document.getElementById("btnCloseQuestionTextModal");
  const qtTabConflictBtn = document.getElementById("qtTabConflictBtn");
  const qtTabPersonalBtn = document.getElementById("qtTabPersonalBtn");
  const qtConflictContent = document.getElementById("qtConflictContent");
  const qtPersonalContent = document.getElementById("qtPersonalContent");
  const btnResetQuestionText = document.getElementById("btnResetQuestionText");
  const btnSaveQuestionText = document.getElementById("btnSaveQuestionText");

  // 사이드바 & 학생 상세
  const studentListContainer = document.getElementById("studentListContainer");
  const activeStudentBadge = document.getElementById("activeStudentBadge");
  const activeStudentTitle = document.getElementById("activeStudentTitle");
  const activeStudentMeta = document.getElementById("activeStudentMeta");
  const btnGenerateDraft = document.getElementById("btnGenerateDraft");

  // 탭
  const tabReflectionsBtn = document.getElementById("tabReflectionsBtn");
  const tabAssessmentBtn = document.getElementById("tabAssessmentBtn");
  const tabReflectionsContent = document.getElementById("tabReflectionsContent");
  const tabAssessmentContent = document.getElementById("tabAssessmentContent");
  const refCountBadge = document.getElementById("refCountBadge");
  const assessCountBadge = document.getElementById("assessCountBadge");
  const reflectionTimelineContainer = document.getElementById("reflectionTimelineContainer");
  const assessmentDetailsContainer = document.getElementById("assessmentDetailsContainer");

  // 행발 초안 영역
  const draftSection = document.getElementById("draftSection");
  const draftModeBadge = document.getElementById("draftModeBadge");
  const draftSummaryNotice = document.getElementById("draftSummaryNotice");
  const draftSentenceList = document.getElementById("draftSentenceList");
  const txtDraftFull = document.getElementById("txtDraftFull");
  const charCountLabel = document.getElementById("charCountLabel");
  const btnCopyDraft = document.getElementById("btnCopyDraft");
  const btnRegenerateDraft = document.getElementById("btnRegenerateDraft");

  // 상태 변수
  let currentActiveStudent = 1;
  let editingReflectionId = null;
  let editingAssessmentId = null;

  // 이전 서식으로 제출된 구버전 질문 키 라벨 (하위 호환용, 현재 문항 정의에 없는 키에 한해 사용)
  const LEGACY_QUESTION_LABELS = {
    conflict: {
      q6: "내가 잘못했다고 생각하는 부분 (이전 서식)",
      q7: "다음에 다르게 행동할 다짐 (이전 서식)"
    }
  };

  // 현재 교사 설정 문구를 반영한 질문 라벨 맵 생성 (key -> label)
  function getQuestionLabelMap(type) {
    const labels = { ...(LEGACY_QUESTION_LABELS[type] || {}) };
    window.getReflectionQuestionTexts(type).forEach(q => {
      labels[q.key] = q.label;
    });
    return labels;
  }

  initTeacherApp();

  function initTeacherApp() {
    checkTeacherSession();
    setupLoginHandler();
    setupSelfIntroToggle();
    setupPinModal();
    setupQuestionTextModal();
    setupTabs();
    setupDraftActions();
  }

  // 교사 세션 확인
  function checkTeacherSession() {
    const session = window.appStore.getCurrentSession();
    if (session && session.role === "teacher") {
      showTeacherDashboard(session);
    } else {
      teacherLoginOverlay.style.display = "flex";
      teacherApp.style.display = "none";
    }
  }

  function setupLoginHandler() {
    formTeacherLogin.addEventListener("submit", (e) => {
      e.preventDefault();
      const res = window.appStore.verifyTeacherLogin(teacherEmail.value.trim(), teacherPassword.value.trim());
      if (res.success) {
        showTeacherDashboard(res.session);
        showToast("선생님 환영합니다. 대시보드에 접속했습니다.", "success");
      } else {
        showToast(res.message, "danger");
      }
    });

    btnTeacherLogout.addEventListener("click", () => {
      window.appStore.logout();
      teacherApp.style.display = "none";
      teacherLoginOverlay.style.display = "flex";
      showToast("로그아웃되었습니다.", "info");
      if (window.OllyApp) window.OllyApp.showView("landing");
    });
  }

  function showTeacherDashboard(session) {
    teacherEmailLabel.textContent = session.email;
    teacherLoginOverlay.style.display = "none";
    teacherApp.style.display = "block";

    updateSelfIntroButtonState();
    renderStudentList();
    loadStudentDetails(currentActiveStudent);
  }

  // 자기평가 기간 오픈/마감 관리
  function setupSelfIntroToggle() {
    btnToggleSelfIntro.addEventListener("click", () => {
      const settings = window.appStore.getSystemSettings() || {};
      settings.selfIntroOpen = !settings.selfIntroOpen;
      window.appStore.saveSystemSettings(settings);
      updateSelfIntroButtonState();
      showToast(settings.selfIntroOpen ? "학생 자기평가 제출 기간이 [오픈]되었습니다." : "학생 자기평가 제출이 [마감]되었습니다.", "info");
    });
  }

  function updateSelfIntroButtonState() {
    const settings = window.appStore.getSystemSettings();
    const isOpen = settings ? settings.selfIntroOpen : true;
    if (isOpen) {
      btnToggleSelfIntro.textContent = "🟢 현재 열림 (마감하기)";
      btnToggleSelfIntro.style.borderColor = "var(--color-success)";
      btnToggleSelfIntro.style.color = "var(--color-success)";
    } else {
      btnToggleSelfIntro.textContent = "🔴 현재 닫힘 (오픈하기)";
      btnToggleSelfIntro.style.borderColor = "var(--color-danger)";
      btnToggleSelfIntro.style.color = "var(--color-danger)";
    }
  }

  // 학생 PIN 관리 모달
  function setupPinModal() {
    btnOpenPinModal.addEventListener("click", () => {
      renderPinTable();
      pinManagementModal.classList.add("active");
    });

    btnClosePinModal.addEventListener("click", () => {
      pinManagementModal.classList.remove("active");
    });

    pinManagementModal.addEventListener("click", (e) => {
      if (e.target === pinManagementModal) {
        pinManagementModal.classList.remove("active");
      }
    });

    btnRegenerateAllPins.addEventListener("click", () => {
      if (confirm("정말로 전체 학생의 4자리 접속 코드를 새로 무작위 생성하시겠습니까?\n(기존 번호로 접속 중인 학생은 새 코드로 재접속해야 합니다)")) {
        window.appStore.generateBulkStudentCodes();
        renderPinTable();
        showToast("전체 학생의 새 4자리 코드가 일괄 발급되었습니다.", "success");
      }
    });
  }

  function renderPinTable() {
    const codes = window.appStore.getAllStudentCodes();
    pinTableBody.innerHTML = "";
    for (let i = 1; i <= 23; i++) {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid var(--color-border-light)";
      tr.innerHTML = `
        <td style="padding: 0.5rem; font-weight: 700; color: var(--color-primary);">${i}번</td>
        <td style="padding: 0.5rem; color: var(--text-muted);">student${i}@classroom.local</td>
        <td style="padding: 0.5rem; font-weight: 700; font-family: monospace; font-size: 1.05rem; letter-spacing: 2px; color: var(--color-accent);">${codes[i] || '미등록'}</td>
      `;
      pinTableBody.appendChild(tr);
    }
  }

  // 성찰문 질문 문구 설정 모달
  let qtActiveType = "conflict";

  function setupQuestionTextModal() {
    btnOpenQuestionTextModal.addEventListener("click", () => {
      renderQuestionTextEditor("conflict", qtConflictContent);
      renderQuestionTextEditor("personal", qtPersonalContent);
      switchQuestionTextTab("conflict");
      questionTextModal.classList.add("active");
    });

    btnCloseQuestionTextModal.addEventListener("click", () => {
      questionTextModal.classList.remove("active");
    });

    questionTextModal.addEventListener("click", (e) => {
      if (e.target === questionTextModal) {
        questionTextModal.classList.remove("active");
      }
    });

    qtTabConflictBtn.addEventListener("click", () => switchQuestionTextTab("conflict"));
    qtTabPersonalBtn.addEventListener("click", () => switchQuestionTextTab("personal"));

    btnResetQuestionText.addEventListener("click", () => {
      const typeLabel = qtActiveType === "conflict" ? "갈등형" : "개인형";
      if (confirm(`${typeLabel} 성찰문 문구를 기본값으로 초기화하시겠습니까?\n(직접 수정한 내용은 사라집니다)`)) {
        window.appStore.resetReflectionQuestionOverrides(qtActiveType);
        renderQuestionTextEditor(qtActiveType, qtActiveType === "conflict" ? qtConflictContent : qtPersonalContent);
        showToast(`${typeLabel} 성찰문 문구가 기본값으로 초기화되었습니다.`, "info");
      }
    });

    btnSaveQuestionText.addEventListener("click", () => {
      ["conflict", "personal"].forEach(type => {
        const overrides = {};
        document.querySelectorAll(`.qt-field[data-type="${type}"]`).forEach(el => {
          const key = el.dataset.key;
          const field = el.dataset.field;
          if (!overrides[key]) overrides[key] = {};
          overrides[key][field] = field === "minLength" ? (parseInt(el.value, 10) || 0) : el.value;
        });
        window.appStore.saveReflectionQuestionOverrides(type, overrides);
      });
      showToast("성찰문 문구가 저장되었습니다. 학생이 작성 화면을 열면 새 문구가 반영됩니다.", "success");
    });
  }

  function switchQuestionTextTab(type) {
    qtActiveType = type;
    const isConflict = type === "conflict";

    qtTabConflictBtn.style.borderBottom = isConflict ? "3px solid var(--color-primary)" : "none";
    qtTabConflictBtn.style.fontWeight = isConflict ? "700" : "normal";
    qtTabConflictBtn.style.color = isConflict ? "var(--color-primary)" : "var(--text-secondary)";

    qtTabPersonalBtn.style.borderBottom = !isConflict ? "3px solid var(--color-primary)" : "none";
    qtTabPersonalBtn.style.fontWeight = !isConflict ? "700" : "normal";
    qtTabPersonalBtn.style.color = !isConflict ? "var(--color-primary)" : "var(--text-secondary)";

    qtConflictContent.style.display = isConflict ? "block" : "none";
    qtPersonalContent.style.display = !isConflict ? "block" : "none";
  }

  function renderQuestionTextEditor(type, container) {
    const questions = window.getReflectionQuestionTexts(type);
    container.innerHTML = "";

    questions.forEach(q => {
      const card = document.createElement("div");
      card.className = "card";
      card.style.cssText = "padding: 1rem; margin-bottom: 1rem; background: #FAF8F5;";
      card.innerHTML = `
        <div style="font-size: 0.76rem; color: var(--text-muted); margin-bottom: 0.5rem;">문항 키: ${q.key}</div>
        <div class="form-group" style="margin-bottom: 0.6rem;">
          <label class="form-label" style="font-size: 0.85rem;">질문 문구</label>
          <input type="text" class="form-control qt-field" data-type="${type}" data-key="${q.key}" data-field="label" value="${escapeHtmlAttr(q.label)}">
        </div>
        <div class="form-group" style="margin-bottom: 0.6rem;">
          <label class="form-label" style="font-size: 0.85rem;">입력창 안내 문구 (placeholder)</label>
          <input type="text" class="form-control qt-field" data-type="${type}" data-key="${q.key}" data-field="placeholder" value="${escapeHtmlAttr(q.placeholder)}">
        </div>
        <div class="form-group" style="margin-bottom: 0.6rem;">
          <label class="form-label" style="font-size: 0.85rem;">가이드 제목</label>
          <input type="text" class="form-control qt-field" data-type="${type}" data-key="${q.key}" data-field="guideTitle" value="${escapeHtmlAttr(q.guideTitle)}">
        </div>
        <div class="form-group" style="margin-bottom: 0.6rem;">
          <label class="form-label" style="font-size: 0.85rem;">가이드 예시 문장</label>
          <textarea class="form-textarea qt-field" data-type="${type}" data-key="${q.key}" data-field="guideExample" style="min-height: 60px;">${escapeHtmlText(q.guideExample)}</textarea>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="font-size: 0.85rem;">최소 작성 글자 수</label>
          <input type="number" min="0" class="form-control qt-field" data-type="${type}" data-key="${q.key}" data-field="minLength" value="${q.minLength}" style="max-width: 120px;">
        </div>
      `;
      container.appendChild(card);
    });
  }

  function escapeHtmlAttr(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeHtmlText(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // 1~23번 사이드바 학생 목록 렌더링
  function renderStudentList() {
    studentListContainer.innerHTML = "";

    for (let i = 1; i <= 23; i++) {
      const summary = window.appStore.getStudentSummary(i);
      const item = document.createElement("div");
      item.className = `student-list-item ${i === currentActiveStudent ? 'active' : ''}`;
      item.dataset.studentNum = i;

      let badgeHtml = "";
      if (summary.reflectionCount > 0) {
        badgeHtml += `<span class="badge-tag" style="background: var(--color-danger-bg); color: var(--color-danger); font-size: 0.72rem; padding: 1px 5px;">성찰 ${summary.reflectionCount}</span>`;
      }
      if (summary.hasSelfAssessment) {
        badgeHtml += `<span class="badge-tag" style="background: var(--color-success-bg); color: var(--color-success); font-size: 0.72rem; padding: 1px 5px;">자기평가</span>`;
      }
      if (!badgeHtml) {
        badgeHtml = `<span style="font-size: 0.75rem; color: var(--text-muted);">-</span>`;
      }

      item.innerHTML = `
        <div class="student-meta">
          <span class="student-num">${i}</span>
          <span style="font-weight: 600; font-size: 0.92rem; color: var(--text-primary);">${i}번 학생</span>
        </div>
        <div style="display: flex; gap: 0.25rem;">
          ${badgeHtml}
        </div>
      `;

      item.addEventListener("click", () => {
        document.querySelectorAll(".student-list-item").forEach(el => el.classList.remove("active"));
        item.classList.add("active");
        currentActiveStudent = i;
        editingReflectionId = null;
        editingAssessmentId = null;
        loadStudentDetails(i);
      });

      studentListContainer.appendChild(item);
    }
  }

  // 학생 상세 정보 로드
  function loadStudentDetails(studentNum) {
    const summary = window.appStore.getStudentSummary(studentNum);

    activeStudentBadge.textContent = `${studentNum}번 학생`;
    activeStudentTitle.textContent = `6학년 1반 ${studentNum}번 학생의 사안 및 기록`;
    activeStudentMeta.textContent = `성찰문 누적 ${summary.reflectionCount}건 · 자기평가 ${summary.hasSelfAssessment ? '제출 완료' : '미제출'}`;

    refCountBadge.textContent = summary.reflectionCount;
    assessCountBadge.textContent = summary.assessments.length;

    // 행발 초안 영역은 학생 변경 시 기본 숨김
    draftSection.style.display = "none";

    renderReflectionsTimeline(summary.reflections, studentNum);
    renderAssessmentDetails(summary.assessments, studentNum);
  }

  // 탭 전환
  function setupTabs() {
    tabReflectionsBtn.addEventListener("click", () => {
      tabReflectionsBtn.style.borderBottom = "3px solid var(--color-primary)";
      tabReflectionsBtn.style.fontWeight = "700";
      tabReflectionsBtn.style.color = "var(--color-primary)";

      tabAssessmentBtn.style.borderBottom = "none";
      tabAssessmentBtn.style.fontWeight = "normal";
      tabAssessmentBtn.style.color = "var(--text-secondary)";

      tabReflectionsContent.style.display = "block";
      tabAssessmentContent.style.display = "none";
    });

    tabAssessmentBtn.addEventListener("click", () => {
      tabAssessmentBtn.style.borderBottom = "3px solid var(--color-primary)";
      tabAssessmentBtn.style.fontWeight = "700";
      tabAssessmentBtn.style.color = "var(--color-primary)";

      tabReflectionsBtn.style.borderBottom = "none";
      tabReflectionsBtn.style.fontWeight = "normal";
      tabReflectionsBtn.style.color = "var(--text-secondary)";

      tabAssessmentContent.style.display = "block";
      tabReflectionsContent.style.display = "none";
    });
  }

  // 성찰문 타임라인 렌더링
  function renderReflectionsTimeline(reflections, studentNum) {
    reflectionTimelineContainer.innerHTML = "";

    if (!reflections || reflections.length === 0) {
      reflectionTimelineContainer.innerHTML = `
        <div class="card" style="text-align: center; padding: 2.5rem; color: var(--text-muted); background: #FAF9F6;">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🕊️</div>
          <div style="font-weight: 600; font-size: 1rem; color: var(--text-secondary);">등록된 사안 성찰문이 없습니다.</div>
          <div style="font-size: 0.85rem; margin-top: 0.25rem;">학급 규칙을 잘 준수하고 원만한 교우 관계를 유지하고 있는 학생입니다.</div>
        </div>
      `;
      return;
    }

    const timeline = document.createElement("div");
    timeline.className = "timeline";

    reflections.forEach(ref => {
      const item = document.createElement("div");
      item.className = "timeline-item";
      const dateStr = new Date(ref.createdAt).toLocaleDateString("ko-KR", {
        year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
      });

      const questionLabels = getQuestionLabelMap(ref.type);
      const isEditing = editingReflectionId === ref.id;

      let bodyHtml;
      if (isEditing) {
        const answerFieldsHtml = Object.keys(ref.answers || {}).map(key => `
          <div class="form-group" style="margin-bottom: 0.85rem;">
            <label class="form-label" style="font-size: 0.84rem; color: var(--color-accent);">${questionLabels[key] || key}</label>
            <textarea class="form-textarea edit-ref-answer" data-key="${key}" style="min-height: 70px;">${escapeHtmlText(ref.answers[key])}</textarea>
          </div>
        `).join("");

        bodyHtml = `
          <div class="form-group" style="margin-bottom: 0.85rem;">
            <label class="form-label" style="font-size: 0.84rem;">사안 제목</label>
            <input type="text" class="form-control" id="editRefTitle_${ref.id}" value="${escapeHtmlAttr(ref.title || '')}">
          </div>
          <div style="background: #FFFBF0; border: 1px dashed var(--color-warning); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
            ${answerFieldsHtml}
          </div>
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-bottom: 1rem;">
            <button class="btn btn-outline btn-sm btn-cancel-edit-ref" data-doc-id="${ref.id}">취소</button>
            <button class="btn btn-primary btn-sm btn-save-edit-ref" data-doc-id="${ref.id}">💾 수정 내용 저장</button>
          </div>
        `;
      } else {
        let answersHtml = "";
        if (ref.answers) {
          answersHtml = Object.keys(ref.answers).map(key => `
            <div style="margin-bottom: 0.75rem;">
              <div style="font-weight: 600; font-size: 0.84rem; color: var(--color-accent);">${questionLabels[key] || key}</div>
              <div style="font-size: 0.94rem; color: var(--text-primary); margin-top: 2px; padding-left: 0.4rem; border-left: 2px solid var(--color-border);">${ref.answers[key]}</div>
            </div>
          `).join("");
        }

        bodyHtml = `
          <h4 style="font-size: 1.15rem; color: var(--color-primary); margin-bottom: 0.85rem;">
            ${ref.title || '성찰 사안 기록'}
            ${ref.editedAt ? `<span style="font-size: 0.7rem; font-weight: 500; color: var(--text-muted); margin-left: 0.4rem;">(교사 수정됨)</span>` : ''}
          </h4>

          <div style="background: #FAF8F5; padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--color-border-light); margin-bottom: 1rem;">
            ${answersHtml}
          </div>

          <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-bottom: 0.75rem;">
            <button class="btn btn-outline btn-sm btn-edit-ref" data-doc-id="${ref.id}">✏️ 내용 수정</button>
            <button class="btn btn-danger btn-sm btn-delete-ref" data-doc-id="${ref.id}">🗑️ 삭제</button>
          </div>
        `;
      }

      item.innerHTML = `
        <div class="timeline-marker" style="${ref.type === 'conflict' ? 'background-color: var(--color-danger);' : 'background-color: var(--color-info);'}"></div>
        <div class="timeline-content">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span class="badge-tag" style="${ref.type === 'conflict' ? 'background: var(--color-danger-bg); color: var(--color-danger);' : 'background: var(--color-info-bg); color: var(--color-info);'}">
              ${ref.type === 'conflict' ? '🤝 친구와 다투었을 때 (갈등형)' : '🧘 혼자 잘못한 일이 있을 때 (개인형)'}
            </span>
            <span style="font-size: 0.82rem; color: var(--text-muted);">${dateStr}</span>
          </div>

          ${bodyHtml}

          <!-- 교사 지도 코멘트 작성란 -->
          <div style="border-top: 1px dashed var(--color-border); padding-top: 0.85rem; margin-top: 0.5rem;">
            <label class="form-label" style="font-size: 0.86rem; color: var(--color-primary);">💬 교사 지도 및 면담 코멘트</label>
            <div style="display: flex; gap: 0.5rem;">
              <input type="text" id="commentInput_${ref.id}" class="form-control" style="font-size: 0.9rem;" value="${escapeHtmlAttr(ref.teacherComment || '')}" placeholder="학생 면담 후 지도 내용 및 조언을 남겨주세요">
              <button class="btn btn-secondary btn-sm btn-save-comment" data-doc-id="${ref.id}">저장</button>
            </div>
            ${ref.commentedAt ? `<div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 4px;">최근 코멘트: ${new Date(ref.commentedAt).toLocaleDateString()}</div>` : ''}
          </div>
        </div>
      `;

      timeline.appendChild(item);
    });

    reflectionTimelineContainer.appendChild(timeline);

    // 코멘트 저장 버튼 이벤트 바인딩
    document.querySelectorAll(".btn-save-comment").forEach(btn => {
      btn.addEventListener("click", () => {
        const docId = btn.dataset.docId;
        const input = document.getElementById(`commentInput_${docId}`);
        const comment = input.value.trim();
        window.appStore.updateReflectionComment(studentNum, docId, comment);
        showToast("지도 코멘트가 저장되었습니다.", "success");
      });
    });

    // 수정 시작
    document.querySelectorAll(".btn-edit-ref").forEach(btn => {
      btn.addEventListener("click", () => {
        editingReflectionId = btn.dataset.docId;
        loadStudentDetails(studentNum);
      });
    });

    // 수정 취소
    document.querySelectorAll(".btn-cancel-edit-ref").forEach(btn => {
      btn.addEventListener("click", () => {
        editingReflectionId = null;
        loadStudentDetails(studentNum);
      });
    });

    // 수정 내용 저장
    document.querySelectorAll(".btn-save-edit-ref").forEach(btn => {
      btn.addEventListener("click", () => {
        const docId = btn.dataset.docId;
        const titleInput = document.getElementById(`editRefTitle_${docId}`);
        const title = titleInput.value.trim();
        if (!title) {
          alert("사안 제목을 입력해 주세요.");
          return;
        }
        const answers = {};
        document.querySelectorAll(".edit-ref-answer").forEach(ta => {
          answers[ta.dataset.key] = ta.value.trim();
        });
        window.appStore.updateReflection(studentNum, docId, { title, answers });
        editingReflectionId = null;
        loadStudentDetails(studentNum);
        showToast("성찰문 내용이 수정되었습니다.", "success");
      });
    });

    // 삭제
    document.querySelectorAll(".btn-delete-ref").forEach(btn => {
      btn.addEventListener("click", () => {
        const docId = btn.dataset.docId;
        if (confirm("이 성찰문 기록을 삭제하시겠습니까? 삭제 후 되돌릴 수 없습니다.")) {
          window.appStore.deleteReflection(studentNum, docId);
          loadStudentDetails(studentNum);
          renderStudentList();
          showToast("성찰문 기록이 삭제되었습니다.", "info");
        }
      });
    });
  }

  // 자기평가 상세 렌더링
  function renderAssessmentDetails(assessments, studentNum) {
    assessmentDetailsContainer.innerHTML = "";

    if (!assessments || assessments.length === 0) {
      assessmentDetailsContainer.innerHTML = `
        <div class="card" style="text-align: center; padding: 2.5rem; color: var(--text-muted); background: #FAF9F6;">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">📝</div>
          <div style="font-weight: 600; font-size: 1rem; color: var(--text-secondary);">아직 제출된 자기평가가 없습니다.</div>
          <div style="font-size: 0.85rem; margin-top: 0.25rem;">상단의 '자기평가 기간 열림' 상태를 확인하고 학생에게 작성을 안내하세요.</div>
        </div>
      `;
      return;
    }

    assessments.forEach(ass => {
      const dateStr = new Date(ass.createdAt).toLocaleDateString("ko-KR", {
        year: "numeric", month: "long", day: "numeric"
      });

      const card = document.createElement("div");
      card.className = "card";
      card.style.background = "#FCFBF9";

      const isEditing = editingAssessmentId === ass.id;
      let bodyHtml;

      if (isEditing) {
        const strengthFieldsHtml = ass.strengths.map((s, idx) => `
          <div style="background: #FFF; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 0.85rem; margin-bottom: 0.6rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
              <span class="badge-tag" style="background: var(--color-primary); color: #FFF; font-size: 0.82rem;">장점 # ${escapeHtmlText(s.tag)}</span>
              <label style="font-size: 0.76rem; color: var(--color-danger); display: flex; align-items: center; gap: 0.3rem; cursor: pointer;">
                <input type="checkbox" class="remove-strength-chk" data-idx="${idx}"> 이 항목 삭제
              </label>
            </div>
            <textarea class="form-textarea edit-strength-reason" data-idx="${idx}" style="min-height: 60px;">${escapeHtmlText(s.reason)}</textarea>
          </div>
        `).join("");

        const growthFieldsHtml = (ass.growthAreas || []).map((g, idx) => `
          <div style="background: #FFF; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 0.85rem; margin-bottom: 0.6rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
              <span class="badge-tag" style="background: var(--color-warning); color: #FFF; font-size: 0.82rem;">보완할 점 # ${escapeHtmlText(g.tag)}</span>
              <label style="font-size: 0.76rem; color: var(--color-danger); display: flex; align-items: center; gap: 0.3rem; cursor: pointer;">
                <input type="checkbox" class="remove-growth-chk" data-idx="${idx}"> 이 항목 삭제
              </label>
            </div>
            <textarea class="form-textarea edit-growth-reason" data-idx="${idx}" style="min-height: 60px;">${escapeHtmlText(g.reason)}</textarea>
          </div>
        `).join("");

        bodyHtml = `
          <div style="margin-bottom: 1.25rem;">
            <div style="font-weight: 700; font-size: 0.9rem; color: var(--color-primary); margin-bottom: 0.5rem;">🌟 장점 (내용 수정 또는 항목 삭제)</div>
            ${strengthFieldsHtml || '<div style="font-size:0.85rem; color: var(--text-muted);">등록된 장점이 없습니다.</div>'}
          </div>
          <div style="margin-bottom: 1rem;">
            <div style="font-weight: 700; font-size: 0.9rem; color: var(--color-warning); margin-bottom: 0.5rem;">🌱 보완할 점 (내용 수정 또는 항목 삭제)</div>
            ${growthFieldsHtml || '<div style="font-size:0.85rem; color: var(--text-muted);">등록된 보완할 점이 없습니다.</div>'}
          </div>
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button class="btn btn-outline btn-sm btn-cancel-edit-assess" data-doc-id="${ass.id}">취소</button>
            <button class="btn btn-primary btn-sm btn-save-edit-assess" data-doc-id="${ass.id}">💾 수정 내용 저장</button>
          </div>
        `;
      } else {
        let strengthsHtml = ass.strengths.map(s => `
          <div style="background: #FFF; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 0.85rem; margin-bottom: 0.6rem;">
            <span class="badge-tag" style="background: var(--color-primary); color: #FFF; font-size: 0.82rem;">장점 # ${s.tag}</span>
            <div style="font-size: 0.94rem; color: var(--text-primary); margin-top: 0.4rem; line-height: 1.5;">${s.reason}</div>
          </div>
        `).join("");

        let growthHtml = ass.growthAreas && ass.growthAreas.length > 0 ? ass.growthAreas.map(g => `
          <div style="background: #FFF; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 0.85rem; margin-bottom: 0.6rem;">
            <span class="badge-tag" style="background: var(--color-warning); color: #FFF; font-size: 0.82rem;">보완할 점 # ${g.tag}</span>
            <div style="font-size: 0.94rem; color: var(--text-primary); margin-top: 0.4rem; line-height: 1.5;">${g.reason}</div>
          </div>
        `).join("") : `<div style="font-size: 0.88rem; color: var(--text-muted); padding: 0.5rem 0;">선택한 보완점 없음 (모범적인 학교생활)</div>`;

        bodyHtml = `
          <div style="margin-bottom: 1.25rem;">
            <div style="font-weight: 700; font-size: 0.9rem; color: var(--color-primary); margin-bottom: 0.5rem;">🌟 학생이 선택한 장점</div>
            ${strengthsHtml}
          </div>
          <div style="margin-bottom: 1rem;">
            <div style="font-weight: 700; font-size: 0.9rem; color: var(--color-warning); margin-bottom: 0.5rem;">🌱 학생이 보완하고 싶다고 밝힌 점</div>
            ${growthHtml}
          </div>
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end; border-top: 1px dashed var(--color-border); padding-top: 0.75rem;">
            <button class="btn btn-outline btn-sm btn-edit-assess" data-doc-id="${ass.id}">✏️ 내용 수정</button>
            <button class="btn btn-danger btn-sm btn-delete-assess" data-doc-id="${ass.id}">🗑️ 삭제</button>
          </div>
        `;
      }

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border-light); padding-bottom: 0.6rem; margin-bottom: 1rem;">
          <h4 style="font-size: 1.05rem; color: var(--color-primary);">
            학생 자기평가 및 다짐 기록
            ${ass.editedAt ? `<span style="font-size: 0.7rem; font-weight: 500; color: var(--text-muted); margin-left: 0.4rem;">(교사 수정됨)</span>` : ''}
          </h4>
          <span style="font-size: 0.8rem; color: var(--text-muted);">제출일: ${dateStr}</span>
        </div>
        ${bodyHtml}
      `;

      assessmentDetailsContainer.appendChild(card);
    });

    // 수정 시작
    document.querySelectorAll(".btn-edit-assess").forEach(btn => {
      btn.addEventListener("click", () => {
        editingAssessmentId = btn.dataset.docId;
        loadStudentDetails(studentNum);
      });
    });

    // 수정 취소
    document.querySelectorAll(".btn-cancel-edit-assess").forEach(btn => {
      btn.addEventListener("click", () => {
        editingAssessmentId = null;
        loadStudentDetails(studentNum);
      });
    });

    // 수정 내용 저장
    document.querySelectorAll(".btn-save-edit-assess").forEach(btn => {
      btn.addEventListener("click", () => {
        const docId = btn.dataset.docId;
        const original = assessments.find(a => a.id === docId);
        if (!original) return;

        const newStrengths = [];
        document.querySelectorAll(".edit-strength-reason").forEach(ta => {
          const idx = parseInt(ta.dataset.idx, 10);
          const removeChk = document.querySelector(`.remove-strength-chk[data-idx="${idx}"]`);
          if (removeChk && removeChk.checked) return;
          newStrengths.push({ tag: original.strengths[idx].tag, reason: ta.value.trim() });
        });
        if (newStrengths.length === 0) {
          alert("장점은 최소 1개 이상 남아있어야 합니다.");
          return;
        }

        const newGrowth = [];
        document.querySelectorAll(".edit-growth-reason").forEach(ta => {
          const idx = parseInt(ta.dataset.idx, 10);
          const removeChk = document.querySelector(`.remove-growth-chk[data-idx="${idx}"]`);
          if (removeChk && removeChk.checked) return;
          newGrowth.push({ tag: original.growthAreas[idx].tag, reason: ta.value.trim() });
        });

        window.appStore.updateSelfAssessment(studentNum, docId, { strengths: newStrengths, growthAreas: newGrowth });
        editingAssessmentId = null;
        loadStudentDetails(studentNum);
        showToast("자기평가 내용이 수정되었습니다.", "success");
      });
    });

    // 삭제
    document.querySelectorAll(".btn-delete-assess").forEach(btn => {
      btn.addEventListener("click", () => {
        const docId = btn.dataset.docId;
        if (confirm("이 자기평가 기록을 삭제하시겠습니까? 삭제 후 되돌릴 수 없습니다.")) {
          window.appStore.deleteSelfAssessment(studentNum, docId);
          loadStudentDetails(studentNum);
          renderStudentList();
          showToast("자기평가 기록이 삭제되었습니다.", "info");
        }
      });
    });
  }

  // 행발 초안 자동 생성 동작
  function setupDraftActions() {
    btnGenerateDraft.addEventListener("click", () => {
      generateDraftForActiveStudent();
    });

    btnRegenerateDraft.addEventListener("click", () => {
      generateDraftForActiveStudent();
    });

    btnCopyDraft.addEventListener("click", () => {
      const text = txtDraftFull.value.trim();
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        showToast("생기부 초안이 클립보드에 복사되었습니다. (NEIS에 바로 붙여넣기 가능)", "success");
      }).catch(() => {
        txtDraftFull.select();
        document.execCommand("copy");
        showToast("초안이 복사되었습니다.", "success");
      });
    });

    txtDraftFull.addEventListener("input", () => {
      updateCharCount();
    });
  }

  function generateDraftForActiveStudent() {
    const summary = window.appStore.getStudentSummary(currentActiveStudent);
    const draftResult = window.RecordDraftGenerator.generateDraft(summary);

    // 모드 뱃지 및 알림 설정
    draftModeBadge.textContent = draftResult.mode === "3:1" ? "3:1 구성 (장점 3 + 완곡 보완점 1)" : "4:0 구성 (장점 4 - 모범 학생)";
    draftModeBadge.style.backgroundColor = draftResult.mode === "3:1" ? "var(--color-primary)" : "var(--color-success)";
    draftSummaryNotice.textContent = draftResult.summary;

    // 문장별 근거 매핑 목록 렌더링
    draftSentenceList.innerHTML = "";
    draftResult.sentences.forEach((s, idx) => {
      const row = document.createElement("div");
      row.className = "draft-sentence-row";
      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span class="draft-badge ${s.type === 'growth' ? 'growth' : ''}">
            ${s.type === 'growth' ? '🌱 ' : '🌟 '} ${s.sourceLabel}
          </span>
          <span style="font-size: 0.78rem; color: var(--text-muted);">${s.sourceDetail}</span>
        </div>
        <div style="font-size: 0.95rem; color: var(--text-primary); line-height: 1.55; padding-left: 0.5rem;">
          ${s.text}
        </div>
      `;
      draftSentenceList.appendChild(row);
    });

    // 종합 텍스트 바인딩
    txtDraftFull.value = draftResult.fullText;
    updateCharCount();

    // 화면 펼치기 및 스크롤
    draftSection.style.display = "block";
    draftSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
    showToast(`${currentActiveStudent}번 학생의 행발 초안이 성공적으로 생성되었습니다.`, "success");
  }

  function updateCharCount() {
    const len = txtDraftFull.value.length;
    // 대략 바이트(한글 3바이트 또는 공백 포함) 계산 안내
    charCountLabel.textContent = `${len}자 (공백 포함)`;
  }

  // 토스트
  function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = "toast";
    if (type === "success") toast.style.backgroundColor = "var(--color-success)";
    if (type === "danger") toast.style.backgroundColor = "var(--color-danger)";
    if (type === "warning") toast.style.backgroundColor = "var(--color-warning)";
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }
});
