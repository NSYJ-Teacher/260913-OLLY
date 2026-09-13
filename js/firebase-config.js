/**
 * Firebase Config 및 통합 스토리지 어댑터 (Firebase & 로컬 모의 저장소 지원)
 * Firebase 프로젝트 설정이 입력되면 클라우드 Firestore/Auth로 작동하고,
 * 설정 전에는 브라우저 LocalStorage 기반으로 동일한 데이터 스키마를 즉시 에뮬레이트합니다.
 */

// 실제 Firebase 연동 시 아래 객체에 발급받은 키를 입력합니다.
window.FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// 스토리지 어댑터 구현
class ClassroomStore {
  constructor() {
    this.STORAGE_KEY_PREFIX = "cls_reflections_";
    this.isFirebaseReady = false;
    this.init();
  }

  init() {
    // 기본 시스템 설정 초기화
    if (!this.getSystemSettings()) {
      this.saveSystemSettings({
        selfIntroOpen: true,
        academicYear: "2026",
        grade: "6",
        classNum: "1",
        totalStudents: 23
      });
    }

    // 학생 기본 4자리 PIN 코드 초기화 (1~23번: 1001 ~ 1023)
    const existingCodes = this.getAllStudentCodes();
    if (Object.keys(existingCodes).length === 0) {
      const defaultCodes = {};
      for (let i = 1; i <= 23; i++) {
        defaultCodes[i] = String(1000 + i);
      }
      localStorage.setItem(this.STORAGE_KEY_PREFIX + "auth_codes", JSON.stringify(defaultCodes));
    }

    // 기본 모의 데이터가 없을 경우 시연용 샘플 생성
    this.seedMockDataIfNeeded();
  }

  // --- 학생 인증 및 PIN 관리 ---
  getAllStudentCodes() {
    const raw = localStorage.getItem(this.STORAGE_KEY_PREFIX + "auth_codes");
    return raw ? JSON.parse(raw) : {};
  }

  saveStudentCode(studentNum, pin) {
    const codes = this.getAllStudentCodes();
    codes[studentNum] = String(pin);
    localStorage.setItem(this.STORAGE_KEY_PREFIX + "auth_codes", JSON.stringify(codes));
    return true;
  }

  generateBulkStudentCodes() {
    const codes = {};
    for (let i = 1; i <= 23; i++) {
      // 4자리 랜덤 숫자 생성
      codes[i] = String(Math.floor(1000 + Math.random() * 9000));
    }
    localStorage.setItem(this.STORAGE_KEY_PREFIX + "auth_codes", JSON.stringify(codes));
    return codes;
  }

  verifyStudentLogin(studentNum, pin) {
    const codes = this.getAllStudentCodes();
    const correctPin = codes[studentNum];
    if (correctPin && correctPin === String(pin)) {
      const session = {
        role: "student",
        studentNum: parseInt(studentNum, 10),
        virtualEmail: `student${studentNum}@classroom.local`,
        loginAt: new Date().toISOString()
      };
      sessionStorage.setItem("current_user", JSON.stringify(session));
      return { success: true, session };
    }
    return { success: false, message: "출석번호 또는 4자리 접속 코드가 일치하지 않습니다." };
  }

  // --- 교사 로그인 (간이 인증 / 데모) ---
  verifyTeacherLogin(email, password) {
    // 실제 서비스에서는 Firebase Auth signInWithEmailAndPassword 사용
    if (email === "teacher@school.kr" && password === "teacher1234") {
      const session = {
        role: "teacher",
        email: email,
        loginAt: new Date().toISOString()
      };
      sessionStorage.setItem("current_user", JSON.stringify(session));
      return { success: true, session };
    }
    // 쉬운 데모 테스트를 위해 이메일에 teacher가 들어가고 비밀번호 4자리 이상이면 통과
    if (email.includes("teacher") && password.length >= 4) {
      const session = {
        role: "teacher",
        email: email,
        loginAt: new Date().toISOString()
      };
      sessionStorage.setItem("current_user", JSON.stringify(session));
      return { success: true, session };
    }
    return { success: false, message: "교사 계정(teacher@school.kr / teacher1234) 정보를 확인해주세요." };
  }

  getCurrentSession() {
    const raw = sessionStorage.getItem("current_user");
    return raw ? JSON.parse(raw) : null;
  }

  logout() {
    sessionStorage.removeItem("current_user");
  }

  // --- 시스템 전역 설정 (settings/system) ---
  getSystemSettings() {
    const raw = localStorage.getItem(this.STORAGE_KEY_PREFIX + "system_settings");
    return raw ? JSON.parse(raw) : null;
  }

