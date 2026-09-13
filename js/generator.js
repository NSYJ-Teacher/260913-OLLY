/**
 * 생활기록부 행동발달 및 종합의견(행발) 초안 자동 생성 엔진
 * - 한국 초등 생기부 특유의 교육적·성장 지향적 완곡 표현(일명 '순화 어투') 적용
 * - 누가기록(성찰문) 유무 및 자기평가 보완점 유무에 따른 3:1 vs 4:0 분기 로직
 * - 문장별 근거 데이터(성찰문, 자기평가) 트래킹 제공
 */

const EuphemismDictionary = {
  // 성격/태도 보완점 완곡 표현 딕셔너리
  "고집": "자신의 주관과 소신이 뚜렷하여 맡은 일에 적극적인 반면, 상황에 따라 다른 친구들의 의견을 열린 마음으로 수용하는 태도를 기르고자 꾸준히 노력함.",
  "산만": "호기심이 풍부하고 관심 분야에 대한 몰입도가 높은 학생으로, 수업 시간 주변 정돈과 학습 과제에 대한 지속적인 집중력을 기르기 위해 스스로 점검하는 자세를 형성해 가고 있음.",
  "충동": "에너지가 넘치고 상황에 빠르게 반응하는 활달한 성향을 지녔으며, 행동하기 전 결과를 먼저 신중히 생각하고 감정을 조절하는 연습을 지속적으로 실천하고 있음.",
  "감정 조절": "자신의 감정을 솔직하게 표현할 줄 아는 학생으로, 친구와의 상호작용 과정에서 상대방의 입장을 먼저 헤아리고 차분하게 대화로 갈등을 풀어가는 의사소통 능력을 발전시켜 나가고 있음.",
  "규칙": "교실 공동체의 기본 생활 규칙의 중요성을 인지하고 있으며, 활동에 몰입하는 과정에서도 학급의 약속을 끝까지 준수하려는 자율적 실천 의지를 점차 강화해 가고 있음.",
  "시간 약속": "다양한 활동에 열의를 가지고 참여하며, 주어진 시간 내에 과제를 완수하고 약속된 일정을 계획적으로 지키는 시간 관리 역량을 꾸준히 개선해 가고 있음.",
  "친구 다툼": "자기표현이 명확하고 교우 관계에 주도적인 모습을 보이며, 의견 차이가 발생했을 때 자신의 실수를 솔직하게 인정하고 먼저 화해의 손을 내미는 성숙한 태도를 보여줌.",
  "수업 태도": "학습에 대한 잠재적 관심이 높은 편으로, 수업 시간 올바른 경청 자세와 교사의 지도에 대한 즉각적인 피드백 수용도를 높이며 성실한 학습 습관을 다져가고 있음."
};

const StrengthTemplates = {
  "배려심": [
    "평소 주변 친구들의 감정과 상황을 세심하게 관찰하고, 도움이 필요한 급우에게 먼저 다가가 따뜻한 말과 행동으로 돕는 이타적인 면모가 돋보임.",
    "급우 간의 사소한 어려움에도 깊이 공감하며 항상 친절하고 온화한 태도로 친구들을 대함으로써 학급 내 긍정적인 분위기 형성에 기여함."
  ],
  "책임감": [
    "자신에게 맡겨진 1인 1역할과 모둠 과제를 끝까지 성실하게 완수하며, 궂은일도 솔선수범하여 학급 구성원들의 두터운 신뢰를 받음.",
    "주어진 일에 주인의식을 갖고 매사에 정성을 다하며, 한 번 시작한 과업은 스스로 만족할 때까지 책임감 있게 마무리하는 자세가 우수함."
  ],
  "성실성": [
    "매일 정해진 학습 일정과 학급 기본 생활 습관을 모범적으로 실천하며, 꾸준하고 성실한 태도로 자신의 역할을 묵묵히 수행함.",
    "변함없이 성실한 자세로 수업에 임하며, 규칙적인 학교생활과 과제 수행을 통해 타의 모범이 되는 든든한 학급의 기둥 역할을 함."
  ],
  "솔직함": [
    "자신의 생각과 행동을 솔직하고 진솔하게 돌아볼 줄 알며, 잘못이나 미흡한 부분이 있을 때 변명하기보다 즉시 인정하고 개선하려는 용기를 지님.",
    "스스로에 대한 성찰 능력이 뛰어나며, 자신의 부족한 점을 솔직하게 마주하고 이를 성장의 계기로 삼는 진정성 있는 태도를 보여줌."
  ],
  "경청": [
    "교사의 안내와 친구들의 발표에 항상 고개를 끄덕이며 진지하게 귀를 기울이고, 타인의 의견을 편견 없이 존중하는 소통 역량을 갖춤.",
    "상대방의 입장을 먼저 헤아리는 높은 경청 능력을 바탕으로, 모둠 활동 시 갈등을 조율하고 원활한 합의를 이끌어내는 데 크게 기여함."
  ],
  "협동심": [
    "모둠 활동 시 자신의 고집을 내세우기보다는 구성원 간의 조화와 협력을 최우선으로 생각하며 배려와 양보를 실천함.",
    "공동의 목표 달성을 위해 적극적으로 역할을 분담하고 헌신하며, 친구들과 함께 성과를 만들어가는 협업 능력이 탁월함."
  ],
  "적극성": [
    "수업 시간 다양한 질문과 창의적인 아이디어를 주도적으로 제시하며, 학급 행사에 열정적으로 참여하여 활력을 불어넣음.",
    "새로운 배움과 낯선 과제에도 두려움 없이 도전하며, 학급 활동에 적극적으로 앞장서 참여하는 긍정적인 에너지를 지님."
  ],
  "정리정돈": [
    "자신의 책상과 사물함 등 주변 환경을 항상 정갈하게 유지하며, 교실의 공용 물건도 소중히 다루어 쾌적한 교실 환경 조성에 모범이 됨.",
    "계획적이고 정돈된 생활 습관을 지니고 있어 학습 준비와 마무리가 철저하며, 공동 물품 관리에도 솔선수범함."
  ],
  "주도성": [
    "선생님의 지시를 기다리기보다 교실 내 필요한 일을 스스로 찾아 행동하는 자발성과 능동적인 생활 태도가 매우 인상적임.",
    "학습 목표를 스스로 설정하고 이를 달성하기 위한 구체적인 실천 방안을 마련하여 자기주도적으로 실천하는 태도가 돋보임."
  ]
};

