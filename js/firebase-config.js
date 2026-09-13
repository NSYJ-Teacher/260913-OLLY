/**
 * Firebase 설정 및 실제 Firestore/Auth 연동 스토리지 어댑터 (학급별 다중 사용 지원)
 * - 교사 1명 = 학급 1개(classroomId = 교사 Firebase Auth UID)로 완전히 분리되어 저장됩니다.
 * - 교사: 이메일/비밀번호로 로그인(최초 로그인 시 자동 가입) 후, 학급 이름/학생 수를 정해
 *   자신의 학급을 생성합니다.
 * - 학생: 담임교사가 공유한 "학급 전용 링크"(?class=학급ID)로 접속해 출석번호와
 *   4자리 코드로 로그인합니다. 가상 이메일(student{번호}_{학급ID}@classroom.local)과
 *   코드 기반 비밀번호로 내부적으로 처리되어, 화면에는 노출되지 않습니다.
 */

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAE45WjT-16qbo26Kf-LhGV93cucnvKfgg",
  authDomain: "olly-a7e1b.firebaseapp.com",
  projectId: "olly-a7e1b",
  storageBucket: "olly-a7e1b.firebasestorage.app",
  messagingSenderId: "1073646031908",
  appId: "1:1073646031908:web:e967c169b0f9a4b64db4b1"
};

const firebaseApp = firebase.initializeApp(window.FIREBASE_CONFIG);
const auth = firebaseApp.auth();
const db = firebaseApp.firestore();

// 학생 계정 생성/코드 재발급 시 교사(관리자)의 로그인 세션을 건드리지 않기 위한 보조 앱 인스턴스
const secondaryApp = firebase.initializeApp(window.FIREBASE_CONFIG, "Secondary");
const secondaryAuth = secondaryApp.auth();

function studentEmail(num, classroomId) {
  return `student${num}_${classroomId}@classroom.local`;
}

function studentPassword(pin) {
  // Firebase Auth 비밀번호는 최소 6자가 필요하므로, 학생에게 보이는 4자리 코드에
  // 고정 접두사를 붙여 변환합니다. (실제 비밀 요소는 여전히 4자리 코드입니다)
  return `olly-${pin}`;
}

function waitForAuthReady() {
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged(() => {
      unsubscribe();
      resolve();
    });
  });
}

function translateAuthError(err) {
  const code = err && err.code;
  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "이메일 또는 비밀번호가 올바르지 않습니다.";
    case "auth/weak-password":
      return "비밀번호는 6자 이상으로 설정해 주세요.";
    case "auth/invalid-email":
      return "이메일 형식이 올바르지 않습니다.";
    case "auth/too-many-requests":
      return "잠시 후 다시 시도해 주세요. (요청이 너무 많습니다)";
    case "auth/network-request-failed":
      return "네트워크 연결을 확인해 주세요.";
    default:
      return "로그인 중 오류가 발생했습니다: " + (err && err.message ? err.message : String(err));
  }
}

// 스토리지 어댑터 구현
class ClassroomStore {
  constructor() {
    this._classroomId = null;
    this._cache = {
      systemSettings: null,
      studentCodes: {},
      questionOverrides: { conflict: {}, personal: {} },
      reflections: {},
      assessments: {}
    };
    this._restorePromise = null;
  }

  _classroomRef() {
    return db.collection("classrooms").doc(this._classroomId);
  }

  getClassroomId() {
    return this._classroomId;
  }

  // 학생 접속 화면(로그인 전)에서 학급명/학생 수를 보여주기 위한 공개 조회
  async getClassroomPublicInfo(classroomId) {
    if (!classroomId) return null;
    try {
      const doc = await db.collection("classrooms").doc(classroomId).collection("settings").doc("system").get();
      return doc.exists ? doc.data() : null;
    } catch (err) {
      console.error("[OLLY] 학급 공개 정보 조회 실패:", err && err.code, err && err.message);
      return null;
    }
  }

