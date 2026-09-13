/**
 * 학생 포털 로직 (출석번호 + PIN 인증, 성찰문 작성, 자기평가, 기록 열람)
 */

document.addEventListener("DOMContentLoaded", () => {
  // DOM 요소 참조
  const authSection = document.getElementById("authSection");
  const selectNumberStep = document.getElementById("selectNumberStep");
  const enterPinStep = document.getElementById("enterPinStep");
  const studentGrid = document.getElementById("studentGrid");
  const classNameBadge = document.getElementById("classNameBadge");
  const classroomMissingNotice = document.getElementById("classroomMissingNotice");
  const studentDashboardSection = document.getElementById("studentDashboardSection");
  const reflectionFormSection = document.getElementById("reflectionFormSection");
  const selfAssessmentSection = document.getElementById("selfAssessmentSection");
  const historySection = document.getElementById("historySection");
  const studentHeaderInfo = document.getElementById("studentHeaderInfo");
  const currentStudentLabel = document.getElementById("currentStudentLabel");
  const btnStudentLogout = document.getElementById("btnStudentLogout");

  // PIN 입력 관련
  const selectedStudentBadge = document.getElementById("selectedStudentBadge");
  const pinBoxes = [
    document.getElementById("pinBox0"),
    document.getElementById("pinBox1"),
    document.getElementById("pinBox2"),
    document.getElementById("pinBox3")
  ];
  const keypadBtns = document.querySelectorAll(".keypad-btn[data-num]");
  const btnKeypadClear = document.getElementById("btnKeypadClear");
  const btnKeypadBackspace = document.getElementById("btnKeypadBackspace");
  const btnBackToNumber = document.getElementById("btnBackToNumber");

  // 성찰문 관련
  const reflectionTypeSelector = document.getElementById("reflectionTypeSelector");
  const reflectionInputsStep = document.getElementById("reflectionInputsStep");
  const chooseTypeConflict = document.getElementById("chooseTypeConflict");
  const chooseTypePersonal = document.getElementById("chooseTypePersonal");
  const dynamicQuestionsContainer = document.getElementById("dynamicQuestionsContainer");
  const currentReflectionTypeBadge = document.getElementById("currentReflectionTypeBadge");
  const formReflectionSubmit = document.getElementById("formReflectionSubmit");
  const btnBackFromReflectionType = document.getElementById("btnBackFromReflectionType");
  const btnCancelReflection = document.getElementById("btnCancelReflection");
  const btnBackToTypeSelection = document.getElementById("btnBackToTypeSelection");

  // 자기평가 관련
  const strengthTagsCloud = document.getElementById("strengthTagsCloud");
  const growthTagsCloud = document.getElementById("growthTagsCloud");
  const strengthReasonsContainer = document.getElementById("strengthReasonsContainer");
  const growthReasonsContainer = document.getElementById("growthReasonsContainer");
  const formAssessmentSubmit = document.getElementById("formAssessmentSubmit");
  const btnBackFromAssessment = document.getElementById("btnBackFromAssessment");
  const selfIntroStatusBadge = document.getElementById("selfIntroStatusBadge");

  // 메뉴 버튼
  const menuStartReflection = document.getElementById("menuStartReflection");
  const menuStartSelfAssessment = document.getElementById("menuStartSelfAssessment");
  const btnGoAssessment = document.getElementById("btnGoAssessment");
  const menuViewHistory = document.getElementById("menuViewHistory");
  const btnBackFromHistory = document.getElementById("btnBackFromHistory");
  const historyContentArea = document.getElementById("historyContentArea");

  // 상태 변수
  let classroomId = window.OllyApp ? window.OllyApp.classroomIdFromUrl : null;
  let classroomName = "";
  let selectedStudentNum = null;
  let enteredPin = "";
  let activeReflectionType = "conflict"; // 'conflict' or 'personal'
  let selectedStrengths = new Set();
  let selectedGrowths = new Set();

  // 상수 데이터: 성찰문 질문별 검증 규칙 (질문 문구 자체는 js/reflection-questions.js 공통 정의 + 교사 설정을 사용)
  const CONFLICT_VALIDATORS = {
    q1: (val) => {
      const timeRegex = /(교시|시간|요일|아침|점심|쉬는|방과|어제|오늘|그저께|지난|월|화|수|목|금)/;
      const placeRegex = /(교실|복도|운동장|체육관|급식실|화장실|계단|도서관|음악실|과학실|놀이터|강당|사물함|자리)/;
      const hasTime = timeRegex.test(val);
      const hasPlace = placeRegex.test(val);
      if (!hasTime && !hasPlace) {
        return { valid: false, msg: "언제(몇 교시, 쉬는 시간 등)와 어디서(교실, 운동장 등) 일어났는지 시간과 장소를 모두 포함해 주세요." };
      }
      if (!hasTime) {
        return { valid: false, msg: "언제(몇 교시, 쉬는 시간, 점심시간 등) 일어난 일인지 시간을 함께 적어주세요." };
      }
      if (!hasPlace) {
        return { valid: false, msg: "어디서(교실, 운동장, 복도 등) 일어난 일인지 장소를 함께 적어주세요." };
      }
      return { valid: true, msg: "시간, 장소, 상황이 잘 표현되었습니다." };
    },
    q2: (val) => {
      const selfWordRegex = /(내|저|소리|화|짜증|욕|밀|때린|던진|놀린|따진|고집|양보|인정|잘못|행동|말|실수|참지|배려|욱해|우긴)/;
      if (!selfWordRegex.test(val)) {
        return { valid: false, msg: "상대방 탓만 하기보다, 내가 한 말이나 행동 중 어떤 점이 잘못되었는지 구체적으로 적어주세요." };
      }
      return { valid: true, msg: "자신의 행동을 솔직하게 돌아보았습니다." };
    },
    q3: (val) => {
      const emotionRegex = /(속상|화|억울|서운|기분|마음|당황|슬펐|상처|무시|놀림|답답|기분 나|불쾌)/;
      if (!emotionRegex.test(val)) {
        return { valid: false, msg: "상대방의 행동 때문에 내가 느낀 구체적인 감정(속상함, 억울함, 서운함 등)을 함께 적어주세요." };
      }
      return { valid: true, msg: "솔직한 감정과 이유가 잘 표현되었습니다." };
    },
    q4: (val) => {
      const altActionRegex = /(했을|않고|말하고|말했을|참고|물어보고|선생님|심호흡|양보|사과|차분|대화|기다렸|배려|대신)/;
      if (!altActionRegex.test(val)) {
        return { valid: false, msg: "화를 내는 대신 취할 수 있었던 바람직한 대처 방법(~했을 텐데, 양보, 차분한 대화 등)을 적어주세요." };
      }
      return { valid: true, msg: "성숙한 대처 다짐이 잘 작성되었습니다." };
    },
    q5: (val) => {
      const requestRegex = /(좋겠|바란|해주|부탁|사과|오해|이야기|대화|양보|조심|사이좋게|들어주|약속|풀었으면)/;
      if (!requestRegex.test(val)) {
        return { valid: false, msg: "상대 친구에게 바라는 점(사과, 경청, 규칙 지키기 등)을 구체적인 바람 표현(~해주면 좋겠다 등)으로 적어주세요." };
      }
      return { valid: true, msg: "관계 회복을 위한 바람이 잘 드러났습니다." };
    }
  };

  const PERSONAL_VALIDATORS = {
    q1: (val) => {
      const timeRegex = /(교시|시간|요일|아침|점심|쉬는|방과|어제|오늘|월|화|수|목|금)/;
      const placeRegex = /(교실|복도|운동장|체육관|급식실|화장실|자리)/;
      if (!timeRegex.test(val) || !placeRegex.test(val)) {
        return { valid: false, msg: "언제(시간)와 어디서(장소) 일어난 일인지 구체적으로 포함해 주세요." };
      }
      return { valid: true, msg: "시간과 장소가 잘 명시되었습니다." };
    },
    q2: (val) => {
      return { valid: true, msg: "상황이 성실하게 작성되었습니다." };
    },
    q3: (val) => {
      const reasonRegex = /(이유|때문|생각|호기심|지루|어려|순간|마음|하고 싶)/;
      if (!reasonRegex.test(val)) {
        return { valid: false, msg: "그런 행동을 하게 된 이유나 당시의 마음 상태를 솔직히 적어주세요." };
      }
      return { valid: true, msg: "이유가 솔직하게 설명되었습니다." };
    },
    q4: (val) => {
      const impactRegex = /(선생님|친구|짝꿍|수업|방해|집중|분위기|피해|영향)/;
      if (!impactRegex.test(val)) {
        return { valid: false, msg: "선생님이나 친구들, 수업 분위기에 어떤 영향을 미쳤는지 적어주세요." };
      }
      return { valid: true, msg: "행동의 영향이 잘 분석되었습니다." };
    },
    q5: (val) => {
      return { valid: true, msg: "잘못된 점을 올바르게 성찰하였습니다." };
    },
    q6: (val) => {
      const pledgeRegex = /(않겠|하겠|실천|다짐|노력|손을 들|질문|주의|지키)/;
      if (!pledgeRegex.test(val)) {
        return { valid: false, msg: "앞으로 어떻게 행동할 것인지 구체적인 실천 다짐(~하겠다)을 적어주세요." };
      }
      return { valid: true, msg: "앞으로의 실천 다짐이 훌륭합니다." };
    }
  };

  // 교사가 설정한 문구(js/reflection-questions.js)와 검증 로직을 병합하여 최종 질문 배열 생성
  function getReflectionQuestions(type) {
    const validators = type === "conflict" ? CONFLICT_VALIDATORS : PERSONAL_VALIDATORS;
    return window.getReflectionQuestionTexts(type).map(q => ({
      ...q,
      validate: validators[q.key]
    }));
  }


  const STRENGTH_KEYWORDS = [
    "배려심", "책임감", "솔직함", "성실성", "경청", 
    "협동심", "적극성", "정리정돈", "주도성", "예의바름", "끈기", "창의성"
  ];

  const GROWTH_KEYWORDS = [
    "감정 조절", "시간 약속", "수업 집중", "차분한 대화", 
    "규칙 준수", "발표 자신감", "친구 배려", "주변 정리"
  ];

  // 초기화 실행
  initApp();

  function initApp() {
    setupKeypadEvents();
    setupReflectionFlow();
    setupSelfAssessmentFlow();
    checkExistingSession();
    setupClassroomEntry();
  }

  // 학급 전용 링크(?class=학급ID)로 접속했는지 확인하고, 학급명/학생 수를 반영해 접속 화면을 준비
  async function setupClassroomEntry() {
    if (!classroomId) {
      classroomMissingNotice.style.display = "block";
      studentGrid.style.display = "none";
      classNameBadge.style.display = "none";
      return;
    }
    const info = await window.appStore.getClassroomPublicInfo(classroomId);
    if (!info) {
      classroomMissingNotice.style.display = "block";
      studentGrid.style.display = "none";
      classNameBadge.style.display = "none";
      return;
    }
    classroomName = info.className || "";
    classNameBadge.textContent = classroomName;
    classNameBadge.style.display = classroomName ? "inline-block" : "none";
    classroomMissingNotice.style.display = "none";
    studentGrid.style.display = "grid";
    renderStudentGrid(info.totalStudents);
  }

  // 시스템 설정 반영 (자기평가 오픈 여부 등)
  function renderSystemStatus() {
    const settings = window.appStore.getSystemSettings();
    if (settings && !settings.selfIntroOpen) {
      selfIntroStatusBadge.textContent = "현재 마감됨";
      selfIntroStatusBadge.style.backgroundColor = "var(--color-danger-bg)";
      selfIntroStatusBadge.style.color = "var(--color-danger)";
      btnGoAssessment.disabled = true;
      btnGoAssessment.textContent = "제출 기간 아님";
    } else {
      selfIntroStatusBadge.textContent = "제출 가능";
      selfIntroStatusBadge.style.backgroundColor = "var(--color-success-bg)";
      selfIntroStatusBadge.style.color = "var(--color-success)";
      btnGoAssessment.disabled = false;
      btnGoAssessment.textContent = "작성하기 →";
    }
  }

  // 1. 학생 출석번호 그리드 렌더링
  function renderStudentGrid(totalStudents) {
    const total = totalStudents || 23;
    studentGrid.innerHTML = "";
    for (let i = 1; i <= total; i++) {
      const btn = document.createElement("button");
      btn.className = "student-btn";
      btn.type = "button";
      btn.textContent = String(i);
      btn.addEventListener("click", () => selectStudentNumber(i));
      studentGrid.appendChild(btn);
    }
  }

  function selectStudentNumber(num) {
    selectedStudentNum = num;
    enteredPin = "";
    updatePinDisplay();
    selectedStudentBadge.textContent = `출석번호 ${num}번`;

    selectNumberStep.style.display = "none";
    enterPinStep.style.display = "block";
  }

  btnBackToNumber.addEventListener("click", () => {
    selectedStudentNum = null;
    enteredPin = "";
    enterPinStep.style.display = "none";
    selectNumberStep.style.display = "block";
  });

  // PIN 키패드 이벤트
  function setupKeypadEvents() {
    keypadBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        if (enteredPin.length < 4) {
          enteredPin += btn.dataset.num;
          updatePinDisplay();
          if (enteredPin.length === 4) {
            handlePinSubmit();
          }
        }
      });
    });

    btnKeypadClear.addEventListener("click", () => {
      enteredPin = "";
      updatePinDisplay();
    });

    btnKeypadBackspace.addEventListener("click", () => {
      if (enteredPin.length > 0) {
        enteredPin = enteredPin.slice(0, -1);
        updatePinDisplay();
      }
    });

    // 물리 키보드 숫자 입력 지원
    document.addEventListener("keydown", (e) => {
      if (enterPinStep.style.display !== "none") {
        if (e.key >= "0" && e.key <= "9") {
          if (enteredPin.length < 4) {
            enteredPin += e.key;
            updatePinDisplay();
            if (enteredPin.length === 4) {
              handlePinSubmit();
            }
          }
        } else if (e.key === "Backspace") {
          enteredPin = enteredPin.slice(0, -1);
          updatePinDisplay();
        } else if (e.key === "Escape") {
          btnBackToNumber.click();
        }
      }
    });
  }

  function updatePinDisplay() {
    for (let i = 0; i < 4; i++) {
      if (i < enteredPin.length) {
        pinBoxes[i].textContent = enteredPin[i];
        pinBoxes[i].classList.add("filled");
      } else {
        pinBoxes[i].textContent = "·";
        pinBoxes[i].classList.remove("filled");
      }
    }
  }

  async function handlePinSubmit() {
    let result;
    try {
      result = await window.appStore.verifyStudentLogin(classroomId, selectedStudentNum, enteredPin);
    } catch (err) {
      console.error("[OLLY] 로그인 처리 중 예외 발생:", err);
      result = { success: false, message: "예상치 못한 오류가 발생했습니다: " + (err && err.message ? err.message : err) };
    }
    if (result.success) {
      showToast(`${selectedStudentNum}번 학생으로 접속되었습니다.`, "success");
      enterPinStep.style.display = "none";
      authSection.style.display = "none";
      showDashboard(result.session);
    } else {
      showToast(result.message || "4자리 코드가 일치하지 않습니다.", "danger");
      enteredPin = "";
      updatePinDisplay();
    }
  }

  function checkExistingSession() {
    window.appStore.restoreSession().then((session) => {
      if (session && session.role === "student") {
        classroomId = session.classroomId || classroomId;
        authSection.style.display = "none";
        showDashboard(session);
      }
    });
  }

  function showDashboard(session) {
    selectedStudentNum = session.studentNum;
    const settings = window.appStore.getSystemSettings();
    classroomName = (settings && settings.className) || classroomName;
    currentStudentLabel.textContent = classroomName
      ? `${classroomName} ${session.studentNum}번 학생`
      : `${session.studentNum}번 학생`;
    studentHeaderInfo.style.display = "flex";
    studentDashboardSection.style.display = "block";
    renderSystemStatus();
  }

  btnStudentLogout.addEventListener("click", () => {
    window.appStore.logout();
    studentHeaderInfo.style.display = "none";
    studentDashboardSection.style.display = "none";
    reflectionFormSection.style.display = "none";
    selfAssessmentSection.style.display = "none";
    historySection.style.display = "none";
    selectNumberStep.style.display = "block";
    enterPinStep.style.display = "none";
    authSection.style.display = "block";
    selectedStudentNum = null;
    enteredPin = "";
    showToast("접속을 종료하였습니다.", "info");
    if (window.OllyApp) window.OllyApp.showView("landing");
  });

  // 성찰문 입력 폼 완전 초기화 (제목 + 동적 질문 답변 모두 비움)
  function resetReflectionForm() {
    formReflectionSubmit.reset();
    dynamicQuestionsContainer.innerHTML = "";
  }

  // 2. 성찰문 작성 플로우
  function setupReflectionFlow() {
    menuStartReflection.addEventListener("click", () => {
      resetReflectionForm();
      studentDashboardSection.style.display = "none";
      reflectionFormSection.style.display = "block";
      reflectionTypeSelector.style.display = "block";
      reflectionInputsStep.style.display = "none";
    });

    btnBackFromReflectionType.addEventListener("click", () => {
      resetReflectionForm();
      reflectionFormSection.style.display = "none";
      studentDashboardSection.style.display = "block";
    });

    chooseTypeConflict.addEventListener("click", () => {
      startReflectionInputs("conflict");
    });

    chooseTypePersonal.addEventListener("click", () => {
      startReflectionInputs("personal");
    });

    btnBackToTypeSelection.addEventListener("click", () => {
      resetReflectionForm();
      reflectionInputsStep.style.display = "none";
      reflectionTypeSelector.style.display = "block";
    });

    btnCancelReflection.addEventListener("click", () => {
      if (confirm("작성 중인 성찰문 내용이 저장되지 않습니다. 취소하시겠습니까?")) {
        resetReflectionForm();
        reflectionFormSection.style.display = "none";
        studentDashboardSection.style.display = "block";
      }
    });

    formReflectionSubmit.addEventListener("submit", (e) => {
      e.preventDefault();
      saveReflection();
    });
  }

  function startReflectionInputs(type) {
    activeReflectionType = type;
    reflectionTypeSelector.style.display = "none";
    reflectionInputsStep.style.display = "block";

    currentReflectionTypeBadge.textContent = type === "conflict" ? "🤝 친구와 다투었을 때 (갈등형)" : "🧘 혼자 잘못한 일이 있을 때 (개인형)";
    currentReflectionTypeBadge.className = `badge-tag ${type === 'conflict' ? 'warning' : 'info'}`;

    renderReflectionQuestions(type);
  }

  // 공통 무성의 입력 필터 (단답, 무의미 도배, 반복 문자 등)
  function checkGeneralQuality(val, minLength) {
    const trimmed = val.trim();
    if (!trimmed) {
      return { valid: false, badge: "invalid", msg: `내용을 입력해 주세요 (최소 ${minLength}자 이상).` };
    }

    // 자음/모음 연속 도배 (예: ㅋㅋㅋ, ㅎㅎㅎ, ㅠㅠㅠ, ㄱㄱㄱ)
    if (/[ㄱ-ㅎㅏ-ㅣ]{3,}/.test(trimmed)) {
      return { valid: false, badge: "invalid", msg: "자음이나 모음(ㅋㅋ, ㅠㅠ 등)을 반복하지 말고 차분한 문장으로 적어주세요." };
    }

    // 동일 문자 4회 이상 연속 반복 (예: 아아아아, .....)
    if (/(.)\1{3,}/.test(trimmed)) {
      return { valid: false, badge: "invalid", msg: "같은 글자를 연속해서 반복 입력하지 마세요." };
    }

    // 대표적인 무성의 단답형 블랙리스트
    const blacklist = [
      "몰라", "몰라요", "모름", "모르겠음", "모르겠어요",
      "그냥", "그냥요", "없음", "없어요", "없다",
      "잘못했음", "잘못했어요", "미안", "미안해", "미안해요", "죄송", "죄송합니다",
      "네", "아니오", "싫어", "싫어요", "기억안남", "기억안나요", "글쎄", "글쎄요"
    ];
    // 정확히 단답으로만 작성한 경우
    const cleanWord = trimmed.replace(/[^가-힣a-zA-Z0-9]/g, "");
    if (blacklist.includes(cleanWord)) {
      return { valid: false, badge: "invalid", msg: "한두 단어의 짧은 답변은 성찰문으로 인정되지 않습니다. 구체적인 상황과 생각을 적어주세요." };
    }

    // 글자 수 검증
    if (trimmed.length < minLength) {
      return { valid: false, badge: "invalid", msg: `아직 내용이 부족합니다 (현재 ${trimmed.length}자 / 권장 ${minLength}자 이상).` };
    }

    // 어절(단어) 수 검증 (최소 3단어 이상)
    const words = trimmed.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 3) {
      return { valid: false, badge: "warning", msg: "조금 더 구체적으로 문장을 이어 적어주세요 (단어 3개 이상 필요)." };
    }

    return { valid: true, badge: "valid", msg: "작성 양호" };
  }

  // 개별 질문 종합 유효성 검사 (공통 성실도 + 질문별 필수 내용)
  function validateQuestionInput(q, val) {
    const genCheck = checkGeneralQuality(val, q.minLength);
    if (!genCheck.valid) {
      return genCheck;
    }

    if (q.validate) {
      const fieldCheck = q.validate(val.trim());
      if (!fieldCheck.valid) {
        return { valid: false, badge: "warning", msg: fieldCheck.msg };
      }
      return { valid: true, badge: "valid", msg: fieldCheck.msg || "정직하고 구체적으로 작성되었습니다." };
    }

    return { valid: true, badge: "valid", msg: "정직하고 구체적으로 작성되었습니다." };
  }

  function renderReflectionQuestions(type) {
    const questions = getReflectionQuestions(type);
    dynamicQuestionsContainer.innerHTML = "";

    questions.forEach((q, idx) => {
      const group = document.createElement("div");
      group.className = "form-group";
      group.style.marginBottom = "1.5rem";
      group.innerHTML = `
        <label class="form-label" for="ans_${q.key}" style="font-size: 1rem; color: var(--color-primary); font-weight: 700; margin-bottom: 0.35rem;">
          ${q.label} <span class="required">*</span>
        </label>
        
        <div class="guide-box">
          <div class="guide-title">${q.guideTitle}</div>
          <div>${q.guideExample}</div>
        </div>

        <textarea id="ans_${q.key}" class="form-textarea reflection-q-input" data-key="${q.key}" placeholder="${q.placeholder}" style="min-height: 90px; line-height: 1.6;" required></textarea>

        <div class="validation-status" id="status_${q.key}">
          <span class="validation-badge invalid" id="badge_${q.key}">
            ⚠️ 내용 작성 필요
          </span>
          <span class="validation-msg" id="msg_${q.key}">
            최소 ${q.minLength}자 이상 필수 요소 포함
          </span>
        </div>
      `;
      dynamicQuestionsContainer.appendChild(group);

      // 실시간 입력 피드백 바인딩
      const textarea = group.querySelector(`#ans_${q.key}`);
      textarea.addEventListener("input", () => {
        updateFieldValidationUI(q, textarea.value);
      });
    });
  }

  function updateFieldValidationUI(q, value) {
    const badgeEl = document.getElementById(`badge_${q.key}`);
    const msgEl = document.getElementById(`msg_${q.key}`);
    const textareaEl = document.getElementById(`ans_${q.key}`);
    if (!badgeEl || !msgEl || !textareaEl) return;

    const result = validateQuestionInput(q, value);

    badgeEl.className = `validation-badge ${result.badge}`;
    if (result.badge === "valid") {
      badgeEl.innerHTML = "✅ 작성 완료";
      textareaEl.style.borderColor = "var(--color-success)";
    } else if (result.badge === "warning") {
      badgeEl.innerHTML = "⚠️ 보완 필요";
      textareaEl.style.borderColor = "var(--color-warning)";
    } else {
      badgeEl.innerHTML = "🔴 내용 부족";
      textareaEl.style.borderColor = "var(--color-danger)";
    }

    const charCount = value.trim().length;
    msgEl.innerHTML = `<strong>${charCount}자</strong> · ${result.msg}`;
  }

  function saveReflection() {
    const titleEl = document.getElementById("refTitle");
    const title = titleEl.value.trim();
    if (!title || title.length < 3) {
      alert("사안 제목을 구체적으로 3자 이상 입력해 주세요.");
      titleEl.focus();
      return;
    }

    const questions = getReflectionQuestions(activeReflectionType);
    const answers = {};
    const invalidItems = [];

    for (const q of questions) {
      const el = document.getElementById(`ans_${q.key}`);
      const val = el ? el.value : "";
      const check = validateQuestionInput(q, val);

      if (!check.valid) {
        invalidItems.push({
          question: q,
          element: el,
          message: check.msg
        });
      } else {
        answers[q.key] = val.trim();
      }
    }

    // 미흡한 항목이 있을 경우 제출 차단 및 친절한 보완 안내
    if (invalidItems.length > 0) {
      const firstInvalid = invalidItems[0];
      alert(`[보완 필요 안내]\n\n'${firstInvalid.question.label}' 항목의 내용이 부족합니다.\n\n👉 이유: ${firstInvalid.message}\n\n예시 가이드를 참고하여 구체적이고 정직하게 보완해 주세요.`);
      firstInvalid.element.scrollIntoView({ behavior: "smooth", block: "center" });
      firstInvalid.element.focus();
      return;
    }

    const newDoc = window.appStore.addReflection(selectedStudentNum, {
      type: activeReflectionType,
      title,
      answers
    });

    showToast("모든 항목이 정직하고 성실하게 검토되어 선생님께 제출되었습니다.", "success");
    resetReflectionForm();
    reflectionFormSection.style.display = "none";
    studentDashboardSection.style.display = "block";
  }

  // 3. 자기평가 플로우
  function setupSelfAssessmentFlow() {
    menuStartSelfAssessment.addEventListener("click", () => {
      const settings = window.appStore.getSystemSettings();
      if (settings && !settings.selfIntroOpen) {
        alert("현재는 자기평가 제출 기간이 아닙니다.");
        return;
      }
      openSelfAssessmentForm();
    });

    btnBackFromAssessment.addEventListener("click", () => {
      selfAssessmentSection.style.display = "none";
      studentDashboardSection.style.display = "block";
    });

    formAssessmentSubmit.addEventListener("submit", (e) => {
      e.preventDefault();
      saveSelfAssessment();
    });
  }

  function openSelfAssessmentForm() {
    studentDashboardSection.style.display = "none";
    selfAssessmentSection.style.display = "block";
    selectedStrengths.clear();
    selectedGrowths.clear();

    renderTagClouds();
    updateReasonInputs();
  }

  function renderTagClouds() {
    // 장점 태그 렌더링
    strengthTagsCloud.innerHTML = "";
    STRENGTH_KEYWORDS.forEach(tag => {
      const chip = document.createElement("div");
      chip.className = `tag-chip ${selectedStrengths.has(tag) ? 'selected' : ''}`;
      chip.textContent = `# ${tag}`;
      chip.addEventListener("click", () => toggleTag(tag, "strength"));
      strengthTagsCloud.appendChild(chip);
    });

    // 보완할 점 태그 렌더링
    growthTagsCloud.innerHTML = "";
    GROWTH_KEYWORDS.forEach(tag => {
      const chip = document.createElement("div");
      chip.className = `tag-chip ${selectedGrowths.has(tag) ? 'selected' : ''}`;
      chip.textContent = `# ${tag}`;
      chip.addEventListener("click", () => toggleTag(tag, "growth"));
      growthTagsCloud.appendChild(chip);
    });
  }

  function toggleTag(tag, type) {
    if (type === "strength") {
      if (selectedStrengths.has(tag)) {
        selectedStrengths.delete(tag);
      } else {
        if (selectedStrengths.size >= 3) {
          alert("장점 키워드는 최대 3개까지 선택할 수 있습니다.");
          return;
        }
        selectedStrengths.add(tag);
      }
    } else {
      if (selectedGrowths.has(tag)) {
        selectedGrowths.delete(tag);
      } else {
        if (selectedGrowths.size >= 2) {
          alert("보완할 점 키워드는 최대 2개까지 선택할 수 있습니다.");
          return;
        }
        selectedGrowths.add(tag);
      }
    }
    renderTagClouds();
    updateReasonInputs();
  }

  function updateReasonInputs() {
    // 장점 이유 입력창
    strengthReasonsContainer.innerHTML = "";
    if (selectedStrengths.size > 0) {
      selectedStrengths.forEach(tag => {
        const item = document.createElement("div");
        item.className = "card";
        item.style.padding = "1rem";
        item.style.marginBottom = "0.75rem";
        item.style.background = "#FAF8F5";
        item.innerHTML = `
          <label class="form-label" style="font-size: 0.9rem; color: var(--color-primary);">
            [${tag}] - 왜 그렇게 생각하는지 학교생활 속 구체적인 사례를 써보세요 <span class="required">*</span>
          </label>
          <textarea class="form-textarea strength-reason-input" data-tag="${tag}" style="min-height: 70px;" placeholder="예: 학급 청소 시간에... / 친구가 어려워할 때..." required></textarea>
        `;
        strengthReasonsContainer.appendChild(item);
      });
    }

    // 보완할 점 이유 입력창
    growthReasonsContainer.innerHTML = "";
    if (selectedGrowths.size > 0) {
      selectedGrowths.forEach(tag => {
        const item = document.createElement("div");
        item.className = "card";
        item.style.padding = "1rem";
        item.style.marginBottom = "0.75rem";
        item.style.background = "#FAF8F5";
        item.innerHTML = `
          <label class="form-label" style="font-size: 0.9rem; color: var(--color-warning);">
            [${tag}] - 어떤 점을 더 노력하고 싶은지 구체적으로 써보세요 <span class="required">*</span>
          </label>
          <textarea class="form-textarea growth-reason-input" data-tag="${tag}" style="min-height: 70px;" placeholder="예: 화가 날 때 심호흡을 하고..." required></textarea>
        `;
        growthReasonsContainer.appendChild(item);
      });
    }
  }

  function saveSelfAssessment() {
    if (selectedStrengths.size === 0) {
      alert("장점 키워드를 최소 1개 이상 선택해 주세요.");
      return;
    }

    const strengths = [];
    document.querySelectorAll(".strength-reason-input").forEach(el => {
      strengths.push({
        tag: el.dataset.tag,
        reason: el.value.trim()
      });
    });

    const growthAreas = [];
    document.querySelectorAll(".growth-reason-input").forEach(el => {
      growthAreas.push({
        tag: el.dataset.tag,
        reason: el.value.trim()
      });
    });

    window.appStore.saveSelfAssessment(selectedStudentNum, {
      strengths,
      growthAreas
    });

    showToast("자기평가 및 다짐이 성공적으로 제출되었습니다.", "success");
    selfAssessmentSection.style.display = "none";
    studentDashboardSection.style.display = "block";
  }

  // 4. 지난 기록 보기 플로우
  menuViewHistory.addEventListener("click", () => {
    studentDashboardSection.style.display = "none";
    historySection.style.display = "block";
    renderHistory();
  });

  btnBackFromHistory.addEventListener("click", () => {
    historySection.style.display = "none";
    studentDashboardSection.style.display = "block";
  });

  function renderHistory() {
    const summary = window.appStore.getStudentSummary(selectedStudentNum);
    historyContentArea.innerHTML = "";

    if (summary.reflections.length === 0 && summary.assessments.length === 0) {
      historyContentArea.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📖</div>
          <p>아직 제출된 성찰문이나 자기평가 기록이 없습니다.</p>
        </div>
      `;
      return;
    }

    // 성찰문 목록
    if (summary.reflections.length > 0) {
      const refTitle = document.createElement("h3");
      refTitle.style.cssText = "font-size: 1.1rem; color: var(--color-primary); margin: 1.5rem 0 1rem;";
      refTitle.textContent = `제출한 성찰문 (${summary.reflections.length}건)`;
      historyContentArea.appendChild(refTitle);

      const timeline = document.createElement("div");
      timeline.className = "timeline";

      summary.reflections.forEach(ref => {
        const item = document.createElement("div");
        item.className = "timeline-item";
        const dateStr = new Date(ref.createdAt).toLocaleDateString("ko-KR", {
          year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
        });

        let answersHtml = "";
        if (ref.answers) {
          const questions = getReflectionQuestions(ref.type);
          answersHtml = questions.map(q => `
            <div style="margin-bottom: 0.6rem;">
              <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-secondary);">${q.label}</div>
              <div style="font-size: 0.92rem; color: var(--text-primary); margin-top: 2px;">${ref.answers[q.key] || '-'}</div>
            </div>
          `).join("");
        }

        const teacherCommentHtml = ref.teacherComment ? `
          <div style="margin-top: 1rem; padding: 0.85rem; background: var(--color-primary-light); border-radius: var(--radius-md);">
            <div style="font-size: 0.8rem; font-weight: 700; color: var(--color-primary); margin-bottom: 3px;">선생님의 피드백 코멘트</div>
            <div style="font-size: 0.9rem; color: var(--text-primary);">${ref.teacherComment}</div>
          </div>
        ` : `
          <div style="margin-top: 0.75rem; font-size: 0.82rem; color: var(--text-muted);">선생님 피드백 확인 대기 중</div>
        `;

        item.innerHTML = `
          <div class="timeline-marker"></div>
          <div class="timeline-content">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span class="badge-tag">${ref.type === 'conflict' ? '갈등형 성찰문' : '개인형 성찰문'}</span>
              <span style="font-size: 0.8rem; color: var(--text-muted);">${dateStr}</span>
            </div>
            <h4 style="font-size: 1.05rem; color: var(--color-primary); margin-bottom: 0.75rem;">${ref.title || '성찰 기록'}</h4>
            <div style="background: #FAF8F5; padding: 0.85rem; border-radius: var(--radius-sm); border: 1px solid var(--color-border-light);">
              ${answersHtml}
            </div>
            ${teacherCommentHtml}
          </div>
        `;
        timeline.appendChild(item);
      });
      historyContentArea.appendChild(timeline);
    }

    // 자기평가 목록
    if (summary.assessments.length > 0) {
      const assessTitle = document.createElement("h3");
      assessTitle.style.cssText = "font-size: 1.1rem; color: var(--color-primary); margin: 2rem 0 1rem;";
      assessTitle.textContent = `제출한 자기평가 (${summary.assessments.length}건)`;
      historyContentArea.appendChild(assessTitle);

      summary.assessments.forEach(ass => {
        const dateStr = new Date(ass.createdAt).toLocaleDateString("ko-KR", {
          year: "numeric", month: "long", day: "numeric"
        });
        const card = document.createElement("div");
        card.className = "card";
        card.style.background = "#FAF8F5";

        let strengthsHtml = ass.strengths.map(s => `
          <div style="margin-bottom: 0.5rem;">
            <span class="badge-tag" style="background: var(--color-primary); color: #FFF;">장점: ${s.tag}</span>
            <span style="font-size: 0.9rem; margin-left: 0.5rem;">${s.reason}</span>
          </div>
        `).join("");

        let growthHtml = ass.growthAreas && ass.growthAreas.length > 0 ? ass.growthAreas.map(g => `
          <div style="margin-bottom: 0.5rem;">
            <span class="badge-tag" style="background: var(--color-warning); color: #FFF;">보완할 점: ${g.tag}</span>
            <span style="font-size: 0.9rem; margin-left: 0.5rem;">${g.reason}</span>
          </div>
        `).join("") : `<div style="font-size: 0.85rem; color: var(--text-muted);">선택한 보완점이 없습니다.</div>`;

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem;">
            <span style="font-weight: 700; color: var(--color-primary);">자기평가 기록</span>
            <span style="font-size: 0.8rem; color: var(--text-muted);">${dateStr}</span>
          </div>
          <div style="margin-bottom: 1rem;">${strengthsHtml}</div>
          <div>${growthHtml}</div>
        `;
        historyContentArea.appendChild(card);
      });
    }
  }

  // 간단 토스트 유틸
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