// 기본 장점 보충 문장 (자기평가 키워드가 적을 때 활용)
const FallbackStrengths = [
  "매사 밝고 긍정적인 태도로 학교생활에 임하며, 교우들과 원만한 관계를 유지함.",
  "수업 활동에 적극적으로 참여하며, 교사의 피드백을 수용하여 한 단계 더 발전하고자 하는 학습 열의를 지님.",
  "학급의 크고 작은 규칙을 모범적으로 준수하며 바른 기본 생활 습관이 잘 형성되어 있음."
];

class RecordDraftGenerator {
  /**
   * 학생 데이터 종합 기반 행발 초안 생성
   * @param {Object} studentSummary - { reflections, assessments, studentNum }
   * @returns {Object} { mode: '3:1' | '4:0', sentences: [...], fullText: '...' }
   */
  static generateDraft(studentSummary) {
    const reflections = studentSummary.reflections || [];
    const assessments = studentSummary.assessments || [];
    const latestAssessment = assessments.length > 0 ? assessments[0] : null;

    const hasReflections = reflections.length > 0;
    const hasGrowthInAssessment = latestAssessment && latestAssessment.growthAreas && latestAssessment.growthAreas.length > 0;

    // 분기 판단: 성찰문이나 자기평가 보완점이 존재하는가?
    const needsGrowthSentence = hasReflections || hasGrowthInAssessment;
    const mode = needsGrowthSentence ? "3:1" : "4:0";

    const sentences = [];

    // 1. 장점 문장 추출 (3문장 또는 4문장)
    const targetStrengthCount = needsGrowthSentence ? 3 : 4;
    const usedTags = new Set();

    // 자기평가 장점에서 추출
    if (latestAssessment && latestAssessment.strengths) {
      for (const item of latestAssessment.strengths) {
        if (sentences.length >= targetStrengthCount) break;
        const tag = item.tag;
        usedTags.add(tag);

        let sentenceText = "";
        if (StrengthTemplates[tag]) {
          // 템플릿 중 하나 선택
          const list = StrengthTemplates[tag];
          sentenceText = list[Math.floor(Math.random() * list.length)];
        } else {
          sentenceText = `평소 ${tag}의 미덕을 바탕으로 주변을 따뜻하게 살피며 모범적인 생활 태도를 실천함.`;
        }

        sentences.push({
          type: "strength",
          tag: tag,
          text: sentenceText,
          sourceLabel: `자기평가 장점 [${tag}]`,
          sourceDetail: item.reason || "학생 자기평가 기록"
        });
      }
    }

    // 장점 개수가 부족하면 일반 장점 템플릿에서 중복 없이 보충
    const availableTags = Object.keys(StrengthTemplates).filter(t => !usedTags.has(t));
    while (sentences.length < targetStrengthCount) {
      if (availableTags.length > 0) {
        const nextTag = availableTags.shift();
        const list = StrengthTemplates[nextTag];
        const pickedText = list[0];
        sentences.push({
          type: "strength",
          tag: nextTag,
          text: pickedText,
          sourceLabel: `학급 생활 관찰 [${nextTag}]`,
          sourceDetail: "기본 생활 습관 및 수업 참여도 관찰"
        });
      } else {
        const fallback = FallbackStrengths[sentences.length % FallbackStrengths.length];
        sentences.push({
          type: "strength",
          tag: "기본태도",
          text: fallback,
          sourceLabel: "기본 생활 태도",
          sourceDetail: "학급 공통 관찰"
        });
      }
    }

    // 2. 단점(보완점) 문장 생성 (3:1 모드일 때 1문장 추가)
    if (needsGrowthSentence) {
      let growthSentence = null;

      // 성찰문이 있는 경우: 성찰문의 다짐(q6, q7 또는 q5, q6)을 반영한 완곡 순화 문장 생성
      if (hasReflections) {
        const latestRef = reflections[0]; // 가장 최근 사안
        const isConflict = latestRef.type === "conflict";
        const refDate = latestRef.createdAt ? new Date(latestRef.createdAt).toLocaleDateString() : "최근";

        if (isConflict) {
          const pledge = latestRef.answers ? (latestRef.answers.q4 || latestRef.answers.q7 || '') : '';
          const wish = latestRef.answers ? (latestRef.answers.q5 || '') : '';
          const fault = latestRef.answers ? (latestRef.answers.q2 || latestRef.answers.q6 || '') : '';

          const conflictTemplates = [
            "교우 관계에서 자신의 생각과 감정을 적극적으로 표현하는 편이나, 다툼이나 의견 차이가 발생했을 때 자신의 잘못을 솔직하게 인정하고 상대방의 입장을 먼저 배려하며 차분한 대화로 갈등을 해결하고자 노력하는 성숙한 소통 자세를 보여줌.",
            "친구들과의 상호작용 과정에서 발생한 갈등 상황을 회피하지 않고 원인을 객관적으로 돌아보며, 그 순간으로 돌아간다면 화를 내기보다 경청과 양보를 실천하겠다는 구체적인 다짐을 세우는 등 관계 회복 역량을 발전시켜 나가고 있음.",
            "자기표현이 명확하여 교우 관계를 주도하는 장점이 있는 반면, 갈등 상황에서 상대방의 마음을 헤아리며 서로 사과하고 오해를 풀고자 먼저 다가가는 태도를 형성해 가고 있어 앞으로의 성장이 기대됨."
          ];
          const selectedText = conflictTemplates[Math.floor(Math.random() * conflictTemplates.length)];

          growthSentence = {
            type: "growth",
            tag: "교우관계·갈등해결",
            text: selectedText,
            sourceLabel: `성찰문 근거 (${refDate} 갈등형 사안)`,
            sourceDetail: pledge ? `대안적 행동 다짐: "${pledge}"` : (wish ? `상대에게 바라는 점: "${wish}"` : "갈등 상황 성찰 기록")
          };
        } else {
          growthSentence = {
            type: "growth",
            tag: "자율규칙준수",
            text: "다양한 활동에 의욕을 가지고 참여하는 과정에서 사소한 규칙을 놓치는 경우가 있었으나, 스스로의 행동을 진솔하게 되돌아보고 바람직한 행동을 실천하고자 다짐하는 등 자율적 규칙 준수 역량이 날로 향상되고 있음.",
            sourceLabel: `성찰문 근거 (${refDate} 개인형 사안)`,
            sourceDetail: latestRef.answers ? `다짐: "${latestRef.answers.q6 || latestRef.answers.q5 || ''}"` : "성찰 기록"
          };
        }
      } 
      // 성찰문은 없지만 자기평가에 보완점 키워드가 있는 경우
      else if (hasGrowthInAssessment) {
        const growthItem = latestAssessment.growthAreas[0];
        const tag = growthItem.tag;
        let euphemism = EuphemismDictionary[tag];

        if (!euphemism) {
          for (const key of Object.keys(EuphemismDictionary)) {
            if (tag.includes(key) || (growthItem.reason && growthItem.reason.includes(key))) {
              euphemism = EuphemismDictionary[key];
              break;
            }
          }
        }

        if (!euphemism) {
          euphemism = `평소 다양한 활동에 적극적인 학생으로, ${tag} 관련하여 스스로 부족한 점을 인지하고 바른 습관을 형성하기 위해 지속적인 개선 노력을 기울이고 있음.`;
        }

        growthSentence = {
          type: "growth",
          tag: tag,
          text: euphemism,
          sourceLabel: `자기평가 보완점 [${tag}]`,
          sourceDetail: growthItem.reason || "학생 자기평가 개선 의지"
        };
      }

      if (growthSentence) {
        sentences.push(growthSentence);
      }
    }

    const fullText = sentences.map(s => s.text).join(" ");

    return {
      mode,
      summary: needsGrowthSentence 
        ? "성찰문/보완점 기록이 반영된 3:1(장점 3 + 완곡 보완점 1) 구성 초안입니다." 
        : "사안 기록이 없는 모범 학생으로, 억지 단점을 배제한 4:0(장점 4) 구성 초안입니다.",
      sentences,
      fullText
    };
  }
}

window.RecordDraftGenerator = RecordDraftGenerator;