  // --- 세션 복원 (새로고침 등으로 재접속 시, Firebase 인증 상태를 바탕으로 데이터 재적재) ---
  restoreSession() {
    if (this._restorePromise) return this._restorePromise;
    this._restorePromise = (async () => {
      const raw = sessionStorage.getItem("current_user");
      if (!raw) return null;
      const session = JSON.parse(raw);

      await waitForAuthReady();
      if (!auth.currentUser) {
        sessionStorage.removeItem("current_user");
        return null;
      }

      this._classroomId = session.classroomId;

      if (session.role === "student") {
        try {
          await this._loadStudentData(session.studentNum);
        } catch (err) {
          console.error("[OLLY] 학생 데이터 재적재 실패:", err && err.code, err && err.message);
          sessionStorage.removeItem("current_user");
          return null;
        }
        return session;
      }

      if (session.role === "teacher") {
        let hasClassroom = false;
        try {
          hasClassroom = await this._checkAndLoadTeacherData();
        } catch (err) {
          console.error("[OLLY] 교사 데이터 재적재 실패:", err && err.code, err && err.message);
        }
        return { ...session, needsClassroomSetup: !hasClassroom };
      }

      return session;
    })();
    return this._restorePromise;
  }

  // --- 학생 인증 및 PIN 관리 (교사 세션에서만 사용) ---
  getAllStudentCodes() {
    return this._cache.studentCodes;
  }

  async saveStudentCode(studentNum, pin) {
    const oldPin = this._cache.studentCodes[studentNum];
    await this._provisionStudentAccount(studentNum, pin, oldPin);
    this._cache.studentCodes[studentNum] = String(pin);
    await this._classroomRef().collection("students").doc(String(studentNum))
      .set({ pin: String(pin), studentNum: parseInt(studentNum, 10) }, { merge: true });
    return true;
  }

  async generateBulkStudentCodes() {
    const total = (this._cache.systemSettings && this._cache.systemSettings.totalStudents) || 23;
    const codes = {};
    for (let i = 1; i <= total; i++) {
      const newPin = String(Math.floor(1000 + Math.random() * 9000));
      const oldPin = this._cache.studentCodes[i];
      await this._provisionStudentAccount(i, newPin, oldPin);
      await this._classroomRef().collection("students").doc(String(i)).set({ pin: newPin, studentNum: i }, { merge: true });
      codes[i] = newPin;
    }
    this._cache.studentCodes = codes;
    return codes;
  }

  // 보조 앱 인스턴스로 학생 Firebase Auth 계정을 생성하거나 비밀번호(=코드)를 갱신
  async _provisionStudentAccount(num, newPin, oldPin) {
    const email = studentEmail(num, this._classroomId);
    const newPassword = studentPassword(newPin);
    try {
      if (oldPin) {
        const oldPassword = studentPassword(oldPin);
        await secondaryAuth.signInWithEmailAndPassword(email, oldPassword);
        await secondaryAuth.currentUser.updatePassword(newPassword);
      } else {
        await secondaryAuth.createUserWithEmailAndPassword(email, newPassword);
      }
    } catch (err) {
      try {
        await secondaryAuth.createUserWithEmailAndPassword(email, newPassword);
      } catch (createErr) {
        if (createErr.code !== "auth/email-already-in-use") {
          this._reportSyncError(createErr);
        }
      }
    } finally {
      try { await secondaryAuth.signOut(); } catch (e) { /* 무시 */ }
    }
  }

  async verifyStudentLogin(classroomId, studentNum, pin) {
    if (!classroomId) {
      return { success: false, message: "학급 접속 링크가 필요합니다. 담임 선생님께 받은 링크(또는 QR코드)로 다시 접속해 주세요." };
    }
    try {
      await auth.signInWithEmailAndPassword(studentEmail(studentNum, classroomId), studentPassword(pin));
    } catch (err) {
      return { success: false, message: "출석번호 또는 4자리 접속 코드가 일치하지 않습니다." };
    }
    this._classroomId = classroomId;
    const session = {
      role: "student",
      studentNum: parseInt(studentNum, 10),
      classroomId,
      virtualEmail: studentEmail(studentNum, classroomId),
      loginAt: new Date().toISOString()
    };
    sessionStorage.setItem("current_user", JSON.stringify(session));

    try {
      await this._loadStudentData(studentNum);
    } catch (err) {
      console.error("[OLLY] 학생 데이터 로드 실패:", err && err.code, err && err.message, err);
      sessionStorage.removeItem("current_user");
      return {
        success: false,
        message: "학생 데이터를 불러오는 중 오류가 발생했습니다. (" + (err && err.code ? err.code : (err && err.message) || err) + ")"
      };
    }

    return { success: true, session };
  }

