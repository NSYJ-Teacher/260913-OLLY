/**
 * 올리(OLLY) 랜딩/화면 전환 컨트롤러
 * - 메인(랜딩) 화면과 학생 포털, 교사 포털을 하나의 페이지에서 전환합니다.
 * - 기존 세션(sessionStorage)이 있으면 해당 역할의 포털로 자동 진입합니다.
 */

document.addEventListener("DOMContentLoaded", () => {
  const landingSection = document.getElementById("landingSection");
  const studentPortalRoot = document.getElementById("studentPortalRoot");
  const teacherPortalRoot = document.getElementById("teacherPortalRoot");
  const studentHeaderInfo = document.getElementById("studentHeaderInfo");
  const teacherHeaderInfo = document.getElementById("teacherHeaderInfo");

  const btnGoStudent = document.getElementById("btnGoStudent");
  const btnGoTeacher = document.getElementById("btnGoTeacher");
  const btnBackToLandingStudent = document.getElementById("btnBackToLandingStudent");
  const btnBackToLandingTeacher = document.getElementById("btnBackToLandingTeacher");

  function showView(view) {
    landingSection.style.display = view === "landing" ? "block" : "none";
    studentPortalRoot.style.display = view === "student" ? "block" : "none";
    teacherPortalRoot.style.display = view === "teacher" ? "block" : "none";
    studentHeaderInfo.style.display = view === "student" ? "flex" : "none";
    teacherHeaderInfo.style.display = view === "teacher" ? "flex" : "none";
  }

  // 학급 전용 링크(?class=학급ID)로 접속한 경우, 해당 학급 ID를 기억해둡니다.
  const classIdFromUrl = new URLSearchParams(window.location.search).get("class");

  // 다른 스크립트(student.js, teacher.js)에서 화면 전환을 호출할 수 있도록 전역 공개
  window.OllyApp = { showView, classroomIdFromUrl: classIdFromUrl };

  if (btnGoStudent) {
    btnGoStudent.addEventListener("click", () => showView("student"));
  }
  if (btnGoTeacher) {
    btnGoTeacher.addEventListener("click", () => showView("teacher"));
  }
  if (btnBackToLandingStudent) {
    btnBackToLandingStudent.addEventListener("click", () => showView("landing"));
  }
  if (btnBackToLandingTeacher) {
    btnBackToLandingTeacher.addEventListener("click", () => showView("landing"));
  }

  // 초기 라우팅: 기존 로그인 세션이 있으면 해당 포털로 바로 진입
  const session = window.appStore.getCurrentSession();
  if (session && session.role === "student") {
    showView("student");
  } else if (session && session.role === "teacher") {
    showView("teacher");
  } else if (classIdFromUrl) {
    // 학급 전용 링크로 처음 접속한 경우, 랜딩을 건너뛰고 바로 학생 접속 화면으로 진입
    showView("student");
  } else {
    showView("landing");
  }
});
