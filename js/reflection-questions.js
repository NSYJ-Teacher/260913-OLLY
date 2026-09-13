/**
 * 성찰문 질문 문구 기본값 및 교사 커스텀 오버레이 병합 유틸
 * - 학생용(student.js)과 교사용(teacher.js) 양쪽에서 공통으로 사용합니다.
 * - 실제 검증 로직(validate 함수)은 student.js에 유지하고, 여기서는
 *   화면에 노출되는 "문구"(질문/안내/가이드/예시/최소글자수)만 관리합니다.
 */

window.REFLECTION_QUESTION_DEFAULTS = {
  conflict: [
    {
      key: "q1",
      label: "1. 언제, 어디서, 무슨 일이 있었나요?",
      placeholder: "육하원칙에 맞추어 시간, 장소, 일어난 일을 구체적으로 적어보세요.",
      guideTitle: "💡 이렇게 적어보세요 (시간 + 장소 + 상황)",
      guideExample: "예: 화요일 3교시 체육 시간, 운동장에서 피구 시합을 하다가 친구가 던진 공이 발에 맞았는지 여부로 언성을 높이며 다투었습니다.",
      minLength: 15
    },
    {
      key: "q2",
      label: "2. 이 상황에서 내가 잘못한 말이나 행동은 무엇인가요?",
      placeholder: "남 탓을 하기 전에, 나의 말과 행동 중 잘못되었던 점을 정직하게 적어보세요.",
      guideTitle: "💡 이렇게 적어보세요 (나의 잘못 성찰)",
      guideExample: "예: 친구의 말을 끝까지 듣지 않고 친구들에게 창피를 주며 큰 소리로 따졌고, 화를 참지 못하고 공을 세게 던진 행동이 잘못되었습니다.",
      minLength: 15
    },
    {
      key: "q3",
      label: "3. 상대방의 어떤 말이나 행동 때문에 내 마음이 속상했나요?",
      placeholder: "상대방의 어떤 부분 때문에 내 기분이 상했는지 솔직한 감정과 이유를 써보세요.",
      guideTitle: "💡 이렇게 적어보세요 (나의 속상한 감정과 이유)",
      guideExample: "예: 친구가 사실과 다르게 우기면서 여러 친구들 앞에서 나를 거짓말쟁이 취급하는 것 같아서 억울하고 마음이 많이 속상했습니다.",
      minLength: 15
    },
    {
      key: "q4",
      label: "4. 만약 그 순간으로 다시 돌아간다면, 나는 어떻게 다르게 행동했을까요?",
      placeholder: "화를 내거나 싸우는 대신, 어떻게 행동하면 좋았을지 바람직한 대처 방법을 써보세요.",
      guideTitle: "💡 이렇게 적어보세요 (대안적 행동 다짐)",
      guideExample: "예: 화를 내기 전에 먼저 심호흡을 하고 '내 생각은 이래'라고 차분하게 말하거나, 양보하거나 심판(선생님)께 정중히 도움을 요청했을 것입니다.",
      minLength: 15
    },
    {
      key: "q5",
      label: "5. 오해를 풀고 앞으로 원만하게 지내기 위해, 상대방 친구에게 바라는 점은 무엇인가요?",
      placeholder: "화해를 위해, 그리고 앞으로 비슷한 일이 생기지 않도록 친구에게 바라는 점을 정중히 써보세요.",
      guideTitle: "💡 이렇게 적어보세요 (상대 친구에게 바라는 점)",
      guideExample: "예: 서로 오해한 부분에 대해 솔직하게 사과를 주고받았으면 좋겠고, 앞으로 의견이 다를 때 서로의 말을 끝까지 들어주었으면 좋겠습니다.",
      minLength: 15
    }
  ],
  personal: [
    {
      key: "q1",
      label: "1. 언제, 어디서 있었던 일인가요?",
      placeholder: "시간과 장소를 구체적으로 적어보세요.",
      guideTitle: "💡 이렇게 적어보세요 (시간 + 장소)",
      guideExample: "예: 화요일 5교시 사회 시간, 6학년 1반 교실에서 있었던 일입니다.",
      minLength: 10
    },
    {
      key: "q2",
      label: "2. 무엇을 했는지 구체적으로 써보세요.",
      placeholder: "규칙을 어겼거나 문제가 되었던 나의 구체적인 행동을 적어보세요.",
      guideTitle: "💡 이렇게 적어보세요 (구체적인 사실 서술)",
      guideExample: "예: 디지털 교과서 검색 시간에 학습과 관련 없는 인터넷 게임 사이트에 접속하여 짝꿍에게 보여주었습니다.",
      minLength: 15
    },
    {
      key: "q3",
      label: "3. 왜 그런 행동을 하게 되었나요?",
      placeholder: "그런 행동을 하게 된 당시의 생각이나 솔직한 이유를 적어보세요.",
      guideTitle: "💡 이렇게 적어보세요 (당시의 솔직한 이유)",
      guideExample: "예: 수업 내용이 어렵고 지루하게 느껴져 순간적으로 호기심이 생겼고 딴짓을 하고 싶었습니다.",
      minLength: 15
    },
    {
      key: "q4",
      label: "4. 그 행동이 다른 사람이나 학급 상황에 어떤 영향을 미쳤나요?",
      placeholder: "선생님, 친구들, 교실 분위기에 미친 부정적인 영향을 생각해 보세요.",
      guideTitle: "💡 이렇게 적어보세요 (학급에 미친 영향)",
      guideExample: "예: 선생님의 수업 진행을 방해했고 옆자리 짝꿍의 집중을 흐트러뜨려 학급의 면학 분위기를 해쳤습니다.",
      minLength: 15
    },
    {
      key: "q5",
      label: "5. 지금 생각해보면 어떤 점이 잘못됐다고 생각하나요?",
      placeholder: "스스로 돌아보았을 때 고쳐야 할 잘못된 점을 정리해 보세요.",
      guideTitle: "💡 이렇게 적어보세요 (자기 반성)",
      guideExample: "예: 수업 도구인 태블릿을 학습 목적에 맞지 않게 사용하고 학급 규칙을 가볍게 여긴 점이 잘못되었습니다.",
      minLength: 15
    },
    {
      key: "q6",
      label: "6. 다음에 비슷한 상황이 오면 어떻게 행동할 것인가요?",
      placeholder: "앞으로 같은 실수를 반복하지 않기 위한 구체적인 실천 다짐을 적어보세요.",
      guideTitle: "💡 이렇게 적어보세요 (구체적 실천 다짐)",
      guideExample: "예: 앞으로는 학습 외 사이트는 절대 접속하지 않고, 수업이 어려울 때는 딴짓 대신 손을 들고 질문하겠습니다.",
      minLength: 15
    }
  ]
};

// 기본 문구 + 교사 저장 오버라이드(appStore)를 병합한 최종 문구 배열 반환
window.getReflectionQuestionTexts = function (type) {
  const defaults = window.REFLECTION_QUESTION_DEFAULTS[type] || [];
  const overrides = (window.appStore && window.appStore.getReflectionQuestionOverrides)
    ? (window.appStore.getReflectionQuestionOverrides(type) || {})
    : {};

  return defaults.map((q) => {
    const o = overrides[q.key];
    if (!o) return { ...q };
    return {
      ...q,
      label: o.label || q.label,
      placeholder: o.placeholder || q.placeholder,
      guideTitle: o.guideTitle || q.guideTitle,
      guideExample: o.guideExample || q.guideExample,
      minLength: (typeof o.minLength === "number" && o.minLength > 0) ? o.minLength : q.minLength
    };
  });
};
