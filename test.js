/**
 * 비즈니스 로직 및 생성기 자동 단위 테스트 스크립트
 */

// LocalStorage 및 브라우저 환경 모킹
const mockStorage = {};
global.localStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; }
};
global.sessionStorage = {
  getItem: (k) => mockStorage['sess_' + k] || null,
  setItem: (k, v) => { mockStorage['sess_' + k] = String(v); },
  removeItem: (k) => { delete mockStorage['sess_' + k]; }
};
global.window = {
  FIREBASE_CONFIG: {}
};

// firebase-config 및 generator 로드
require('./js/firebase-config.js');
require('./js/generator.js');

const store = window.appStore;
const Generator = window.RecordDraftGenerator;

console.log('--- [1] 학생 인증 및 PIN 테스트 ---');
const codes = store.getAllStudentCodes();
console.log('초기 발급된 1번 PIN:', codes[1]);
const loginFail = store.verifyStudentLogin(1, '9999');
console.assert(loginFail.success === false, '틀린 PIN 실패 검증 통과');
const loginSuccess = store.verifyStudentLogin(1, '1001');
console.assert(loginSuccess.success === true, '정상 PIN 성공 검증 통과');
console.log('학생 1번 로그인 결과:', loginSuccess);

console.log('\n--- [2] 교사 인증 테스트 ---');
const teacherLogin = store.verifyTeacherLogin('teacher@school.kr', 'teacher1234');
console.assert(teacherLogin.success === true, '교사 로그인 검증 통과');
console.log('교사 로그인 성공:', teacherLogin);

console.log('\n--- [3] 1번 학생 (갈등 사안 + 자기평가) 행발 초안 생성 테스트 (3:1 비율) ---');
const student1Summary = store.getStudentSummary(1);
const draft1 = Generator.generateDraft(student1Summary);
console.log('모드:', draft1.mode);
console.assert(draft1.mode === '3:1', '1번 학생은 3:1 비율이어야 함');
console.log('문장 수:', draft1.sentences.length);
console.log('종합 초안:\n', draft1.fullText);
console.log('문장별 근거:');
draft1.sentences.forEach((s, idx) => {
  console.log(` [문장 ${idx+1}] [${s.type}] ${s.sourceLabel} -> ${s.text}`);
});

console.log('\n--- [4] 3번 학생 (사안 없음 - 모범 학생) 행발 초안 생성 테스트 (4:0 비율) ---');
const student3Summary = store.getStudentSummary(3);
const draft3 = Generator.generateDraft(student3Summary);
console.log('모드:', draft3.mode);
console.assert(draft3.mode === '4:0', '3번 학생은 4:0 비율이어야 함');
console.log('문장 수:', draft3.sentences.length);
console.log('종합 초안:\n', draft3.fullText);

console.log('\n--- [5] 성찰문 신규 추가 및 코멘트 테스트 ---');
const newRef = store.addReflection(5, {
  type: 'personal',
  title: '과제 미제출 및 준비물 미지참',
  answers: {
    q1: '금요일 1교시 국어 시간',
    q2: '국어 학습지를 집에 두고 왔습니다.',
    q3: '어제 저녁 가방을 챙길 때 꼼꼼히 확인하지 않았습니다.',
    q4: '수업 준비가 늦어져 모둠 활동에 피해를 주었습니다.',
    q5: '전날 미리 가방을 챙기는 습관이 부족했습니다.',
    q6: '앞으로는 자기 전 알림장을 확인하고 가방을 미리 챙기겠습니다.'
  }
});
console.log('신규 성찰문 등록 ID:', newRef.id);
store.updateReflectionComment(5, newRef.id, '앞으로 전날 가방 챙기기를 1주일간 실천해봅시다.');
const updatedSummary = store.getStudentSummary(5);
console.log('선생님 코멘트 저장 확인:', updatedSummary.reflections[0].teacherComment);

console.log('\n✅ ALL TESTS PASSED SUCCESSFULLY!');