  async _loadStudentData(studentNum) {
    const numKey = String(studentNum);
    const classroomRef = this._classroomRef();
    const queries = [
      { name: "settings/system", promise: classroomRef.collection("settings").doc("system").get() },
      // classroomId로 where() 필터를 걸어야, students/{id}/reflections 등에 함께 걸려있는
      // collectionGroup 보안 규칙(위 firestore.rules의 {path=**} 규칙)과 겹쳐도 Firestore가
      // 이 조회가 본인 학급으로만 범위가 좁혀졌음을 증명할 수 있어 permission-denied가 나지 않습니다.
      // (createdAt 정렬은 복합 색인이 추가로 필요해지므로 클라이언트에서 정렬합니다)
      { name: "reflections", promise: classroomRef.collection("students").doc(numKey).collection("reflections").where("classroomId", "==", this._classroomId).get() },
      { name: "selfAssessments", promise: classroomRef.collection("students").doc(numKey).collection("selfAssessments").where("classroomId", "==", this._classroomId).get() },
      { name: "question_overrides_conflict", promise: classroomRef.collection("settings").doc("question_overrides_conflict").get() },
      { name: "question_overrides_personal", promise: classroomRef.collection("settings").doc("question_overrides_personal").get() }
    ];
    const results = await Promise.allSettled(queries.map(q => q.promise));
    results.forEach((r, idx) => {
      if (r.status === "rejected") {
        console.error(`[OLLY] 학생 데이터 - ${queries[idx].name} 읽기 실패:`, r.reason && r.reason.code, r.reason && r.reason.message);
      }
    });
    const firstFailure = results.find(r => r.status === "rejected");
    if (firstFailure) {
      throw firstFailure.reason;
    }

    const [settingsDoc, reflSnap, assessSnap, ocDoc, opDoc] = results.map(r => r.value);

    this._cache.systemSettings = settingsDoc.exists ? settingsDoc.data() : { selfIntroOpen: true, totalStudents: 23 };
    this._cache.reflections[studentNum] = reflSnap.docs.map(d => d.data())
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    this._cache.assessments[studentNum] = assessSnap.docs.map(d => d.data())
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    this._cache.questionOverrides.conflict = ocDoc.exists ? ocDoc.data() : {};
    this._cache.questionOverrides.personal = opDoc.exists ? opDoc.data() : {};
  }

  // --- 교사 로그인 ---
  async verifyTeacherLogin(email, password) {
    email = String(email || "").trim();
    password = String(password || "").trim();

    if (password.length < 6) {
      return { success: false, message: "비밀번호는 6자 이상이어야 합니다." };
    }

    try {
      try {
        // 최초 로그인 시 자동으로 계정을 생성하고, 이미 있는 계정이면 로그인으로 전환
        await auth.createUserWithEmailAndPassword(email, password);
      } catch (createErr) {
        if (createErr.code === "auth/email-already-in-use") {
          await auth.signInWithEmailAndPassword(email, password);
        } else {
          throw createErr;
        }
      }
    } catch (err) {
      return { success: false, message: translateAuthError(err) };
    }

    this._classroomId = auth.currentUser.uid;

    let hasClassroom = false;
    try {
      hasClassroom = await this._checkAndLoadTeacherData();
    } catch (err) {
      console.error("[OLLY] 교사 데이터 로드 실패:", err && err.code, err && err.message, err);
      return {
        success: false,
        message: "교사 데이터를 불러오는 중 오류가 발생했습니다. (" + (err && err.code ? err.code : (err && err.message) || err) + ")"
      };
    }

    const session = {
      role: "teacher",
      email,
      classroomId: this._classroomId,
      loginAt: new Date().toISOString()
    };
    sessionStorage.setItem("current_user", JSON.stringify(session));

    return { success: true, session, needsClassroomSetup: !hasClassroom };
  }