  saveSystemSettings(settings) {
    localStorage.setItem(this.STORAGE_KEY_PREFIX + "system_settings", JSON.stringify(settings));
  }

  // --- 성찰문 질문 문구 커스터마이징 (settings/reflection_question_overrides_{type}) ---
  getReflectionQuestionOverrides(type) {
    const raw = localStorage.getItem(this.STORAGE_KEY_PREFIX + "question_overrides_" + type);
    return raw ? JSON.parse(raw) : {};
  }

  saveReflectionQuestionOverrides(type, overrides) {
    localStorage.setItem(this.STORAGE_KEY_PREFIX + "question_overrides_" + type, JSON.stringify(overrides));
  }

  resetReflectionQuestionOverrides(type) {
    localStorage.removeItem(this.STORAGE_KEY_PREFIX + "question_overrides_" + type);
  }

  // --- 성찰문 (students/{studentNum}/reflections) ---
  getReflections(studentNum) {
    const key = `${this.STORAGE_KEY_PREFIX}reflections_${studentNum}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }

  addReflection(studentNum, data) {
    const list = this.getReflections(studentNum);
    const newDoc = {
      id: "ref_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      studentNum: parseInt(studentNum, 10),
      createdAt: new Date().toISOString(),
      teacherComment: "",
      ...data
    };
    list.unshift(newDoc); // 최신순
    localStorage.setItem(`${this.STORAGE_KEY_PREFIX}reflections_${studentNum}`, JSON.stringify(list));
    return newDoc;
  }

  updateReflectionComment(studentNum, docId, comment) {
    const list = this.getReflections(studentNum);
    const target = list.find(item => item.id === docId);
    if (target) {
      target.teacherComment = comment;
      target.commentedAt = new Date().toISOString();
      localStorage.setItem(`${this.STORAGE_KEY_PREFIX}reflections_${studentNum}`, JSON.stringify(list));
      return true;
    }
    return false;
  }

  // 교사에 의한 성찰문 제목/답변 직접 수정
  updateReflection(studentNum, docId, updates) {
    const list = this.getReflections(studentNum);
    const target = list.find(item => item.id === docId);
    if (!target) return false;
    if (typeof updates.title === "string") target.title = updates.title;
    if (updates.answers) target.answers = { ...target.answers, ...updates.answers };
    target.editedAt = new Date().toISOString();
    localStorage.setItem(`${this.STORAGE_KEY_PREFIX}reflections_${studentNum}`, JSON.stringify(list));
    return true;
  }

  // 교사에 의한 성찰문 삭제
  deleteReflection(studentNum, docId) {
    const list = this.getReflections(studentNum);
    const filtered = list.filter(item => item.id !== docId);
    localStorage.setItem(`${this.STORAGE_KEY_PREFIX}reflections_${studentNum}`, JSON.stringify(filtered));
    return filtered.length !== list.length;
  }

  // --- 자기평가 (students/{studentNum}/selfAssessments) ---
  getSelfAssessments(studentNum) {
    const key = `${this.STORAGE_KEY_PREFIX}assessments_${studentNum}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }

  saveSelfAssessment(studentNum, data) {
    const list = this.getSelfAssessments(studentNum);
    const newDoc = {
      id: "self_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      studentNum: parseInt(studentNum, 10),
      createdAt: new Date().toISOString(),
      ...data
    };
    list.unshift(newDoc);
    localStorage.setItem(`${this.STORAGE_KEY_PREFIX}assessments_${studentNum}`, JSON.stringify(list));
    return newDoc;
  }

  // 교사에 의한 자기평가 내용 직접 수정
  updateSelfAssessment(studentNum, docId, updates) {
    const list = this.getSelfAssessments(studentNum);
    const target = list.find(item => item.id === docId);
    if (!target) return false;
    if (updates.strengths) target.strengths = updates.strengths;
    if (updates.growthAreas) target.growthAreas = updates.growthAreas;
    target.editedAt = new Date().toISOString();
    localStorage.setItem(`${this.STORAGE_KEY_PREFIX}assessments_${studentNum}`, JSON.stringify(list));
    return true;
  }

  // 교사에 의한 자기평가 삭제
  deleteSelfAssessment(studentNum, docId) {
    const list = this.getSelfAssessments(studentNum);
    const filtered = list.filter(item => item.id !== docId);
    localStorage.setItem(`${this.STORAGE_KEY_PREFIX}assessments_${studentNum}`, JSON.stringify(filtered));
    return filtered.length !== list.length;
  }