  // 학급 존재 여부를 확인하고, 있으면 전체 데이터를 적재합니다. (반환값: 학급 존재 여부)
  async _checkAndLoadTeacherData() {
    let settingsDoc;
    try {
      settingsDoc = await this._classroomRef().collection("settings").doc("system").get();
    } catch (err) {
      console.error("[OLLY] settings/system 읽기 실패:", err && err.code, err && err.message);
      throw err;
    }

    if (!settingsDoc.exists) {
      return false;
    }

    const classroomRef = this._classroomRef();
    const queries = [
      { name: "students", promise: classroomRef.collection("students").get() },
      // Firestore는 collectionGroup 쿼리가 "이 학급 소속 문서만 반환할 수 있음"을 규칙과 함께
      // 정적으로 증명할 수 있어야 허용합니다. where()로 classroomId를 명시적으로 제한해야
      // 보안 규칙의 resource.data.classroomId 검사와 맞물려 permission-denied 없이 통과합니다.
      { name: "reflections(collectionGroup)", promise: db.collectionGroup("reflections").where("classroomId", "==", this._classroomId).get() },
      { name: "selfAssessments(collectionGroup)", promise: db.collectionGroup("selfAssessments").where("classroomId", "==", this._classroomId).get() },
      { name: "question_overrides_conflict", promise: classroomRef.collection("settings").doc("question_overrides_conflict").get() },
      { name: "question_overrides_personal", promise: classroomRef.collection("settings").doc("question_overrides_personal").get() }
    ];
    const results = await Promise.allSettled(queries.map(q => q.promise));
    results.forEach((r, idx) => {
      if (r.status === "rejected") {
        console.error(`[OLLY] ${queries[idx].name} 읽기 실패:`, r.reason && r.reason.code, r.reason && r.reason.message);
      }
    });
    const firstFailure = results.find(r => r.status === "rejected");
    if (firstFailure) {
      throw firstFailure.reason;
    }

    const [studentsSnap, reflSnap, assessSnap, ocDoc, opDoc] = results.map(r => r.value);

    this._cache.systemSettings = settingsDoc.data();

    this._cache.studentCodes = {};
    studentsSnap.forEach(doc => {
      this._cache.studentCodes[doc.id] = doc.data().pin;
    });

    // collectionGroup 쿼리는 이 프로젝트 내 모든 학급의 reflections/selfAssessments를 스캔 대상으로
    // 삼을 수 있으므로(보안 규칙은 본인 학급 경로만 허용), 응답에는 본인 학급 문서만 포함됩니다.
    this._cache.reflections = {};
    reflSnap.forEach(doc => {
      const data = doc.data();
      const num = data.studentNum;
      if (!this._cache.reflections[num]) this._cache.reflections[num] = [];
      this._cache.reflections[num].push(data);
    });
    Object.keys(this._cache.reflections).forEach(num => {
      this._cache.reflections[num].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    });

    this._cache.assessments = {};
    assessSnap.forEach(doc => {
      const data = doc.data();
      const num = data.studentNum;
      if (!this._cache.assessments[num]) this._cache.assessments[num] = [];
      this._cache.assessments[num].push(data);
    });
    Object.keys(this._cache.assessments).forEach(num => {
      this._cache.assessments[num].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    });

    this._cache.questionOverrides.conflict = ocDoc.exists ? ocDoc.data() : {};
    this._cache.questionOverrides.personal = opDoc.exists ? opDoc.data() : {};

    return true;
  }

  // 교사가 최초 로그인 후 자신의 학급을 생성 (학급 이름 + 학생 수 지정)
  async createClassroom({ className, totalStudents }) {
    const total = Math.max(1, Math.min(50, parseInt(totalStudents, 10) || 23));
    const defaultSettings = {
      className: String(className || "").trim() || "우리 학급",
      selfIntroOpen: true,
      totalStudents: total,
      createdAt: new Date().toISOString()
    };

    try {
      await this._classroomRef().collection("settings").doc("system").set(defaultSettings);
    } catch (err) {
      console.error("[OLLY] 학급 생성(settings) 실패:", err && err.code, err && err.message);
      throw err;
    }

    for (let i = 1; i <= total; i++) {
      const pin = String(1000 + i);
      await this._provisionStudentAccount(i, pin, null);
      try {
        await this._classroomRef().collection("students").doc(String(i)).set({ pin, studentNum: i });
      } catch (err) {
        console.error(`[OLLY] students/${i} 쓰기 실패:`, err && err.code, err && err.message);
        throw err;
      }
    }

    await this._checkAndLoadTeacherData();
  }

  // 학급 설정 변경 (학급 이름, 학생 수 등) — 학생 수를 늘리면 새 학생 계정이 자동 생성됩니다.
  async updateClassroomSettings({ className, totalStudents }) {
    const current = this._cache.systemSettings || {};
    const prevTotal = current.totalStudents || 0;
    const nextTotal = Math.max(1, Math.min(50, parseInt(totalStudents, 10) || prevTotal || 23));

    const updated = {
      ...current,
      className: String(className || current.className || "").trim() || "우리 학급",
      totalStudents: nextTotal
    };

    await this._classroomRef().collection("settings").doc("system").set(updated, { merge: true });
    this._cache.systemSettings = updated;

    // 학생 수가 늘어난 경우, 늘어난 번호만큼 기본 코드로 신규 계정 생성
    if (nextTotal > prevTotal) {
      for (let i = prevTotal + 1; i <= nextTotal; i++) {
        const pin = String(1000 + i);
        await this._provisionStudentAccount(i, pin, null);
        await this._classroomRef().collection("students").doc(String(i)).set({ pin, studentNum: i });
        this._cache.studentCodes[i] = pin;
      }
    }

    return updated;
  }

  getCurrentSession() {
    const raw = sessionStorage.getItem("current_user");
    return raw ? JSON.parse(raw) : null;
  }

  logout() {
    sessionStorage.removeItem("current_user");
    this._classroomId = null;
    this._cache = {
      systemSettings: null,
      studentCodes: {},
      questionOverrides: { conflict: {}, personal: {} },
      reflections: {},
      assessments: {}
    };
    this._restorePromise = null;
    auth.signOut().catch(() => {});
  }

  _reportSyncError(err) {
    console.error("[OLLY Firestore 동기화 오류]", err);
  }

  // --- 시스템 전역 설정 (classrooms/{id}/settings/system) ---
  getSystemSettings() {
    return this._cache.systemSettings;
  }

  saveSystemSettings(settings) {
    this._cache.systemSettings = settings;
    this._classroomRef().collection("settings").doc("system").set(settings, { merge: true })
      .catch(err => this._reportSyncError(err));
  }

  // --- 성찰문 질문 문구 커스터마이징 ---
  getReflectionQuestionOverrides(type) {
    return this._cache.questionOverrides[type] || {};
  }

  saveReflectionQuestionOverrides(type, overrides) {
    this._cache.questionOverrides[type] = overrides;
    this._classroomRef().collection("settings").doc("question_overrides_" + type).set(overrides)
      .catch(err => this._reportSyncError(err));
  }

  resetReflectionQuestionOverrides(type) {
    this._cache.questionOverrides[type] = {};
    this._classroomRef().collection("settings").doc("question_overrides_" + type).delete()
      .catch(err => this._reportSyncError(err));
  }

  // --- 성찰문 (classrooms/{id}/students/{studentNum}/reflections) ---
  getReflections(studentNum) {
    return this._cache.reflections[studentNum] || [];
  }

  addReflection(studentNum, data) {
    const docRef = this._classroomRef().collection("students").doc(String(studentNum)).collection("reflections").doc();
    const newDoc = {
      id: docRef.id,
      studentNum: parseInt(studentNum, 10),
      classroomId: this._classroomId,
      createdAt: new Date().toISOString(),
      teacherComment: "",
      ...data
    };
    const list = this.getReflections(studentNum);
    list.unshift(newDoc);
    this._cache.reflections[studentNum] = list;
    docRef.set(newDoc).catch(err => this._reportSyncError(err));
    return newDoc;
  }