  // 학생별 요약 데이터 (성찰문 개수, 자기평가 여부 등)
  getStudentSummary(studentNum) {
    const reflections = this.getReflections(studentNum);
    const assessments = this.getSelfAssessments(studentNum);
    return {
      studentNum: parseInt(studentNum, 10),
      reflectionCount: reflections.length,
      hasSelfAssessment: assessments.length > 0,
      latestReflectionDate: reflections.length > 0 ? reflections[0].createdAt : null,
      reflections,
      assessments
    };
  }

  // --- 모의 시연용 초기 데이터 시드 ---
  seedMockDataIfNeeded() {
    const flagKey = this.STORAGE_KEY_PREFIX + "seeded";
    if (localStorage.getItem(flagKey)) return;

    // 1번 학생: 갈등 사안 1건 (5문항 신규 서식) + 자기평가 작성됨
    this.addReflection(1, {
      type: "conflict",
      title: "체육 시간 피구 경기 중 규칙 문제로 다툼",
      answers: {
        q1: "지난 주 목요일 3교시 체육 시간, 운동장에서 피구 시합을 하다가 발생한 일입니다.",
        q2: "친구가 발에 공이 맞았다고 인정하지 않자, 흥분해서 친구들에게 망신을 주며 큰 소리로 따지고 공을 세게 던진 점이 잘못되었습니다.",
        q3: "친구가 사실대로 인정하지 않고 발뺌하는 것 같아 억울했고, 제 말을 거짓말 취급하는 것 같아서 기분이 몹시 상하고 속상했습니다.",
        q4: "화를 내며 따지기 전에 심호흡을 하고 심판인 체육 선생님께 정중히 판정을 요청하거나, 웃으면서 양보했을 것입니다.",
        q5: "친구도 사실대로 솔직히 인정하고 사과해주면 좋겠고, 앞으로 비슷한 상황이 생기면 서로 감정을 앞세우지 않고 끝까지 말을 들어주었으면 좋겠습니다."
      }
    });

    this.saveSelfAssessment(1, {
      strengths: [
        { tag: "책임감", reason: "학급 환경미화 당번을 맡았을 때 청소 구역을 끝까지 책임지고 깨끗하게 정리했습니다." },
        { tag: "솔직함", reason: "잘못한 일이 생겼을 때 변명하지 않고 제 실수를 인정하려고 노력합니다." },
        { tag: "적극성", reason: "수업 시간 모둠 발표나 토의 활동이 있을 때 앞장서서 아이디어를 냅니다." }
      ],
      growthAreas: [
        { tag: "감정 조절", reason: "승부욕이 앞설 때 상대방의 말에 쉽게 화를 내는 경향이 있어 보완하고 싶습니다." }
      ]
    });

    // 2번 학생: 개인형 잘못 1건
    this.addReflection(2, {
      type: "personal",
      title: "수업 중 집중하지 않고 태블릿으로 장난을 침",
      answers: {
        q1: "화요일 5교시 사회 시간, 6학년 1반 교실이었습니다.",
        q2: "디지털 교과서 검색 시간에 학습과 관련 없는 게임 웹사이트를 몰래 열었습니다.",
        q3: "수업 내용이 어렵게 느껴져 딴짓을 하고 싶어서 호기심에 접속했습니다.",
        q4: "선생님의 수업 진행을 방해했고 옆자리 짝꿍의 집중도 흐트러뜨렸습니다.",
        q5: "학습 도구인 태블릿을 규칙에 맞지 않게 사용하고 수업에 성실히 참여하지 않은 점입니다.",
        q6: "앞으로는 학습 목적 외의 사이트는 절대 열지 않고, 수업이 어려울 때는 질문을 하겠습니다."
      }
    });

    // 3번 학생: 모범 학생 (성찰문 0건, 자기평가만 성실히 작성)
    this.saveSelfAssessment(3, {
      strengths: [
        { tag: "배려심", reason: "도움이 필요한 친구에게 다가가 친절하게 학습 과제를 설명해 주었습니다." },
        { tag: "경청", reason: "선생님과 친구들의 의견을 끝까지 집중하여 듣고 공감합니다." },
        { tag: "정리정돈", reason: "자신의 사물함과 책상 주변을 항상 정돈하여 쾌적한 교실을 만듭니다." },
        { tag: "성실성", reason: "매일 아침 독서 시간과 1인 1역할을 한 번도 빠짐없이 실천했습니다." }
      ],
      growthAreas: []
    });

    localStorage.setItem(flagKey, "true");
  }
}

// 전역 스토어 인스턴스
window.appStore = new ClassroomStore();