  updateReflectionComment(studentNum, docId, comment) {
    const list = this.getReflections(studentNum);
    const target = list.find(item => item.id === docId);
    if (!target) return false;
    target.teacherComment = comment;
    target.commentedAt = new Date().toISOString();
    this._classroomRef().collection("students").doc(String(studentNum)).collection("reflections").doc(docId)
      .update({ teacherComment: comment, commentedAt: target.commentedAt })
      .catch(err => this._reportSyncError(err));
    return true;
  }

  // 교사에 의한 성찰문 제목/답변 직접 수정
  updateReflection(studentNum, docId, updates) {
    const list = this.getReflections(studentNum);
    const target = list.find(item => item.id === docId);
    if (!target) return false;

    const patch = { editedAt: new Date().toISOString() };
    if (typeof updates.title === "string") {
      target.title = updates.title;
      patch.title = target.title;
    }
    if (updates.answers) {
      target.answers = { ...target.answers, ...updates.answers };
      patch.answers = target.answers;
    }
    target.editedAt = patch.editedAt;

    this._classroomRef().collection("students").doc(String(studentNum)).collection("reflections").doc(docId)
      .update(patch)
      .catch(err => this._reportSyncError(err));
    return true;
  }

  // 교사에 의한 성찰문 삭제
  deleteReflection(studentNum, docId) {
    const list = this.getReflections(studentNum);
    const filtered = list.filter(item => item.id !== docId);
    const changed = filtered.length !== list.length;
    this._cache.reflections[studentNum] = filtered;
    if (changed) {
      this._classroomRef().collection("students").doc(String(studentNum)).collection("reflections").doc(docId)
        .delete().catch(err => this._reportSyncError(err));
    }
    return changed;
  }

  // --- 자기평가 (classrooms/{id}/students/{studentNum}/selfAssessments) ---
  getSelfAssessments(studentNum) {
    return this._cache.assessments[studentNum] || [];
  }

  saveSelfAssessment(studentNum, data) {
    const docRef = this._classroomRef().collection("students").doc(String(studentNum)).collection("selfAssessments").doc();
    const newDoc = {
      id: docRef.id,
      studentNum: parseInt(studentNum, 10),
      classroomId: this._classroomId,
      createdAt: new Date().toISOString(),
      ...data
    };
    const list = this.getSelfAssessments(studentNum);
    list.unshift(newDoc);
    this._cache.assessments[studentNum] = list;
    docRef.set(newDoc).catch(err => this._reportSyncError(err));
    return newDoc;
  }

  // 교사에 의한 자기평가 내용 직접 수정
  updateSelfAssessment(studentNum, docId, updates) {
    const list = this.getSelfAssessments(studentNum);
    const target = list.find(item => item.id === docId);
    if (!target) return false;

    const patch = { editedAt: new Date().toISOString() };
    if (updates.strengths) {
      target.strengths = updates.strengths;
      patch.strengths = updates.strengths;
    }
    if (updates.growthAreas) {
      target.growthAreas = updates.growthAreas;
      patch.growthAreas = updates.growthAreas;
    }
    target.editedAt = patch.editedAt;

    this._classroomRef().collection("students").doc(String(studentNum)).collection("selfAssessments").doc(docId)
      .update(patch)
      .catch(err => this._reportSyncError(err));
    return true;
  }

  // 교사에 의한 자기평가 삭제
  deleteSelfAssessment(studentNum, docId) {
    const list = this.getSelfAssessments(studentNum);
    const filtered = list.filter(item => item.id !== docId);
    const changed = filtered.length !== list.length;
    this._cache.assessments[studentNum] = filtered;
    if (changed) {
      this._classroomRef().collection("students").doc(String(studentNum)).collection("selfAssessments").doc(docId)
        .delete().catch(err => this._reportSyncError(err));
    }
    return changed;
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
}

// 전역 스토어 인스턴스
window.appStore = new ClassroomStore();
